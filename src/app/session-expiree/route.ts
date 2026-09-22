import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { SESSION_COOKIE, cookieOptions } from "@/lib/auth/session";

/**
 * Session refusee en base (voir denyAccess, lib/auth/current.ts) : efface le
 * cookie, puis renvoie vers la connexion avec un message. Sans cet
 * effacement, le middleware, qui ne lit que la signature, renverrait la page
 * de connexion vers l'espace reserve, et ainsi de suite.
 *
 * Hors du matcher du middleware : la route doit repondre meme avec un cookie
 * encore signe.
 */
export function GET(request: NextRequest) {
  const suite = safeRedirectPath(request.nextUrl.searchParams.get("suite")) ?? "/";
  const target = `/connexion?${new URLSearchParams({ erreur: "session", suite })}`;

  // Redirection relative : request.url peut porter un autre hote que celui
  // du visiteur (« localhost » derriere next start), qui perdrait ses cookies.
  const response = new NextResponse(null, { status: 307, headers: { Location: target } });
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
