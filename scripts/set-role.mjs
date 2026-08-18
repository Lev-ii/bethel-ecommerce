/**
 * Change le role d'un compte, ou liste les comptes existants.
 *
 *   npm run admin:role                              liste les comptes
 *   npm run admin:role -- levi@exemple.com ADMIN    promeut
 *   npm run admin:role -- levi@exemple.com CLIENT   retrograde
 *
 * Le formulaire d'inscription ne cree que des comptes CLIENT, volontairement :
 * personne ne doit pouvoir se donner les droits d'administration depuis le
 * site. Cette commande est le seul chemin, et elle demande un acces a la base.
 *
 * A savoir : le role est inscrit dans le cookie de session. Une personne deja
 * connectee garde son ancien role jusqu'a ce qu'elle se deconnecte et se
 * reconnecte.
 */
import postgres from "postgres";

const [email, role] = process.argv.slice(2);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("\nDATABASE_URL n'est pas defini. Renseignez .env.\n");
  process.exit(1);
}

const sql = postgres(url, {
  ssl: url.includes("localhost") || url.includes("127.0.0.1") ? false : "require",
  prepare: false,
  onnotice: () => {},
});

try {
  // Sans argument : lister, pour retrouver une adresse exacte.
  if (!email) {
    const comptes = await sql`
      SELECT email, name, role, created_at FROM users ORDER BY created_at
    `;

    if (comptes.length === 0) {
      console.log("\nAucun compte.\n");
    } else {
      console.log("\nComptes existants :\n");
      for (const c of comptes) {
        const date = new Date(c.created_at).toLocaleDateString("fr-FR");
        console.log(`  ${c.role.padEnd(7)} ${c.email.padEnd(32)} ${c.name}  (${date})`);
      }
      console.log(
        '\nPour promouvoir : npm run admin:role -- <email> ADMIN\n'
      );
    }
    process.exit(0);
  }

  if (role !== "ADMIN" && role !== "CLIENT") {
    console.error("\nLe role doit etre ADMIN ou CLIENT.\n");
    console.error("  npm run admin:role -- <email> ADMIN\n");
    process.exit(1);
  }

  const cible = email.toLowerCase();

  // Ne pas retirer le dernier administrateur : plus personne ne pourrait
  // ouvrir l'administration, ni se redonner les droits depuis le site.
  if (role === "CLIENT") {
    const [{ count }] = await sql`
      SELECT count(*)::int AS count FROM users
      WHERE role = 'ADMIN' AND lower(email) <> ${cible}
    `;
    if (count === 0) {
      console.error(
        "\nC'est le dernier administrateur. Promouvez d'abord quelqu'un d'autre.\n"
      );
      process.exit(1);
    }
  }

  const rows = await sql`
    UPDATE users SET role = ${role}
    WHERE lower(email) = ${cible}
    RETURNING email, name, role
  `;

  if (rows.length === 0) {
    console.error(`\nAucun compte avec l'adresse ${email}.`);
    console.error("Lancez la commande sans argument pour voir la liste.\n");
    process.exit(1);
  }

  console.log(`\n${rows[0].name} (${rows[0].email}) est desormais ${rows[0].role}.`);
  console.log(
    "Si la personne est connectee, elle doit se deconnecter et se reconnecter :\n" +
      "le role est inscrit dans le cookie de session.\n"
  );
} finally {
  await sql.end();
}
