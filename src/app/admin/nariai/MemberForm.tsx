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
                { value: "išstojęs", label: "Išstojęs" },
              ]}
            />
          </div>
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
