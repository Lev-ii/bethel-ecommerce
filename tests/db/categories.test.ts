import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { CategoryError } from "@/lib/admin/categories";
import {
  createCategory,
  deleteCategories,
  getCategoriesWithCounts,
  moveCategory,
  moveProducts,
  updateCategory,
} from "@/lib/admin/category-store";
import { sql } from "@/lib/db/client";

/**
 * Categories administrables contre un vrai PostgreSQL : creation, renommage
 * (l'adresse suit le nom, les produits suivent l'adresse), ordre du menu,
 * suppression avec deplacement des produits, deplacement de produits.
 *
 * Les categories de test commencent par "Zz test", les produits par "cat-test-".
 */

const admin = { id: "admin-categories", email: "admin@bethel.test" };

async function purge() {
  await sql`DELETE FROM products WHERE id LIKE 'cat-test-%'`;
  await sql`DELETE FROM categories WHERE name LIKE 'Zz test%' OR name LIKE 'Zz renommée%'`;
  await sql.begin(async (tx) => {
    await tx`SET LOCAL bethel.audit_purge = 'on'`;
    await tx`DELETE FROM audit_logs WHERE actor_id = ${admin.id}`;
  });
}

async function product(id: string, category: string) {
  await sql`
    INSERT INTO products (id, slug, name, brand, category, headline, price, stock, image, published)
    VALUES (${id}, ${id}, ${"Produit " + id}, 'Test', ${category}, 'Produit de test', 1000, 1, '/produits/sans-photo.svg', TRUE)
  `;
}

async function categoryOf(id: string) {
  const [row] = await sql<Array<{ category: string }>>`SELECT category FROM products WHERE id = ${id}`;
  return row?.category;
}

async function auditActions() {
  const rows = await sql<Array<{ action: string; entity_id: string }>>`
    SELECT action, entity_id FROM audit_logs WHERE actor_id = ${admin.id} ORDER BY id
  `;
  return rows.map((r) => `${r.action} ${r.entity_id}`);
}

function codeOf(promise: Promise<unknown>) {
  return promise.then(
    () => "ok",
    (error) => (error instanceof CategoryError ? error.code : String(error))
  );
}

beforeEach(purge);
afterAll(async () => {
  await purge();
  await sql.end();
});

describe("création", () => {
  it("crée une catégorie en fin de menu, adresse tirée du nom, inscrite au journal", async () => {
    const { slug } = await createCategory(admin, { name: "  Zz test  Drônes ", tagline: "Pour filmer d'en haut" });

    expect(slug).toBe("zz-test-drones");
    const all = await getCategoriesWithCounts();
    expect(all.at(-1)).toMatchObject({ slug, name: "Zz test Drônes", tagline: "Pour filmer d'en haut", productCount: 0 });
    expect(await auditActions()).toEqual(["category.created zz-test-drones"]);
  });

  it("donne une adresse libre à un nom déjà pris", async () => {
    await createCategory(admin, { name: "Zz test Son" });
    const second = await createCategory(admin, { name: "Zz test SON" });
    expect(second.slug).toBe("zz-test-son-2");
  });

  it.each([["", "nom"], ["a", "nom"], ["!!!", "nom"], ["x".repeat(61), "nom"]])("refuse le nom %j", async (name, code) => {
    expect(await codeOf(createCategory(admin, { name }))).toBe(code);
    expect(await auditActions()).toEqual([]);
  });
});

describe("renommage", () => {
  it("l'adresse suit le nouveau nom et les produits suivent l'adresse", async () => {
    const { slug } = await createCategory(admin, { name: "Zz test Éclairage" });
    await product("cat-test-1", slug);
    await product("cat-test-2", slug);

    const result = await updateCategory(admin, slug, { name: "Zz renommée Lumière", tagline: "Nouvelle accroche" });

    expect(result).toMatchObject({ slug: "zz-renommee-lumiere", previousSlug: "zz-test-eclairage", changed: true });
    expect(await categoryOf("cat-test-1")).toBe("zz-renommee-lumiere");
    expect(await categoryOf("cat-test-2")).toBe("zz-renommee-lumiere");
    const [entry] = await sql<Array<{ changes: Record<string, unknown> }>>`
      SELECT changes FROM audit_logs WHERE actor_id = ${admin.id} AND action = 'category.updated'
    `;
    expect(entry.changes).toMatchObject({
      name: { from: "Zz test Éclairage", to: "Zz renommée Lumière" },
      slug: { from: "zz-test-eclairage", to: "zz-renommee-lumiere" },
    });
  });

  it("changer seulement l'accroche garde l'adresse", async () => {
    const { slug } = await createCategory(admin, { name: "Zz test Micros", tagline: "Avant" });
    const result = await updateCategory(admin, slug, { name: "Zz test Micros", tagline: "Après" });
    expect(result).toMatchObject({ slug, changed: true });
  });

  it("n'écrit rien quand rien ne change", async () => {
    const { slug } = await createCategory(admin, { name: "Zz test Stable", tagline: "Même" });
    expect(await updateCategory(admin, slug, { name: "Zz test Stable", tagline: "Même" })).toMatchObject({ changed: false });
    expect(await auditActions()).toEqual([`category.created ${slug}`]);
  });

  it("refuse une catégorie inconnue", async () => {
    expect(await codeOf(updateCategory(admin, "zz-inexistante", { name: "Zz test X" }))).toBe("introuvable");
  });
});

