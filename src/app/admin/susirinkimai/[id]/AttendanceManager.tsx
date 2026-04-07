"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addAttendance, removeAttendance } from "@/actions/meetings";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Member } from "@/lib/types";
import { toast } from "sonner";
import { UserPlus, X, Users, CheckCircle, AlertTriangle } from "lucide-react";
import { ATTENDANCE_TYPE_LABELS } from "@/lib/constants";

interface AttendanceRecord {
  id: string;
  meeting_id: string;
  member_id: string;
  attendance_type: string;
  member: { id: string; first_name: string; last_name: string } | null;
}

interface Props {
  meetingId: string;
  attendance: AttendanceRecord[];
  allMembers: Member[];
  quorumRequired: number;
  meetingStatus: string;
}

export function AttendanceManager({
  meetingId,
  attendance,
  allMembers,
  quorumRequired,
  meetingStatus,
}: Props) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [attendanceType, setAttendanceType] = useState("fizinis");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const attendedIds = new Set(attendance.map((a) => a.member_id));
  const available = allMembers.filter(
    (m) => !attendedIds.has(m.id) &&
      (m.first_name.toLowerCase().includes(search.toLowerCase()) ||
       m.last_name.toLowerCase().includes(search.toLowerCase()))
  );

  const hasQuorum = quorumRequired === 0 || attendance.length >= quorumRequired;

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    const result = await addAttendance(meetingId, selectedIds, attendanceType);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Pridėta dalyvių: ${selectedIds.length}`);
      setSelectedIds([]);
      setShowAdd(false);
      router.refresh();
    }
    setLoading(false);
  };

  const handleRemove = async (memberId: string) => {
    const result = await removeAttendance(meetingId, memberId);
    if (result.error) toast.error(result.error);
    else router.refresh();
  };

  const canEdit = meetingStatus !== "baigtas" && meetingStatus !== "atšauktas";

  // Suskirstyti pagal tipą
  const byType = {
    fizinis: attendance.filter((a) => a.attendance_type === "fizinis"),
    nuotolinis: attendance.filter((a) => a.attendance_type === "nuotolinis"),
    rastu: attendance.filter((a) => a.attendance_type === "rastu"),
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Dalyviai ({attendance.length})
          </h2>
          {canEdit && (
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(!showAdd)}>
              <UserPlus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Kvorumo indikatorius */}
        <div className={`rounded-lg p-3 mb-4 text-sm ${
          hasQuorum
            ? "bg-green-50 text-green-800"
            : "bg-amber-50 text-amber-800"
        }`}>
          <div className="flex items-center gap-2">
            {hasQuorum ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            )}
            <span className="font-medium">
              {hasQuorum ? "Kvorumas yra" : "Kvorumo nėra"}
            </span>
          </div>
          <p className="text-xs mt-1 opacity-80">
            {attendance.length} iš {quorumRequired > 0 ? `${quorumRequired} reikalingų` : "∞ (pakartotinis)"}
          </p>
        </div>

        {/* Pridėjimo forma */}
        {showAdd && canEdit && (
          <div className="border border-gray-200 rounded-lg p-3 mb-4 space-y-3">
            <div>
              <select
                value={attendanceType}
                onChange={(e) => setAttendanceType(e.target.value)}
                className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="fizinis">Gyvai</option>
                <option value="nuotolinis">Nuotoliniu būdu</option>
                <option value="rastu">Balsavo raštu</option>
              </select>
            </div>
            <input
              type="text"
              placeholder="Ieškoti nario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-300 px-3 py-2"
            />
            <div className="max-h-48 overflow-y-auto space-y-1">
              {available.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm py-1 px-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(m.id)}
                    onChange={(e) =>
                      setSelectedIds(
                        e.target.checked
                          ? [...selectedIds, m.id]
                          : selectedIds.filter((id) => id !== m.id)
                      )
                    }
                    className="rounded border-gray-300"
                  />
                  {m.last_name} {m.first_name}
                </label>
              ))}
              {available.length === 0 && (
                <p className="text-xs text-gray-400 py-2">
                  {search ? "Nerasta" : "Visi nariai jau pridėti"}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                loading={loading}
                disabled={selectedIds.length === 0}
              >
                Pridėti ({selectedIds.length})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAdd(false); setSelectedIds([]); }}>
                Atšaukti
              </Button>
            </div>
          </div>
        )}

        {/* Dalyvių sąrašas */}
        {attendance.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">
            Dar nėra registruotų dalyvių
          </p>
        ) : (
          <div className="space-y-3">
            {Object.entries(byType).map(([type, members]) =>
              members.length > 0 ? (
                <div key={type}>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    {ATTENDANCE_TYPE_LABELS[type]} ({members.length})
                  </p>
                  <div className="space-y-0.5">
                    {members.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-50"
                      >
                        <span className="text-gray-700">
                          {a.member?.last_name} {a.member?.first_name}
                        </span>
                        {canEdit && (
                          <button
                            onClick={() => handleRemove(a.member_id)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
