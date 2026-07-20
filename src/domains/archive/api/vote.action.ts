import { getSupabaseClient } from "@/lib/supabase";
import { RealityStatus } from "../model/archive.model";

async function getAuthenticatedVoteClient() {
  const client = getSupabaseClient();
  const { data: { session }, error } = await client.auth.getSession();

  if (error || !session) {
    throw new Error("투표하려면 먼저 로그인해 주세요.");
  }

  return { client, userId: session.user.id };
}

export async function updateVote(
  archiveId: string,
  status: RealityStatus,
  currentVotes: Record<RealityStatus, number>
): Promise<Record<RealityStatus, number>> {
  const { client, userId } = await getAuthenticatedVoteClient();
  const { data: existingVote, error: selectError } = await client
    .from("votes")
    .select("status")
    .eq("archive_id", archiveId)
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) {
    throw new Error(`기존 투표 조회 실패: ${selectError.message}`);
  }

  const oldStatus = existingVote?.status as RealityStatus | undefined;
  if (oldStatus === status) {
    return currentVotes;
  }

  const { error: saveError } = await client
    .from("votes")
    .upsert(
      { archive_id: archiveId, user_id: userId, status },
      { onConflict: "user_id,archive_id" }
    );

  if (saveError) {
    throw new Error(`투표 저장 실패: ${saveError.message}`);
  }

  const updatedVotes = { ...currentVotes };
  if (oldStatus) {
    updatedVotes[oldStatus] = Math.max(0, (updatedVotes[oldStatus] || 0) - 1);
  }
  updatedVotes[status] = (updatedVotes[status] || 0) + 1;
  return updatedVotes;
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