describe("ordre du menu", () => {
  it("monte et descend d'un cran, sans sortir des bornes", async () => {
    const a = await createCategory(admin, { name: "Zz test Ordre A" });
    const b = await createCategory(admin, { name: "Zz test Ordre B" });
    const order = async () => (await getCategoriesWithCounts()).map((c) => c.slug).filter((s) => s.startsWith("zz-test-ordre"));

    expect(await order()).toEqual([a.slug, b.slug]);
    expect(await moveCategory(admin, b.slug, "up")).toEqual({ moved: true });
    expect(await order()).toEqual([b.slug, a.slug]);
    expect(await moveCategory(admin, a.slug, "down")).toEqual({ moved: false });
  });
});

describe("suppression", () => {
  it("supprime plusieurs catégories et déplace leurs produits en une opération", async () => {
    const a = await createCategory(admin, { name: "Zz test Supp A" });
    const b = await createCategory(admin, { name: "Zz test Supp B" });
    const dest = await createCategory(admin, { name: "Zz test Destination" });
    await product("cat-test-a", a.slug);
    await product("cat-test-b", b.slug);

    const result = await deleteCategories(admin, [a.slug, b.slug], dest.slug);

    expect(result).toEqual({ deleted: 2, productsMoved: 2 });
    expect(await categoryOf("cat-test-a")).toBe(dest.slug);
    expect(await categoryOf("cat-test-b")).toBe(dest.slug);
    const remaining = (await getCategoriesWithCounts()).map((c) => c.slug);
    expect(remaining).not.toContain(a.slug);
    expect(remaining).toContain(dest.slug);
    expect((await auditActions()).filter((a) => a.startsWith("category.deleted"))).toHaveLength(2);
  });

  it("supprime une catégorie vide sans destination", async () => {
    const empty = await createCategory(admin, { name: "Zz test Vide" });
    expect(await deleteCategories(admin, [empty.slug])).toEqual({ deleted: 1, productsMoved: 0 });
  });

  it("refuse sans destination quand des produits y sont rangés, et ne supprime rien", async () => {
    const full = await createCategory(admin, { name: "Zz test Pleine" });
    await product("cat-test-p", full.slug);

    expect(await codeOf(deleteCategories(admin, [full.slug]))).toBe("destination");
    expect(await categoryOf("cat-test-p")).toBe(full.slug);
    expect((await getCategoriesWithCounts()).map((c) => c.slug)).toContain(full.slug);
  });

  it("refuse une destination qui fait partie de la sélection", async () => {
    const a = await createCategory(admin, { name: "Zz test Boucle A" });
    const b = await createCategory(admin, { name: "Zz test Boucle B" });
    await product("cat-test-boucle", a.slug);
    expect(await codeOf(deleteCategories(admin, [a.slug, b.slug], b.slug))).toBe("destination-supprimee");
  });

  it("refuse de supprimer toutes les catégories", async () => {
    const all = (await getCategoriesWithCounts()).map((c) => c.slug);
    expect(await codeOf(deleteCategories(admin, all, all[0]))).toBe("derniere");
    expect((await getCategoriesWithCounts()).map((c) => c.slug)).toEqual(all);
  });

  it("refuse une sélection vide ou inconnue", async () => {
    expect(await codeOf(deleteCategories(admin, []))).toBe("selection");
    expect(await codeOf(deleteCategories(admin, ["zz-inexistante"]))).toBe("selection");
  });
});

describe("déplacement de produits", () => {
  it("déplace plusieurs produits, ignore ceux déjà rangés, trace chaque déplacement", async () => {
    const from = await createCategory(admin, { name: "Zz test Origine" });
    const to = await createCategory(admin, { name: "Zz test Cible" });
    await product("cat-test-m1", from.slug);
    await product("cat-test-m2", from.slug);
    await product("cat-test-m3", to.slug);

    const result = await moveProducts(admin, ["cat-test-m1", "cat-test-m2", "cat-test-m3"], to.slug);

    expect(result).toEqual({ moved: 2 });
    for (const id of ["cat-test-m1", "cat-test-m2", "cat-test-m3"]) expect(await categoryOf(id)).toBe(to.slug);
    expect((await auditActions()).filter((a) => a.startsWith("product.category_moved"))).toEqual([
      "product.category_moved cat-test-m1",
      "product.category_moved cat-test-m2",
    ]);
  });

  it("refuse une destination inconnue ou une sélection vide", async () => {
    const from = await createCategory(admin, { name: "Zz test Seule" });
    await product("cat-test-s", from.slug);
    expect(await codeOf(moveProducts(admin, ["cat-test-s"], "zz-inexistante"))).toBe("introuvable");
    expect(await codeOf(moveProducts(admin, [], from.slug))).toBe("produits");
    expect(await categoryOf("cat-test-s")).toBe(from.slug);
  });
});
