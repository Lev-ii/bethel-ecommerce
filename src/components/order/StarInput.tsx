"use client";

import { useState } from "react";
import { Star } from "lucide-react";

const LABELS = ["Décevant", "Moyen", "Correct", "Très bien", "Excellent"];

/**
 * Choix de la note : de vrais boutons radio (clavier, lecteurs d'ecran, et
 * fonctionne sans JavaScript), habilles en etoiles.
 */
export function StarInput({ name, id }: { name: string; id: string }) {
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <fieldset>
      <legend className="field-label">Votre note</legend>
      <div className="flex items-center gap-3" onMouseLeave={() => setHover(0)}>
        <div className="flex">
          {LABELS.map((label, index) => {
            const rating = index + 1;
            return (
              <label key={rating} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(rating)}>
                <input
                  type="radio"
                  name={name}
                  value={rating}
                  required
                  className="peer sr-only"
                  onChange={() => setValue(rating)}
                  id={`${id}-${rating}`}
                />
                <span className="sr-only">
                  {rating} étoile{rating > 1 ? "s" : ""} : {label}
                </span>
                <Star
                  size={28}
                  aria-hidden
                  className="rounded-sm text-brand-deep transition-transform peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fg hover:scale-110"
                  fill={rating <= shown ? "currentColor" : "none"}
                />
              </label>
            );
          })}
        </div>
        <span className="text-sm text-fg-2" aria-hidden>
          {shown ? LABELS[shown - 1] : "Choisissez"}
        </span>
      </div>
    </fieldset>
  );
}
