import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readToken } from "@/lib/auth/session";

/**
 * Filtre de navigation.
 *
 * Il bloque l'acces aux espaces reserves avant meme que la page ne soit rendue.
 * Ce n'est pas la seule barriere : chaque page et chaque action serveur
 * revalide le role de son cote, car le middleware ne protege que la
 * navigation.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = await readToken(token);

  const isAdminArea = pathname.startsWith("/admin");
  const isAccountArea = pathname.startsWith("/compte");
  const isAuthPage = pathname === "/connexion" || pathname === "/inscription";

  // Deja connecte : les pages de connexion n'ont plus de sens.
  if (isAuthPage && user) {
    return NextResponse.redirect(
      new URL(user.role === "ADMIN" ? "/admin" : "/compte", request.url)
    );
  }

  if (isAdminArea || isAccountArea) {
    if (!user) {
      const url = new URL("/connexion", request.url);
      url.searchParams.set("suite", pathname + search);
      return NextResponse.redirect(url);
    }
    // Un client qui tente d'ouvrir l'administration est renvoye chez lui,
    // pas vers une page d'erreur : il n'a rien fait de mal.
    if (isAdminArea && user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/compte", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/compte/:path*", "/connexion", "/inscription"],
};
