"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import {
  Checkbox,
  Field,
  FormError,
  SubmitButton,
  TextArea,
} from "@/components/ui/Form";
import { GearImage } from "@/components/product/GearImage";
import { categories } from "@/lib/data/catalog";
import { createProduct, updateProduct } from "@/lib/admin/actions";
import { productErrorField, productErrorMessage } from "@/lib/admin/messages";
import type { Product, Spec } from "@/lib/types";

/**
 * Formulaire unique pour la creation et la modification.
 *
 * Les deux parcours partagent exactement les memes champs et les memes regles
 * de validation ; seule l'action serveur change. Les dupliquer reviendrait a
 * les voir diverger a la premiere evolution.
 */
export function ProductForm({
  product,
  erreur,
}: {
  product?: Product;
  /** Code d'erreur renvoye par l'action, transmis par l'URL. */
  erreur?: string;
}) {
  const isEdit = Boolean(product);
  const action = isEdit ? updateProduct : createProduct;
  const message = productErrorMessage(erreur);
  const invalidField = erreur ? productErrorField[erreur] : undefined;

  const [specs, setSpecs] = useState<Spec[]>(
    product?.specs.length ? product.specs : [{ label: "", value: "" }]
  );
  const [preview, setPreview] = useState<string | null>(null);

  const errorFor = (field: string) =>
    invalidField === field ? message : undefined;

  return (
    <form action={action} className="space-y-8">
      <FormError message={invalidField ? undefined : message} />

      {isEdit ? <input type="hidden" name="id" value={product!.id} /> : null}

      {/* ------------------------------------------------------ Identite */}
      <section className="card p-5">
        <h2 className="text-lg">Identite</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            id="name"
            name="name"
            label="Nom du materiel"
            required
            defaultValue={product?.name}
            error={errorFor("name")}
            placeholder="Ring light 18 pouces"
            className="sm:col-span-2"
          />
          <Field
            id="brand"
            name="brand"
            label="Marque"
            required
            defaultValue={product?.brand}
            error={errorFor("brand")}
            placeholder="Godox"
          />

          <div>
            <label htmlFor="category" className="field-label">
              Categorie
            </label>
            <select
              id="category"
              name="category"
              defaultValue={product?.category ?? ""}
              required
              aria-invalid={errorFor("category") ? true : undefined}
              className={`field ${errorFor("category") ? "border-danger" : ""}`}
            >
              <option value="" disabled>
                Choisir...
              </option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            {errorFor("category") ? (
              <p className="mt-1.5 text-sm text-danger">
                {errorFor("category")}
              </p>
            ) : null}
          </div>

          <Field
            id="headline"
            name="headline"
            label="Argument principal"
            required
            defaultValue={product?.headline}
            error={errorFor("headline")}
            hint="Une ligne, affichee sous le nom dans le catalogue."
            placeholder="Pied 2 m, support telephone, trois temperatures"
            className="sm:col-span-2"
          />

          <TextArea
            id="description"
            name="description"
            label="Description"
            defaultValue={product?.description}
            rows={5}
            hint="Ce que le client a besoin de savoir avant d'acheter."
            className="sm:col-span-2"
          />
        </div>
      </section>

      {/* --------------------------------------------------------- Photo */}
      <section className="card p-5">
        <h2 className="text-lg">Photo</h2>
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
          <GearImage
            src={preview ?? product?.image ?? "/produits/trepied.svg"}
            alt=""
            size={200}
            padding="p-[12%]"
            className="h-40 w-40 shrink-0 rounded-card"
          />

          <div className="min-w-0 flex-1">
            <label htmlFor="image" className="field-label">
              {isEdit ? "Remplacer la photo" : "Photo du materiel"}
            </label>
            <input
              id="image"
              name="image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : null);
              }}
              className="field file:mr-3 file:rounded-card file:border-0 file:bg-fg file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-bg"
            />
            <p className="mt-1.5 text-sm text-fg-3">
              PNG, JPEG ou WebP, 3 Mo maximum. Un fond transparent et un cadrage
              carre rendent le mieux.
            </p>
            {isEdit ? (
              <p className="mt-1.5 text-sm text-fg-3">
                Sans nouveau fichier, la photo actuelle est conservee.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- Prix, stock */}
      <section className="card p-5">
        <h2 className="text-lg">Prix et stock</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            id="price"
            name="price"
            label="Prix de vente"
            type="number"
            required
            min={0}
            step={500}
            defaultValue={product?.price}
            error={errorFor("price")}
          />
          <Field
            id="compareAtPrice"
            name="compareAtPrice"
            label="Prix barre"
            type="number"
            min={0}
            step={500}
            defaultValue={product?.compareAtPrice}
            error={errorFor("compareAtPrice")}
            hint="A remplir seulement en cas de promotion."
          />
          <Field
            id="stock"
            name="stock"
            label="Quantite en stock"
            type="number"
            required
            min={0}
            defaultValue={product?.stock ?? 0}
            error={errorFor("stock")}
          />
          <Field
            id="lowStockThreshold"
            name="lowStockThreshold"
            label="Seuil d'alerte"
            type="number"
            required
            min={0}
            defaultValue={product?.lowStockThreshold ?? 5}
            hint="En dessous, le produit remonte dans les alertes."
          />
        </div>
      </section>

      {/* ----------------------------------------------- Fiche technique */}
      <section className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg">Fiche technique</h2>
            <p className="mt-1 text-sm text-fg-2">
              Les caracteristiques affichees sur la page du produit.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSpecs((s) => [...s, { label: "", value: "" }])}
            className="btn-outline shrink-0 px-3 py-2"
          >
            <Plus size={15} aria-hidden /> Ajouter
          </button>
        </div>

        <ul className="mt-4 space-y-3">
          {specs.map((spec, index) => (
            <li key={index} className="flex gap-3">
              <input
                name="specLabel"
                defaultValue={spec.label}
                placeholder="Puissance"
                aria-label={`Caracteristique ${index + 1}, libelle`}
                className="field flex-1"
              />
              <input
                name="specValue"
                defaultValue={spec.value}
                placeholder="45 W"
                aria-label={`Caracteristique ${index + 1}, valeur`}
                className="field flex-1"
              />
              <button
                type="button"
                onClick={() =>
                  setSpecs((s) => s.filter((_, i) => i !== index))
                }
                disabled={specs.length <= 1}
                className="btn-ghost shrink-0 disabled:opacity-30"
                aria-label={`Retirer la caracteristique ${index + 1}`}
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-sm text-fg-3">
          Les lignes laissees vides ne sont pas enregistrees.
        </p>
      </section>

      {/* --------------------------------------------------- Publication */}
      <section className="card space-y-4 p-5">
        <h2 className="text-lg">Publication</h2>
        <Checkbox
          id="published"
          name="published"
          label="Visible dans la boutique"
          hint="Decochez pour preparer une fiche sans la mettre en ligne."
          defaultChecked={product ? product.published : true}
        />
        <Checkbox
          id="featured"
          name="featured"
          label="Mettre en avant sur l'accueil"
          hint="Apparait dans la selection en bas de la page d'accueil."
          defaultChecked={product?.featured ?? false}
        />
        <Checkbox
          id="isHero"
          name="isHero"
          label="Produit vedette de l'accueil"
          hint="Occupe la grande fiche technique en haut de page. Un seul produit a la fois : cocher ici le retire au precedent."
          defaultChecked={product?.isHero ?? false}
        />
      </section>

      <div className="flex flex-wrap gap-3">
        <SubmitButton pendingLabel="Enregistrement...">
          {isEdit ? "Enregistrer les modifications" : "Ajouter le materiel"}
        </SubmitButton>
        <Link href="/admin/produits" className="btn-outline">
          Annuler
        </Link>
      </div>
    </form>
  );
}
