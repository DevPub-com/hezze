import { LeaderboardSection } from "@/components/archive/LeaderboardSection";

export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  return (
    <div className="mx-auto max-w-[560px] px-[10px] py-[16px]">
      <LeaderboardSection />
    </div>
  );
}
