-- 0007 · Categories administrables.
--
-- 1. Renommer une categorie recalcule son identifiant d'URL (slug), qui est
--    aussi la cle etrangere des produits : ON UPDATE CASCADE fait suivre les
--    produits. Supprimer une categorie reste refuse tant qu'elle contient des
--    produits (pas de CASCADE ni de SET NULL) : l'administration les deplace
--    d'abord, dans la meme transaction.
-- 2. Le journal d'audit accepte les actions sur les categories et le
--    deplacement de produits.

ALTER TABLE products DROP CONSTRAINT products_category_fkey;
ALTER TABLE products
  ADD CONSTRAINT products_category_fkey
  FOREIGN KEY (category) REFERENCES categories(slug) ON UPDATE CASCADE;

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
  'order.status_changed',
  'auth.admin_login',
  'auth.admin_login_failed',
  'auth.password_reset',
  'demo.reset'
));

ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_entity_type_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_entity_type_check
  CHECK (entity_type IN ('product', 'order', 'user', 'category'));
