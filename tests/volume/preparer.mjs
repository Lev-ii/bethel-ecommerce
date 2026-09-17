/**
 * Base de volume : donnees de demonstration, puis un volume realiste de
 * plusieurs annees d'activite, genere en SQL.
 *
 *   E2E_VOLUME_URL=postgresql://localhost:5432/bethel_volume node tests/volume/preparer.mjs
 *
 * Refuse toute base non locale ou dont le nom ne contient pas "volume" :
 * la preparation efface tout.
 */

import { execFileSync } from "node:child_process";
import postgres from "postgres";

export const VOLUME = { products: 2_000, orders: 200_000, linesPerOrder: 2, views: 1_000_000, customers: 20_000 };

const url = process.env.VOLUME_DATABASE_URL ?? "postgresql://localhost:5432/bethel_volume";
const target = new URL(url);
const name = target.pathname.slice(1);
if (!["localhost", "127.0.0.1"].includes(target.hostname) || !name.includes("volume")) {
  throw new Error(`Base de volume refusée : ${target.hostname}/${name}.`);
}

const admin = new URL(url);
admin.pathname = "/postgres";
const root = postgres(admin.toString(), { max: 1, onnotice: () => {} });
const [exists] = await root`SELECT 1 FROM pg_database WHERE datname = ${name}`;
if (!exists) await root.unsafe(`CREATE DATABASE "${name}"`);
await root.end();

execFileSync("node", ["scripts/setup-db.mjs", "--force"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });

const sql = postgres(url, { max: 1, onnotice: () => {} });
const started = Date.now();
const step = async (label, query) => {
  const t = Date.now();
  await query;
  console.log(`${label.padEnd(28)} ${((Date.now() - t) / 1000).toFixed(1)} s`);
};

await step("produits", sql`
  INSERT INTO products (id, slug, name, brand, category, headline, price, stock, image, published, created_at)
  SELECT 'vol-p-' || n, 'produit-volume-' || n, 'Produit volume ' || n,
         (ARRAY['Godox','Rode','Ulanzi','Boya','Viltrox'])[1 + n % 5],
         c.slug, 'Accroche du produit ' || n,
         5000 + (n * 7919) % 400000, (n * 31) % 60, '/produits/trepied.jpg',
         n % 10 <> 0, now() - make_interval(days => (n % 900)::int)
  FROM generate_series(1::bigint, ${VOLUME.products}) n
  JOIN LATERAL (SELECT slug FROM categories ORDER BY position OFFSET (n % (SELECT count(*) FROM categories)) LIMIT 1) c ON TRUE
`);

await step("commandes", sql`
  INSERT INTO orders (id, reference, customer_name, customer_phone, delivery_mode, payment_method,
                      total, status, created_at, paid_at, admin_seen_at)
  SELECT 'vol-o-' || n,
         'BTH-VOL-' || lpad(n::text, 6, '0'),
         'Client ' || (n % ${VOLUME.customers}),
         '+225 07 ' || lpad((n % ${VOLUME.customers})::text, 8, '0'),
         CASE WHEN n % 3 = 0 THEN 'retrait' ELSE 'livraison' END,
         (ARRAY['orange','mtn','wave','paiement-livraison','especes-retrait'])[1 + n % 5],
         10000 + (n * 104729) % 500000,
         (ARRAY['livree','livree','livree','livree','expediee','preparee','recue','annulee'])[1 + n % 8],
         created,
         CASE WHEN n % 8 = 7 THEN NULL ELSE created + interval '5 minutes' END,
         created + interval '1 hour'
  FROM generate_series(1::bigint, ${VOLUME.orders}) n,
       LATERAL (SELECT now() - make_interval(secs => (n * 2654435761) % (730 * 86400)) AS created) t
`);

await step("lignes de commande", sql`
  INSERT INTO order_lines (order_id, product_id, name, unit_price, quantity)
  SELECT 'vol-o-' || n, 'vol-p-' || (1 + (n * k * 7) % ${VOLUME.products}),
         'Produit volume ' || (1 + (n * k * 7) % ${VOLUME.products}),
         5000 + (n * k) % 200000, 1 + (n + k) % 3
  FROM generate_series(1::bigint, ${VOLUME.orders}) n, generate_series(1::bigint, ${VOLUME.linesPerOrder}) k
`);

await step("vues produit", sql`
  INSERT INTO product_views (product_id, day, visitor_hash)
  SELECT 'vol-p-' || (1 + (n * 48271) % ${VOLUME.products}),
         (current_date - ((n * 16807) % 730)::int),
         md5(n::text)
  FROM generate_series(1::bigint, ${VOLUME.views}) n
  ON CONFLICT DO NOTHING
`);

await step("statistiques (ANALYZE)", sql`ANALYZE`);
const [counts] = await sql`
  SELECT (SELECT count(*) FROM products) AS produits, (SELECT count(*) FROM orders) AS commandes,
         (SELECT count(*) FROM order_lines) AS lignes, (SELECT count(*) FROM product_views) AS vues,
         pg_size_pretty(pg_database_size(current_database())) AS taille
`;
console.log(counts, `total ${((Date.now() - started) / 1000).toFixed(0)} s`);
await sql.end();
