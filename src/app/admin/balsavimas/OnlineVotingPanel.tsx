"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { castOnlineVote } from "@/actions/voting";
import { Badge } from "@/components/ui/Badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, MinusCircle } from "lucide-react";

interface Resolution {
  id: string;
  title: string;
  description: string | null;
  resolution_number: number;
  requires_qualified_majority: boolean;
  result_for: number;
  result_against: number;
  result_abstain: number;
}

interface Props {
  resolutions: Resolution[];
  memberId: string;
  existingBallots: Array<{ resolution_id: string; vote: string }>;
}

export function OnlineVotingPanel({ resolutions, memberId, existingBallots }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const getExistingVote = (resId: string) =>
    existingBallots.find((b) => b.resolution_id === resId)?.vote;

  const handleVote = async (resolutionId: string, vote: string) => {
    setLoading(resolutionId);
    const result = await castOnlineVote(resolutionId, memberId, vote);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Balsas priimtas!");
      router.refresh();
    }
    setLoading(null);
  };

  const voteLabels: Record<string, string> = {
    uz: "Už",
    pries: "Prieš",
    susilaike: "Susilaikė",
  };

  return (
    <div className="space-y-4">
      {resolutions.map((res) => {
        const existingVote = getExistingVote(res.id);
        const isLoading = loading === res.id;

        return (
          <div key={res.id} className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-sm font-bold text-gray-400">{res.resolution_number}.</span>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-gray-900">{res.title}</h3>
                {res.description && (
                  <p className="text-xs text-gray-500 mt-1">{res.description}</p>
                )}
                {res.requires_qualified_majority && (
                  <Badge variant="warning" className="mt-1">
                    Reikalinga 2/3 dauguma
                  </Badge>
                )}
              </div>
            </div>

            {existingVote ? (
              <div className="bg-green-50 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">
                  Jūs balsavote: <strong>{voteLabels[existingVote]}</strong>
                </span>
                <span className="text-xs text-green-600 ml-auto">Galite pakeisti balsą</span>
              </div>
            ) : null}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => handleVote(res.id, "uz")}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  existingVote === "uz"
                    ? "bg-green-600 text-white"
                    : "bg-green-50 text-green-700 hover:bg-green-100"
                } disabled:opacity-50`}
              >
                <CheckCircle className="h-4 w-4" />
                Už
              </button>
              <button
                onClick={() => handleVote(res.id, "pries")}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  existingVote === "pries"
                    ? "bg-red-600 text-white"
                    : "bg-red-50 text-red-700 hover:bg-red-100"
                } disabled:opacity-50`}
              >
                <XCircle className="h-4 w-4" />
                Prieš
              </button>
              <button
                onClick={() => handleVote(res.id, "susilaike")}
                disabled={isLoading}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  existingVote === "susilaike"
                    ? "bg-gray-600 text-white"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                } disabled:opacity-50`}
              >
                <MinusCircle className="h-4 w-4" />
                Susilaikau
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
