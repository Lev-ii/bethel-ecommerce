import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db/client";
import { invoiceToken } from "@/lib/shop/invoice";
import {
  countReviewsByStatus,
  getOrderForReview,
  getPublishedReviews,
  getReviewsForAdmin,
  moderateReview,
  submitReview,
} from "@/lib/shop/review-store";
import { ReviewError } from "@/lib/shop/reviews";

/**
 * Avis clients contre un vrai PostgreSQL : seul l'acheteur d'une commande
 * livree peut noter, un avis par produit, publication apres moderation.
 *
 * Commandes BTH-AVIS-*, produits avis-test-*, tout est efface a la fin.
 */

const admin = { id: "admin-avis", email: "admin@avis.test" };
const client = { id: "client-avis", email: "client@avis.test", name: "Client", role: "CLIENT" as const };
const good = { rating: 5, body: "Très stable, parfait pour mes lives.", authorName: "Aminata K." };

async function purge() {
  await sql`DELETE FROM orders WHERE reference LIKE 'BTH-AVIS-%'`;
  await sql`DELETE FROM products WHERE id LIKE 'avis-test-%'`;
  await sql`DELETE FROM users WHERE id = ${client.id}`;
  await sql.begin(async (tx) => {
    await tx`SET LOCAL bethel.audit_purge = 'on'`;
    await tx`DELETE FROM audit_logs WHERE actor_id = ${admin.id}`;
  });
}

async function order(reference: string, status: string, productIds: string[], userId: string | null = null) {
  const id = `avis-${reference}`;
  await sql`
    INSERT INTO orders (id, reference, user_id, customer_name, customer_phone, delivery_mode, payment_method, total, status)
    VALUES (${id}, ${reference}, ${userId}, 'Aminata Koné', '+225 01', 'retrait', 'especes-retrait', 1000, ${status})
  `;
  for (const productId of productIds) {
    await sql`INSERT INTO order_lines (order_id, product_id, name, unit_price, quantity) VALUES (${id}, ${productId}, ${"Nom " + productId}, 1000, 1)`;
  }
}

function codeOf(promise: Promise<unknown>) {
  return promise.then(
    () => "ok",
    (error) => (error instanceof ReviewError ? error.code : String(error))
  );
}

beforeAll(async () => {
  await purge();
  const [category] = await sql<Array<{ slug: string }>>`SELECT slug FROM categories ORDER BY position LIMIT 1`;
  for (const id of ["avis-test-a", "avis-test-b"]) {
    await sql`
      INSERT INTO products (id, slug, name, brand, category, headline, price, stock, image, published)
      VALUES (${id}, ${id}, ${"Produit " + id}, 'Test', ${category.slug}, 'Accroche', 1000, 5, '/produits/sans-photo.svg', TRUE)
    `;
  }
  await sql`INSERT INTO users (id, email, name, password_hash, role) VALUES (${client.id}, ${client.email}, 'Client', 'x:y', 'CLIENT')`;
});

beforeEach(async () => {
  await sql`DELETE FROM orders WHERE reference LIKE 'BTH-AVIS-%'`;
});

afterAll(async () => {
  await purge();
  await sql.end();
});

const REF = "BTH-AVIS-0001";

