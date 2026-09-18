import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "@/lib/db/client";
import { authSecret } from "@/lib/auth/session";
import { NewsletterError, unsubscribeToken } from "@/lib/shop/newsletter";
import { listSubscribers, newsletterCounts, subscribe, unsubscribe } from "@/lib/shop/newsletter-store";

/** Newsletter contre un vrai PostgreSQL. Adresses @newsletter.test, effacees a la fin. */

async function purge() {
  await sql`DELETE FROM newsletter_subscribers WHERE email LIKE '%@newsletter.test'`;
}
async function row(email: string) {
  const [r] = await sql<Array<{ consented_at: Date; unsubscribed_at: Date | null }>>`
    SELECT consented_at, unsubscribed_at FROM newsletter_subscribers WHERE lower(email) = ${email}
  `;
  return r;
}

beforeEach(purge);
afterAll(async () => {
  await purge();
  await sql.end();
});

describe("inscription", () => {
  it("inscrit une adresse avec son consentement, une seule fois quelle que soit la casse", async () => {
    await subscribe({ email: "Awa@Newsletter.test", consent: "on" });
    await subscribe({ email: "awa@newsletter.test", consent: "on" });
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM newsletter_subscribers WHERE lower(email) = 'awa@newsletter.test'`;
    expect(n).toBe(1);
    expect((await row("awa@newsletter.test")).unsubscribed_at).toBeNull();
  });

  it("refuse sans consentement ou avec une adresse invalide, sans rien écrire", async () => {
    for (const [raw, code] of [
      [{ email: "awa@newsletter.test" }, "consentement"],
      [{ email: "pas-une-adresse", consent: "on" }, "email"],
    ] as const) {
      const error = await subscribe(raw).catch((e) => e);
      expect(error).toBeInstanceOf(NewsletterError);
      expect(error.code).toBe(code);
    }
    expect(await row("awa@newsletter.test")).toBeUndefined();
  });

  it("deux inscriptions simultanées de la même adresse n'en créent qu'une", async () => {
    await Promise.all(Array.from({ length: 5 }, () => subscribe({ email: "koffi@newsletter.test", consent: "on" })));
    const [{ n }] = await sql<Array<{ n: number }>>`SELECT count(*)::int AS n FROM newsletter_subscribers WHERE lower(email) = 'koffi@newsletter.test'`;
    expect(n).toBe(1);
  });
});

describe("désinscription", () => {
  it("par le lien signé : marquée, jamais effacée ; se réinscrire renouvelle le consentement", async () => {
    await subscribe({ email: "awa@newsletter.test", consent: "on" });
    const before = await row("awa@newsletter.test");

    expect(await unsubscribe("awa@newsletter.test", unsubscribeToken("awa@newsletter.test", authSecret()))).toBe(true);
    const after = await row("awa@newsletter.test");
    expect(after).toBeDefined();
    expect(after.unsubscribed_at).not.toBeNull();
    expect((await listSubscribers({ activeOnly: true })).map((s) => s.email)).not.toContain("awa@newsletter.test");

    await new Promise((r) => setTimeout(r, 20));
    await subscribe({ email: "awa@newsletter.test", consent: "on" });
    const again = await row("awa@newsletter.test");
    expect(again.unsubscribed_at).toBeNull();
    expect(again.consented_at.getTime()).toBeGreaterThan(before.consented_at.getTime());
  });

  it("refuse un lien falsifié ou celui d'une autre adresse", async () => {
    await subscribe({ email: "awa@newsletter.test", consent: "on" });
    expect(await unsubscribe("awa@newsletter.test", "0".repeat(32))).toBe(false);
    expect(await unsubscribe("awa@newsletter.test", unsubscribeToken("autre@newsletter.test", authSecret()))).toBe(false);
    expect((await row("awa@newsletter.test")).unsubscribed_at).toBeNull();
  });

  it("compte actifs et désinscrits", async () => {
    const start = await newsletterCounts();
    await subscribe({ email: "a1@newsletter.test", consent: "on" });
    await subscribe({ email: "a2@newsletter.test", consent: "on" });
    await unsubscribe("a2@newsletter.test", unsubscribeToken("a2@newsletter.test", authSecret()));
    expect(await newsletterCounts()).toEqual({ active: start.active + 1, unsubscribed: start.unsubscribed + 1 });
  });
});
