import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tunnel d'achat contre un vrai PostgreSQL : placeOrder, liberation des
 * reservations et synchronisation du paiement.
 *
 * Jeko est simule au niveau de fetch : le vrai code du prestataire s'execute
 * (construction de la demande, lecture des reponses), sans aucun appel reseau.
 * Les produits de test portent l'identifiant tunnel-*, les commandes le nom
 * "Tunnel test" : tout est efface a la fin.
 */

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/auth/current", () => ({ currentUser: vi.fn(async () => null) }));
vi.mock("@/lib/shop/notifications", () => ({ notifyCustomerLater: vi.fn() }));

const { sql } = await import("@/lib/db/client");
const { placeOrder } = await import("@/lib/shop/actions");
const { releaseExpiredReservations } = await import("@/lib/shop/reservations");
const { syncOrderPayment } = await import("@/lib/shop/payment");
const { deliveryFeeFor } = await import("@/lib/shop/checkout");
const { notifyCustomerLater } = await import("@/lib/shop/notifications");

const host = new URL(process.env.DATABASE_URL ?? "postgresql://x").hostname;
if (host !== "localhost" && host !== "127.0.0.1") {
  throw new Error(`Tests du tunnel d'achat refusés sur une base non locale (${host}) : ils modifient le stock.`);
}

const CUSTOMER = "Tunnel test";
const TRIPOD = "tunnel-trepied";
const MIC = "tunnel-micro";
const HIDDEN = "tunnel-brouillon";

/** Etat du faux Jeko. */
const jeko = {
  down: false,
  createFails: false,
  created: 0,
  /** Retient les verifications jusqu'a ce que ce nombre d'appels soit en cours. */
  holdUntil: 0,
  waiting: [] as Array<() => void>,
  requests: new Map<string, { status: string; amountCents?: number }>(),
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fakeFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  if (!url.startsWith("https://api.jeko.africa/")) throw new Error(`Appel réseau inattendu : ${url}`);
  if (jeko.down) return json(503, { message: "indisponible" });

  if (init?.method === "POST") {
    if (jeko.createFails) return json(500, { message: "erreur interne Jeko" });
    jeko.created += 1;
    const id = `pr-tunnel-${jeko.created}`;
    const body = JSON.parse(String(init.body)) as { amountCents: number };
    jeko.requests.set(id, { status: "pending", amountCents: body.amountCents });
    return json(201, { id, redirectUrl: `https://pay.jeko.africa/${id}` });
  }

  if (jeko.holdUntil > 0) {
    await new Promise<void>((resolve) => {
      jeko.waiting.push(resolve);
      if (jeko.waiting.length >= jeko.holdUntil) jeko.waiting.splice(0).forEach((release) => release());
    });
  }

  const id = decodeURIComponent(url.split("/").pop() ?? "");
  const request = jeko.requests.get(id);
  if (!request) return json(404, { message: "inconnue" });
  return json(200, { id, status: request.status, transaction: { amount: { amount: request.amountCents } } });
});

async function stockOf(id: string) {
  const [row] = await sql<Array<{ stock: number }>>`SELECT stock FROM products WHERE id = ${id}`;
  return row.stock;
}

async function orderByReference(reference: string) {
  const [row] = await sql<
    Array<{ id: string; status: string; total: number; paid_at: Date | null; payment_ref: string | null; payment_error: string | null }>
  >`SELECT id, status, total, paid_at, payment_ref, payment_error FROM orders WHERE reference = ${reference}`;
  return row;
}

