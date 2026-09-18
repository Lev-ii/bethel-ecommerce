import type { Metadata } from "next";
import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/auth/current";
import { formatDateTime } from "@/lib/format";
import { listSubscribers, newsletterCounts } from "@/lib/shop/newsletter-store";

export const metadata: Metadata = { title: "Newsletter" };

export default async function NewsletterAdminPage() {
  await requireAdmin();
  const [counts, latest] = await Promise.all([newsletterCounts(), listSubscribers({ activeOnly: false, limit: 100 })]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Marketing</p>
          <h1 className="mt-2 text-3xl">Newsletter</h1>
          <p className="mt-2 max-w-2xl text-fg-2">
            Inscriptions depuis le bas de chaque page, avec consentement explicite. L&apos;envoi sera branché avec le nom
            de domaine ; d&apos;ici là, la liste se constitue et s&apos;exporte.
          </p>
        </div>
        <a href="/api/admin/newsletter/export" className="btn-accent inline-flex items-center gap-2">
          <Download size={16} aria-hidden /> Exporter les abonnés (CSV)
        </a>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <p className="eyebrow">Abonnés actifs</p>
          <p className="mt-2 text-3xl font-semibold tabular">{counts.active}</p>
        </div>
        <div className="card p-5">
          <p className="eyebrow">Désinscrits</p>
          <p className="mt-2 text-3xl font-semibold tabular">{counts.unsubscribed}</p>
          <p className="mt-1 text-sm text-fg-3">Conservés, jamais recontactés.</p>
        </div>
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line bg-bg-2 px-4 py-3 text-base">Dernières inscriptions</h2>
        {latest.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-fg-2">Aucune inscription pour le moment.</p>
        ) : (
          <ul className="divide-y divide-line">
            {latest.map((s) => (
              <li key={s.email} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0 truncate font-medium">{s.email}</span>
                <span className="text-fg-3">
                  {s.unsubscribedAt ? `désinscrit le ${formatDateTime(s.unsubscribedAt)}` : `inscrit le ${formatDateTime(s.consentedAt)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
