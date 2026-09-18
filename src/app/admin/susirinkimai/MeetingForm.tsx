"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createMeeting, updateMeeting, getMeetings } from "@/actions/meetings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { COMMUNITY_LEGAL } from "@/lib/constants";
import { isoToVilniusLocal } from "@/lib/utils";
import { Meeting } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  meeting?: Meeting;
}

export function MeetingForm({ meeting }: Props) {
  const router = useRouter();
  const [meetingType, setMeetingType] = useState(meeting?.meeting_type || "visuotinis");
  const [previousMeetings, setPreviousMeetings] = useState<Meeting[]>([]);
  useEffect(() => { getMeetings().then(setPreviousMeetings).catch(() => toast.error("Nepavyko gauti susirinkimų sąrašo")); }, []);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  // Datos/laiko laukai – VISADA Europe/Vilnius (ne UTC), kad redaguojant
  // susirinkimą nepasislinktų laikas (žr. `vilniusLocalToIso` utils.ts).
  const meetingLocal = meeting ? isoToVilniusLocal(meeting.meeting_date) : "";
  const dateValue = meetingLocal ? meetingLocal.split("T")[0] : "";
  const timeValue = meetingLocal ? meetingLocal.split("T")[1] : "18:00";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const result = meeting
      ? await updateMeeting(meeting.id, formData)
      : await createMeeting(formData);

    if (result.error) {
      setErrors(result.error as Record<string, string[]>);
      setLoading(false);
      return;
    }

    toast.success(meeting ? "Susirinkimas atnaujintas" : "Susirinkimas sukurtas");

    if (!meeting && "id" in result) {
      router.push(`/admin/susirinkimai/${result.id}`);
    } else {
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-gray-900">
          {meeting ? "Redaguoti susirinkimą" : "Susirinkimo informacija"}
        </h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Pavadinimas"
            name="title"
            defaultValue={meeting?.title || "Visuotinis narių susirinkimas"}
            error={errors.title?.[0]}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Susirinkimo tipas"
              name="meeting_type"
              value={meetingType}
              onChange={e => setMeetingType(e.target.value as Meeting["meeting_type"])}
              options={[
                { value: "visuotinis", label: "Visuotinis narių susirinkimas" },
                { value: "neeilinis", label: "Neeilinis susirinkimas" },
                { value: "pakartotinis", label: "Pakartotinis po neįvykusio susirinkimo" },
                { value: "valdybos", label: "Tarybos posėdis" },
              ]}
            />
            <Input
              label="Protokolo Nr."
              name="protocol_number"
              defaultValue={meeting?.protocol_number || ""}
              placeholder="Pvz.: Nr. 3"
            />
          </div>

          {meetingType === "pakartotinis" && (
            <div className="space-y-2">
              <Select name="previous_meeting_id" label="Dėl kvorumo neįvykęs susirinkimas" defaultValue={meeting?.previous_meeting_id || ""} required
                options={[{ value: "", label: "Pasirinkite" }, ...previousMeetings.filter(m => m.id !== meeting?.id && ["visuotinis", "neeilinis"].includes(m.meeting_type) && m.status === "baigtas").map(m => ({ value: m.id, label: `${m.title} (${m.meeting_date.slice(0, 10)})` }))]} />
              <p className="text-sm text-gray-600">Kuriant pakartotinį susirinkimą perkeliama ankstesnė darbotvarkė. Spręsti naujų klausimų pagal kvorumo išimtį negalima.</p>
            </div>
          )}
          <Select name="majority_rule" label="Patvirtintoje balsavimo tvarkoje nustatyta paprasta dauguma" defaultValue={meeting?.majority_rule || ""}
            options={[{ value: "", label: "Tvarka dar nenurodyta" }, { value: "for_against", label: "Daugiau už negu prieš" }, { value: "participants", label: "Daugiau nei pusė dalyvaujančių" }]} />
          <Input name="majority_reference" label="Balsavimo tvarkos dokumentas / sprendimo nuoroda" defaultValue={meeting?.majority_reference || ""} />
          <p className="text-sm text-gray-600">Įstatai išsamios paprastos daugumos formulės nenustato. Prieš tvirtinant įprastą nutarimą reikia nurodyti taikomą patvirtintą tvarką. Specialiems sprendimams taikoma 2/3 dalyvaujančių riba.</p>

          <div className="grid grid-cols-2 gap-4">
            <DatePicker
              label="Data"
              name="meeting_date"
              defaultValue={dateValue}
              error={errors.meeting_date?.[0]}
              required
            />
            <Input
              label="Laikas (24h, Vilniaus)"
              name="meeting_time"
              type="text"
              inputMode="numeric"
              pattern="([01]\d|2[0-3]):[0-5]\d"
              placeholder="18:00"
              defaultValue={timeValue}
              error={errors.meeting_time?.[0]}
              required
            />
          </div>

          <Input
            label="Vieta"
            name="location"
            defaultValue={meeting?.location || COMMUNITY_LEGAL.address}
            error={errors.location?.[0]}
            required
          />

          <Textarea
            label="Darbotvarkė / pastabos"
            name="description"
            defaultValue={meeting?.description || ""}
            rows={4}
            placeholder="Papildomi klausimai bus pridedami atskirai kaip nutarimai"
          />

          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">Automatiškai sukuriami procedūriniai klausimai:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
              <li>Dėl susirinkimo pirmininko ir sekretoriaus rinkimų</li>
              <li>Susirinkimo pranešimo tinkamumo patvirtinimas</li>
              <li>Susirinkimo darbotvarkės tvirtinimas</li>
            </ol>
            <p className="mt-2 text-xs text-blue-600">
              Kvorumas siūlomas automatiškai – &bdquo;daugiau kaip pusė&ldquo;: visuotiniam
              susirinkimui nuo balso teisę turinčių narių (įstatų 4.5 p.), Tarybos
              posėdžiui nuo dabartinių Tarybos narių (5.5 p.), pakartotiniam –
              neribojamas (4.6 p.). Posėdžio ekrane skaičių galima pakoreguoti.
            </p>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Išankstinis balsavimas online (neprivaloma)
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Pagal įstatų 4.4 str. susirinkimas gali vykti elektroninėmis ryšio priemonėmis
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Pradžia (YYYY-MM-DDTHH:MM)"
                name="early_voting_start"
                type="text"
                pattern="\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d"
                placeholder="2026-05-03T18:00"
                defaultValue={
                  meeting?.early_voting_start
                    ? isoToVilniusLocal(meeting.early_voting_start)
                    : ""
                }
              />
              <Input
                label="Pabaiga (YYYY-MM-DDTHH:MM)"
                name="early_voting_end"
                type="text"
                pattern="\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d"
                placeholder="2026-05-23T17:00"
                defaultValue={
                  meeting?.early_voting_end
                    ? isoToVilniusLocal(meeting.early_voting_end)
                    : ""
                }
              />
            </div>
          </div>

          {errors._form && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
              {errors._form[0]}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={loading}>
              {meeting ? "Išsaugoti" : "Sukurti susirinkimą"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Atšaukti
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
