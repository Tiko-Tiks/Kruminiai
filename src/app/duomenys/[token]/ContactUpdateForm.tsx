"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { CheckCircle2 } from "lucide-react";

interface Props {
  token: string;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
}

export function ContactUpdateForm({ token, member }: Props) {
  const [email, setEmail] = useState(member.email || "");
  const [phone, setPhone] = useState(member.phone || "");
  const [address, setAddress] = useState(member.address || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !email.includes("@")) {
      setError("Įveskite teisingą el. pašto adresą");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data, error: rpcErr } = await supabase.rpc("update_member_with_token", {
      p_token: token,
      p_email: email.trim(),
      p_phone: phone.trim() || null,
      p_address: address.trim() || null,
    });
    setLoading(false);

    if (rpcErr || (data && (data as { error?: string }).error)) {
      const errMsg =
        rpcErr?.message || (data as { error?: string }).error || "Įvyko klaida";
      setError(
        errMsg === "already_completed"
          ? "Šia nuoroda jau pasinaudojote anksčiau"
          : errMsg === "invalid_token"
            ? "Nuoroda negalioja"
            : "Nepavyko išsaugoti. Bandykite dar kartą."
      );
      return;
    }

    setSuccess(true);
  };

  // Sėkmingo išsaugojimo būsena – paprastas „Ačiū" su žalia varnele.
  // Slepiam ir tėvinio puslapio sveikinimą per CSS (sibling negative margin),
  // kad nebūtų dubliuoto teksto „Sveiki, Vardenis" + „Ačiū, Vardenis".
  if (success) {
    return (
      <>
        <style>{`
          /* Užmaskuojam Sveiki header'į page.tsx puslapyje – jis yra
             tarp main'o ir formos, todėl nustatom display: none ant jo. */
          [data-greeting] { display: none !important; }
        `}</style>
        <div className="text-center py-6">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="h-10 w-10 text-green-700" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Ačiū už papildytą informaciją!
          </h2>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          El. paštas *
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="jusu@pastas.lt"
          required
          autoFocus
          inputMode="email"
          className="block w-full rounded-lg border border-gray-300 bg-blue-50/50 px-4 py-3 text-base focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Privaloma. Per šį adresą gausite pranešimus apie susirinkimus.
        </p>
      </div>

      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Telefonas
        </label>
        <input
          id="phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+370 6XX XXXXX"
          inputMode="tel"
          className="block w-full rounded-lg border border-gray-300 bg-blue-50/50 px-4 py-3 text-base focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div>
        <label
          htmlFor="address"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Adresas
        </label>
        <input
          id="address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Gatvė, namo nr."
          className="block w-full rounded-lg border border-gray-300 bg-blue-50/50 px-4 py-3 text-base focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-green-700 px-4 py-3.5 text-base font-semibold text-white hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
      >
        {loading ? "Saugoma..." : "Išsaugoti"}
      </button>
    </form>
  );
}
