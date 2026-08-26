-- Schema de la base Bethel.
--
-- Source de verite unique de la structure. Applique par `npm run db:setup`,
-- qui est idempotent : on peut le relancer sans rien casser.
--
-- Les montants sont des entiers, dans l'unite de la devise. Le F CFA n'a pas
-- de centimes, et on ne met jamais de flottant sur de l'argent.

CREATE TABLE IF NOT EXISTS categories (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  tagline     TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
  id                    TEXT PRIMARY KEY,
  slug                  TEXT NOT NULL UNIQUE,
  name                  TEXT NOT NULL,
  brand                 TEXT NOT NULL,
  category              TEXT NOT NULL REFERENCES categories(slug),
  headline              TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  price                 INTEGER NOT NULL CHECK (price > 0),
  compare_at_price      INTEGER CHECK (compare_at_price IS NULL OR compare_at_price > price),
  stock                 INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_threshold   INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  image                 TEXT NOT NULL,
  featured              BOOLEAN NOT NULL DEFAULT FALSE,
  -- Produit occupant la fiche technique du hero. Un seul a la fois.
  is_hero               BOOLEAN NOT NULL DEFAULT FALSE,
  published             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index calques sur les filtres reellement utilises par le catalogue.
CREATE INDEX IF NOT EXISTS products_published_category_idx
  ON products (published, category);
CREATE INDEX IF NOT EXISTS products_published_featured_idx
  ON products (published, featured);

-- Un seul produit vedette. La contrainte est posee en base plutot que dans le
-- code : meme une mise a jour manuelle depuis Supabase ne peut pas en creer
-- deux. L'index partiel ne couvre que les lignes a TRUE.
CREATE UNIQUE INDEX IF NOT EXISTS products_single_hero_idx
  ON products (is_hero) WHERE is_hero;

CREATE TABLE IF NOT EXISTS product_specs (
  id          BIGSERIAL PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  value       TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS product_specs_product_idx
  ON product_specs (product_id, position);

CREATE TABLE IF NOT EXISTS product_images (
  id         BIGSERIAL PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_images_product_idx
  ON product_images (product_id, position, id);

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'CLIENT' CHECK (role IN ('ADMIN', 'CLIENT')),
  phone          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  reference       TEXT NOT NULL UNIQUE,
  -- Une commande peut etre passee sans compte : on ne perd pas la vente
  -- pour une inscription. Si le compte est supprime, la commande reste.
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  customer_email  TEXT,
  delivery_mode   TEXT NOT NULL CHECK (delivery_mode IN ('livraison', 'retrait')),
  address         TEXT,
  city            TEXT,
  payment_method  TEXT NOT NULL,
  -- Reference de transaction rendue par le prestataire. Aucune donnee
  -- bancaire n'est stockee ici, seulement cet identifiant.
  payment_ref     TEXT,
  paid_at         TIMESTAMPTZ,
  total           INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'recue'
                    CHECK (status IN ('recue','preparee','expediee','livree','annulee')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_expiry_idx
  ON password_reset_tokens (token_hash, expires_at);

CREATE TABLE IF NOT EXISTS order_lines (
  id          BIGSERIAL PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  -- Le produit peut disparaitre du catalogue ; la commande garde le nom et le
  -- prix pratiques ce jour-la. C'est pour cela qu'ils sont recopies ici.
  product_id  TEXT REFERENCES products(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  unit_price  INTEGER NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS order_lines_order_idx ON order_lines (order_id);

-- Rattrapage des bases creees avant l'ajout du produit vedette.
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_hero BOOLEAN NOT NULL DEFAULT FALSE;
