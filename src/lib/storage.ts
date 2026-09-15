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

/**
 * Formats acceptes, reconnus a leurs octets d'en-tete.
 *
 * Le SVG est volontairement absent : c'est un document XML, il peut contenir
 * du script, et il serait ensuite re-servi avec son propre type MIME.
 *
 * Le type declare par le navigateur (file.type) n'est pas une preuve : il est
 * choisi par le client. Seul le contenu reel fait foi.
 */
const SIGNATURES: Array<{ extension: string; contentType: string; matches: (b: Buffer) => boolean }> = [
  {
    extension: "png",
    contentType: "image/png",
    matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  {
    extension: "jpg",
    contentType: "image/jpeg",
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    extension: "webp",
    contentType: "image/webp",
    matches: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

function detectImage(bytes: Buffer) {
  return SIGNATURES.find((signature) => signature.matches(bytes)) ?? null;
}

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

  // La taille est verifiee avant la lecture : inutile de charger 200 Mo en
  // memoire pour les refuser ensuite.
  if (file.size > MAX_BYTES) {
    throw new UploadError("L'image depasse 3 Mo.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const format = detectImage(bytes);
  if (!format) {
    throw new UploadError("Format d'image non accepte. Utilise un fichier PNG, JPEG ou WebP.");
  }

  const objectPath = `${productId}/${randomUUID()}.${format.extension}`;

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
      contentType: format.contentType,
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
 * Efface une image unique d'un produit.
 */
export async function deleteProductImageFile(imageUrl: string): Promise<void> {
  const client = supabase();

  if (!client) {
    const match = imageUrl.match(/\/api\/media\/(.+)$/);
    if (match) {
      const filePath = path.join(MEDIA_DIR, match[1]);
      fs.rmSync(filePath, { force: true });
    }
    return;
  }

  try {
    const match = imageUrl.match(new RegExp(`${BUCKET}/(.+)$`));
    if (match) {
      await client.storage.from(BUCKET).remove([match[1]]);
    }
  } catch (error) {
    console.warn("[storage] suppression image impossible", error);
  }
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
