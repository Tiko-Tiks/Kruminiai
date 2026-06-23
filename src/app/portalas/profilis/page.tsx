import { getMemberProfile } from "@/actions/portal";
import { ProfileForm } from "./ProfileForm";
import { formatDate } from "@/lib/utils";
import { getDict } from "@/lib/i18n-server";
import { User, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

interface ProfileData {
  profile?: {
    full_name: string;
    role: string;
    is_approved: boolean;
    member_id: string | null;
  };
  member?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    join_date: string;
    status: string;
  } | null;
  error?: string;
}

export default async function PortalProfilePage() {
  const data = (await getMemberProfile()) as ProfileData;
  const t = getDict().portalProfile;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t.pageTitle}</h1>
        <p className="text-sm text-gray-500 mt-1">{t.pageSubtitle}</p>
      </div>

      {!data.member && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-1">{t.noMemberLinkTitle}</p>
              <p>{t.noMemberLinkBody}</p>
            </div>
          </div>
        </div>
      )}

      {data.member && (
        <>
          {/* Nario informacija (read-only) */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-14 w-14 rounded-full bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0">
                <User className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {data.member.first_name} {data.member.last_name}
                </h2>
                <p className="text-sm text-gray-500">
                  {t.memberSincePrefix} {formatDate(data.member.join_date)} ·{" "}
                  <span
                    className={
                      data.member.status === "aktyvus"
                        ? "text-green-700 font-medium"
                        : "text-gray-500"
                    }
                  >
                    {data.member.status === "aktyvus" ? t.statusActive : data.member.status}
                  </span>
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
              {t.changeNameNotice}
            </p>
          </div>

          {/* Kontaktų atnaujinimo forma */}
          <ProfileForm
            initialEmail={data.member.email || ""}
            initialPhone={data.member.phone || ""}
            initialAddress={data.member.address || ""}
          />
        </>
      )}
    </div>
  );
}
