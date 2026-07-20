import { getSupabaseClient } from "@/lib/supabase";
import { ClaimRelation, RelationType } from "../model/archive.model";

interface DBRelation {
  id: string;
  target_archive_id: string;
  relation_type: string;
}

async function getAuthenticatedClient() {
  const client = getSupabaseClient();
  const { data: { session }, error } = await client.auth.getSession();

  if (error || !session) {
    throw new Error("HETJE를 연결하려면 먼저 로그인해 주세요.");
  }

  return client;
}

function relationMutationError(action: "저장" | "삭제", message?: string) {
  if (message?.toLowerCase().includes("row-level security")) {
    return new Error(`관계 저장 설정이 완료되지 않았습니다. Supabase 정책을 적용해 주세요. (${action})`);
  }

  return new Error(`관계 ${action} 실패: ${message || "알 수 없는 오류"}`);
}

export async function fetchRelationsForArchive(archiveId: string): Promise<ClaimRelation[]> {
  const { data, error } = await getSupabaseClient()
    .from("relations")
    .select("id, target_archive_id, relation_type")
    .eq("source_archive_id", archiveId);

  if (error) {
    throw new Error(`관계 조회 실패: ${error.message}`);
  }

  return ((data || []) as DBRelation[]).map((row) => ({
    id: row.id,
    targetArchiveId: row.target_archive_id,
    relationType: row.relation_type as RelationType,
  }));
}

export async function createRelation(
  sourceArchiveId: string,
  targetArchiveId: string,
  relationType: RelationType
): Promise<ClaimRelation> {
  if (sourceArchiveId === targetArchiveId) {
    throw new Error("같은 HETJE끼리는 연결할 수 없습니다.");
  }

  const client = await getAuthenticatedClient();
  const { data, error } = await client
    .from("relations")
    .upsert(
      {
        source_archive_id: sourceArchiveId,
        target_archive_id: targetArchiveId,
        relation_type: relationType,
      },
      { onConflict: "source_archive_id,target_archive_id,relation_type" }
    )
    .select("id, target_archive_id, relation_type")
    .single();

  if (error || !data) {
    throw relationMutationError("저장", error?.message);
  }

  const row = data as DBRelation;
  return {
    id: row.id,
    targetArchiveId: row.target_archive_id,
    relationType: row.relation_type as RelationType,
  };
}

export async function deleteRelation(relationId: string): Promise<void> {
  const client = await getAuthenticatedClient();
  const { error } = await client
    .from("relations")
    .delete()
    .eq("id", relationId);

  if (error) {
    throw relationMutationError("삭제", error.message);
  }
}
