"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { KeyRound } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("Nepavyko pakeisti slaptažodžio. Bandykite dar kartą.");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-amber-400 flex items-center justify-center mb-5">
              <KeyRound className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Naujas slaptažodis</h1>
            <p className="text-sm text-gray-500 mt-1">
              Įveskite naują slaptažodį
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Naujas slaptažodis
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Naujas slaptažodis"
                required
                className="block w-full rounded-lg border border-gray-300 bg-blue-50/50 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="confirm" className="block text-sm font-medium text-gray-700">
                Pakartokite slaptažodį
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              {loading ? "Keičiama..." : "Pakeisti slaptažodį"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
