-- 0008 · Avis clients.
--
-- Seul un acheteur verifie peut noter : l'avis est rattache a la commande
-- (livree) qui contenait le produit, un seul avis par produit et par
-- commande. Il n'apparait sur le site qu'apres validation par
-- l'administration. Un avis refuse est garde (statut 'refuse'), jamais efface.

CREATE TABLE reviews (
  id           TEXT PRIMARY KEY,
  product_id   TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  author_name  TEXT NOT NULL CHECK (char_length(author_name) BETWEEN 2 AND 40),
  rating       SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         TEXT NOT NULL CHECK (char_length(body) BETWEEN 10 AND 1000),
  status       TEXT NOT NULL DEFAULT 'en_attente'
                 CHECK (status IN ('en_attente', 'publie', 'refuse')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  moderated_at TIMESTAMPTZ,
  UNIQUE (order_id, product_id)
);

-- Avis publies d'un produit (fiche, moyenne des cartes) et file de moderation.
CREATE INDEX reviews_product_published_idx ON reviews (product_id, created_at DESC) WHERE status = 'publie';
CREATE INDEX reviews_status_created_idx ON reviews (status, created_at DESC);

ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'product.created',
  'product.updated',
  'product.deleted',
  'product.stock_adjusted',
  'product.published',
  'product.unpublished',
  'product.image_deleted',
  'product.category_moved',
  'category.created',
  'category.updated',
  'category.reordered',
  'category.deleted',
  'review.published',
  'review.rejected',
  'order.status_changed',
  'auth.admin_login',
  'auth.admin_login_failed',
  'auth.password_reset',
  'demo.reset'
));

ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_entity_type_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_entity_type_check
  CHECK (entity_type IN ('product', 'order', 'user', 'category', 'review'));
