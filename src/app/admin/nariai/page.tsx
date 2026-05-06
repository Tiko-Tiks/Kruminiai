import { getMembers } from "@/actions/members";
import { Badge, statusBadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { MEMBER_STATUS_LABELS } from "@/lib/constants";
import { Plus, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { MembersSearch } from "./MembersSearch";
import { DeleteMemberButton } from "./DeleteMemberButton";

interface Props {
  searchParams: { paieska?: string; statusas?: string };
}

export default async function MembersPage({ searchParams }: Props) {
  const members = await getMembers(searchParams.paieska, searchParams.statusas);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nariai</h1>
          <p className="text-sm text-gray-500 mt-1">{members.length} narių bendruomenėje</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/nariai/deklaracija">
            <Button variant="outline">
              <ClipboardCheck className="h-4 w-4" /> Narystės deklaracija
            </Button>
          </Link>
          <Link href="/admin/nariai/naujas">
            <Button>
              <Plus className="h-4 w-4" /> Naujas narys
            </Button>
          </Link>
        </div>
      </div>

      <MembersSearch />

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-6 py-3 font-medium">Vardas, pavardė</th>
                <th className="px-6 py-3 font-medium">Telefonas</th>
                <th className="px-6 py-3 font-medium">El. paštas</th>
                <th className="px-6 py-3 font-medium">Adresas</th>
                <th className="px-6 py-3 font-medium">Statusas</th>
                <th className="px-6 py-3 font-medium">Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    {searchParams.paieska ? "Nieko nerasta" : "Dar nėra narių. Pridėkite pirmąjį!"}
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-3 font-medium text-gray-900">
                      <Link href={`/admin/nariai/${member.id}`} className="hover:text-blue-600">
                        {member.first_name} {member.last_name}
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{member.phone || "–"}</td>
                    <td className="px-6 py-3 text-gray-600">{member.email || "–"}</td>
                    <td className="px-6 py-3 text-gray-600">{member.address || "–"}</td>
                    <td className="px-6 py-3">
                      <Badge variant={statusBadgeVariant(member.status)}>
                        {MEMBER_STATUS_LABELS[member.status] || member.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/nariai/${member.id}`}
                          className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                        >
                          Redaguoti
                        </Link>
                        <DeleteMemberButton id={member.id} name={`${member.first_name} ${member.last_name}`} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
