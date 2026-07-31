import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { Eyebrow } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Mon panier" };

export default function PanierPage() {
  return (
    <div className="shell py-10 lg:py-14">
      <header className="mb-8">
        <Eyebrow>Etape 1 sur 3</Eyebrow>
        <h1 className="mt-2 text-3xl sm:text-4xl">Mon panier</h1>
      </header>
      <CartView />
    </div>
  );
}
