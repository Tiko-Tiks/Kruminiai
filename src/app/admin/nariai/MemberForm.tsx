"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { createMember, updateMember } from "@/actions/members";
import { toast } from "sonner";
import type { Member } from "@/lib/types";

interface Props {
  member?: Member;
}

export function MemberForm({ member }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const isEdit = !!member;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const result = isEdit
      ? await updateMember(member.id, formData)
      : await createMember(formData);

    setLoading(false);

    if (result.error) {
      if (typeof result.error === "object") {
        setErrors(result.error as Record<string, string[]>);
      }
      toast.error("Nepavyko išsaugoti");
      return;
    }

    toast.success(isEdit ? "Narys atnaujintas" : "Narys sukurtas");
    router.push("/admin/nariai");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-gray-900">
          {isEdit ? "Redaguoti narį" : "Naujas narys"}
        </h2>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="first_name"
              name="first_name"
              label="Vardas *"
              defaultValue={member?.first_name}
              error={errors.first_name?.[0]}
              required
            />
            <Input
              id="last_name"
              name="last_name"
              label="Pavardė *"
              defaultValue={member?.last_name}
              error={errors.last_name?.[0]}
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="email"
              name="email"
              label="El. paštas"
              type="email"
              defaultValue={member?.email || ""}
              error={errors.email?.[0]}
            />
            <Input
              id="phone"
              name="phone"
              label="Telefonas"
              defaultValue={member?.phone || ""}
              error={errors.phone?.[0]}
            />
          </div>
          <Input
            id="address"
            name="address"
            label="Adresas"
            defaultValue={member?.address || ""}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="join_date"
              name="join_date"
              label="Narystės pradžia *"
              type="date"
              defaultValue={member?.join_date || new Date().toISOString().split("T")[0]}
              required
            />
            <Select
              id="status"
              name="status"
              label="Statusas"
              defaultValue={member?.status || "aktyvus"}
              options={[
                { value: "aktyvus", label: "Aktyvus" },
                { value: "pasyvus", label: "Pasyvus" },
                { value: "išstojęs", label: "Narystė pasibaigusi" },
                { value: "garbes_narys", label: "Garbės narys" },
              ]}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              id="language"
              name="language"
              label="El. laiškų kalba"
              defaultValue={(member as { language?: string })?.language || "lt"}
              options={[
                { value: "lt", label: "Lietuvių" },
                { value: "en", label: "English" },
              ]}
            />
          </div>
          <fieldset className="space-y-3 border-t pt-4">
            <legend className="font-medium">Priėmimo į bendruomenę pagrindas</legend>
            <p className="text-sm text-gray-600">Nurodykite raštišką prašymą ir jau priimtą Tarybos sprendimą (įstatų 3.2 p.). Importuojant seną narį tinka istorinio sprendimo nuoroda.</p>
            <Input name="application_reference" label="Raštiško prašymo data ir registracijos numeris / nuoroda" defaultValue={member?.application_reference || ""} />
            <Input name="admission_reference" label="Tarybos protokolo numeris ir sprendimo punktas / nuoroda" defaultValue={member?.admission_reference || ""} />
            <Input name="admission_date" label="Tarybos sprendimo data" type="date" defaultValue={member?.admission_date || ""} />
          </fieldset>
          <fieldset className="space-y-3 border-t pt-4">
            <legend className="font-medium">Narystės pabaigos pagrindas</legend>
            <p className="text-sm text-gray-600">Pildoma nutraukiant narystę. Išstojimui pakanka nario raštiško prašymo; Tarybos leidimo nereikia. Pašalinimui registruojamas Tarybos sprendimas ir nario informavimas apie teisę skųsti. Taikymo data įrašoma pagal dokumentus.</p>
            <Select name="termination_kind" label="Narystės pabaigos būdas" defaultValue={member?.termination_kind || ""} options={[{value:"",label:"Netaikoma"},{value:"withdrawal",label:"Nario išstojimas"},{value:"expulsion",label:"Tarybos sprendimas pašalinti"}]} />
            <Input name="termination_reference" label="Raštiško išstojimo prašymo arba Tarybos sprendimo nuoroda" defaultValue={member?.termination_reference || ""} />
            <Input name="termination_date" label="Dokumentuose nustatyta narystės pabaigos data" type="date" defaultValue={member?.termination_date || ""} />
            <Select name="expulsion_ground" label="Pašalinimo pagrindas (tik Tarybos sprendimui)" defaultValue={member?.expulsion_ground || ""} options={[{value:"",label:"Netaikoma"},{value:"3.4.1",label:"Įstatų 3.4.1 p."},{value:"3.4.2",label:"Įstatų 3.4.2 p."},{value:"3.4.3",label:"Įstatų 3.4.3 p."}]} />
            <Input name="appeal_reference" label="Pranešimo apie pašalinimą ir teisę skųsti artimiausiam Visuotiniam susirinkimui įrodymas" defaultValue={member?.appeal_reference || ""} />
          </fieldset>
          <Textarea
            id="notes"
            name="notes"
            label="Pastabos"
            defaultValue={member?.notes || ""}
          />

          {errors._form && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
              {errors._form[0]}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" loading={loading}>
              {isEdit ? "Išsaugoti" : "Sukurti"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.back()}>
              Atšaukti
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
