/**
 * Mise en place de la base : schema, categories, donnees de demonstration,
 * compte administrateur.
 *
 * Idempotent : on peut le relancer apres chaque deploiement sans se demander
 * dans quel etat se trouve la base.
 *
 *   npm run db:setup            structure + donnees si la base est vide
 *   npm run db:setup -- --force remet les donnees de demonstration a zero
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID, randomBytes, scrypt } from "node:crypto";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL n'est pas defini. Renseignez-le dans .env");
  process.exit(1);
}

const force = process.argv.includes("--force");
const local = url.includes("localhost") || url.includes("127.0.0.1");
const sql = postgres(url, {
  ssl: local ? false : "require",
  prepare: false,
  // Le schema est idempotent : PostgreSQL signale chaque "existe deja, je
  // passe" par un NOTICE. C'est le fonctionnement attendu, pas un probleme.
  // Les afficher noierait le vrai resultat sous une douzaine de blocs.
  // Tout ce qui est plus grave qu'un NOTICE remonte quand meme en exception.
  onnotice: () => {},
});

const hash = (password) =>
  new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, 64, (err, key) =>
      err ? reject(err) : resolve(`${salt}:${key.toString("hex")}`)
    );
  });

// Les donnees de demonstration sont lues depuis les sources TypeScript, pour
// n'avoir qu'un seul endroit ou les maintenir.
function readSeed(file, exportName) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src", "lib", "data", file),
    "utf8"
  );
  const start = source.indexOf(`export const ${exportName}`);
  if (start === -1) throw new Error(`${exportName} introuvable dans ${file}`);

  // Le crochet a viser est celui qui suit le signe egal. Chercher le premier
  // "[" apres le nom attraperait celui de l'annotation de type "Category[]".
  const equals = source.indexOf("=", start);
  const open = source.indexOf("[", equals);
  let depth = 0;
  let end = open;
  let inString = null;
  for (let i = open; i < source.length; i += 1) {
    const c = source[i];
    if (inString) {
      if (c === "\\") i += 1;
      else if (c === inString) inString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") inString = c;
    else if (c === "[") depth += 1;
    else if (c === "]") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return eval(source.slice(open, end + 1));
}

try {
  console.log("1/4  Structure de la base...");
  await sql.unsafe(
    fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8")
  );

  console.log("2/4  Categories...");
  const categories = readSeed("catalog.ts", "categories");
  for (const [i, c] of categories.entries()) {
    await sql`
      INSERT INTO categories (slug, name, tagline, position)
      VALUES (${c.slug}, ${c.name}, ${c.tagline}, ${i})
      ON CONFLICT (slug) DO UPDATE
        SET name = EXCLUDED.name, tagline = EXCLUDED.tagline, position = EXCLUDED.position
    `;
  }

  const [{ count }] = await sql`SELECT count(*)::text AS count FROM products`;
  if (Number(count) > 0 && !force) {
    console.log("3/4  Catalogue deja rempli, rien a faire.");
  } else {
    console.log("3/4  Catalogue et commandes de demonstration...");
    const products = readSeed("catalog.ts", "products");
    const orders = readSeed("orders.ts", "orders");

    await sql.begin(async (tx) => {
      await tx`DELETE FROM orders`;
      await tx`DELETE FROM products`;

      for (const [i, p] of products.entries()) {
        await tx`
          INSERT INTO products (
            id, slug, name, brand, category, headline, description,
            price, compare_at_price, stock, low_stock_threshold,
            image, featured, is_hero, published, created_at
          ) VALUES (
            ${p.id}, ${p.slug}, ${p.name}, ${p.brand}, ${p.category},
            ${p.headline}, ${p.description}, ${p.price},
            ${p.compareAtPrice ?? null}, ${p.stock}, ${p.lowStockThreshold},
            ${p.image}, ${p.featured ?? false}, ${p.isHero ?? false}, ${p.published},
            now() + ${i + " seconds"}::interval
          )
        `;
        for (const [position, s] of p.specs.entries()) {
          await tx`
            INSERT INTO product_specs (product_id, label, value, position)
            VALUES (${p.id}, ${s.label}, ${s.value}, ${position})
          `;
        }
      }

      for (const o of orders) {
        await tx`
          INSERT INTO orders (
            id, reference, customer_name, customer_phone, customer_email,
            delivery_mode, address, city, payment_method, total, status, created_at
          ) VALUES (
            ${o.id}, ${o.reference}, ${o.customerName}, ${o.customerPhone},
            ${o.customerEmail ?? null}, ${o.deliveryMode}, ${o.address ?? null},
            ${o.city ?? null}, ${o.paymentMethod}, ${o.total}, ${o.status}, ${o.createdAt}
          )
        `;
        for (const l of o.lines) {
          await tx`
            INSERT INTO order_lines (order_id, product_id, name, unit_price, quantity)
            VALUES (${o.id}, ${l.productId}, ${l.name}, ${l.unitPrice}, ${l.quantity})
          `;
        }
      }
    });
  }

  console.log("4/4  Compte administrateur...");
  const [{ count: admins }] =
    await sql`SELECT count(*)::text AS count FROM users WHERE role = 'ADMIN'`;
  if (Number(admins) > 0) {
    console.log("     Un administrateur existe deja.");
  } else {
    await sql`
      INSERT INTO users (id, email, name, password_hash, role)
      VALUES (${randomUUID()}, 'admin@bethel.store', 'Administrateur',
              ${await hash("bethel2026")}, 'ADMIN')
      ON CONFLICT (email) DO NOTHING
    `;
    console.log("     admin@bethel.store / bethel2026  — a changer !");
  }

  // Verification finale : plutot que de laisser deviner, on affiche l'etat
  // reel de la base. Les colonnes ajoutees apres coup sont la source d'erreur
  // la plus frequente — le code deploye les attend, la base ne les a pas.
  const [etat] = await sql`
    SELECT
      (SELECT count(*)::int FROM categories) AS categories,
      (SELECT count(*)::int FROM products) AS produits,
      (SELECT count(*)::int FROM orders) AS commandes,
      (SELECT count(*)::int FROM users) AS comptes,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products' AND column_name = 'is_hero'
      ) AS colonne_vedette
  `;

  console.log("\nEtat de la base");
  console.log(`     categories : ${etat.categories}`);
  console.log(`     produits   : ${etat.produits}`);
  console.log(`     commandes  : ${etat.commandes}`);
  console.log(`     comptes    : ${etat.comptes}`);
  console.log(
    `     produit vedette : ${etat.colonne_vedette ? "colonne presente" : "COLONNE MANQUANTE"}`
  );

  if (etat.colonne_vedette) {
    console.log("\nBase prete.");
  } else {
    console.log(
      "\n     La colonne is_hero manque. Le code qui l'attend plantera."
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.error("\nEchec :", error.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
