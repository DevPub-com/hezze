import { getSupabaseClient } from "@/lib/supabase";
import { RealityStatus } from "../model/archive.model";

const EMPTY_VOTE_SUMMARY: Record<RealityStatus, number> = {
  [RealityStatus.REALIZING]: 0,
  [RealityStatus.FADING]: 0,
  [RealityStatus.DEBATING]: 0,
  [RealityStatus.DEFUNCT]: 0,
  [RealityStatus.REALIZED]: 0,
};

async function getAuthenticatedVoteClient() {
  const client = getSupabaseClient();
  const { data: { session }, error } = await client.auth.getSession();

  if (error || !session) {
    throw new Error("투표하려면 먼저 로그인해 주세요.");
  }

  return { client, userId: session.user.id };
}

async function fetchVoteSummaryWithClient(
  client: ReturnType<typeof getSupabaseClient>,
  archiveId: string
): Promise<Record<RealityStatus, number>> {
  const { data, error } = await client
    .from("votes")
    .select("status")
    .eq("archive_id", archiveId);

  if (error) {
    throw new Error(`투표 집계 조회 실패: ${error.message}`);
  }

  const summary = { ...EMPTY_VOTE_SUMMARY };
  for (const row of data || []) {
    const status = row.status as RealityStatus;
    if (Object.prototype.hasOwnProperty.call(summary, status)) {
      summary[status] += 1;
    }
  }
  return summary;
}

export async function fetchVoteSummary(archiveId: string): Promise<Record<RealityStatus, number>> {
  const { client } = await getAuthenticatedVoteClient();
  return fetchVoteSummaryWithClient(client, archiveId);
}

export async function updateVote(
  archiveId: string,
  status: RealityStatus
): Promise<Record<RealityStatus, number>> {
  const { client, userId } = await getAuthenticatedVoteClient();
  const { error: saveError } = await client
    .from("votes")
    .upsert(
      { archive_id: archiveId, user_id: userId, status },
      { onConflict: "user_id,archive_id" }
    );

  if (saveError) {
    throw new Error(`투표 저장 실패: ${saveError.message}`);
  }

  return fetchVoteSummaryWithClient(client, archiveId);
}

export async function fetchUserVote(archiveId: string): Promise<RealityStatus | null> {
  const { client, userId } = await getAuthenticatedVoteClient();
  const { data, error } = await client
    .from("votes")
    .select("status")
    .eq("archive_id", archiveId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`투표 조회 실패: ${error.message}`);
  }

  return data ? (data.status as RealityStatus) : null;
}
