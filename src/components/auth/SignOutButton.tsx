import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";

export function SignOutButton({ className = "btn-outline" }: { className?: string }) {
  return (
    <form action={signOut}>
      <button type="submit" className={className}>
        <LogOut size={15} aria-hidden /> Se déconnecter
      </button>
    </form>
  );
}
