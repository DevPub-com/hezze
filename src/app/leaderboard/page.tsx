import { LeaderboardSection } from "@/components/archive/LeaderboardSection";

export const dynamic = "force-dynamic";

export default function LeaderboardPage() {
  return (
    <div className="px-[16px] sm:px-[24px] py-[20px] max-w-[1180px] mx-auto">
      <LeaderboardSection />
    </div>
  );
}
