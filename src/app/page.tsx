import { BoardView } from "@/components/board/BoardView";

export const dynamic = "force-dynamic";

interface BoardPageProps {
  searchParams: Promise<{ archive?: string | string[] }>;
}

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const { archive } = await searchParams;
  const initialArchiveId = typeof archive === "string" ? archive : null;

  return <BoardView initialArchiveId={initialArchiveId} />;
}
