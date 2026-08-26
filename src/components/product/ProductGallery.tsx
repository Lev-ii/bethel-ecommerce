"use client";

import { useState } from "react";
import { GearImage } from "@/components/product/GearImage";

export function ProductGallery({ name, images }: { name: string; images: string[] }) {
  const [selected, setSelected] = useState(images[0]);
  return (
    <div className="card overflow-hidden">
      <GearImage src={selected} alt={name} size={800} priority padding="p-[12%]" className="aspect-square w-full" />
      {images.length > 1 ? (
        <div className="flex gap-2 border-t border-line p-3">
          {images.map((image) => (
            <button key={image} type="button" onClick={() => setSelected(image)} className={`overflow-hidden rounded-card border ${selected === image ? "border-fg" : "border-line"}`} aria-label={`Voir la photo de ${name}`}>
              <GearImage src={image} alt="" size={80} compact padding="p-[12%]" className="h-16 w-16" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}