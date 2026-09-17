"use server";

import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { CategoryError } from "@/lib/admin/categories";
import {
  createCategory,
  deleteCategories,
  moveCategory,
  moveProducts,
  updateCategory,
} from "@/lib/admin/category-store";
import { assertAdmin } from "@/lib/auth/current";

/**
 * Actions des formulaires de categories. La logique vit dans
 * category-store.ts (testee contre la base) ; ici : controle de
 * l'administrateur, rafraichissement du site, retour vers la page.
 */

function codeOf(error: unknown): string {
  if (error instanceof CategoryError) return error.code;
  console.error("[admin:categories]", error);
  return "inconnue";
}

/**
 * Les categories apparaissent dans le menu et le pied de page de toutes les
 * pages, et un renommage change l'adresse des produits : tout le site est
 * rafraichi.
 */
function refreshSite() {
  revalidateTag("categories");
  revalidateTag("products");
  revalidatePath("/", "layout");
}

async function run(back: string, operation: () => Promise<string>): Promise<never> {
  let target: string;
  try {
    target = `${back}${back.includes("?") ? "&" : "?"}ok=${await operation()}`;
    refreshSite();
  } catch (error) {
    target = `${back}${back.includes("?") ? "&" : "?"}erreur=${codeOf(error)}`;
  }
  redirect(target);
}

export async function createCategoryAction(formData: FormData) {
  const admin = await assertAdmin();
  await run("/admin/categories", async () => {
    await createCategory(admin, { name: formData.get("name"), tagline: formData.get("tagline") });
    return "creee";
  });
}

export async function updateCategoryAction(formData: FormData) {
  const admin = await assertAdmin();
  await run("/admin/categories", async () => {
    const result = await updateCategory(admin, String(formData.get("slug") ?? ""), {
      name: formData.get("name"),
      tagline: formData.get("tagline"),
    });
    return result.changed ? "modifiee" : "inchangee";
  });
}

export async function moveCategoryAction(formData: FormData) {
  const admin = await assertAdmin();
  const direction = formData.get("direction") === "up" ? "up" : "down";
  await run("/admin/categories", async () => {
    await moveCategory(admin, String(formData.get("slug") ?? ""), direction);
    return "ordre";
  });
}

export async function deleteCategoriesAction(formData: FormData) {
  const admin = await assertAdmin();
  await run("/admin/categories", async () => {
    const result = await deleteCategories(
      admin,
      formData.getAll("slug").map(String),
      String(formData.get("destination") ?? "") || undefined
    );
    return `supprimees-${result.deleted}-${result.productsMoved}`;
  });
}

export async function moveProductsAction(formData: FormData) {
  const admin = await assertAdmin();
  await run("/admin/produits", async () => {
    const result = await moveProducts(admin, formData.getAll("id").map(String), String(formData.get("category") ?? ""));
    return `deplaces-${result.moved}`;
  });
}
