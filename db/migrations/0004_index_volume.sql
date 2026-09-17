-- 0004 · Index pour l'historique et le tableau de bord sous volume.
--
-- Mesures sur 200 000 commandes (tests/volume) :
-- - liste des commandes et "dernieres commandes" : tri par date sans index,
--   donc lecture et tri de toute la table a chaque page ;
-- - commande par reference : la recherche porte sur lower(reference), que
--   l'index unique sur reference ne couvre pas ;
-- - lignes d'un produit (nom du produit le plus vendu, suppression d'un
--   produit qui remet product_id a NULL) : aucun index sur product_id.

CREATE INDEX orders_created_idx ON orders (created_at DESC, id);

CREATE INDEX orders_reference_lower_idx ON orders (lower(reference));

CREATE INDEX order_lines_product_idx ON order_lines (product_id);
