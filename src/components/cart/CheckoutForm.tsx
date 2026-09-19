"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { trackShopEvent } from "@/lib/tracking/pixels";
import Image from "next/image";
import Link from "next/link";
import { Banknote, Loader2, Smartphone, Store } from "lucide-react";
import { EmptyState } from "@/components/ui/Primitives";
import { formatPrice } from "@/lib/format";
import { quoteShipping } from "@/lib/shop/shipping";
import { useCart, useCartTotal } from "@/store/cart";
import { placeOrder } from "@/lib/shop/actions";

type Errors = Partial<Record<"name" | "phone" | "address" | "city" | "operator", string>>;

type Operator = "wave" | "orange" | "mtn" | "moov" | "djamo";

// Jeko fige l'operateur a la creation de la demande : sa page de paiement
// n'autorise pas d'en changer. Le client doit donc le choisir ici.
/**
 * Brouillon des coordonnees, garde dans le navigateur.
 *
 * Le paiement en ligne sort du site : le client part chez Jeko et peut
 * revenir sans avoir paye, par le bouton retour. Sans ce brouillon, l'etat
 * React est perdu a la navigation et il doit ressaisir nom, telephone et
 * adresse. Le panier, lui, persiste deja (voir store/cart).
 *
 * Reste dans ce navigateur, n'est jamais envoye au serveur, et disparait a la
 * page de confirmation (voir ClearCartOnMount).
 */
export const CHECKOUT_DRAFT_KEY = "bethel-commande-brouillon";

