/**
 * Change le mot de passe d'un compte existant.
 *
 *   npm run admin:password -- <email> "<nouveau-mot-de-passe>"
 */
import { randomBytes, scrypt } from "node:crypto";
import postgres from "postgres";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("\nUsage : npm run admin:password -- <email> <mot-de-passe>\n");
  process.exit(1);
}

if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
  console.error(
    "\nLe mot de passe doit faire au moins 8 caracteres et contenir une lettre et un chiffre.\n"
  );
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("\nDATABASE_URL n'est pas defini. Renseignez .env.\n");
  process.exit(1);
}

function derive(passwordValue, salt) {
  return new Promise((resolve, reject) => {
    scrypt(passwordValue, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

const salt = randomBytes(16).toString("hex");
const hash = await derive(password, salt);
const passwordHash = `${salt}:${hash.toString("hex")}`;
const sql = postgres(url, {
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
  prepare: false,
  onnotice: () => {},
});

try {
  const rows = await sql`
    UPDATE users
    SET password_hash = ${passwordHash},
        -- Revoque les sessions ouvertes avec l'ancien mot de passe.
        session_version = session_version + 1
    WHERE lower(email) = ${email.trim().toLowerCase()}
    RETURNING email, name
  `;

  if (rows.length === 0) {
    console.error(`\nAucun compte avec l'adresse ${email}.\n`);
    process.exit(1);
  }

  console.log(`\nMot de passe mis a jour pour ${rows[0].name} (${rows[0].email}).\n`);
} finally {
  await sql.end();
}