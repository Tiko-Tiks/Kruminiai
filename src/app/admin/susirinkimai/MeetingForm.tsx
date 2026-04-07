"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMeeting, updateMeeting } from "@/actions/meetings";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { COMMUNITY_LEGAL } from "@/lib/constants";
import { Meeting } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  meeting?: Meeting;
}

export function MeetingForm({ meeting }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const dateValue = meeting ? new Date(meeting.meeting_date).toISOString().split("T")[0] : "";
  const timeValue = meeting
    ? new Date(meeting.meeting_date).toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" })
    : "18:00";

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
              defaultValue={meeting?.meeting_type || "visuotinis"}
              options={[
                { value: "visuotinis", label: "Visuotinis narių susirinkimas" },
                { value: "neeilinis", label: "Neeilinis susirinkimas" },
                { value: "pakartotinis", label: "Pakartotinis (be kvorumo)" },
                { value: "valdybos", label: "Valdybos posėdis" },
              ]}
            />
            <Input
              label="Protokolo Nr."
              name="protocol_number"
              defaultValue={meeting?.protocol_number || ""}
              placeholder="Pvz.: Nr. 3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Data"
              name="meeting_date"
              type="date"
              defaultValue={dateValue}
              error={errors.meeting_date?.[0]}
              required
            />
            <Input
              label="Laikas"
              name="meeting_time"
              type="time"
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
              <li>Susirinkimo darbotvarkės tvirtinimas</li>
            </ol>
            <p className="mt-2 text-xs text-blue-600">
              Kvorumas apskaičiuojamas automatiškai pagal aktyvių narių skaičių (&gt;50%, įstatai 4.5 str.)
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
                label="Pradžia"
                name="early_voting_start"
                type="datetime-local"
                defaultValue={
                  meeting?.early_voting_start
                    ? new Date(meeting.early_voting_start).toISOString().slice(0, 16)
                    : ""
                }
              />
              <Input
                label="Pabaiga"
                name="early_voting_end"
                type="datetime-local"
                defaultValue={
                  meeting?.early_voting_end
                    ? new Date(meeting.early_voting_end).toISOString().slice(0, 16)
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