async function countTestOrders() {
  const [row] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM orders WHERE customer_name = ${CUSTOMER}`;
  return row.n;
}

/** Vieillit une commande, comme si le client etait parti sans payer. */
async function ageOrder(reference: string, minutes: number) {
  await sql`UPDATE orders SET created_at = now() - make_interval(mins => ${minutes}) WHERE reference = ${reference}`;
}

function onlineOrder(quantity = 1, productId = TRIPOD) {
  return placeOrder({
    customerName: CUSTOMER,
    customerPhone: "+225 07 00 00 00 01",
    deliveryMode: "retrait",
    paymentMethod: "orange",
    items: [{ productId, quantity }],
  });
}

async function purge() {
  await sql`DELETE FROM orders WHERE customer_name = ${CUSTOMER}`;
  await sql`DELETE FROM products WHERE id IN (${TRIPOD}, ${MIC}, ${HIDDEN})`;
}

beforeAll(async () => {
  vi.stubGlobal("fetch", fakeFetch);
  process.env.JEKO_API_KEY = "cle-de-test";
  process.env.JEKO_API_KEY_ID = "id-de-test";
  process.env.JEKO_STORE_ID = "boutique-de-test";

  const [waiting] = await sql<Array<{ n: number }>>`
    SELECT count(*)::int AS n FROM orders WHERE status = 'attente_paiement' AND customer_name <> ${CUSTOMER}
  `;
  if (waiting.n > 0) {
    throw new Error("Des commandes en attente de paiement existent déjà : placeOrder les traiterait. Base de test requise.");
  }

  await purge();
  const [category] = await sql<Array<{ slug: string }>>`SELECT slug FROM categories ORDER BY position LIMIT 1`;
  for (const [id, price, published] of [
    [TRIPOD, 45000, true],
    [MIC, 30000, true],
    [HIDDEN, 10000, false],
  ] as const) {
    await sql`
      INSERT INTO products (id, slug, name, brand, category, headline, price, stock, image, published)
      VALUES (${id}, ${id}, ${`Produit ${id}`}, 'Test', ${category.slug}, 'Produit de test', ${price}, 0, '/test.png', ${published})
    `;
  }
});

beforeEach(async () => {
  await sql`DELETE FROM orders WHERE customer_name = ${CUSTOMER}`;
  await sql`UPDATE products SET stock = 5 WHERE id IN (${TRIPOD}, ${MIC}, ${HIDDEN})`;
  Object.assign(jeko, { down: false, createFails: false, holdUntil: 0 });
  jeko.requests.clear();
  vi.mocked(notifyCustomerLater).mockClear();
});

// Vitest 3 : ne restaure que les espions vi.spyOn (console.error), pas les vi.fn.
afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await purge();
  vi.unstubAllGlobals();
});

describe("réservation à la commande", () => {
  it("paiement en ligne : stock réservé, commande en attente, redirection vers Jeko", async () => {
    const result = await onlineOrder(2);

    expect(result.error).toBeUndefined();
    expect(result.checkoutUrl).toMatch(/^https:\/\/pay\.jeko\.africa\//);
    expect(result.paymentPending).toBe(true);
    expect(await stockOf(TRIPOD)).toBe(3);

    const order = await orderByReference(result.reference!);
    expect(order.status).toBe("attente_paiement");
    expect(order.paid_at).toBeNull();
    expect(order.payment_ref).toMatch(/^pr-tunnel-/);
    // Prix relu en base et converti en centimes pour Jeko.
    expect(order.total).toBe(90000);
    expect(jeko.requests.get(order.payment_ref!)?.amountCents).toBe(9000000);
    // Le client n'est prevenu qu'une fois le paiement confirme.
    expect(notifyCustomerLater).not.toHaveBeenCalled();
  });

  it("paiement à la livraison : commande reçue tout de suite et client prévenu", async () => {
    const result = await placeOrder({
      customerName: CUSTOMER,
      customerPhone: "+225 07 00 00 00 01",
      deliveryMode: "livraison",
      address: "Rue des Jardins",
      city: "Abidjan",
      paymentMethod: "paiement-livraison",
      items: [{ productId: MIC, quantity: 1 }],
    });

    expect(result.error).toBeUndefined();
    expect(result.checkoutUrl).toBeUndefined();
    expect((await orderByReference(result.reference!)).status).toBe("recue");
    expect(await stockOf(MIC)).toBe(4);
    expect(notifyCustomerLater).toHaveBeenCalledWith(result.reference, "commande_recue");
  });

  it("ignore des frais de livraison envoyés par le client", async () => {
    const forged = {
      customerName: CUSTOMER,
      customerPhone: "+225 07 00 00 00 01",
      deliveryMode: "livraison" as const,
      address: "Rue des Jardins",
      city: "Abidjan",
      paymentMethod: "paiement-livraison" as const,
      items: [{ productId: MIC, quantity: 1 }],
      deliveryFee: -50000,
      total: 1,
    };
    const result = await placeOrder(forged);

    expect(result.total).toBe(30000 + deliveryFeeFor("livraison", "Abidjan"));
    expect((await orderByReference(result.reference!)).total).toBe(result.total);
  });

  it.each([0, -5, 1.5, 51])("refuse la quantité %s sans toucher au stock", async (quantity) => {
    const created = jeko.created;
    const result = await onlineOrder(quantity);

    expect(result.error).toBe("Quantité invalide.");
    expect(await stockOf(TRIPOD)).toBe(5);
    expect(await countTestOrders()).toBe(0);
    expect(jeko.created).toBe(created);
  });

  it("refuse une quantité supérieure au stock, sans rien réserver", async () => {
    const created = jeko.created;
    const result = await onlineOrder(6);

    expect(result.error).toMatch(/Il ne reste que 5 exemplaire/);
    expect(await stockOf(TRIPOD)).toBe(5);
    expect(await countTestOrders()).toBe(0);
    expect(jeko.created).toBe(created);
  });

  it("refuse un produit non publié", async () => {
    const result = await onlineOrder(1, HIDDEN);

    expect(result.error).toBe("Un article de votre panier n'est plus disponible.");
    expect(await stockOf(HIDDEN)).toBe(5);
    expect(await countTestOrders()).toBe(0);
  });
});

describe("échec du prestataire de paiement", () => {
  it("rend le stock, annule la commande et ne montre au client qu'un message générique", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    jeko.createFails = true;

    const result = await onlineOrder(2);

    expect(result.error).toBe("Erreur lors du paiement. Réessayez ou contactez-nous si le problème persiste.");
    expect(result.error).not.toMatch(/jeko|endpoint|500/i);
    expect(await stockOf(TRIPOD)).toBe(5);

    const [order] = await sql<Array<{ status: string; payment_error: string }>>`
      SELECT status, payment_error FROM orders WHERE customer_name = ${CUSTOMER}
    `;
    expect(order.status).toBe("annulee");
    // Le detail technique reste consultable en admin.
    expect(order.payment_error).toMatch(/erreur interne Jeko/);
  });
});

describe("libération des réservations expirées", () => {
  it("laisse en attente une commande de moins de 30 minutes", async () => {
    const { reference } = await onlineOrder(2);
    await ageOrder(reference!, 29);

    const { releasedOrderIds } = await releaseExpiredReservations();

    expect(releasedOrderIds).toHaveLength(0);
    expect((await orderByReference(reference!)).status).toBe("attente_paiement");
    expect(await stockOf(TRIPOD)).toBe(3);
  });

  it("annule après 30 minutes sans paiement et remet le stock en vente", async () => {
    const { reference } = await onlineOrder(2);
    await ageOrder(reference!, 31);

    const { releasedOrderIds } = await releaseExpiredReservations();

    const order = await orderByReference(reference!);
    expect(releasedOrderIds).toEqual([order.id]);
    expect(order.status).toBe("annulee");
    expect(order.payment_error).toMatch(/30 minutes/);
    expect(await stockOf(TRIPOD)).toBe(5);
    expect(notifyCustomerLater).toHaveBeenCalledWith(reference, "annulee");
  });

  it("n'annule pas à l'aveugle quand Jeko est injoignable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { reference } = await onlineOrder(2);
    await ageOrder(reference!, 45);
    jeko.down = true;

    const { releasedOrderIds } = await releaseExpiredReservations();

    expect(releasedOrderIds).toHaveLength(0);
    expect((await orderByReference(reference!)).status).toBe("attente_paiement");
    expect(await stockOf(TRIPOD)).toBe(3);
  });

  it("valide une commande payée dont le webhook s'est perdu, sans rendre le stock", async () => {
    const { reference } = await onlineOrder(2);
    await ageOrder(reference!, 45);
    const before = await orderByReference(reference!);
    jeko.requests.get(before.payment_ref!)!.status = "success";

    const { releasedOrderIds, paidOrderIds } = await releaseExpiredReservations();

    const order = await orderByReference(reference!);
    expect(releasedOrderIds).toHaveLength(0);
    expect(paidOrderIds).toEqual([order.id]);
    expect(order.status).toBe("recue");
    expect(order.paid_at).not.toBeNull();
    expect(await stockOf(TRIPOD)).toBe(3);
  });
});

describe("synchronisation du paiement", () => {
  it("paiement refusé : commande annulée et stock rendu", async () => {
    const { reference } = await onlineOrder(2);
    const { payment_ref } = await orderByReference(reference!);
    jeko.requests.get(payment_ref!)!.status = "error";

    const sync = await syncOrderPayment({ paymentRef: payment_ref! });

    expect(sync).toMatchObject({ kind: "checked", paid: false, failed: true });
    expect((await orderByReference(reference!)).status).toBe("annulee");
    expect(await stockOf(TRIPOD)).toBe(5);
  });

  it("webhook rejoué deux fois : un seul paiement enregistré, un seul message au client", async () => {
    const { reference } = await onlineOrder(1);
    const { payment_ref } = await orderByReference(reference!);
    jeko.requests.get(payment_ref!)!.status = "success";
    // Les deux appels lisent la commande impayee avant que l'un d'eux n'ecrive.
    jeko.holdUntil = 2;

    const [first, second] = await Promise.all([
      syncOrderPayment({ paymentRef: payment_ref! }),
      syncOrderPayment({ paymentRef: payment_ref! }),
    ]);
    jeko.holdUntil = 0;
    const paidAt = (await orderByReference(reference!)).paid_at;
    const third = await syncOrderPayment({ paymentRef: payment_ref! });

    for (const sync of [first, second, third]) expect(sync).toMatchObject({ kind: "checked", paid: true });
    expect((await orderByReference(reference!)).paid_at).toEqual(paidAt);
    expect(vi.mocked(notifyCustomerLater).mock.calls.filter(([, event]) => event === "paiement_confirme")).toHaveLength(1);
  });

  it("signale en admin un montant confirmé différent du total, sans bloquer le paiement", async () => {
    const { reference } = await onlineOrder(1);
    const { payment_ref } = await orderByReference(reference!);
    Object.assign(jeko.requests.get(payment_ref!)!, { status: "success", amountCents: 4400000 });

    await syncOrderPayment({ reference: reference! });

    const order = await orderByReference(reference!);
    expect(order.status).toBe("recue");
    expect(order.payment_error).toBe("Montant confirmé par Jeko : 44000 FCFA pour un total de 45000 FCFA, à vérifier.");
  });

  it("paiement arrivé après l'annulation : enregistré et signalé, la commande reste annulée", async () => {
    const { reference } = await onlineOrder(1);
    await ageOrder(reference!, 31);
    await releaseExpiredReservations();
    const { payment_ref } = await orderByReference(reference!);
    jeko.requests.get(payment_ref!)!.status = "success";

    await syncOrderPayment({ paymentRef: payment_ref! });

    const order = await orderByReference(reference!);
    expect(order.status).toBe("annulee");
    expect(order.paid_at).not.toBeNull();
    expect(order.payment_error).toMatch(/Paiement reçu après l'annulation/);
  });
});
