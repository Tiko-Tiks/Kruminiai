"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { LogIn } from "lucide-react";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { useT } from "@/components/i18n/LocaleProvider";

export default function LoginPage() {
  const t = useT().auth;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Parodyti priežastį, kai vartotojas atkeliauja po peradresavimo
  // (middleware → ?error=not_approved, auth/callback → ?error=auth).
  // Skaitom iš window (ne useSearchParams), kad nereikėtų Suspense ribos.
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (err === "not_approved") {
      setError(t.errNotApproved);
    } else if (err === "auth") {
      setError(t.errAuthLink);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const code = (error as { code?: string }).code;
      const msg = (error.message || "").toLowerCase();
      if (code === "email_not_confirmed" || msg.includes("not confirmed") || msg.includes("not been confirmed")) {
        setError(t.errNotConfirmed);
      } else {
        setError(t.errInvalidCredentials);
      }
      setLoading(false);
      return;
    }

    // Check if user is approved + role
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_approved, role")
      .eq("id", data.user.id)
      .single();

    if (!profile?.is_approved) {
      await supabase.auth.signOut();
      setError(t.errNotApproved);
      setLoading(false);
      return;
    }

    // Admin'ai → /admin, paprasti nariai → /portalas
    const isAdmin = profile.role === "admin" || profile.role === "super_admin";
    router.push(isAdmin ? "/admin" : "/portalas");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex flex-col bg-amber-50">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex flex-col items-center mb-6">
              <div className="w-16 h-16 rounded-full bg-amber-400 flex items-center justify-center mb-5">
                <LogIn className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{t.loginTitle}</h1>
              <p className="text-sm text-gray-500 mt-1">{t.loginSubtitle}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  {t.emailLabel}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  required
                  className="block w-full rounded-lg border border-gray-300 bg-blue-50/50 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-gray-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    {t.passwordLabel}
                  </label>
                  <Link href="/slaptazodis" className="text-xs text-gray-500 hover:text-gray-700">
                    {t.forgotPassword}
                  </Link>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t.passwordPlaceholder}
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
                {loading ? t.loggingIn : t.loginButton}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                {t.noAccount}{" "}
                <Link href="/registracija" className="font-semibold text-gray-900 hover:underline">
                  {t.registerNow}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