// Wave en tete : c'est le mobile money le plus utilise en Cote d'Ivoire. Jeko
// l'accepte (voir JEKO_PAYMENT_METHOD dans lib/shop/payment.ts) ; il manquait
// seulement ici, et un client ne le trouvait pas au moment de payer.
const OPERATORS: Array<{ id: Operator; name: string; logo: string }> = [
  { id: "wave", name: "Wave", logo: "/paiement/wave.png" },
  { id: "orange", name: "Orange Money", logo: "/paiement/orange.png" },
  { id: "mtn", name: "MTN Money", logo: "/paiement/mtn.png" },
  { id: "moov", name: "Moov Money", logo: "/paiement/moov.png" },
  { id: "djamo", name: "Djamo", logo: "/paiement/djamo.png" },
];

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
  const [payment, setPayment] = useState<"mobile-money" | "hors-ligne">("mobile-money");
  const [operator, setOperator] = useState<Operator | null>(null);
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
  const [draftLoaded, setDraftLoaded] = useState(false);
  const checkoutTracked = useRef(false);

  // Pixels : debut de commande, une fois par affichage, panier connu.
  useEffect(() => {
    if (!ready || items.length === 0 || checkoutTracked.current) return;
    checkoutTracked.current = true;
    trackShopEvent({
      name: "InitiateCheckout",
      lines: items.map((i) => ({ id: i.productId, quantity: i.quantity, price: i.unitPrice })),
    });
  }, [ready, items]);

  // Relecture du brouillon. Apres le montage seulement : le serveur ne connait
  // pas le stockage du navigateur, le lire au rendu ferait diverger les deux.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHECKOUT_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Record<string, unknown>;
        if (draft.mode === "livraison" || draft.mode === "retrait") setMode(draft.mode);
        if (draft.payment === "mobile-money" || draft.payment === "hors-ligne") {
          setPayment(draft.payment);
        }
        if (OPERATORS.some((o) => o.id === draft.operator)) {
          setOperator(draft.operator as Operator);
        }
        const saved = draft.form;
        if (saved && typeof saved === "object") {
          const champ = (cle: string) => {
            const valeur = (saved as Record<string, unknown>)[cle];
            return typeof valeur === "string" ? valeur : undefined;
          };
          // Le brouillon ne prime que la ou il porte une valeur : sinon le
          // pre-remplissage venant du compte resterait ecrase par du vide.
          setForm((actuel) => ({
            name: champ("name") || actuel.name,
            phone: champ("phone") || actuel.phone,
            email: champ("email") || actuel.email,
            address: champ("address") ?? actuel.address,
            city: champ("city") ?? actuel.city,
            note: champ("note") ?? actuel.note,
          }));
        }
      }
    } catch {
      // Brouillon illisible, ou stockage refuse par le navigateur (navigation
      // privee) : on repart du formulaire vierge, ce n'est pas une erreur.
    }
    setDraftLoaded(true);
  }, []);

  // Sauvegarde a chaque frappe. draftLoaded garde le premier passage, sinon
  // l'etat initial vide ecraserait le brouillon avant sa relecture.
  useEffect(() => {
    if (!draftLoaded) return;
    try {
      localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ mode, payment, operator, form }));
    } catch {
      // Stockage plein ou refuse : la commande reste possible sans brouillon.
    }
  }, [draftLoaded, mode, payment, operator, form]);

  if (!ready || !draftLoaded) {
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
    if (payment === "mobile-money" && !operator) {
      next.operator = "Choisissez votre opérateur mobile money.";
    }
    return next;
  };

  const offlineMethod = mode === "retrait" ? "especes-retrait" : "paiement-livraison";
  const paymentMethod = payment === "mobile-money" ? operator : offlineMethod;
  const operatorName = OPERATORS.find((o) => o.id === operator)?.name;

  const submit = async () => {
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = document.querySelector<HTMLElement>("[data-error='true']");
      first?.scrollIntoView({ block: "center", behavior: "smooth" });
      first?.focus();
      return;
    }

    if (!paymentMethod) return;

    setSubmitting(true);
    setServerError(null);

    const result = await placeOrder({
      customerName: form.name.trim(),
      customerPhone: form.phone.trim(),
      customerEmail: form.email.trim() || undefined,
      deliveryMode: mode,
      address: mode === "livraison" ? form.address.trim() : undefined,
      city: mode === "livraison" ? form.city.trim() : undefined,
      paymentMethod,
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    });

    if (result.error || !result.reference) {
      setServerError(result.error ?? "La commande n'a pas pu être enregistrée.");
      setSubmitting(false);
      return;
    }

    if (result.checkoutUrl) {
      // Le panier n'est pas vide ici : le client n'a pas encore paye, il va
      // sur la page du prestataire de paiement et peut annuler. On le vide
      // seulement s'il revient effectivement sur la page de confirmation
      // (voir ClearCartOnMount).
      window.location.assign(result.checkoutUrl);
      return;
    }

    clear();
    router.push(
      `/commande/confirmation?ref=${result.reference}${result.accessToken ? `&t=${result.accessToken}` : ""}&total=${result.total}&mode=${mode}${
        result.paymentPending ? "&paiement=attente" : ""
      }`
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
              label="Téléphone"
              type="tel"
              value={form.phone}
              onChange={set("phone")}
              error={errors.phone}
              autoComplete="tel"
              placeholder="+225 00 00 00 00"
              hint="Suivi de commande et facture envoyés par WhatsApp sur ce numéro."
            />
            <div className="sm:col-span-2">
              <Field
                id="email"
                label="Email (facultatif)"
                type="email"
                value={form.email}
                onChange={set("email")}
                autoComplete="email"
                hint="Pour recevoir aussi la facture et le suivi par email."
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
              detail={
                <span className="mt-1.5 flex items-center gap-1.5" aria-label="Wave, Orange Money, MTN Money, Moov Money, Djamo">
                  {OPERATORS.map((o) => (
                    <Image key={o.id} src={o.logo} alt="" width={24} height={24} className="rounded-full" />
                  ))}
                </span>
              }
              icon={<Smartphone size={17} aria-hidden />}
            />
            {mode === "retrait" ? (
              <ChoiceCard
                active={payment === "hors-ligne"}
                onClick={() => setPayment("hors-ligne")}
                title="Espèces au retrait"
                detail="Vous payez en boutique"
                icon={<Store size={17} aria-hidden />}
              />
            ) : (
              <ChoiceCard
                active={payment === "hors-ligne"}
                onClick={() => setPayment("hors-ligne")}
                title="Paiement à la livraison"
                detail="Réglez à la réception"
                icon={<Banknote size={17} aria-hidden />}
              />
            )}
          </div>

          {payment === "mobile-money" ? (
            <fieldset
              className="mt-5"
              tabIndex={-1}
              data-error={errors.operator ? "true" : undefined}
              aria-describedby={errors.operator ? "operator-error" : undefined}
            >
              <legend className="field-label">Votre opérateur</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {OPERATORS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setOperator(o.id);
                      setErrors((e) => ({ ...e, operator: undefined }));
                    }}
                    aria-pressed={operator === o.id}
                    className={`flex items-center gap-2.5 rounded-card border p-3 text-left text-sm font-semibold transition-colors ${
                      operator === o.id
                        ? "border-fg bg-bg-2"
                        : errors.operator
                          ? "border-danger"
                          : "border-line hover:border-fg-3"
                    }`}
                  >
                    <Image src={o.logo} alt="" width={28} height={28} className="shrink-0 rounded-full" />
                    {o.name}
                  </button>
                ))}
              </div>
              {errors.operator ? (
                <p id="operator-error" className="mt-1.5 text-sm text-danger">
                  {errors.operator}
                </p>
              ) : null}
            </fieldset>
          ) : null}

          <p className="mt-4 text-sm text-fg-2">
            {payment === "hors-ligne"
              ? mode === "retrait"
                ? "Vous réglerez en espèces au moment du retrait en boutique."
                : "Vous paierez directement au livreur. Aucun paiement en ligne n'est nécessaire."
              : `Vous serez redirigé vers la page de paiement sécurisée${
                  operatorName ? ` ${operatorName}` : ""
                } pour confirmer depuis votre téléphone.`}
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
            payment === "hors-ligne" ? "Confirmer la commande" : "Valider et payer"
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
  detail: React.ReactNode;
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
