import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Audito įrašas.
 *
 * Nuo migr. 048 `audit_log` INSERT politika reikalauja administratoriaus –
 * eilinio nario srautai į šią lentelę nerašo, o sisteminius įrašus (pvz.
 * narystės statuso trigger'is) daro SECURITY DEFINER funkcijos, kurioms RLS
 * negalioja.
 *
 * Klaida čia NEnutraukia mutacijos (ji jau įvykdyta), bet ir NEnutylima:
 * tylus audito praradimas yra blogesnis už triukšmą žurnale.
 */
export async function logAudit(
  supabase: SupabaseClient,
  params: {
    userId: string | null;
    action: "CREATE" | "UPDATE" | "DELETE";
    tableName: string;
    recordId: string;
    oldData?: Record<string, unknown> | null;
    newData?: Record<string, unknown> | null;
  }
): Promise<void> {
  const { error } = await supabase.from("audit_log").insert({
    user_id: params.userId,
    action: params.action,
    table_name: params.tableName,
    record_id: params.recordId,
    old_data: params.oldData ?? null,
    new_data: params.newData ?? null,
  });

  if (error) {
    console.error(
      `[audit_log] Neįrašyta: ${params.action} ${params.tableName}/${params.recordId} – ${error.message}`
    );
  }
}