describe("dépôt d'un avis", () => {
  it("l'acheteur d'une commande livrée note un produit : avis en attente de validation", async () => {
    await order(REF, "livree", ["avis-test-a", "avis-test-b"]);

    await submitReview({ reference: REF, token: invoiceToken(REF), user: null, productId: "avis-test-a", raw: good });

    const current = await getOrderForReview(REF);
    expect(current!.items.find((i) => i.productId === "avis-test-a")!.review).toEqual({ status: "en_attente", rating: 5 });
    expect(current!.items.find((i) => i.productId === "avis-test-b")!.review).toBeNull();
    expect((await getPublishedReviews("avis-test-a")).count).toBe(0);
  });

  it("le client connecté propriétaire de la commande peut noter sans le lien", async () => {
    await order(REF, "livree", ["avis-test-a"], client.id);
    expect(await codeOf(submitReview({ reference: REF, user: client, productId: "avis-test-a", raw: good }))).toBe("ok");
  });

  it.each([
    ["sans jeton ni compte", { token: undefined, user: null }],
    ["jeton d'une autre commande", { token: invoiceToken("BTH-AVIS-9999"), user: null }],
    ["un autre client connecté", { token: undefined, user: { ...client, id: "quelqu-un-d-autre" } }],
    ["l'administration", { token: undefined, user: { id: admin.id, email: admin.email, name: "Admin", role: "ADMIN" as const } }],
  ])("refuse : %s", async (_label, who) => {
    await order(REF, "livree", ["avis-test-a"], client.id);
    expect(await codeOf(submitReview({ reference: REF, productId: "avis-test-a", raw: good, ...who }))).toBe("acces");
  });

  it.each(["recue", "expediee", "annulee"])("refuse une commande %s", async (status) => {
    await order(REF, status, ["avis-test-a"]);
    expect(await codeOf(submitReview({ reference: REF, token: invoiceToken(REF), user: null, productId: "avis-test-a", raw: good }))).toBe(
      "non-livree"
    );
  });

  it("refuse un produit absent de la commande, et un second avis sur le même produit", async () => {
    await order(REF, "livree", ["avis-test-a"]);
    const base = { reference: REF, token: invoiceToken(REF), user: null };
    expect(await codeOf(submitReview({ ...base, productId: "avis-test-b", raw: good }))).toBe("produit");
    expect(await codeOf(submitReview({ ...base, productId: "avis-test-a", raw: good }))).toBe("ok");
    expect(await codeOf(submitReview({ ...base, productId: "avis-test-a", raw: good }))).toBe("deja");
  });

  it("deux envois simultanés n'enregistrent qu'un avis", async () => {
    await order(REF, "livree", ["avis-test-a"]);
    const send = () => codeOf(submitReview({ reference: REF, token: invoiceToken(REF), user: null, productId: "avis-test-a", raw: good }));
    const results = await Promise.all([send(), send(), send()]);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM reviews r JOIN orders o ON o.id = r.order_id WHERE o.reference = ${REF}`;
    expect(n).toBe(1);
  });

  it.each([
    [{ ...good, rating: 0 }, "note"],
    [{ ...good, rating: 6 }, "note"],
    [{ ...good, body: "Bof" }, "texte"],
    [{ ...good, authorName: "" }, "nom"],
  ])("refuse une saisie invalide %j", async (raw, code) => {
    await order(REF, "livree", ["avis-test-a"]);
    expect(await codeOf(submitReview({ reference: REF, token: invoiceToken(REF), user: null, productId: "avis-test-a", raw }))).toBe(code);
  });
});

describe("modération", () => {
  it("publier rend l'avis visible et compte dans la moyenne ; refuser le retire sans l'effacer", async () => {
    await order(REF, "livree", ["avis-test-a"]);
    await order("BTH-AVIS-0002", "livree", ["avis-test-a"]);
    await submitReview({ reference: REF, token: invoiceToken(REF), user: null, productId: "avis-test-a", raw: good });
    await submitReview({
      reference: "BTH-AVIS-0002",
      token: invoiceToken("BTH-AVIS-0002"),
      user: null,
      productId: "avis-test-a",
      raw: { ...good, rating: 4 },
    });
    const pending = (await getReviewsForAdmin("en_attente")).filter((r) => r.productId === "avis-test-a");
    expect(pending).toHaveLength(2);

    for (const review of pending) expect(await moderateReview(admin, review.id, "publie")).toEqual({ productSlug: "avis-test-a" });
    expect(await getPublishedReviews("avis-test-a")).toMatchObject({ average: 4.5, count: 2 });

    await moderateReview(admin, pending[0].id, "refuse");
    expect((await getPublishedReviews("avis-test-a")).count).toBe(1);
    expect((await countReviewsByStatus()).refuse).toBeGreaterThanOrEqual(1);
    // Refuse n'est pas efface.
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM reviews WHERE id = ${pending[0].id}`;
    expect(n).toBe(1);

    const actions = await sql<Array<{ action: string }>>`SELECT action FROM audit_logs WHERE actor_id = ${admin.id} ORDER BY id`;
    expect(actions.map((a) => a.action)).toEqual(["review.published", "review.published", "review.rejected"]);
    // Meme decision deux fois : rien n'est reecrit.
    expect(await moderateReview(admin, pending[0].id, "refuse")).toBeNull();
  });
});
