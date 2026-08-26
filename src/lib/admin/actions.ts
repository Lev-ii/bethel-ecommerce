"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth/current";
import { sql } from "@/lib/db/client";
import { deleteProductImages, saveProductImage, UploadError } from "@/lib/storage";
import { categories } from "@/lib/data/catalog";
import type { CategorySlug, OrderStatus, Spec } from "@/lib/types";

/** Transforme un nom en identifiant d'URL : "Ring light 18" -> "ring-light-18". */
function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Ajoute un suffixe si l'identifiant est deja pris. */
async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const rows = await sql<Array<{ slug: string }>>`
    SELECT slug FROM products
    WHERE slug LIKE ${base + "%"} ${ignoreId ? sql`AND id <> ${ignoreId}` : sql``}
  `;
  const taken = new Set(rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Lit les paires libelle / valeur de la fiche technique. */
function readSpecs(formData: FormData): Spec[] {
  const labels = formData.getAll("specLabel").map(String);
  const values = formData.getAll("specValue").map(String);
  const specs: Spec[] = [];
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i]?.trim();
    const value = values[i]?.trim();
    if (label && value) specs.push({ label, value });
  }
  return specs;
}

/**
 * Erreur de validation portant un code court.
 *
 * Le code voyage dans l'URL de retour, et le libelle correspondant est resolu
 * cote affichage (lib/admin/messages.ts). Les formulaires restent ainsi de
 * simples formulaires HTML, sans etat client a conserver.
 */
class ValidationError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
function invalid(code: string) {
  return new ValidationError(code);
}

function codeOf(error: unknown): string {
  if (error instanceof ValidationError) return error.code;
  if (error instanceof UploadError) return "image";
  if (error instanceof Error && error.message.includes("administration")) {
    return "refus";
  }
  console.error("[admin]", error);
  return "inconnue";
}

interface ParsedFields {
  name: string;
  brand: string;
  category: CategorySlug;
  headline: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  lowStockThreshold: number;
  featured: boolean;
  isHero: boolean;
  published: boolean;
  specs: Spec[];
}

function parseFields(formData: FormData): ParsedFields {
  const name = String(formData.get("name") ?? "").trim();
  const brand = String(formData.get("brand") ?? "").trim();
  const category = String(formData.get("category") ?? "") as CategorySlug;
  const headline = String(formData.get("headline") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price"));
  const compareRaw = String(formData.get("compareAtPrice") ?? "").trim();
  const compareAtPrice = compareRaw ? Number(compareRaw) : null;
  const stock = Number(formData.get("stock") ?? 0);
  const lowStockThreshold = Number(formData.get("lowStockThreshold") ?? 5);

  if (name.length < 3) throw invalid("nom");
  if (brand.length < 2) throw invalid("marque");
  if (!categories.some((c) => c.slug === category)) throw invalid("categorie");
  if (headline.length < 5) throw invalid("argument");
  if (!Number.isFinite(price) || price <= 0) throw invalid("prix");
  if (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice <= price)) {
    throw invalid("prix-barre");
  }
  if (!Number.isInteger(stock) || stock < 0) throw invalid("stock");

  return {
    name,
    brand,
    category,
    headline,
    description,
    price: Math.round(price),
    compareAtPrice: compareAtPrice ? Math.round(compareAtPrice) : null,
    stock,
    lowStockThreshold: Number.isInteger(lowStockThreshold) ? lowStockThreshold : 5,
    featured: formData.get("featured") === "on",
    isHero: formData.get("isHero") === "on",
    published: formData.get("published") === "on",
    specs: readSpecs(formData),
  };
}

/** Reecrit la fiche technique d'un produit. */
async function writeSpecs(
  tx: typeof sql,
  productId: string,
  specs: Spec[]
): Promise<void> {
  await tx`DELETE FROM product_specs WHERE product_id = ${productId}`;
  if (specs.length === 0) return;
  await tx`
    INSERT INTO product_specs ${tx(
      specs.map((s, i) => ({
        product_id: productId,
        label: s.label,
        value: s.value,
        position: i,
      })),
      "product_id",
      "label",
      "value",
      "position"
    )}
  `;
}

function refreshCatalog(slug?: string) {
  revalidatePath("/");
  revalidatePath("/boutique");
  revalidatePath("/admin");
  revalidatePath("/admin/produits");
  if (slug) revalidatePath(`/boutique/${slug}`);
}

async function saveProductImages(formData: FormData, productId: string): Promise<string[]> {
  const files = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const urls: string[] = [];
  for (const file of files) {
    const url = await saveProductImage(file, productId);
    if (url) urls.push(url);
  }
  return urls;
}

function shouldReplaceImages(formData: FormData): boolean {
  return formData.get("replaceImages") === "on";
}

/* --------------------------------------------------------------- Creation */

