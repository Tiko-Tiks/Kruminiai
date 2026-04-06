import { createServerSupabaseClient } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/Card";
import { Users, Banknote, FileText, Newspaper, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

async function getDashboardData() {
  const supabase = createServerSupabaseClient();

  const currentYear = new Date().getFullYear();

  const [membersRes, activeMembersRes, documentsRes, newsRes, , paymentsRes, recentAuditRes] =
    await Promise.all([
      supabase.from("members").select("id", { count: "exact", head: true }),
      supabase.from("members").select("id", { count: "exact", head: true }).eq("status", "aktyvus"),
      supabase.from("documents").select("id", { count: "exact", head: true }),
      supabase.from("news").select("id", { count: "exact", head: true }).eq("is_published", true),
      supabase.from("fee_periods").select("id").eq("year", currentYear),
      supabase.from("payments").select("amount_cents, fee_period:fee_periods!inner(year)").eq("fee_periods.year", currentYear),
      supabase.from("audit_log").select("*, profile:profiles(full_name)").order("created_at", { ascending: false }).limit(10),
    ]);

  const totalCollected = (paymentsRes.data || []).reduce(
    (sum: number, p: { amount_cents: number }) => sum + p.amount_cents,
    0
  );

  return {
    totalMembers: membersRes.count || 0,
    activeMembers: activeMembersRes.count || 0,
    documentsCount: documentsRes.count || 0,
    newsCount: newsRes.count || 0,
    totalCollected,
    recentAudit: recentAuditRes.data || [],
  };
}

const actionLabels: Record<string, string> = {
  CREATE: "Sukūrė",
  UPDATE: "Atnaujino",
  DELETE: "Ištrynė",
};

const tableLabels: Record<string, string> = {
  members: "narį",
  payments: "mokėjimą",
  fee_periods: "mokesčio laikotarpį",
  documents: "dokumentą",
  news: "naujieną",
};

export default async function AdminDashboard() {
  const data = await getDashboardData();

  const stats = [
    {
      label: "Viso narių",
      value: data.totalMembers,
      sub: `${data.activeMembers} aktyvūs`,
      icon: Users,
      color: "text-blue-600 bg-blue-50",
      href: "/admin/nariai",
    },
    {
      label: "Surinkta šiais metais",
      value: formatCurrency(data.totalCollected),
      icon: Banknote,
      color: "text-green-600 bg-green-50",
      href: "/admin/mokesciai",
    },
    {
      label: "Dokumentai",
      value: data.documentsCount,
      icon: FileText,
      color: "text-amber-600 bg-amber-50",
      href: "/admin/dokumentai",
    },
    {
      label: "Paskelbtos naujienos",
      value: data.newsCount,
      icon: Newspaper,
      color: "text-purple-600 bg-purple-50",
      href: "/admin/naujienos",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Suvestinė</h1>
        <p className="text-sm text-gray-500 mt-1">Bendruomenės administravimo apžvalga</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-start gap-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  {stat.sub && <p className="text-xs text-gray-400">{stat.sub}</p>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Paskutiniai veiksmai</h2>
        </div>
        <CardContent>
          {data.recentAudit.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Veiksmų istorija tuščia</p>
          ) : (
            <div className="space-y-3">
              {data.recentAudit.map((entry: Record<string, unknown>) => (
                <div key={entry.id as string} className="flex items-start gap-3 text-sm">
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-gray-700">
                      <span className="font-medium">
                        {(entry.profile as Record<string, string>)?.full_name || "Sistema"}
                      </span>{" "}
                      {actionLabels[entry.action as string] || entry.action as string}{" "}
                      {tableLabels[entry.table_name as string] || entry.table_name as string}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(entry.created_at as string).toLocaleString("lt-LT")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
