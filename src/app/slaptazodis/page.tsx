"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/admin/slaptazodis`,
    });

    if (error) {
      setError("Nepavyko išsiųsti nuorodos. Patikrinkite el. paštą.");
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-amber-50">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-amber-400 flex items-center justify-center mb-5">
                <KeyRound className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Slaptažodžio atstatymas</h1>
              <p className="text-sm text-gray-500 mt-1">
                Įveskite savo el. paštą ir atsiųsime nuorodą
              </p>
            </div>

            {success ? (
              <div className="text-center space-y-4">
                <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">
                  Nuoroda išsiųsta! Patikrinkite savo el. paštą.
                </div>
                <Link
                  href="/prisijungimas"
                  className="inline-block text-sm font-semibold text-gray-900 hover:underline"
                >
                  Grįžti į prisijungimą
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    El. paštas
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jusu@pastas.lt"
                    required
                    className="block w-full rounded-lg border border-gray-300 bg-blue-50/50 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-gray-400"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-green-800 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
                >
                  {loading ? "Siunčiama..." : "Siųsti nuorodą"}
                </button>

                <div className="text-center">
                  <Link
                    href="/prisijungimas"
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Grįžti į prisijungimą
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
