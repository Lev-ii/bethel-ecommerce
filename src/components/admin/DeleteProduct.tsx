"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { deleteProduct } from "@/lib/admin/actions";
import { SubmitButton } from "@/components/ui/Form";

/**
 * Suppression definitive.
 *
 * La confirmation demande de retaper le nom du materiel. C'est plus long
 * qu'un simple "Etes-vous sur ?", et c'est le but : on ne supprime pas une
 * fiche par reflexe.
 *
 * Le depliage passe par <details> et non par un etat React : le formulaire
 * existe donc dans la page des le premier rendu, et la suppression reste
 * possible si JavaScript n'a pas charge. La correspondance du nom est
 * revalidee cote serveur, le bouton grise n'etant qu'un confort.
 */
export function DeleteProduct({ id, name }: { id: string; name: string }) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === name.trim().toLowerCase();

  return (
    <section className="card border-danger/30 p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} aria-hidden className="mt-0.5 text-danger" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg">Supprimer ce materiel</h2>
          <p className="mt-1 text-sm text-fg-2">
            La fiche disparait de la boutique et de l&apos;administration. Les
            commandes deja passees gardent le nom et le prix pratiques ce
            jour-la.
          </p>

          <details className="group mt-4">
            <summary className="btn-outline inline-flex cursor-pointer border-danger/40 text-danger hover:border-danger hover:bg-danger/5">
              <Trash2 size={15} aria-hidden /> Supprimer
            </summary>

            <form action={deleteProduct} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={id} />

              <label htmlFor="confirmation" className="field-label">
                Pour confirmer, retapez{" "}
                <span className="font-semibold text-fg">{name}</span>
              </label>
              <input
                id="confirmation"
                name="confirmation"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                required
                className="field max-w-md"
              />

              <div className="flex flex-wrap gap-3 pt-1">
                <SubmitButton
                  disabled={!matches}
                  pendingLabel="Suppression..."
                  className={`btn ${
                    matches
                      ? "bg-danger text-bg hover:brightness-110"
                      : "cursor-not-allowed bg-bg-3 text-fg-3"
                  }`}
                >
                  Supprimer definitivement
                </SubmitButton>
              </div>

              {!matches && typed.length > 0 ? (
                <p className="text-sm text-fg-3">
                  Le nom ne correspond pas encore.
                </p>
              ) : null}
            </form>
          </details>
        </div>
      </div>
    </section>
  );
}
