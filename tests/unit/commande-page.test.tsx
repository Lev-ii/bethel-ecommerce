import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * La page de commande pre-remplit le telephone d'un client connecte. Cette
 * lecture est un confort : si la base ne repond pas, le formulaire doit
 * s'afficher quand meme, sans faire tomber le tunnel d'achat.
 */

const session = { id: "u-1", email: "awa@example.com", name: "Awa Koné", role: "CLIENT" as const };

vi.mock("@/lib/auth/current", () => ({ currentUser: vi.fn() }));
vi.mock("@/lib/repository", () => ({ getUserById: vi.fn() }));
vi.mock("@/components/cart/CheckoutForm", () => ({ CheckoutForm: () => null }));

const { currentUser } = await import("@/lib/auth/current");
const { getUserById } = await import("@/lib/repository");
const { CheckoutForm } = await import("@/components/cart/CheckoutForm");
const { default: CommandePage } = await import("@/app/(site)/commande/page");

/** Props du formulaire dans l'arbre rendu par la page. */
function checkoutProps(node: ReactNode): { account: unknown } | undefined {
  if (!isValidElement(node)) return undefined;
  const element = node as ReactElement<{ children?: ReactNode; account?: unknown }>;
  if (element.type === CheckoutForm) return element.props as { account: unknown };
  const children = element.props.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = checkoutProps(child);
    if (found) return found;
  }
  return undefined;
}

beforeEach(() => {
  vi.mocked(currentUser).mockReset();
  vi.mocked(getUserById).mockReset();
});

describe("page de commande", () => {
  it("pré-remplit nom, email et téléphone d'un client connecté", async () => {
    vi.mocked(currentUser).mockResolvedValue(session);
    vi.mocked(getUserById).mockResolvedValue({ phone: "+225 07 00 00 00 01" } as never);

    const props = checkoutProps(await CommandePage());

    expect(props?.account).toEqual({ name: "Awa Koné", email: "awa@example.com", phone: "+225 07 00 00 00 01" });
  });

  it("s'affiche quand même si la base ne répond pas, sans téléphone pré-rempli", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(currentUser).mockResolvedValue(session);
    vi.mocked(getUserById).mockRejectedValue(Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }));

    const props = checkoutProps(await CommandePage());

    expect(props?.account).toEqual({ name: "Awa Koné", email: "awa@example.com", phone: undefined });
    expect(logged).toHaveBeenCalledWith("[commande] pre-remplissage indisponible", "u-1", expect.any(Error));
    logged.mockRestore();
  });

  it("client invité : aucun appel à la base, formulaire vierge", async () => {
    vi.mocked(currentUser).mockResolvedValue(null);

    const props = checkoutProps(await CommandePage());

    expect(props?.account).toBeNull();
    expect(getUserById).not.toHaveBeenCalled();
  });
});