export async function createProduct(formData: FormData) {
  let slug: string;

  try {
    await assertAdmin();
    const fields = parseFields(formData);
    const id = randomUUID();

    // L'identifiant est genere avant l'envoi de la photo : il sert de prefixe
    // de rangement dans le bucket.
    const uploadedImages = await saveProductImages(formData, id);
    const image = uploadedImages[0] ?? "/produits/trepied.svg";

    slug = await uniqueSlug(slugify(fields.name));

    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO products (
          id, slug, name, brand, category, headline, description,
          price, compare_at_price, stock, low_stock_threshold,
          image, featured, is_hero, published
        ) VALUES (
          ${id}, ${slug}, ${fields.name}, ${fields.brand}, ${fields.category},
          ${fields.headline}, ${fields.description}, ${fields.price},
          ${fields.compareAtPrice}, ${fields.stock}, ${fields.lowStockThreshold},
          ${image}, ${fields.featured}, ${fields.isHero}, ${fields.published}
        )
      `;
      // Un seul produit vedette : on retire la designation aux autres.
      // Fait dans la meme transaction que l'insertion, sinon l'index unique
      // rejetterait l'ecriture.
      if (fields.isHero) {
        await tx`UPDATE products SET is_hero = FALSE WHERE id <> ${id}`;
      }
      await writeSpecs(tx as unknown as typeof sql, id, fields.specs);
      for (const [position, url] of uploadedImages.entries()) {
        await tx`
          INSERT INTO product_images (product_id, url, position)
          VALUES (${id}, ${url}, ${position})
        `;
      }
    });
  } catch (error) {
    redirect(`/admin/produits/nouveau?erreur=${codeOf(error)}`);
  }

  refreshCatalog(slug);
  redirect(`/admin/produits?ajoute=${slug}`);
}

/* ------------------------------------------------------------ Modification */

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  let slug: string | undefined;

  try {
    await assertAdmin();

    const [existing] = await sql<Array<{ image: string }>>`
      SELECT image FROM products WHERE id = ${id}
    `;
    if (!existing) throw invalid("introuvable");

    const fields = parseFields(formData);
    const replaceImages = shouldReplaceImages(formData);
    if (replaceImages && formData.getAll("images").some((value) => value instanceof File && value.size > 0)) {
      await deleteProductImages(id);
      await sql`DELETE FROM product_images WHERE product_id = ${id}`;
    }
    const uploadedImages = await saveProductImages(formData, id);
    const uploaded = uploadedImages[0];
    slug = await uniqueSlug(slugify(fields.name), id);

    await sql.begin(async (tx) => {
      // Retire la designation aux autres avant de la poser ici, sinon
      // l'index unique refuserait d'avoir deux vedettes le temps de la
      // transaction.
      if (fields.isHero) {
        await tx`UPDATE products SET is_hero = FALSE WHERE id <> ${id}`;
      }
      await tx`
        UPDATE products SET
          slug = ${slug!}, name = ${fields.name}, brand = ${fields.brand},
          category = ${fields.category}, headline = ${fields.headline},
          description = ${fields.description}, price = ${fields.price},
          compare_at_price = ${fields.compareAtPrice}, stock = ${fields.stock},
          low_stock_threshold = ${fields.lowStockThreshold},
          image = ${uploaded ?? existing.image},
          featured = ${fields.featured}, is_hero = ${fields.isHero},
          published = ${fields.published},
          updated_at = now()
        WHERE id = ${id}
      `;
      await writeSpecs(tx as unknown as typeof sql, id, fields.specs);
      if (uploadedImages.length > 0) {
        const [{ maxPosition }] = await tx<Array<{ maxPosition: number | null }>>`
          SELECT max(position)::int AS "maxPosition"
          FROM product_images WHERE product_id = ${id}
        `;
        for (const [index, url] of uploadedImages.entries()) {
          await tx`
            INSERT INTO product_images (product_id, url, position)
            VALUES (${id}, ${url}, ${(maxPosition ?? -1) + index + 1})
          `;
        }
      }
    });
  } catch (error) {
    redirect(`/admin/produits/${id}?erreur=${codeOf(error)}`);
  }

  refreshCatalog(slug);
  redirect(`/admin/produits?modifie=${slug}`);
}

/* ------------------------------------------------------------ Suppression */

export async function deleteProduct(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "").trim();

  const [product] = await sql<Array<{ name: string }>>`
    SELECT name FROM products WHERE id = ${id}
  `;
  if (!product) redirect("/admin/produits?erreur=introuvable");

  // La confirmation est verifiee ici, pas seulement dans le navigateur :
  // desactiver un bouton cote client ne protege rien.
  if (confirmation.toLowerCase() !== product.name.trim().toLowerCase()) {
    redirect(`/admin/produits/${id}?erreur=confirmation`);
  }

  await sql`DELETE FROM products WHERE id = ${id}`;
  await deleteProductImages(id);

  refreshCatalog();
  redirect("/admin/produits?supprime=1");
}

/* ------------------------------------------ Actions rapides sur une fiche */

export async function adjustStock(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const delta = Number(formData.get("delta") ?? 0);

  // GREATEST evite de passer sous zero, et l'operation reste atomique :
  // deux ajustements simultanes ne s'ecrasent pas.
  await sql`
    UPDATE products SET stock = GREATEST(0, stock + ${delta}), updated_at = now()
    WHERE id = ${id}
  `;

  refreshCatalog();
}

export async function togglePublished(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  await sql`
    UPDATE products SET published = NOT published, updated_at = now()
    WHERE id = ${id}
  `;
  refreshCatalog();
}

export async function setOrderStatus(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const requestedStatus = String(formData.get("status") ?? "");
  const validStatuses: OrderStatus[] = ["recue", "preparee", "expediee", "livree"];
  if (!validStatuses.includes(requestedStatus as OrderStatus)) return;
  const status = requestedStatus as OrderStatus;

  await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;

  revalidatePath("/admin/commandes");
  revalidatePath("/admin");
}

export async function resetDemo() {
  await assertAdmin();
  const { seedDemoData } = await import("@/lib/db/seed");
  await seedDemoData({ force: true });
  refreshCatalog();
  revalidatePath("/admin/commandes");
}
