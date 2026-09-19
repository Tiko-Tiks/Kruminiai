type FeeClient = { rpc: (name: string, args: { p_member_ids: string[] | null }) => PromiseLike<{ data: unknown; error: unknown }> };
export async function fetchFeeEligibility(client: FeeClient, memberIds: string[] | null = null) {
  const { data, error } = await client.rpc("bylaws_fee_eligibility", { p_member_ids: memberIds });
  if (error || !Array.isArray(data)) throw new Error("Nepavyko patikrinti mokesčių narystės laikotarpių.");
  return new Map<string, Set<string>>(data.map(row => [row.member_id, new Set<string>(row.fee_period_ids)]));
}
