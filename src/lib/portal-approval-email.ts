import { renderBrandedEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/utils";

/** Account activation is separate from the Council's admission decision. */
export function renderPortalApprovalEmail({ firstName, locale = "lt" }: { firstName: string; locale?: "lt" | "en" }): string {
  const url = escapeHtml(process.env.NEXT_PUBLIC_SITE_URL || "https://kruminiai.lt");
  return renderBrandedEmail({ locale,
    preheader: locale === "en" ? "Your portal account is active." : "Jūsų portalo paskyra aktyvuota.",
    body: locale === "en"
      ? `<h1>Hello, ${escapeHtml(firstName)}!</h1><p>Your Krūminiai member portal account is now active. Sign in with the email and password you chose during registration.</p><p><a href="${url}/prisijungimas">Sign in to the portal</a></p>`
      : `<h1>Sveiki, ${escapeHtml(firstName)}!</h1><p>Jūsų Krūminių nario portalo paskyra aktyvuota. Galite prisijungti su registracijos metu pasirinktu el. paštu ir slaptažodžiu.</p><p><a href="${url}/prisijungimas">Prisijungti prie portalo</a></p>`,
  });
}
