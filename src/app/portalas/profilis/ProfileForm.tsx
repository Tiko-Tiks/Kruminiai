"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { updateMemberContacts } from "@/actions/portal";
import { toast } from "sonner";
import { Save } from "lucide-react";

interface Props {
  initialEmail: string;
  initialPhone: string;
  initialAddress: string;
}

export function ProfileForm({ initialEmail, initialPhone, initialAddress }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState(initialAddress);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const result = await updateMemberContacts(email, phone, address);
    setSaving(false);
    if ("error" in result) {
      toast.error(result.error || "Klaida");
    } else {
      toast.success("Duomenys atnaujinti");
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
    >
      <h3 className="text-base font-semibold text-gray-900">Kontaktai</h3>
      <Input
        label="El. paštas"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="vardenis@email.com"
      />
      <Input
        label="Telefonas"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+370 6XX XXXXX"
      />
      <Textarea
        label="Adresas"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        rows={2}
        placeholder="Gatvė ir namo numeris"
      />
      <Button type="submit" loading={saving}>
        <Save className="h-4 w-4" />
        Išsaugoti
      </Button>
    </form>
  );
}
