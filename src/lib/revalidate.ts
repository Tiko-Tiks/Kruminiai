import { revalidatePath } from "next/cache";

/**
 * Vienoje vietoje surašyti visi puslapiai, kurie atvaizduoja susirinkimo
 * darbotvarkę / nutarimus / dokumentus. Bet kuri resolution/meeting mutacija
 * (admin pertvarkymas, edit, delete, status keitimas) turi iškviesti
 * `revalidateMeetingPaths(meetingId)`, kad VISI puslapiai pasinaujintų ir
 * negalėtų rodyti skirtingos darbotvarkės versijos.
 *
 * SINGLE SOURCE OF TRUTH – jei pridėsime naują puslapį, kuris rodo darbotvarkę,
 * jį pridėsim čia ir užmiršti revalidate negalim.
 */
export function revalidateMeetingPaths(meetingId: string) {
  // Administracinis – pati darbotvarkės redagavimo vieta
  revalidatePath(`/admin/susirinkimai/${meetingId}`);
  revalidatePath("/admin/susirinkimai");

  // Vieša member-facing kopija
  revalidatePath(`/susirinkimai/${meetingId}`);
  revalidatePath("/susirinkimai");

  // Portalo nario rodinys
  revalidatePath(`/portalas/susirinkimai/${meetingId}`);
  revalidatePath("/portalas/susirinkimai");
  revalidatePath(`/portalas/balsavimai/${meetingId}`);
  revalidatePath("/portalas/balsavimai");

  // Pagrindinis puslapis – rodo „Artėjantis susirinkimas" juostelę
  revalidatePath("/");
}

/**
 * SMS balsavimo nuoroda /balsuoti/[token] – jos negalim revalidate per
 * meeting_id, nes Next.js dinamiškas tag'as remiasi į [token] segmentą.
 * Vietoje to ji deklaruota kaip `dynamic = "force-dynamic"` – ji visada
 * pertikrina duomenis iš RPC. Tad atskirai bust'inti nereikia.
 */
