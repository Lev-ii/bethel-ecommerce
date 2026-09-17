"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { currentUser } from "@/lib/auth/current";
import { sql } from "@/lib/db/client";
import { buildOrderReference } from "@/lib/format";
import { notifyCustomerLater } from "@/lib/shop/notifications";
import { paymentProvider } from "@/lib/shop/payment";
import { invoiceToken } from "@/lib/shop/invoice";
import { cartProblem, deliveryFeeFor, orderTotal } from "@/lib/shop/checkout";
import { releaseExpiredReservationsQuietly } from "@/lib/shop/reservations";
import type { PaymentMethod } from "@/lib/types";

/**
 * Refus a montrer tel quel au client (article indisponible, stock
 * insuffisant). Toute autre erreur est technique : journalisee, jamais
 * affichee.
 */
class OrderRejection extends Error {}

export interface PlaceOrderInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryMode: "livraison" | "retrait";
  address?: string;
  city?: string;
  paymentMethod: PaymentMethod;
  items: Array<{ productId: string; quantity: number }>;
}

export interface PlaceOrderResult {
  reference?: string;
  /** Jeton d'acces aux documents de la commande, remis a son auteur. */
  accessToken?: string;
  total?: number;
  checkoutUrl?: string;
  /**
   * Le paiement en ligne est parti mais n'est pas encore confirme : la
   * demande Jeko est cree, le client doit encore valider sur son telephone.
   * La page de confirmation le lui dit (voir /commande/confirmation).
   */
  paymentPending?: boolean;
  error?: string;
}

/**
 * Enregistre une commande et decremente le stock.
 *
 * Trois points importants :
 *
 * 1. Les prix sont relus depuis la base, jamais pris du client. Le panier vit
 *    dans le navigateur : on ne lui fait pas confiance sur les montants.
 * 2. La reservation (verrou, decompte du stock, ecriture de la commande) se
 *    fait dans une transaction courte : SELECT ... FOR UPDATE verrouille les
 *    lignes de produit, mais rien de long ne s'execute pendant que le verrou
 *    est tenu. Deux clients qui commandent le dernier exemplaire en meme
 *    temps ne peuvent plus l'acheter tous les deux.
 * 3. Le nom et le prix sont recopies dans la ligne de commande, pour que
 *    l'historique reste juste meme si la fiche change ensuite.
 *
 * L'appel au prestataire de paiement a lieu apres cette transaction, une fois
 * les verrous relaches : un appel reseau ne doit jamais bloquer d'autres
 * clients qui commandent les memes produits. S'il echoue, la reservation est
 * annulee (stock rendu, commande passee en 'annulee').
 */
