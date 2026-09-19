"use server";

import { recordAudit } from "@/lib/admin/audit";
import { resetLinkMessage, resetLinkUrl, whatsappNumber, whatsappShareUrl } from "@/lib/admin/reset-link";
import { assertAdmin } from "@/lib/auth/current";
import { ADMIN_RESET_LINK_HOURS, issueResetToken } from "@/lib/auth/reset-token";
import { sql } from "@/lib/db/client";
import { getUserByEmail } from "@/lib/repository";

export type ResetLinkState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok"; customerName: string; email: string; link: string; whatsappUrl: string; hasPhone: boolean; validHours: number };

/**
 * Cree un lien de reinitialisation pour un client, a lui remettre sur WhatsApp.
 *
 * Le lien est renvoye dans la reponse de l'action, jamais dans une URL ni un
 * journal serveur : il n'est affiche qu'une fois, a l'administrateur qui l'a
 * demande. La creation est inscrite au journal d'audit, dans la meme
 * transaction que le jeton.
 *
 * Reserve aux comptes clients : un compte administrateur se reinitialise par
 * "npm run admin:password", pour qu'un administrateur ne puisse pas prendre la
 * main sur le compte d'un autre.
 */
export async function createClientResetLink(_previous: ResetLinkState, formData: FormData): Promise<ResetLinkState> {
  const admin = await assertAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { status: "error", message: "Entrez l'adresse email du client." };

  try {
    const user = await getUserByEmail(email);
    if (!user) return { status: "error", message: "Aucun compte avec cette adresse email." };
    if (user.role !== "CLIENT") {
      return {
        status: "error",
        message: "C'est un compte administrateur : son mot de passe se change avec « npm run admin:password ».",
      };
    }

    const token = await sql.begin(async (tx) => {
      const db = tx as unknown as typeof sql;
      const issued = await issueResetToken(db, user.id, ADMIN_RESET_LINK_HOURS);
      await recordAudit(db, {
        action: "auth.reset_link_created",
        actor: { id: admin.id, email: admin.email },
        entityType: "user",
        entityId: user.id,
        entityLabel: user.email,
      });
      return issued;
    });

    const link = resetLinkUrl(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000", token);
    const phone = whatsappNumber(user.phone);
    return {
      status: "ok",
      customerName: user.name,
      email: user.email,
      link,
      whatsappUrl: whatsappShareUrl(phone, resetLinkMessage(user.name, link, ADMIN_RESET_LINK_HOURS)),
      hasPhone: phone !== null,
      validHours: ADMIN_RESET_LINK_HOURS,
    };
  } catch (error) {
    console.error("[admin] lien de réinitialisation non créé", error);
    return { status: "error", message: "Service momentanément indisponible. Réessayez." };
  }
}
