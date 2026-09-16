import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { sql } from "@/lib/db/client";
import { MigrationError, readMigrations, runMigrations } from "../../scripts/lib/migrations.mjs";

/**
 * Lanceur de migrations contre un vrai PostgreSQL.
 *
 * Chaque test a son propre dossier de migrations, sa propre table d'historique
 * (schema_migrations_tN) et ses propres objets (mig_tN_*), tous supprimes a la
 * fin. Les vraies tables de la boutique ne sont jamais touchees.
 */

const dirs: string[] = [];
let counter = 0;

function setup(files: Record<string, string>) {
  counter += 1;
  const n = counter;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bethel-mig-"));
  dirs.push(dir);
  const write = (name: string, content: string) =>
    fs.writeFileSync(path.join(dir, name), content.replaceAll("{t}", `mig_t${n}`));
  for (const [name, content] of Object.entries(files)) write(name, content);
  const table = `schema_migrations_t${n}`;
  const run = (extra: Record<string, unknown> = {}) =>
    runMigrations(sql, { dir, table, legacyTable: null, ...extra });
  const history = () =>
    sql.unsafe(`SELECT version, baselined FROM ${table} ORDER BY version`) as Promise<
      Array<{ version: string; baselined: boolean }>
    >;
  const exists = async (name: string) => {
    const [row] = await sql`SELECT to_regclass(${`public.mig_t${n}_${name}`}) IS NOT NULL AS exists`;
    return row.exists as boolean;
  };
  return { dir, n, table, write, run, history, exists };
}

afterAll(async () => {
  const leftovers = await sql<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND (tablename LIKE 'mig\\_t%' OR tablename LIKE 'schema\\_migrations\\_t%')
  `;
  for (const { tablename } of leftovers) await sql.unsafe(`DROP TABLE IF EXISTS ${tablename} CASCADE`);
  for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
  await sql.end();
});

describe("application", () => {
  it("applique les migrations dans l'ordre et les inscrit", async () => {
    const m = setup({
      "0001_a.sql": "CREATE TABLE {t}_a (id int);",
      "0002_b.sql": "CREATE TABLE {t}_b (a_id int);",
    });
    expect(await m.run()).toEqual({ alreadyApplied: [], baselined: [], ran: ["0001", "0002"] });
    expect(await m.history()).toEqual([
      { version: "0001", baselined: false },
      { version: "0002", baselined: false },
    ]);
    expect(await m.exists("b")).toBe(true);
  });

  it("ne rejoue rien au second lancement", async () => {
    const m = setup({ "0001_a.sql": "CREATE TABLE {t}_a (id int);" });
    await m.run();
    expect(await m.run()).toEqual({ alreadyApplied: ["0001"], baselined: [], ran: [] });
  });

  it("n'applique que la nouvelle migration ajoutee ensuite", async () => {
    const m = setup({ "0001_a.sql": "CREATE TABLE {t}_a (id int);" });
    await m.run();
    m.write("0002_b.sql", "CREATE TABLE {t}_b (id int);");
    expect((await m.run()).ran).toEqual(["0002"]);
  });
});

describe("atomicite", () => {
  it("n'applique rien du lancement si une migration echoue au milieu", async () => {
    const m = setup({
      "0001_a.sql": "CREATE TABLE {t}_a (id int);",
      "0002_casse.sql": "CREATE TABLE {t}_b (id int); SELECT colonne_inexistante FROM {t}_a;",
    });
    await expect(m.run()).rejects.toThrow(/0002_casse\.sql/);
    // Ni la 0001 qui avait reussi, ni la table creee par la 0002 avant l'erreur.
    expect(await m.exists("a")).toBe(false);
    expect(await m.exists("b")).toBe(false);
    const [row] = await sql`SELECT to_regclass(${`public.${m.table}`}) IS NOT NULL AS exists`;
    expect(row.exists).toBe(false);
  });
});

describe("protections", () => {
  it("refuse une migration modifiee apres application", async () => {
    const m = setup({ "0001_a.sql": "CREATE TABLE {t}_a (id int);" });
    await m.run();
    m.write("0001_a.sql", "CREATE TABLE {t}_a (id int, ajout text);");
    await expect(m.run()).rejects.toThrow(/modifiee apres avoir ete appliquee/);
  });

  it("refuse une migration numerotee avant la derniere appliquee", async () => {
    const m = setup({ "0001_a.sql": "SELECT 1;", "0003_c.sql": "SELECT 1;" });
    await m.run();
    m.write("0002_b.sql", "SELECT 1;");
    await expect(m.run()).rejects.toThrow(/anterieure a la derniere appliquee/);
  });

  it("refuse d'executer quoi que ce soit sur une base existante sans historique", async () => {
    const m = setup({ "0001_initial.sql": "CREATE TABLE {t}_existante (id int);" });
    await sql.unsafe(`CREATE TABLE mig_t${m.n}_existante (id int)`);
    await expect(m.run({ legacyTable: `mig_t${m.n}_existante` })).rejects.toThrow(/aucun historique/);
    const [row] = await sql`SELECT to_regclass(${`public.${m.table}`}) IS NOT NULL AS exists`;
    expect(row.exists).toBe(false);
  });

  it("marque l'existant sans l'executer, puis applique la suite", async () => {
    const m = setup({
      // Si elle etait executee, cette migration echouerait : la table existe deja.
      "0001_initial.sql": "CREATE TABLE {t}_existante (id int);",
      "0002_suite.sql": "ALTER TABLE {t}_existante ADD COLUMN ajout text;",
    });
    await sql.unsafe(`CREATE TABLE mig_t${m.n}_existante (id int)`);
    expect(await m.run({ legacyTable: `mig_t${m.n}_existante`, baseline: "0001" })).toEqual({
      alreadyApplied: [],
      baselined: ["0001"],
      ran: ["0002"],
    });
    expect(await m.history()).toEqual([
      { version: "0001", baselined: true },
      { version: "0002", baselined: false },
    ]);
  });

  it("refuse une migration qui gere elle-meme sa transaction", () => {
    const m = setup({ "0001_a.sql": "BEGIN;\nCREATE TABLE {t}_a (id int);\nCOMMIT;" });
    expect(() => readMigrations(m.dir)).toThrow(MigrationError);
  });

  it("refuse deux migrations de meme version et un nom mal forme", () => {
    const doublon = setup({ "0001_a.sql": "SELECT 1;", "0001_b.sql": "SELECT 1;" });
    expect(() => readMigrations(doublon.dir)).toThrow(/meme version|portent la version/);
    const mal = setup({ "2_Mauvais-Nom.sql": "SELECT 1;" });
    expect(() => readMigrations(mal.dir)).toThrow(/Nom de migration invalide/);
  });
});

describe("simulation", () => {
  it("donne le plan sans rien ecrire", async () => {
    const m = setup({ "0001_a.sql": "CREATE TABLE {t}_a (id int);" });
    expect(await m.run({ dryRun: true })).toEqual({ alreadyApplied: [], baselined: [], ran: ["0001"] });
    expect(await m.exists("a")).toBe(false);
    const [row] = await sql`SELECT to_regclass(${`public.${m.table}`}) IS NOT NULL AS exists`;
    expect(row.exists).toBe(false);
  });
});

describe("migrations du depot", () => {
  it("sont toutes lisibles et bien formees", () => {
    const files = readMigrations(path.join(process.cwd(), "db", "migrations"));
    expect(files[0]?.file).toBe("0001_schema_initial.sql");
  });
});
