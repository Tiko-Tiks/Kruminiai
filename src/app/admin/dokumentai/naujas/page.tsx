import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NewDocumentForm } from "./NewDocumentForm";

export const dynamic = "force-dynamic";

export default async function NewDocumentPage() {
  const supabase = createServerSupabaseClient();

  // Susirinkimai dropdown'ui – tik tie, kurie aktyvūs ar pasibaigę
  // (atšauktiems dokumentų nereikia priskirti).
  const { data: meetings } = await supabase
    .from("meetings")
    .select("id, title, meeting_date")
    .in("status", ["planuojamas", "registracija", "vyksta", "baigtas"])
    .order("meeting_date", { ascending: false })
    .limit(50);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Įkelti dokumentą</h1>
        <p className="text-sm text-gray-500 mt-1">Įkelkite naują dokumentą į archyvą</p>
      </div>
      <NewDocumentForm meetings={meetings || []} />
    </div>
  );
}
