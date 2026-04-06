"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Clock } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  role: string;
  is_approved: boolean;
  created_at: string;
}

export function UserApprovalList({ profiles }: { profiles: Profile[] }) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleApprove = async (id: string) => {
    setLoading(id);
    const supabase = createClient();
    await supabase.from("profiles").update({ is_approved: true }).eq("id", id);
    router.refresh();
    setLoading(null);
  };

  const handleRevoke = async (id: string) => {
    setLoading(id);
    const supabase = createClient();
    await supabase.from("profiles").update({ is_approved: false }).eq("id", id);
    router.refresh();
    setLoading(null);
  };

  const pending = profiles.filter((p) => !p.is_approved);
  const approved = profiles.filter((p) => p.is_approved);

  return (
    <div className="space-y-8">
      {/* Laukiantys patvirtinimo */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-500" />
          Laukiantys patvirtinimo ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
            Nėra laukiančių patvirtinimo
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {pending.map((profile) => (
              <div key={profile.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-gray-900">{profile.full_name}</p>
                  <p className="text-xs text-gray-400">
                    Registruotas: {new Date(profile.created_at).toLocaleDateString("lt-LT")}
                  </p>
                </div>
                <button
                  onClick={() => handleApprove(profile.id)}
                  disabled={loading === profile.id}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle className="h-4 w-4" />
                  {loading === profile.id ? "..." : "Patvirtinti"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Patvirtinti vartotojai */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Patvirtinti ({approved.length})
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {approved.map((profile) => (
            <div key={profile.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-gray-900">{profile.full_name}</p>
                <p className="text-xs text-gray-400">
                  {profile.role === "super_admin" ? "Super admin" : "Administratorius"}
                </p>
              </div>
              <button
                onClick={() => handleRevoke(profile.id)}
                disabled={loading === profile.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
                {loading === profile.id ? "..." : "Atšaukti"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
