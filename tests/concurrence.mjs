/**
 * Deux clients commandent le dernier exemplaire en meme temps.
 *
 * Reproduit la transaction de placeOrder (SELECT ... FOR UPDATE puis
 * decrement) et la lance deux fois en parallele. Exactement une commande doit
 * passer, et le stock doit finir a zero, jamais en negatif.
 *
 * C'est precisement ce que l'ancien stockage en fichier JSON ne pouvait pas
 * garantir : les deux commandes lisaient "1 en stock" avant que l'une ait
 * ecrit, et les deux passaient.
 */
import postgres from "postgres";
import { randomUUID } from "node:crypto";

const sql = postgres(process.env.DATABASE_URL, { ssl: false, prepare: false });

const PRODUCT = "p-001";

async function commander(etiquette) {
  try {
    return await sql.begin(async (tx) => {
      const [produit] = await tx`
        SELECT id, name, price, stock FROM products
        WHERE id = ${PRODUCT} AND published = TRUE
        FOR UPDATE
      `;

      if (!produit) throw new Error("produit introuvable");

      // Pause volontaire : sans verrou, les deux transactions liraient le
      // meme stock avant que l'une ait ecrit.
      await new Promise((r) => setTimeout(r, 120));

      if (produit.stock < 1) {
        throw new Error(`stock insuffisant (${produit.stock})`);
      }

      const id = randomUUID();
      await tx`
        INSERT INTO orders (
          id, reference, customer_name, customer_phone,
          delivery_mode, payment_method, total, status
        ) VALUES (
          ${id}, ${"BTH-TEST-" + etiquette}, ${"Client " + etiquette},
          '+225 00 00 00 00', 'retrait', 'especes-retrait',
          ${produit.price}, 'recue'
        )
      `;
      await tx`
        INSERT INTO order_lines (order_id, product_id, name, unit_price, quantity)
        VALUES (${id}, ${produit.id}, ${produit.name}, ${produit.price}, 1)
      `;
      await tx`
        UPDATE products SET stock = stock - 1 WHERE id = ${produit.id}
      `;
      return "acceptee";
    });
  } catch (error) {
    return "refusee : " + error.message;
  }
}

const echecs = [];
function verifier(libelle, condition, detail = "") {
  console.log(`  ${condition ? "OK    " : "ECHEC "} ${libelle} ${detail}`);
  if (!condition) echecs.push(libelle);
}

// Stock a 1 exemplaire, table des commandes nettoyee
await sql`DELETE FROM orders WHERE reference LIKE 'BTH-TEST-%'`;
await sql`UPDATE products SET stock = 1 WHERE id = ${PRODUCT}`;

console.log("\n===== Deux commandes simultanees sur le dernier exemplaire =====");
const [a, b] = await Promise.all([commander("A"), commander("B")]);
console.log(`  client A : ${a}`);
console.log(`  client B : ${b}`);

const acceptees = [a, b].filter((r) => r === "acceptee").length;
const [{ stock }] = await sql`SELECT stock FROM products WHERE id = ${PRODUCT}`;
const [{ count }] = await sql`
  SELECT count(*)::int AS count FROM orders WHERE reference LIKE 'BTH-TEST-%'
`;

verifier("une seule commande est acceptee", acceptees === 1, `(${acceptees})`);
verifier("le stock tombe a zero", stock === 0, `(${stock})`);
verifier("le stock ne passe jamais en negatif", stock >= 0, `(${stock})`);
verifier("une seule commande est enregistree", count === 1, `(${count})`);

console.log("\n===== Le stock ne peut pas descendre sous zero =====");
try {
  await sql`UPDATE products SET stock = -1 WHERE id = ${PRODUCT}`;
  verifier("la base refuse un stock negatif", false, "(accepte !)");
} catch {
  verifier("la base refuse un stock negatif", true);
}

console.log("\n===== Le prix barre doit rester superieur au prix de vente =====");
try {
  // Le prix barre du trepied est a 29000 : passer le prix au-dessus doit echouer.
  await sql`UPDATE products SET price = 30000 WHERE id = ${PRODUCT}`;
  verifier("la base refuse un prix superieur au prix barre", false, "(accepte !)");
} catch {
  verifier("la base refuse un prix superieur au prix barre", true);
}

console.log("\n===== Les commandes gardent le prix pratique =====");
const [ligne] = await sql`
  SELECT ol.unit_price, p.price AS prix_actuel
  FROM order_lines ol JOIN products p ON p.id = ol.product_id
  WHERE ol.product_id = ${PRODUCT} LIMIT 1
`;
await sql`UPDATE products SET price = price + 1000 WHERE id = ${PRODUCT}`;
const [apres] = await sql`
  SELECT unit_price FROM order_lines WHERE product_id = ${PRODUCT} LIMIT 1
`;
verifier(
  "un changement de prix ne reecrit pas l'historique",
  apres.unit_price === ligne.unit_price,
  `(${ligne.unit_price} -> ${apres.unit_price})`
);

// Remise en etat
await sql`DELETE FROM orders WHERE reference LIKE 'BTH-TEST-%'`;
await sql`UPDATE products SET stock = 18, price = 24500 WHERE id = ${PRODUCT}`;

console.log(
  `\n===== BILAN : ${echecs.length === 0 ? "tout est conforme" : echecs.length + " echec(s)"} =====\n`
);
await sql.end();
process.exit(echecs.length ? 1 : 0);