export async function placeOrder(
  input: PlaceOrderInput
): Promise<PlaceOrderResult> {
  const problem = cartProblem(input.items);
  if (problem) return { error: problem };

  const deliveryFee = deliveryFeeFor(input.deliveryMode, input.city);

  const user = await currentUser();
  const reference = buildOrderReference();
  const orderId = randomUUID();
  const isOnlinePayment =
    input.paymentMethod !== "paiement-livraison" && input.paymentMethod !== "especes-retrait";
  // Une commande payee en ligne n'est "recue" qu'une fois le paiement
  // confirme par Jeko (voir syncOrderPayment) : d'ici la, elle n'apparait
  // ni dans le chiffre d'affaires ni dans les commandes a traiter.
  const initialStatus = isOnlinePayment ? "attente_paiement" : "recue";

  let total: number;
  let slugs: string[];
  let lines: Array<{ productId: string; unitPrice: number; quantity: number }>;

  // Rend d'abord le stock des paiements abandonnes : sans ca, le dernier
  // exemplaire resterait bloque par un client parti sans payer. Le cache
  // produits est vide juste apres la reservation, plus bas.
  await releaseExpiredReservationsQuietly();

  try {
    const reserved = await sql.begin(async (tx) => {
      const ids = input.items.map((i) => i.productId);

      const rows = await tx<
        Array<{
          id: string;
          slug: string;
          name: string;
          price: number;
          stock: number;
        }>
      >`
        SELECT id, slug, name, price, stock FROM products
        WHERE id = ANY(${ids}) AND published = TRUE
        -- Toujours le meme ordre de verrouillage. Sans lui, deux paniers
        -- contenant les memes produits pouvaient se bloquer mutuellement
        -- (146 commandes perdues sur 500 paniers croises, tests/charge).
        ORDER BY id
        FOR UPDATE
      `;

      const byId = new Map(rows.map((r) => [r.id, r]));
      const reservedLines = [];
      // Les fiches produits sont pre-generees : il faudra les rafraichir,
      // sinon celle du dernier exemplaire vendu continue d'afficher "En stock".
      const reservedSlugs: string[] = [];

      for (const item of input.items) {
        const product = byId.get(item.productId);
        if (!product) {
          throw new OrderRejection("Un article de votre panier n'est plus disponible.");
        }
        if (product.stock < item.quantity) {
          throw new OrderRejection(
            `Il ne reste que ${product.stock} exemplaire(s) de ${product.name}.`
          );
        }
        reservedSlugs.push(product.slug);
        reservedLines.push({
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: item.quantity,
        });
      }

      const computedTotal = orderTotal(reservedLines, deliveryFee);

      await tx`
        INSERT INTO orders (
          id, reference, user_id, customer_name, customer_phone, customer_email,
          delivery_mode, address, city, payment_method, payment_ref, paid_at,
          total, status
        ) VALUES (
          ${orderId}, ${reference}, ${user?.id ?? null}, ${input.customerName},
          ${input.customerPhone}, ${input.customerEmail || user?.email || null},
          ${input.deliveryMode}, ${input.address ?? null}, ${input.city ?? null},
          ${input.paymentMethod}, NULL, NULL,
          ${computedTotal}, ${initialStatus}
        )
      `;

      for (const line of reservedLines) {
        await tx`
          INSERT INTO order_lines (order_id, product_id, name, unit_price, quantity)
          VALUES (${orderId}, ${line.productId}, ${line.name},
                  ${line.unitPrice}, ${line.quantity})
        `;
        await tx`
          UPDATE products SET stock = stock - ${line.quantity}, updated_at = now()
          WHERE id = ${line.productId}
        `;
      }

      return { total: computedTotal, slugs: reservedSlugs, lines: reservedLines };
    });

    total = reserved.total;
    slugs = reserved.slugs;
    lines = reserved.lines;
    // Le stock vient de baisser : le catalogue en cache doit le refleter
    // immediatement, meme si le paiement echoue ensuite (voir plus bas).
    revalidateTag("products");
  } catch (error) {
    if (error instanceof OrderRejection) return { error: error.message };
    console.error("[placeOrder] réservation échouée", { orderId, reference }, error);
    return { error: "La commande n'a pas pu être enregistrée. Réessayez dans un instant." };
  }

  let checkoutUrl: string | undefined;
  let paymentPending = false;

  try {
    const payment = await paymentProvider.charge({
      amount: total,
      method: input.paymentMethod,
      reference,
      customerName: input.customerName,
      customerEmail: input.customerEmail || user?.email,
      customerPhone: input.customerPhone,
      customerAddress: input.address,
      customerCity: input.city,
      callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/payment/ipn`,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/commande/confirmation?ref=${encodeURIComponent(reference)}&t=${invoiceToken(reference)}&total=${total}&mode=${input.deliveryMode}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/panier?erreur=paiement&ref=${encodeURIComponent(reference)}`,
    });

    checkoutUrl = payment.checkoutUrl;
    paymentPending = isOnlinePayment && payment.status !== "paid";

    await sql`
      UPDATE orders
      SET payment_ref = ${payment.transactionReference ?? null},
          paid_at = ${payment.status === "paid" ? sql`now()` : sql`NULL`},
          status = ${payment.status === "paid" ? "recue" : initialStatus}
      WHERE id = ${orderId}
    `;
  } catch (error) {
    // Le message technique (endpoint, code prestataire...) ne doit jamais
    // atteindre le client : il est journalise et garde sur la commande pour
    // le debug admin (voir OrdersTable), le client ne voit qu'un message
    // generique.
    const technicalMessage = error instanceof Error ? error.message : String(error);
    console.error("[placeOrder] paiement échoué", { orderId, reference }, technicalMessage);

    await sql.begin(async (tx) => {
      for (const line of lines) {
        await tx`
          UPDATE products SET stock = stock + ${line.quantity}, updated_at = now()
          WHERE id = ${line.productId}
        `;
      }
      await tx`
        UPDATE orders SET status = 'annulee', payment_error = ${technicalMessage}
        WHERE id = ${orderId}
      `;
    });
    revalidateTag("products");

    return { error: "Erreur lors du paiement. Réessayez ou contactez-nous si le problème persiste." };
  }

  revalidatePath("/");
  revalidatePath("/boutique");
  for (const slug of slugs) {
    revalidatePath(`/boutique/${slug}`);
  }
  // Pour un paiement en ligne, le client est prevenu (facture jointe) a la
  // validation du paiement (voir syncOrderPayment), pas avant.
  if (!isOnlinePayment) notifyCustomerLater(reference, "commande_recue");
  revalidatePath("/admin");
  revalidatePath("/admin/commandes");

  return { reference, accessToken: invoiceToken(reference), total, checkoutUrl, paymentPending };
}
