-- 0002 · Journal d'audit.
--
-- Qui a fait quoi, quand, et avec quelles valeurs avant et apres. En ajout
-- seul : l'application ne peut ni modifier ni effacer une entree.
--
-- actor_id n'est pas une cle etrangere : une entree doit survivre a la
-- suppression du compte qui l'a produite, et une contrainte ON DELETE SET NULL
-- ecrirait dans une table en ajout seul. L'email est recopie pour la meme
-- raison, et pour les tentatives de connexion echouees, qui n'ont pas d'acteur.

CREATE TABLE audit_logs (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id     TEXT,
  actor_email  TEXT,
  action       TEXT NOT NULL CHECK (action IN (
                 'product.created',
                 'product.updated',
                 'product.deleted',
                 'product.stock_adjusted',
                 'product.published',
                 'product.unpublished',
                 'product.image_deleted',
                 'order.status_changed',
                 'auth.admin_login',
                 'auth.admin_login_failed',
                 'auth.password_reset',
                 'demo.reset'
               )),
  entity_type  TEXT CHECK (entity_type IN ('product', 'order', 'user')),
  entity_id    TEXT,
  -- Nom du produit ou reference de la commande au moment de l'action : lisible
  -- meme apres suppression ou renommage.
  entity_label TEXT,
  -- { "champ": { "from": ..., "to": ... } }
  changes      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip           TEXT
);

CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC, id DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX audit_logs_action_idx ON audit_logs (action, created_at DESC);

-- Ajout seul. Un proprietaire de la base peut toujours retirer ce declencheur :
-- il protege contre une erreur de l'application, pas contre un administrateur
-- de la base. Une purge volontaire (retention) passe par
--   SET LOCAL bethel.audit_purge = 'on'
-- dans une transaction, ce qui la rend explicite et reperable.
CREATE FUNCTION audit_logs_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('bethel.audit_purge', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'audit_logs est en ajout seul : % refuse', TG_OP;
END
$$;

CREATE TRIGGER audit_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();

CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only();
