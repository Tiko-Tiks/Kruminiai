"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SITE_NAME } from "@/lib/constants";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("Neteisingas el. paštas arba slaptažodis");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/images/logo-sm.png" alt={SITE_NAME} width={56} height={84} className="h-14 w-auto mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">{SITE_NAME}</h1>
          <p className="text-sm text-gray-500 mt-1">Administravimo sistema</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
          <Input
            id="email"
            label="El. paštas"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@kruminiai.lt"
            required
          />
          <Input
            id="password"
            label="Slaptažodis"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Slaptažodis"
            required
          />

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" loading={loading}>
            Prisijungti
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          <a href="/" className="hover:text-gray-600">
            &larr; Grįžti į pagrindinį puslapį
          </a>
        </p>
      </div>
    </div>
  );
}
