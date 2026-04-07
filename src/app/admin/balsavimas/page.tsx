import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { formatDateLong } from "@/lib/utils";
import { Calendar, Vote, CheckCircle } from "lucide-react";
import { OnlineVotingPanel } from "./OnlineVotingPanel";

export const metadata = {
  title: "Balsavimas | Administravimas",
};

export default async function VotingPage() {
  const supabase = createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Rasti nario įrašą pagal el. paštą
  // Ieškoti nario pagal profilį (per el. paštą)
  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("email", user?.email)
    .eq("status", "aktyvus")
    .single();

  // Gauti aktyvius susirinkimus su balsavimais
  const { data: meetings } = await supabase
    .from("meetings")
    .select("*")
    .in("status", ["vyksta", "registracija"])
    .order("meeting_date", { ascending: false });

  // Gauti nutarimus atidarytus balsavimui
  const meetingIds = (meetings || []).map((m: { id: string }) => m.id);

  let openResolutions: Array<{
    id: string;
    meeting_id: string;
    title: string;
    description: string | null;
    resolution_number: number;
    requires_qualified_majority: boolean;
    result_for: number;
    result_against: number;
    result_abstain: number;
  }> = [];

  if (meetingIds.length > 0) {
    const { data } = await supabase
      .from("resolutions")
      .select("*")
      .in("meeting_id", meetingIds)
      .eq("early_voting_open", true)
      .order("resolution_number", { ascending: true });
    openResolutions = data || [];
  }

  // Gauti jau atiduotus balsus
  let existingBallots: Array<{ resolution_id: string; vote: string }> = [];
  if (member && openResolutions.length > 0) {
    const { data } = await supabase
      .from("vote_ballots")
      .select("resolution_id, vote")
      .eq("member_id", member.id)
      .in("resolution_id", openResolutions.map((r) => r.id));
    existingBallots = data || [];
  }

  if (!member) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Balsavimas</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <Vote className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              Jūsų el. paštas nesusietas su aktyviu bendruomenės nariu.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Kreipkitės į administratorių, kad susietų jūsų paskyrą su nario įrašu.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Balsavimas</h1>
      <p className="text-sm text-gray-500 mb-6">
        Sveiki, {member.first_name}! Čia galite balsuoti dėl aktyvių nutarimų.
      </p>

      {meetings && meetings.length > 0 ? (
        <div className="space-y-6">
          {meetings.map((meeting: { id: string; title: string; meeting_date: string; location: string }) => {
            const meetingResolutions = openResolutions.filter(
              (r) => r.meeting_id === meeting.id
            );

            if (meetingResolutions.length === 0) return null;

            return (
              <Card key={meeting.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <div>
                      <h2 className="font-semibold text-gray-900">{meeting.title}</h2>
                      <p className="text-xs text-gray-500">
                        {formatDateLong(meeting.meeting_date)} | {meeting.location}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <OnlineVotingPanel
                    resolutions={meetingResolutions}
                    memberId={member.id}
                    existingBallots={existingBallots}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-300 mx-auto mb-4" />
            <p className="text-gray-500">Šiuo metu nėra aktyvių balsavimų.</p>
            <p className="text-sm text-gray-400 mt-2">
              Kai bus paskelbtas susirinkimas su balsavimu, jį matysite čia.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
