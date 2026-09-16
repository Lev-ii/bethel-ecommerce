"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function Field({
  id,
  name,
  label,
  hint,
  error,
  type = "text",
  defaultValue,
  placeholder,
  required,
  autoComplete,
  min,
  step,
  className = "",
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  type?: string;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  min?: number;
  step?: number;
  className?: string;
}) {
  // Un mot de passe peut etre affiche le temps de verifier la saisie : sur
  // telephone surtout, une faute de frappe invisible fait echouer la connexion.
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);

  const input = (
    <input
      id={id}
      name={name}
      type={isPassword && revealed ? "text" : type}
      defaultValue={defaultValue}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      min={min}
      step={step}
      aria-invalid={error ? true : undefined}
      aria-describedby={
        error ? `${id}-error` : hint ? `${id}-hint` : undefined
      }
      className={`field ${error ? "border-danger" : ""} ${
        type === "number" ? "tabular" : ""
      } ${isPassword ? "pr-11" : ""}`}
    />
  );

  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {!required ? (
          <span className="ml-1.5 font-normal text-fg-3">(facultatif)</span>
        ) : null}
      </label>
      {isPassword ? (
        <div className="relative">
          {input}
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-controls={id}
            aria-pressed={revealed}
            aria-label={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            title={revealed ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-card text-fg-3 transition-colors hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-fg"
          >
            {revealed ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
      ) : (
        input
      )}
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

export function TextArea({
  id,
  name,
  label,
  hint,
  defaultValue,
  rows = 4,
  className = "",
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="field resize-y"
      />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-fg-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  id,
  name,
  label,
  hint,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 shrink-0 accent-brand"
      />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium">{label}</span>
        {hint ? <span className="block text-fg-3">{hint}</span> : null}
      </label>
    </div>
  );
}

/** Bouton d'envoi qui se desactive et s'annonce pendant le traitement. */
export function SubmitButton({
  children,
  pendingLabel = "Enregistrement...",
  className = "btn-accent",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? (
        <>
          <Loader2 size={16} aria-hidden className="animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-card border border-danger/40 bg-danger/5 px-3.5 py-2.5 text-sm text-danger"
    >
      {message}
    </p>
  );
}
