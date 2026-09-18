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
 *   • tokenas turi EGZISTUOTI ir dar GALIOTI – `meeting_voting_tokens.expires_at`
 *     ateityje. Būtent `expires_at`, ne `voted_at`: po balsavimo gavėjas dar
 *     gauna patvirtinimo laišką su nuorodomis į tuos pačius dokumentus, o balso
 *     teisės netekusiam nariui tokenas anuliuojamas nustatant `expires_at`
 *     dabartimi – tad viena patikra padengia abu atvejus;
 *   • atiduodamas TIK dokumentas, prikabintas prie TO susirinkimo
 *     **neprocedūrinio** nutarimo (`resolution_documents` → `resolutions`).
 *     Procedūriniai klausimai į balsavimo payload'ą neįeina
 *     (`_meeting_resolutions_jsonb(..., TRUE)` filtruoja `is_procedural = FALSE`),
 *     todėl jų priedų balsuotojas ir nemato. Tiesioginis `documents.meeting_id`
 *     ryšys SĄMONINGAI netinka: migr. 025 juo prikabinami PO susirinkimo įkelti
 *     pasirašyti dokumentai (protokolas, dalyvių sąrašas) – jie nėra
 *     darbotvarkės medžiaga.
 *
 * Viskas skaitoma service-role klientu: anon RLS neviešo dokumento nerodo, o
 * `meeting_voting_tokens` / `resolution_documents` / `resolutions` anonimui irgi
 * nematomi. Route'as prieš kviesdamas tikrina `isAdminClientAvailable()`.
 */

/** Vienas `resolution_documents` ryšys – tiek, kiek reikia prieigai nuspręsti. */
export interface DocumentResolutionLink {
  meetingId: string | null;
  isProcedural: boolean | null;
}

/** Dokumento ryšiai su nutarimais. */
export interface DocumentMeetingLinks {
  resolutions: readonly DocumentResolutionLink[];
}

/**
 * Ar dokumentas yra šio susirinkimo darbotvarkės medžiaga?
 *
 * Gryna funkcija – visa DB dalis lieka `findDocumentForVotingToken`.
 * `isProcedural === false` atkartoja SQL `is_procedural = FALSE`: neaiški
 * (`null`) reikšmė neatrakina.
 */
export function documentBelongsToMeeting(
  links: DocumentMeetingLinks,
  meetingId: string | null | undefined
): boolean {
  if (!meetingId) return false;
  return (links.resolutions || []).some(
    (r) => r.isProcedural === false && r.meetingId === meetingId
  );
}

/** Dokumento duomenys, kurių reikia atsakymui suformuoti. */
export interface TokenAccessibleDocument {
  id: string;
  file_name: string | null;
}

/** Tokeno susirinkimas, jei tokenas egzistuoja ir dar galioja. */
async function loadValidTokenMeetingId(
  admin: SupabaseClient,
  token: string
): Promise<string | null> {
  const { data: row } = await admin
    .from("meeting_voting_tokens")
    .select("meeting_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!row) return null;

  const expiresAt = row.expires_at as string | null;
  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : NaN;
  // Neįskaitoma data laikoma negaliojančia – kitaip `NaN` palyginimas būtų
  // `false` ir tokenas praeitų.
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return null;

  const meetingId = row.meeting_id as string | null;
  return meetingId || null;
}

/** Nutarimai, prie kurių prikabintas dokumentas. */
async function loadDocumentResolutionLinks(
  admin: SupabaseClient,
  documentId: string
): Promise<DocumentResolutionLink[]> {
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
    .select("id, meeting_id, is_procedural")
    .in("id", resolutionIds);

  return (resolutions ?? []).map((row) => ({
    meetingId: (row.meeting_id as string | null) ?? null,
    isProcedural: (row.is_procedural as boolean | null) ?? null,
  }));
}

/**
 * Grąžina dokumentą, jei pateiktas balsavimo tokenas suteikia teisę jį matyti,
 * arba `null`. `null` reiškia „neleidžiam" – kvietėjas tada eina įprastu
 * sesijos keliu (ir gauna 401/403).
 */
export async function findDocumentForVotingToken(
  admin: SupabaseClient,
  filePath: string,
  token: string
): Promise<TokenAccessibleDocument | null> {
  if (!token) return null;

  const tokenMeetingId = await loadValidTokenMeetingId(admin, token);
  if (!tokenMeetingId) return null;

  const { data: doc } = await admin
    .from("documents")
    .select("id, file_name")
    .eq("file_path", filePath)
    .maybeSingle();
  if (!doc) return null;

  const documentId = doc.id as string;
  const resolutions = await loadDocumentResolutionLinks(admin, documentId);
  if (!documentBelongsToMeeting({ resolutions }, tokenMeetingId)) return null;

  return {
    id: documentId,
    file_name: (doc.file_name as string | null) ?? null,
  };
}
