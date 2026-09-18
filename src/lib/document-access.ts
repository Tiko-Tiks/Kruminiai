import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Prieiga prie susirinkimo dokumentų turint BALSAVIMO TOKENĄ.
 *
 * Kodėl reikia: `/balsuoti/[token]` srautas yra anoniminis – nario sesijos nėra.
 * Darbotvarkės dokumentus balsuotojui grąžina `get_voting_token_data`, tarp jų
 * gali būti ir NEVIEŠŲ bibliotekos dokumentų (admin'o dokumentų pasirinkiklis
 * rodo ir viešus, ir neviešus). Be šio kelio `/api/dokumentai/...` tokiam
 * balsuotojui grąžintų 401 – jis matytų dokumento pavadinimą, bet negalėtų jo
 * atidaryti.
 *
 * Ribos, kad tokenas netaptų raktu į visą biblioteką:
 *   • tokenas paverčiamas susirinkimo ID per `voting_token_meeting` RPC
 *     (SECURITY DEFINER, anon; tas pats šaltinis kaip `canViewMeetingDoc`);
 *   • atiduodamas TIK dokumentas, prikabintas BŪTENT prie to susirinkimo –
 *     tiesiogiai (`documents.meeting_id`) arba per jo nutarimą
 *     (`resolution_documents` → `resolutions.meeting_id`).
 *
 * Ryšius skaitom service-role klientu: anon RLS neviešo dokumento nerodo, o
 * `resolution_documents` / `resolutions` anonimui irgi nematomi.
 */

/** Dokumento ryšiai su susirinkimais – tiek, kiek reikia prieigai nuspręsti. */
export interface DocumentMeetingLinks {
  /** `documents.meeting_id` – dokumentas prikabintas prie susirinkimo tiesiogiai. */
  meetingId: string | null;
  /** Susirinkimai, prie kurių nutarimų dokumentas prikabintas. */
  resolutionMeetingIds: readonly (string | null)[];
}

/**
 * Ar dokumentas priklauso BŪTENT šiam susirinkimui?
 *
 * Gryna funkcija – visa DB dalis lieka `findDocumentForVotingToken`.
 */
export function documentBelongsToMeeting(
  links: DocumentMeetingLinks,
  meetingId: string | null | undefined
): boolean {
  if (!meetingId) return false;
  if (links.meetingId === meetingId) return true;
  return (links.resolutionMeetingIds || []).some((id) => id === meetingId);
}

/** Dokumento duomenys, kurių reikia atsakymui suformuoti. */
export interface TokenAccessibleDocument {
  id: string;
  file_name: string | null;
}

/** Susirinkimai, prie kurių nutarimų prikabintas dokumentas. */
async function loadResolutionMeetingIds(
  admin: SupabaseClient,
  documentId: string
): Promise<string[]> {
  const { data: links } = await admin
    .from("resolution_documents")
    .select("resolution_id")
    .eq("document_id", documentId);

  const resolutionIds = (links ?? [])
    .map((row) => row.resolution_id as string | null)
    .filter((id): id is string => !!id);
  if (resolutionIds.length === 0) return [];

  const { data: resolutions } = await admin
    .from("resolutions")
    .select("meeting_id")
    .in("id", resolutionIds);

  return (resolutions ?? [])
    .map((row) => row.meeting_id as string | null)
    .filter((id): id is string => !!id);
}

/**
 * Grąžina dokumentą, jei pateiktas balsavimo tokenas suteikia teisę jį matyti,
 * arba `null`. `null` reiškia „neleidžiam" – kvietėjas tada eina įprastu
 * sesijos keliu (ir gauna 401/403).
 */
export async function findDocumentForVotingToken(
  clients: { anon: SupabaseClient; admin: SupabaseClient },
  filePath: string,
  token: string
): Promise<TokenAccessibleDocument | null> {
  if (!token) return null;

  const { data: tokenMeetingId } = await clients.anon.rpc("voting_token_meeting", {
    p_token: token,
  });
  if (typeof tokenMeetingId !== "string" || !tokenMeetingId) return null;

  const { data: doc } = await clients.admin
    .from("documents")
    .select("id, file_name, meeting_id")
    .eq("file_path", filePath)
    .maybeSingle();
  if (!doc) return null;

  const documentId = doc.id as string;
  const directMeetingId = (doc.meeting_id as string | null) ?? null;

  const result: TokenAccessibleDocument = {
    id: documentId,
    file_name: (doc.file_name as string | null) ?? null,
  };

  // Greitas kelias – dokumentas prikabintas tiesiai prie susirinkimo.
  if (
    documentBelongsToMeeting(
      { meetingId: directMeetingId, resolutionMeetingIds: [] },
      tokenMeetingId
    )
  ) {
    return result;
  }

  const resolutionMeetingIds = await loadResolutionMeetingIds(clients.admin, documentId);
  if (
    documentBelongsToMeeting(
      { meetingId: directMeetingId, resolutionMeetingIds },
      tokenMeetingId
    )
  ) {
    return result;
  }

  return null;
}
