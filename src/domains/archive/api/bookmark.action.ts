import { getSupabaseClient } from "@/lib/supabase";

export type BookmarkKind = "saved" | "tracked";

interface DBBookmark {
  archive_id: string;
  kind: string;
}

async function getAuthenticatedBookmarkClient() {
  const client = getSupabaseClient();
  const { data: { session }, error } = await client.auth.getSession();

  if (error || !session) {
    throw new Error("My HETJE를 저장하려면 먼저 로그인해 주세요.");
  }

  return { client, userId: session.user.id };
}

export async function fetchUserBookmarks(): Promise<{ saved: string[]; tracked: string[] }> {
  const { client, userId } = await getAuthenticatedBookmarkClient();
  const { data, error } = await client
    .from("bookmarks")
    .select("archive_id, kind")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`북마크 조회 실패: ${error.message}`);
  }

  const saved: string[] = [];
  const tracked: string[] = [];

  for (const row of (data || []) as DBBookmark[]) {
    if (row.kind === "saved") {
      saved.push(row.archive_id);
    } else if (row.kind === "tracked") {
      tracked.push(row.archive_id);
    }
  }

  return { saved, tracked };
}

export async function setBookmark(
  archiveId: string,
  kind: BookmarkKind,
  active: boolean
): Promise<void> {
  const { client, userId } = await getAuthenticatedBookmarkClient();

  if (active) {
    const { error } = await client
      .from("bookmarks")
      .upsert(
        { user_id: userId, archive_id: archiveId, kind },
        { onConflict: "user_id,archive_id,kind" }
      );

    if (error) {
      throw new Error(`북마크 저장 실패: ${error.message}`);
    }
  } else {
    const { error } = await client
      .from("bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("archive_id", archiveId)
      .eq("kind", kind);

    if (error) {
      throw new Error(`북마크 삭제 실패: ${error.message}`);
    }
  }
}
