import type { Metadata } from "next";
import Link from "next/link";
import { getAuditLogs, type AuditLogRow } from "@/lib/admin/audit";
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, describeChange, type AuditCategory } from "@/lib/admin/audit-core";
import { requireAdmin } from "@/lib/auth/current";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Journal" };

type Params = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function href(category: AuditCategory | undefined, page = 1) {
  const params = new URLSearchParams();
  if (category) params.set("categorie", category);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/journal?${qs}` : "/admin/journal";
}

/** Les actions qui meritent l'attention portent un repere, jamais la couleur seule. */
function isAlert(action: AuditLogRow["action"]) {
  return action === "auth.admin_login_failed" || action === "product.deleted" || action === "demo.reset";
}

function entityLink(entry: AuditLogRow): string | null {
  if (!entry.entityId) return null;
  if (entry.entityType === "product" && entry.action !== "product.deleted") return `/admin/produits/${entry.entityId}`;
  if (entry.entityType === "category" && entry.action !== "category.deleted") return "/admin/categories";
  if (entry.entityType === "order" && entry.entityLabel) return `/admin/commandes?q=${encodeURIComponent(entry.entityLabel)}`;
  return null;
}

export default async function JournalPage({ searchParams }: { searchParams: Params }) {
  await requireAdmin();
  const params = await searchParams;
  const rawCategory = first(params.categorie);
  const category = rawCategory && rawCategory in AUDIT_CATEGORIES ? (rawCategory as AuditCategory) : undefined;
  const requestedPage = Number(first(params.page));
  const { entries, total, page, pageCount } = await getAuditLogs({
    category,
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  });

  const filters: Array<{ key?: AuditCategory; label: string }> = [
    { key: undefined, label: "Tout" },
    ...(Object.entries(AUDIT_CATEGORIES) as Array<[AuditCategory, { label: string }]>).map(([key, c]) => ({
      key,
      label: c.label,
    })),
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Traçabilité</p>
        <h1 className="mt-2 text-3xl">Journal</h1>
        <p className="mt-2 max-w-2xl text-sm text-fg-2">
          Qui a fait quoi, et quand. Les entrées ne peuvent être ni modifiées ni effacées depuis
          l&apos;application. Le journal commence à sa mise en service : les actions antérieures n&apos;y
          figurent pas.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrer le journal">
        {filters.map((f) => {
          const active = f.key === category;
          return (
            <a
              key={f.key ?? "tout"}
              href={href(f.key)}
              aria-current={active ? "page" : undefined}
              className={`rounded-card border px-3 py-1.5 text-sm transition-colors ${
                active ? "border-fg bg-fg text-bg" : "border-line bg-bg text-fg-2 hover:border-fg-3 hover:text-fg"
              }`}
            >
              {f.label}
            </a>
          );
        })}
      </nav>

      <p className="text-sm text-fg-2">
        {total === 0 ? "Aucune entrée" : `${total} entrée${total > 1 ? "s" : ""}`}
      </p>

      <ol className="card divide-y divide-line overflow-hidden">
        {entries.map((entry) => {
          const link = entityLink(entry);
          const changes = Object.entries(entry.changes);
          return (
            <li key={entry.id} className="grid gap-x-6 gap-y-2 px-5 py-4 md:grid-cols-[11rem_minmax(0,1fr)_minmax(0,14rem)]">
              <time dateTime={entry.createdAt} className="tabular text-sm text-fg-3">
                {formatDateTime(entry.createdAt)}
              </time>

              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  {isAlert(entry.action) ? (
                    <span className="rounded-card border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-danger">
                      À vérifier
                    </span>
                  ) : null}
                  <span className="font-semibold">{AUDIT_ACTIONS[entry.action]}</span>
                  {entry.entityLabel ? (
                    link ? (
                      <Link href={link} className="break-words text-fg-2 underline-offset-4 hover:underline">
                        {entry.entityLabel}
                      </Link>
                    ) : (
                      <span className="break-words text-fg-2">{entry.entityLabel}</span>
                    )
                  ) : null}
                </p>
                {changes.length > 0 ? (
                  <ul className="space-y-0.5 text-sm text-fg-2">
                    {changes.map(([field, change]) => (
                      <li key={field} className="break-words">
                        {describeChange(field, change)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="min-w-0 text-sm md:text-right">
                <p className="break-words text-fg-2">{entry.actorEmail ?? "—"}</p>
                {entry.ip ? <p className="tabular text-xs text-fg-3">{entry.ip}</p> : null}
              </div>
            </li>
          );
        })}

        {entries.length === 0 ? (
          <li className="px-5 py-10 text-center text-sm text-fg-2">
            {category ? "Aucune entrée dans cette catégorie." : "Aucune entrée pour le moment."}
          </li>
        ) : null}
      </ol>

      {pageCount > 1 ? (
        <nav className="flex items-center justify-between gap-3 text-sm" aria-label="Pagination">
          {page > 1 ? (
            <a href={href(category, page - 1)} rel="prev" className="btn-outline">
              Plus récentes
            </a>
          ) : (
            <span aria-disabled="true" className="btn-outline pointer-events-none opacity-40">
              Plus récentes
            </span>
          )}
          <span className="tabular text-fg-2">
            Page {page} sur {pageCount}
          </span>
          {page < pageCount ? (
            <a href={href(category, page + 1)} rel="next" className="btn-outline">
              Plus anciennes
            </a>
          ) : (
            <span aria-disabled="true" className="btn-outline pointer-events-none opacity-40">
              Plus anciennes
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
