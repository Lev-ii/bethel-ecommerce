"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Banknote, CreditCard, Loader2, Smartphone, Store } from "lucide-react";
import { EmptyState } from "@/components/ui/Primitives";
import { buildOrderReference, formatPrice } from "@/lib/format";
import { quoteShipping } from "@/lib/shop/shipping";
import { useCart, useCartTotal } from "@/store/cart";
import { placeOrder } from "@/lib/shop/actions";
import type { PaymentMethod } from "@/lib/types";

type Errors = Partial<Record<"name" | "phone" | "address" | "city", string>>;

export function CheckoutForm({
  account,
}: {
  account?: { name: string; email: string; phone?: string } | null;
}) {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const ready = useCart((s) => s.ready);
  const clear = useCart((s) => s.clear);
  const subtotal = useCartTotal();

  const [mode, setMode] = useState<"livraison" | "retrait">("livraison");
  const [payment, setPayment] = useState<PaymentMethod>("mobile-money");
  const [form, setForm] = useState({
    name: account?.name ?? "",
    phone: account?.phone ?? "",
    email: account?.email ?? "",
    address: "",
    city: "",
    note: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-card bg-bg-2" />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Il n'y a rien à commander"
        description="Ajoutez du matériel à votre panier avant de passer commande."
        actionLabel="Voir le matériel"
        actionHref="/boutique"
      />
    );
  }

  const shipping = quoteShipping(form.city);
  const fee = mode === "livraison" ? shipping.fee : 0;
  const total = subtotal + fee;

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (): Errors => {
    const next: Errors = {};
    if (form.name.trim().length < 3) {
      next.name = "Indiquez votre nom complet.";
    }
    if (!/^[+\d][\d\s]{7,}$/.test(form.phone.trim())) {
      next.phone = "Indiquez un numéro joignable, avec l'indicatif.";
    }
    if (mode === "livraison") {
      if (form.address.trim().length < 5) {
        next.address = "Précisez la rue et le quartier.";
      }
      if (form.city.trim().length < 2) {
        next.city = "Indiquez la ville de livraison.";
      }
    }
    return next;
  };

  const submit = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = document.querySelector<HTMLElement>("[data-error='true']");
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
      first?.focus();
      return;
    }

    setSubmitting(true);
    setServerError(null);

    // Etape suivante : appel au prestataire de paiement avant cet
    // enregistrement. Voir README, "Agregateurs de paiement".
    const result = await placeOrder({
      customerName: form.name.trim(),
      customerPhone: form.phone.trim(),
      customerEmail: form.email.trim() || undefined,
      deliveryMode: mode,
      address: mode === "livraison" ? form.address.trim() : undefined,
      city: mode === "livraison" ? form.city.trim() : undefined,
      paymentMethod: payment,
      deliveryFee: fee,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });

    if (result.error || !result.reference) {
      setServerError(result.error ?? "La commande n'a pas pu etre enregistree.");
      setSubmitting(false);
      return;
    }

    clear();
    router.push(
      `/commande/confirmation?ref=${result.reference}&total=${result.total}&mode=${mode}`
    );
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        {/* Mode de reception */}
        <section className="card p-5">
          <h2 className="text-lg">Comment recevoir la commande</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              active={mode === "livraison"}
              onClick={() => setMode("livraison")}
              title="Livraison"
              detail={`${formatPrice(shipping.fee)} · ${shipping.label.split(" · ")[1]}`}
            />
            <ChoiceCard
              active={mode === "retrait"}
              onClick={() => setMode("retrait")}
              title="Retrait en boutique"
              detail="Gratuit · dès aujourd'hui"
              icon={<Store size={17} aria-hidden />}
            />
          </div>
        </section>

        {/* Coordonnees */}
        <section className="card p-5">
          <h2 className="text-lg">Vos coordonnées</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              id="nom"
              label="Nom complet"
              value={form.name}
              onChange={set("name")}
              error={errors.name}
              autoComplete="name"
            />
            <Field
              id="tel"
              label="Telephone"
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              error={errors.phone}
              autoComplete="tel"
              placeholder="+225 00 00 00 00"
              hint="Nous appelons ce numéro pour confirmer."
            />
            <div className="sm:col-span-2">
              <Field
                id="email"
                label="Email (facultatif)"
                type="email"
                value={form.email}
                onChange={set("email")}
                autoComplete="email"
                hint="Pour recevoir le recu de commande."
              />
            </div>

            {mode === "livraison" ? (
              <>
                <div className="sm:col-span-2">
                  <Field
                    id="adresse"
                    label="Adresse de livraison"
                    value={form.address}
                    onChange={set("address")}
                    error={errors.address}
                    autoComplete="street-address"
                    placeholder="Rue, quartier, point de repère"
                  />
                </div>
                <Field
                  id="ville"
                  label="Ville"
                  value={form.city}
                  onChange={set("city")}
                  error={errors.city}
                  autoComplete="address-level2"
                />
                  <p className="sm:col-span-2 -mt-2 text-sm text-fg-3">
                    {shipping.label}. Les frais sont calculés selon la ville indiquée.
                  </p>
              </>
            ) : null}
          </div>
        </section>

        {/* Paiement */}
        <section className="card p-5">
          <h2 className="text-lg">Paiement</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              active={payment === "mobile-money"}
              onClick={() => setPayment("mobile-money")}
              title="Mobile money"
              detail="Orange, MTN, Moov, Wave"
              icon={<Smartphone size={17} aria-hidden />}
            />
            <ChoiceCard
              active={payment === "carte"}
              onClick={() => setPayment("carte")}
              title="Carte bancaire"
              detail="Visa, Mastercard"
              icon={<CreditCard size={17} aria-hidden />}
            />
            {mode === "retrait" ? (
              <ChoiceCard
                active={payment === "especes-retrait"}
                onClick={() => setPayment("especes-retrait")}
                title="Especes au retrait"
                detail="Vous payez en boutique"
                icon={<Store size={17} aria-hidden />}
              />
            ) : null}
            {mode === "livraison" ? (
              <ChoiceCard
                active={payment === "paiement-livraison"}
                onClick={() => setPayment("paiement-livraison")}
                title="Paiement à la livraison"
                detail="Réglez à la réception"
                icon={<Banknote size={17} aria-hidden />}
              />
            ) : null}
          </div>
          <p className="mt-4 text-sm text-fg-2">
            {payment === "paiement-livraison"
              ? "Vous paierez directement au livreur. Aucun paiement en ligne n'est nécessaire."
              : "Le paiement est simulé pour le moment. Aucune donnée bancaire n'est enregistrée sur ce site."}
          </p>
        </section>
      </div>

      {/* Recapitulatif */}
      <aside className="card h-fit p-5 lg:sticky lg:top-24">
        <h2 className="text-lg">Votre commande</h2>

        <ul className="mt-4 space-y-2.5 text-sm">
          {items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-3">
              <span className="min-w-0 text-fg-2">
                <span className="tabular">{i.quantity}&times;</span> {i.name}
              </span>
              <span className="tabular shrink-0 font-medium">
                {formatPrice(i.unitPrice * i.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-fg-2">Sous-total</dt>
            <dd className="tabular">{formatPrice(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-fg-2">Livraison</dt>
            <dd className="tabular">
              {fee > 0 ? formatPrice(fee) : "Gratuit"}
            </dd>
          </div>
        </dl>

        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="font-semibold">Total</span>
          <span className="tabular text-xl font-semibold">
            {formatPrice(total)}
          </span>
        </div>

        {serverError ? (
          <p
            role="alert"
            className="mt-4 rounded-card border border-danger/40 bg-danger/5 px-3.5 py-2.5 text-sm text-danger"
          >
            {serverError}
          </p>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="btn-accent mt-5 w-full"
        >
          {submitting ? (
            <>
              <Loader2 size={17} aria-hidden className="animate-spin" />
              Validation...
            </>
          ) : (
            payment === "paiement-livraison" ? "Confirmer la commande" : "Valider et payer"
          )}
        </button>

        <Link
          href="/panier"
          className="mt-3 block text-center text-sm text-fg-2 underline underline-offset-4 hover:text-fg"
        >
          Revenir au panier
        </Link>
      </aside>
    </div>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  detail,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  detail: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-start gap-3 rounded-card border p-4 text-left transition-colors ${
        active
          ? "border-fg bg-bg-2"
          : "border-line hover:border-fg-3"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          active ? "border-brand bg-brand" : "border-line-2"
        }`}
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 font-semibold">
          {icon}
          {title}
        </span>
        <span className="mt-0.5 block text-sm text-fg-2">{detail}</span>
      </span>
    </button>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        data-error={error ? "true" : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`field ${error ? "border-danger" : ""}`}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-fg-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
