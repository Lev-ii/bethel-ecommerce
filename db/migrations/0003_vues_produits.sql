-- 0003 · Vues des fiches produit.
--
-- Une ligne par visiteur, par produit et par jour : la cle primaire fait le
-- dedoublonnage, un visiteur qui rouvre dix fois la fiche compte une fois.
--
-- Aucune donnee personnelle : visitor_hash est une empreinte HMAC de
-- l'adresse IP, du navigateur et du jour. Elle change chaque jour, ce qui
-- empeche de suivre un visiteur d'un jour a l'autre, et l'IP n'est jamais
-- enregistree.

CREATE TABLE product_views (
  product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  day          DATE NOT NULL,
  visitor_hash TEXT NOT NULL,
  PRIMARY KEY (product_id, day, visitor_hash)
);

CREATE INDEX product_views_day_idx ON product_views (day, product_id);
