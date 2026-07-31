import "server-only";

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/**
 * Stockage des photos de materiel.
 *
 * En production, les fichiers vont dans un bucket Supabase. Sans identifiants
 * configures, ils sont ecrits dans data/media et servis par /api/media : cela
 * permet de lancer le projet en local sans compte Supabase.
 *
 * Le repli local ne fonctionne pas sur Vercel, dont le disque est en lecture
 * seule. C'est volontairement bruyant dans les journaux si le cas se presente.
 */

const BUCKET = process.env.SUPABASE_BUCKET ?? "produits";
const MEDIA_DIR = path.join(process.cwd(), "data", "media");

const MAX_BYTES = 3 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export class UploadError extends Error {}

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  // La cle de service ne quitte jamais le serveur : ce module est marque
  // server-only, et aucun composant client ne l'importe.
  return createClient(url, key, { auth: { persistSession: false } });
}

export function storageIsConfigured(): boolean {
  return supabase() !== null;
}

/**
 * Enregistre la photo et renvoie son URL publique.
 *
 * Le chemin est prefixe par l'identifiant du produit : supprimer un produit
 * revient alors a effacer un prefixe, et toutes ses photos partent avec.
 */
export async function saveProductImage(
  file: File | null,
  productId: string
): Promise<string | null> {
  if (!file || file.size === 0) return null;

  const extension = TYPES[file.type];
  if (!extension) {
    throw new UploadError("Format d'image non accepte.");
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError("L'image depasse 3 Mo.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const objectPath = `${productId}/${randomUUID()}.${extension}`;

  const client = supabase();

  if (!client) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[storage] SUPABASE_URL et SUPABASE_SERVICE_KEY ne sont pas definis. " +
          "Les photos sont ecrites sur le disque local, ce qui ne fonctionne " +
          "pas sur un hebergement dont le disque est en lecture seule."
      );
    }
    const target = path.join(MEDIA_DIR, objectPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    return `/api/media/${objectPath}`;
  }

  const { error } = await client.storage
    .from(BUCKET)
    .upload(objectPath, bytes, {
      contentType: file.type,
      // Le nom contient un identifiant unique : jamais de collision.
      upsert: false,
      cacheControl: "31536000",
    });

  if (error) {
    throw new UploadError(`Envoi de l'image impossible : ${error.message}`);
  }

  const { data } = client.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

/**
 * Efface les photos d'un produit supprime.
 *
 * Un echec ici ne doit pas empecher la suppression du produit : mieux vaut un
 * fichier orphelin qu'une fiche impossible a retirer du catalogue.
 */
export async function deleteProductImages(productId: string): Promise<void> {
  const client = supabase();

  if (!client) {
    fs.rmSync(path.join(MEDIA_DIR, productId), {
      recursive: true,
      force: true,
    });
    return;
  }

  try {
    const { data } = await client.storage.from(BUCKET).list(productId);
    if (!data?.length) return;
    await client.storage
      .from(BUCKET)
      .remove(data.map((f) => `${productId}/${f.name}`));
  } catch (error) {
    console.warn("[storage] nettoyage des photos impossible", error);
  }
}
