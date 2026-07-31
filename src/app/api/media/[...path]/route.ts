import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

/**
 * Sert les photos stockees en local.
 *
 * Ce chemin n'est utilise que lorsque Supabase Storage n'est pas configure —
 * en developpement, typiquement. En production, les photos sont servies
 * directement par Supabase et cette route n'est jamais appelee.
 */

const MEDIA_DIR = path.join(process.cwd(), "data", "media");

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  // Les segments viennent de l'URL : on refuse tout ce qui pourrait sortir
  // du dossier.
  if (
    segments.length === 0 ||
    segments.some((s) => !/^[A-Za-z0-9._-]+$/.test(s) || s.includes(".."))
  ) {
    return new NextResponse("Chemin invalide", { status: 400 });
  }

  const type = TYPES[path.extname(segments.at(-1) ?? "").toLowerCase()];
  if (!type) {
    return new NextResponse("Type de fichier non servi", { status: 400 });
  }

  const root = path.resolve(MEDIA_DIR);
  const file = path.resolve(root, ...segments);
  if ((file !== root && !file.startsWith(root + path.sep)) || !fs.existsSync(file)) {
    return new NextResponse("Image introuvable", { status: 404 });
  }

  return new NextResponse(fs.readFileSync(file), {
    headers: {
      "Content-Type": type,
      // Le nom contient un identifiant unique : le contenu ne change jamais.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
