"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth/current";
import { sql } from "@/lib/db/client";
import { buildOrderReference } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";

export interface PlaceOrderInput {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryMode: "livraison" | "retrait";
  address?: string;
  city?: string;
  paymentMethod: PaymentMethod;
  deliveryFee: number;
  items: Array<{ productId: string; quantity: number }>;
}

export interface PlaceOrderResult {
  reference?: string;
  total?: number;
  error?: string;
}

/**
 * Enregistre une commande et decremente le stock.
 *
 * Trois points importants :
 *
 * 1. Les prix sont relus depuis la base, jamais pris du client. Le panier vit
 *    dans le navigateur : on ne lui fait pas confiance sur les montants.
 * 2. Tout se passe dans une transaction, et les lignes de produit sont
 *    verrouillees avec SELECT ... FOR UPDATE. Deux clients qui commandent le
 *    dernier exemplaire en meme temps ne peuvent plus l'acheter tous les deux.
 * 3. Le nom et le prix sont recopies dans la ligne de commande, pour que
 *    l'historique reste juste meme si la fiche change ensuite.
 *
 * C'est ici que l'appel au prestataire de paiement viendra s'inserer, avant
 * l'ecriture : voir README, "Agregateurs de paiement".
 */
export async function placeOrder(
  input: PlaceOrderInput
): Promise<PlaceOrderResult> {
  if (input.items.length === 0) {
    return { error: "Votre panier est vide." };
  }

  const user = await currentUser();
  const reference = buildOrderReference();
  const orderId = randomUUID();

  try {
    const { orderTotal: total, slugs } = await sql.begin(async (tx) => {
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
        FOR UPDATE
      `;

      const byId = new Map(rows.map((r) => [r.id, r]));
      const lines = [];
      // Les fiches produits sont pre-generees : il faudra les rafraichir,
      // sinon celle du dernier exemplaire vendu continue d'afficher "En stock".
      const slugs: string[] = [];

      for (const item of input.items) {
        const product = byId.get(item.productId);
        if (!product) {
          throw new Error("Un article de votre panier n'est plus disponible.");
        }
        if (product.stock < item.quantity) {
          throw new Error(
            `Il ne reste que ${product.stock} exemplaire(s) de ${product.name}.`
          );
        }
        slugs.push(product.slug);
        lines.push({
          productId: product.id,
          name: product.name,
          unitPrice: product.price,
          quantity: item.quantity,
        });
      }

      const subtotal = lines.reduce(
        (sum, l) => sum + l.unitPrice * l.quantity,
        0
      );
      const orderTotal = subtotal + input.deliveryFee;

      await tx`
        INSERT INTO orders (
          id, reference, user_id, customer_name, customer_phone, customer_email,
          delivery_mode, address, city, payment_method, total, status
        ) VALUES (
          ${orderId}, ${reference}, ${user?.id ?? null}, ${input.customerName},
          ${input.customerPhone}, ${input.customerEmail || user?.email || null},
          ${input.deliveryMode}, ${input.address ?? null}, ${input.city ?? null},
          ${input.paymentMethod}, ${orderTotal}, 'recue'
        )
      `;

      for (const line of lines) {
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

      return { orderTotal, slugs };
    });

    revalidatePath("/");
    revalidatePath("/boutique");
    for (const slug of slugs) {
      revalidatePath(`/boutique/${slug}`);
    }
    revalidatePath("/admin");
    revalidatePath("/admin/commandes");

    return { reference, total };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "La commande n'a pas pu etre enregistree.";
    return { error: message };
  }
}
