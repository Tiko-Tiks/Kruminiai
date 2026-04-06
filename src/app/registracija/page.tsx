"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { UserPlus, CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Slaptažodžiai nesutampa");
      return;
    }

    if (password.length < 6) {
      setError("Slaptažodis turi būti bent 6 simbolių");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: `${firstName} ${lastName}`,
        },
      },
    });

    if (error) {
      setError("Nepavyko sukurti paskyros. Bandykite dar kartą.");
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
            {success ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">Registracija gauta!</h2>
                <p className="text-sm text-gray-600 leading-relaxed mb-2">
                  Jūsų registracija sėkmingai pateikta.
                </p>
                <p className="text-sm text-gray-600 leading-relaxed mb-6">
                  Bendruomenės administratorius peržiūrės jūsų prašymą ir patvirtins paskyrą.
                  Kai paskyra bus patvirtinta, galėsite prisijungti.
                </p>
                <Link
                  href="/"
                  className="inline-block px-6 py-3 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Grįžti į pradžią
                </Link>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-amber-400 flex items-center justify-center mb-5">
                    <UserPlus className="h-7 w-7 text-white" />
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">Tapti nariu</h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Užpildykite formą ir laukite administratoriaus patvirtinimo
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                        Vardas
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Vardenis"
                        required
                        className="block w-full rounded-lg border border-gray-300 bg-blue-50/50 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-gray-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                        Pavardė
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Pavardenis"
                        required
                        className="block w-full rounded-lg border border-gray-300 bg-blue-50/50 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                      El. paštas
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                      </div>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jusu@pastas.lt"
                        required
                        className="block w-full rounded-lg border border-gray-300 bg-blue-50/50 pl-10 pr-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Slaptažodis
                    </label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Slaptažodis"
                      required
                      className="block w-full rounded-lg border border-gray-300 bg-blue-50/50 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-gray-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                      Pakartokite slaptažodį
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Pakartokite slaptažodį"
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
                    {loading ? "Registruojama..." : "Pateikti registraciją"}
                  </button>
                </form>

                <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                  <p className="text-sm text-gray-500">
                    Jau turite paskyrą?{" "}
                    <Link href="/prisijungimas" className="font-semibold text-gray-900 hover:underline">
                      Prisijungti
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
