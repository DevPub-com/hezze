import { LeaderboardSection } from "@/components/archive/LeaderboardSection";

export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  return (
    <div className="mx-auto min-h-[calc(100dvh-140px)] max-w-[560px] bg-background">
      <LeaderboardSection />
    </div>
  );
}
