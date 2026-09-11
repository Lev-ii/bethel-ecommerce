import test from "node:test";
import assert from "node:assert/strict";

import { getFallbackCategories, getFallbackProducts } from "../src/lib/catalog-fallback";

test("fallback catalog is used when the database is unavailable", () => {
  const categories = getFallbackCategories();
  const products = getFallbackProducts();

  assert.ok(categories.length > 0);
  assert.ok(products.length > 0);
  assert.equal(products[0].published, true);
  assert.equal(categories[0].slug, "trepieds");
});
