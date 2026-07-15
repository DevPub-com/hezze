"use server";

import { getSupabaseClient } from "@/lib/supabase";
import { ClaimRelation, RelationType } from "../model/archive.model";

interface DBRelation {
  id: string;
  target_archive_id: string;
  relation_type: string;
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

  const { data, error } = await getSupabaseClient()
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
    throw new Error(`관계 저장 실패: ${error?.message || "알 수 없는 오류"}`);
  }

  const row = data as DBRelation;
  return {
    id: row.id,
    targetArchiveId: row.target_archive_id,
    relationType: row.relation_type as RelationType,
  };
}

export async function deleteRelation(relationId: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("relations")
    .delete()
    .eq("id", relationId);

  if (error) {
    throw new Error(`관계 삭제 실패: ${error.message}`);
  }
}
