"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { KeyRound, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";

/**
 * Slaptažodžio nustatymo puslapis – naudojamas:
 *   • Naujo nario welcome flow'e (po admin bulk-invite)
 *   • Esamo nario slaptažodžio atstatyme (po „Pamiršau slaptažodį")
 *
 * Nuoroda iš email'o atveda į /auth/callback?next=/nustatyti-slaptazodi.
 * Auth callback iškeičia code → session, tada redirect'as čia su jau
 * autentifikuotu naudotoju. Tuomet kviečiam supabase.auth.updateUser()
 * naują slaptažodį.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  // Recovery nuoroda iš Supabase atveda su hash fragmentu:
  //   /nustatyti-slaptazodi#access_token=...&refresh_token=...&type=recovery
  //
  // @supabase/ssr createBrowserClient pagal default'ą naudoja PKCE flow
  // (laukia ?code=...) ir todėl AUTOMATIŠKAI neapdoroja hash fragmento.
  // Vadinasi turim rankiniu būdu parse'inti hash'ą ir kviesti setSession().
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function init() {
      // 1) Tikrinam, ar URL hash'e yra recovery token'ai
      if (typeof window !== "undefined" && window.location.hash) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const errorDescription = params.get("error_description");

        // Klaida iš Supabase (pvz., token expired)
        if (errorDescription) {
          console.error("[set-password] recovery error:", errorDescription);
          if (mounted) {
            setAuthorized(false);
            setAuthChecked(true);
          }
          return;
        }

        // Sėkmingas atvejis – nustatom sessiją iš hash'o
        if (accessToken && refreshToken) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (mounted) {
            if (setErr) {
              console.error("[set-password] setSession failed:", setErr);
              setAuthorized(false);
            } else {
              setAuthorized(true);
              // Pašalinam hash iš URL (kad nerodytume token'ų)
              window.history.replaceState(null, "", window.location.pathname);
            }
            setAuthChecked(true);
          }
          return;
        }
      }

      // 2) Hash'o nėra – tikrinam, ar yra esama sessija (jau prisijungęs narys)
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setAuthorized(!!data.session);
        setAuthChecked(true);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Slaptažodžiai nesutampa");
      return;
    }
    if (password.length < 6) {
      setError("Slaptažodis turi būti bent 6 simbolių");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password });

    if (updateErr) {
      setError(`Nepavyko nustatyti slaptažodžio: ${updateErr.message}`);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);

    // Po sėkmingo nustatymo redirect'as į portalą (arba admin, jei admin rolė).
    setTimeout(async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", (await supabase.auth.getUser()).data.user!.id)
        .single();
      const next = profile?.role === "admin" || profile?.role === "super_admin" ? "/admin" : "/portalas";
      router.push(next);
      router.refresh();
    }, 1500);
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
              <h1 className="text-2xl font-bold text-gray-900 text-center">
                Nustatykite slaptažodį
              </h1>
              <p className="text-sm text-gray-500 mt-1 text-center">
                Pasirinkite slaptažodį, kuriuo prisijungsite į portalą
              </p>
            </div>

            {!authChecked ? (
              <p className="text-sm text-gray-500 text-center py-8">Tikrinama...</p>
            ) : !authorized ? (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-900 mb-1">
                      Nuoroda negalioja arba baigėsi
                    </p>
                    <p className="text-sm text-red-800">
                      Slaptažodžio nustatymo nuorodos paprastai galioja 24 valandas.
                      Paprašykite naujos nuorodos:
                    </p>
                  </div>
                </div>
                <Link
                  href="/slaptazodis"
                  className="block w-full text-center rounded-lg bg-green-800 px-4 py-3 text-sm font-medium text-white hover:bg-green-700"
                >
                  Užsakyti naują nuorodą
                </Link>
                <Link
                  href="/prisijungimas"
                  className="block w-full text-center rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Grįžti į prisijungimą
                </Link>
              </div>
            ) : success ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-700" />
                </div>
                <p className="text-base font-semibold text-gray-900">
                  Slaptažodis nustatytas!
                </p>
                <p className="text-sm text-gray-600">
                  Nukreipiame Jus į portalą...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Naujas slaptažodis
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Bent 6 simboliai"
                    required
                    minLength={6}
                    autoFocus
                    className="block w-full rounded-lg border border-gray-300 bg-blue-50/50 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-gray-400"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="confirm"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Pakartokite slaptažodį
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Pakartokite tą patį slaptažodį"
                    required
                    minLength={6}
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
                  {loading ? "Saugoma..." : "Nustatyti slaptažodį"}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  Po slaptažodžio nustatymo automatiškai pateksite į portalą.
                </p>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
