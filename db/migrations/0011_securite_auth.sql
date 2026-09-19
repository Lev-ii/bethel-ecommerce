-- 0011 · Durcissement de l'authentification.
--
-- 1. Version de session. Elle est inscrite dans le cookie a la connexion et
--    incrementee a chaque changement de mot de passe : les sessions ouvertes
--    avant le changement (cookie derobe, ordinateur partage) cessent de valoir.
--    Les comptes existants partent de 0, comme les cookies deja emis : personne
--    n'est deconnecte par le deploiement.
--
-- 2. Limitation de la reinitialisation de mot de passe. Chaque demande, et
--    chaque lien invalide presente, laisse une trace comptee sur une fenetre
--    glissante. Le sujet est une adresse IP ou l'empreinte SHA-256 d'une
--    adresse email : la table ne contient aucune adresse en clair.
--    Aucune purge automatique : les lignes sont petites, et les comptages ne
--    lisent que la fenetre recente, par l'index.
--
-- 3. Nouvelle action du journal : lien de reinitialisation cree par
--    l'administration, pour un client qui le recoit par WhatsApp.

ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE auth_throttle_events (
  id         BIGSERIAL PRIMARY KEY,
  bucket     TEXT NOT NULL CHECK (bucket IN ('reset_request', 'reset_attempt')),
  subject    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX auth_throttle_events_lookup_idx
  ON auth_throttle_events (bucket, subject, created_at DESC);

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
  'auth.reset_link_created',
  'demo.reset'
));
