-- 0009 · Inscrits a la newsletter.
--
-- Collecte seulement : l'envoi viendra avec le nom de domaine. Une personne
-- qui se desinscrit est marquee (unsubscribed_at), jamais effacee ; se
-- reinscrire efface la marque et note un nouveau consentement.

CREATE TABLE newsletter_subscribers (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL CHECK (char_length(email) BETWEEN 5 AND 254),
  source           TEXT NOT NULL DEFAULT 'pied-de-page' CHECK (char_length(source) <= 40),
  consented_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Une adresse une seule fois, sans tenir compte de la casse.
CREATE UNIQUE INDEX newsletter_subscribers_email_idx ON newsletter_subscribers (lower(email));
CREATE INDEX newsletter_subscribers_active_idx ON newsletter_subscribers (created_at DESC) WHERE unsubscribed_at IS NULL;
