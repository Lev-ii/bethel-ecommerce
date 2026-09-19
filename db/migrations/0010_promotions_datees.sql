-- 0010 · Promotions datees, fixees par l'administration.
--
-- Pendant la promotion (debut facultatif, fin obligatoire), le prix promo est
-- affiche ET facture ; a l'echeance, le prix normal revient de lui-meme, sans
-- tache planifiee : le prix effectif est calcule a chaque lecture.
-- Le prix barre permanent (compare_at_price) reste disponible a cote.

ALTER TABLE products
  ADD COLUMN promo_price     INTEGER,
  ADD COLUMN promo_starts_at TIMESTAMPTZ,
  ADD COLUMN promo_ends_at   TIMESTAMPTZ;

ALTER TABLE products ADD CONSTRAINT products_promo_check CHECK (
  (promo_price IS NULL AND promo_starts_at IS NULL AND promo_ends_at IS NULL)
  OR (
    promo_price > 0
    AND promo_price < price
    AND promo_ends_at IS NOT NULL
    AND (promo_starts_at IS NULL OR promo_starts_at < promo_ends_at)
  )
);
