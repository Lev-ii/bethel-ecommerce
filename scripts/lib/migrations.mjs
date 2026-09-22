/**
 * Lanceur de migrations versionnees.
 *
 * Une migration est un fichier db/migrations/NNNN_nom.sql. Chaque migration
 * appliquee est inscrite, avec l'empreinte SHA-256 de son contenu, dans une
 * table d'historique.
 *
 * Garanties :
 *  - Tout un lancement tient dans UNE transaction, sous verrou consultatif :
 *    soit toutes les migrations en attente passent, soit aucune. Deux
 *    lancements simultanes ne peuvent pas s'entrelacer. Le verrou est de
 *    niveau transaction, donc compatible avec le pooler de Supabase.
 *  - Une migration deja appliquee ne peut pas etre modifiee : son empreinte
 *    ne correspondrait plus, et le lancement s'arrete.
 *  - Une base qui a deja des tables mais aucun historique n'est jamais
 *    migree par surprise : il faut marquer explicitement l'etat existant
 *    (option baseline).
 *
 * Consequence : une migration ne peut pas contenir BEGIN, COMMIT, ni
 * d'instruction interdite en transaction (CREATE INDEX CONCURRENTLY...).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const FILE = /^(\d{4})_([a-z0-9_]+)\.sql$/;
const IDENT = /^[a-z_][a-z0-9_]*$/;

export class MigrationError extends Error {}

class DryRun {
  constructor(plan) {
    this.plan = plan;
  }
}

function checksum(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/** Lit et valide les fichiers de migration, tries par version. */
export function readMigrations(dir) {
  const entries = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const seen = new Map();
  return entries.map((file) => {
    const match = file.match(FILE);
    if (!match) {
      throw new MigrationError(`Nom de migration invalide : ${file}. Format attendu : 0002_nom_en_minuscules.sql`);
    }
    const [, version, name] = match;
    if (seen.has(version)) {
      throw new MigrationError(`Deux migrations portent la version ${version} : ${seen.get(version)} et ${file}.`);
    }
    seen.set(version, file);
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    // Instruction de controle de transaction, terminee par un point-virgule : le
    // BEGIN d'un bloc PL/pgSQL, lui, n'en a pas et reste permis.
    if (/^\s*(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)(\s+(WORK|TRANSACTION))?\s*;/im.test(content)) {
      throw new MigrationError(`${file} gere lui-meme une transaction : c'est le lanceur qui s'en charge.`);
    }
    return { version, name, file, content, checksum: checksum(content) };
  });
}

/**
 * Applique les migrations en attente.
 *
 * @param sql        client postgres.js
 * @param options.dir         dossier des migrations
 * @param options.table       table d'historique (defaut schema_migrations)
 * @param options.baseline    version jusqu'a laquelle marquer l'existant
 *                            comme applique, sans l'executer
 * @param options.legacyTable table dont la presence signale une base deja
 *                            structuree (defaut orders) ; null pour ignorer
 * @param options.dryRun      calcule le plan sans rien ecrire
 * @param options.allowNewerApplied tolere des migrations appliquees absentes
 *                            du dossier si elles sont TOUTES plus recentes que
 *                            le dernier fichier : base partagee (staging) deja
 *                            migree par une branche plus avancee. Reserve aux
 *                            preversions ; ailleurs, c'est une erreur.
 * @returns { alreadyApplied, baselined, ran, ahead } — listes de versions
 */
export async function runMigrations(sql, options) {
  const {
    dir,
    table = "schema_migrations",
    baseline,
    legacyTable = "orders",
    dryRun = false,
    allowNewerApplied = false,
  } = options;
  if (!IDENT.test(table)) throw new MigrationError(`Nom de table d'historique invalide : ${table}`);
  const files = readMigrations(dir);

  try {
    return await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`bethel:migrations:${table}`}))`;
      await tx.unsafe(`
        CREATE TABLE IF NOT EXISTS ${table} (
          version    TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          checksum   TEXT NOT NULL,
          baselined  BOOLEAN NOT NULL DEFAULT FALSE,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

      const allApplied = await tx.unsafe(`SELECT version, checksum FROM ${table} ORDER BY version`);
      const byVersion = new Map(files.map((f) => [f.version, f]));
      const lastFile = files.at(-1)?.version;
      // Base en avance sur cette branche : migrations posees par une branche
      // plus recente. Tolere seulement au-dela du dernier fichier, jamais un
      // trou au milieu de l'historique.
      const ahead = allApplied.filter(
        (row) => allowNewerApplied && !byVersion.has(row.version) && (!lastFile || row.version > lastFile)
      );
      const applied = allApplied.filter((row) => !ahead.includes(row));
      for (const row of applied) {
        const file = byVersion.get(row.version);
        if (!file) {
          throw new MigrationError(`La migration ${row.version} est inscrite comme appliquee, mais son fichier a disparu.`);
        }
        if (file.checksum !== row.checksum) {
          throw new MigrationError(
            `${file.file} a ete modifiee apres avoir ete appliquee. ` +
              "Ne modifiez jamais une migration appliquee : ecrivez-en une nouvelle."
          );
        }
      }

      const appliedVersions = new Set(applied.map((r) => r.version));
      let pending = files.filter((f) => !appliedVersions.has(f.version));
      const latest = applied.at(-1)?.version;
      const late = latest ? pending.filter((f) => f.version < latest) : [];
      if (late.length > 0) {
        throw new MigrationError(
          `${late.map((f) => f.file).join(", ")} porte une version anterieure a la derniere appliquee (${latest}). ` +
            "Renumerotez-la apres elle."
        );
      }

      let baselined = [];
      if (baseline) {
        if (applied.length > 0) {
          throw new MigrationError("L'option baseline ne s'utilise que sur une base sans historique de migration.");
        }
        if (!byVersion.has(baseline)) throw new MigrationError(`Version de baseline inconnue : ${baseline}`);
        baselined = pending.filter((f) => f.version <= baseline);
        pending = pending.filter((f) => f.version > baseline);
      } else if (applied.length === 0 && legacyTable) {
        const [{ exists }] = await tx`SELECT to_regclass(${`public.${legacyTable}`}) IS NOT NULL AS exists`;
        if (exists) {
          throw new MigrationError(
            `La base contient deja des tables (${legacyTable}) mais aucun historique de migration. ` +
              "Rien n'a ete execute. Si sa structure correspond a une version, marquez-la : " +
              "npm run db:migrate -- --baseline=0001"
          );
        }
      }

      const plan = {
        alreadyApplied: applied.map((r) => r.version),
        baselined: baselined.map((f) => f.version),
        ran: pending.map((f) => f.version),
        ahead: ahead.map((r) => r.version),
      };
      if (dryRun) throw new DryRun(plan);

      for (const f of baselined) {
        await tx.unsafe(`INSERT INTO ${table} (version, name, checksum, baselined) VALUES ($1, $2, $3, TRUE)`, [
          f.version,
          f.name,
          f.checksum,
        ]);
      }
      for (const f of pending) {
        try {
          await tx.unsafe(f.content);
        } catch (error) {
          throw new MigrationError(`Echec de ${f.file}, aucune migration de ce lancement n'est appliquee : ${error.message}`);
        }
        await tx.unsafe(`INSERT INTO ${table} (version, name, checksum) VALUES ($1, $2, $3)`, [f.version, f.name, f.checksum]);
      }
      return plan;
    });
  } catch (error) {
    if (error instanceof DryRun) return error.plan;
    throw error;
  }
}
