import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Envoi des photos produit (repli disque, sans Supabase) et route qui les
 * sert. Les deux modules lisent process.cwd() au chargement : il est redirige
 * vers un dossier temporaire avant l'import, rien n'est ecrit dans le depot.
 */

const root = fs.mkdtempSync(path.join(os.tmpdir(), "bethel-media-"));
vi.spyOn(process, "cwd").mockReturnValue(root);
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_KEY;

const { saveProductImage, UploadError } = await import("@/lib/storage");
const { GET } = await import("@/app/api/media/[...path]/route");

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.from([0, 0, 0, 0]), Buffer.from("WEBPVP8 ")]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

function file(bytes: Buffer, name: string, type: string) {
  return new File([new Uint8Array(bytes)], name, { type });
}

function serve(...segments: string[]) {
  return GET(new Request("http://localhost/api/media"), { params: Promise.resolve({ path: segments }) });
}

beforeAll(() => {
  fs.writeFileSync(path.join(root, "secret.png"), PNG);
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("envoi d'une photo produit", () => {
  it.each([
    ["png", PNG, "photo.png", "image/png"],
    ["jpg", JPEG, "photo.jpg", "image/jpeg"],
    ["webp", WEBP, "photo.webp", "image/webp"],
  ])("accepte un fichier %s et l'enregistre tel quel", async (extension, bytes, name, type) => {
    const url = await saveProductImage(file(bytes, name, type), "p-test");

    expect(url).toMatch(new RegExp(`^/api/media/p-test/[0-9a-f-]{36}\\.${extension}$`));
    const written = path.join(root, "data", "media", url!.replace("/api/media/", ""));
    expect(fs.readFileSync(written)).toEqual(bytes);
  });

  it("nomme le fichier d'après son contenu, pas d'après le nom envoyé", async () => {
    const url = await saveProductImage(file(PNG, "../../evil.jpg", "image/jpeg"), "p-test");
    expect(url).toMatch(/^\/api\/media\/p-test\/[0-9a-f-]{36}\.png$/);
  });

  it("refuse un SVG, même déclaré comme image", async () => {
    await expect(saveProductImage(file(SVG, "logo.svg", "image/svg+xml"), "p-test")).rejects.toThrow(UploadError);
  });

  it("refuse un faux type MIME : du texte déclaré image/png", async () => {
    const fake = file(Buffer.from("<html><script>alert(1)</script></html>"), "photo.png", "image/png");
    await expect(saveProductImage(fake, "p-test")).rejects.toThrow("Format d'image non accepté");
  });

  it("refuse un fichier de plus de 3 Mo avant de le lire", async () => {
    const big = file(Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]), "grande.png", "image/png");
    const read = vi.spyOn(big, "arrayBuffer");

    await expect(saveProductImage(big, "p-test")).rejects.toThrow("L'image dépasse 3 Mo.");
    expect(read).not.toHaveBeenCalled();
  });

  it("ignore un champ fichier vide", async () => {
    expect(await saveProductImage(file(Buffer.alloc(0), "", "application/octet-stream"), "p-test")).toBeNull();
    expect(await saveProductImage(null, "p-test")).toBeNull();
  });
});

describe("route /api/media", () => {
  it("sert une photo enregistrée avec son type", async () => {
    const url = await saveProductImage(file(JPEG, "photo.jpg", "image/jpeg"), "p-serve");
    const response = await serve(...url!.replace("/api/media/", "").split("/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(JPEG);
  });

  it.each([
    [["..", "secret.png"]],
    [["p-test", "..", "..", "secret.png"]],
    [["..%2Fsecret.png"]],
    [["p-test/../../secret.png"]],
    [["p-test", "a..png"]],
    [[]],
  ])("refuse la traversée de chemin %j", async (segments) => {
    const response = await serve(...segments);
    expect(response.status).toBe(400);
  });

  it("refuse de servir un type autre qu'une image", async () => {
    fs.mkdirSync(path.join(root, "data", "media"), { recursive: true });
    fs.writeFileSync(path.join(root, "data", "media", "notes.svg"), SVG);

    expect((await serve("notes.svg")).status).toBe(400);
    expect((await serve(".env")).status).toBe(400);
  });

  it("répond 404 pour une photo absente", async () => {
    expect((await serve("p-test", "absente.png")).status).toBe(404);
  });
});
