/**
 * Cree un compte administrateur.
 *
 *   npm run admin:create -- <email> [mot-de-passe]
 *
 * Sans mot de passe, un mot de passe solide est tire au hasard et affiche une
 * seule fois : rien n'est ecrit dans le depot, qui est public.
 */
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import postgres from "postgres";

const [email, given] = process.argv.slice(2);

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error("\nUsage : npm run admin:create -- <email> [mot-de-passe]\n");
  process.exit(1);
}

const password = given ?? `${randomBytes(9).toString("base64url")}9a`;

if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
  console.error("\nLe mot de passe doit faire au moins 8 caracteres et contenir une lettre et un chiffre.\n");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("\nDATABASE_URL n'est pas defini.\n");
  process.exit(1);
}

// Meme format que lib/auth/password.ts : "sel-hexadecimal:hachage".
const hash = (value) =>
  new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(value, salt, 64, (error, key) =>
      error ? reject(error) : resolve(`${salt}:${key.toString("hex")}`)
    );
  });

const sql = postgres(url, {
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
  prepare: false,
  max: 1,
});

const [existing] = await sql`SELECT id FROM users WHERE lower(email) = lower(${email})`;
const passwordHash = await hash(password);

if (existing) {
  // session_version + 1 : les sessions ouvertes avec l'ancien mot de passe
  // cessent de valoir.
  await sql`
    UPDATE users
    SET password_hash = ${passwordHash}, role = 'ADMIN', session_version = session_version + 1
    WHERE id = ${existing.id}
  `;
  console.log(`\nCompte existant : mot de passe remplace et role ADMIN confirme (${email}).`);
} else {
  await sql`
    INSERT INTO users (id, email, name, password_hash, role)
    VALUES (${randomUUID()}, ${email}, ${process.env.ADMIN_NAME?.trim() || "Administrateur"}, ${passwordHash}, 'ADMIN')
  `;
  console.log(`\nCompte administrateur cree : ${email}`);
}

if (!given) {
  console.log(`Mot de passe (affiche une seule fois) : ${password}`);
  console.log("Notez-le maintenant, il n'est stocke nulle part en clair.");
}
console.log();

await sql.end();
