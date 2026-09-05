import type { Dictionary } from "@/lib/i18n";

// Balsavimo RPC (`cast_votes_as_member` / `cast_votes_with_token`) klaidų kodai
// → nario kalba (LT/EN) parašytas tekstas. Vienas šaltinis abiem srautams:
// portalo balsavimui ir SMS magic link balsavimui.
export function voteErrorMessage(
  code: string | null | undefined,
  t: Dictionary["voteErrors"]
): string {
  switch (code) {
    case "not_eligible":
      return t.notEligible;
    case "voting_closed":
      return t.votingClosed;
    case "incomplete_ballot":
      return t.incompleteBallot;
    case "already_voted":
      return t.alreadyVoted;
    case "meeting_not_found":
      return t.meetingNotFound;
    case "expired":
      return t.expired;
    case "invalid_token":
      return t.invalidToken;
    case "no_member_link":
      return t.noMemberLink;
    default:
      // Nežinomas kodas – dažniausiai netikėta DB klaida. Rodom ją pačią
      // (padeda atsekti), o jei tuščia – bendrą pranešimą.
      return code && code.length > 0 ? code : t.generic;
  }
}
