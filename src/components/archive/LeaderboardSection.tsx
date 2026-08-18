"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Target, Trophy } from "lucide-react";
import { fetchSpeakerLeaderboard, fetchUserLeaderboard } from "@/domains/archive/api/analyze.action";
import { SpeakerRankItem, UserRankItem } from "@/domains/archive/model/archive.model";
import { cn } from "@/lib/utils";

type RankingTab = "speaker" | "user";

function RankNumber({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-[9px] text-[12px] font-black tabular-nums",
        rank === 1
          ? "bg-brand-600 text-white"
          : rank <= 3
            ? "bg-brand-50 text-brand-700"
            : "bg-muted text-muted-foreground"
      )}
      aria-label={`${rank}위`}
    >
      {rank}
    </span>
  );
}

export function LeaderboardSection() {
  const [activeTab, setActiveTab] = useState<RankingTab>("speaker");
  const [speakerList, setSpeakerList] = useState<SpeakerRankItem[]>([]);
  const [userList, setUserList] = useState<UserRankItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadLeaderboardData() {
      try {
        const [speakers, users] = await Promise.all([
          fetchSpeakerLeaderboard(),
          fetchUserLeaderboard(),
        ]);
        if (!cancelled) {
          setSpeakerList(speakers);
          setUserList(users);
        }
      } catch (error: unknown) {
        console.error("리더보드 로드 실패:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadLeaderboardData();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = activeTab === "speaker" ? speakerList.length : userList.length;

  return (
    <section>
      <div className="border-b border-border bg-card px-[18px] pb-[14px] pt-[12px]">
        <div className="flex items-end justify-between gap-[12px]">
          <div>
            <h1 className="text-[16px] font-black tracking-[-0.03em] text-foreground">이번 주 신뢰도 랭킹</h1>
            <p className="mt-[3px] text-[10px] leading-[1.5] text-muted-foreground">
              확인된 결과와 예측 적중 기록을 기준으로 집계합니다.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-[4px] rounded-full bg-emerald-50 px-[8px] py-[5px] text-[9px] font-extrabold text-emerald-700">
            <CheckCircle2 className="h-[12px] w-[12px]" />
            실시간 집계
          </span>
        </div>

        <div className="mt-[14px] grid grid-cols-2 rounded-[10px] bg-muted p-[3px]" role="tablist" aria-label="랭킹 유형">
          <button
            type="button"
            data-page-filter="true"
            role="tab"
            aria-selected={activeTab === "speaker"}
            onClick={() => setActiveTab("speaker")}
            className={cn(
              "flex min-h-[42px] items-center justify-center gap-[6px] rounded-[8px] text-[11px] font-extrabold transition-colors",
              activeTab === "speaker" ? "bg-card text-brand-600 shadow-sm" : "text-muted-foreground"
            )}
          >
            <Trophy className="h-[15px] w-[15px]" />
            인물 랭킹
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "user"}
            onClick={() => setActiveTab("user")}
            className={cn(
              "flex min-h-[42px] items-center justify-center gap-[6px] rounded-[8px] text-[11px] font-extrabold transition-colors",
              activeTab === "user" ? "bg-card text-brand-600 shadow-sm" : "text-muted-foreground"
            )}
          >
            <Target className="h-[15px] w-[15px]" />
            예측 랭킹
          </button>
        </div>
      </div>

      <div className="px-[14px] py-[12px]">
        <div className="mb-[9px] flex items-center justify-between px-[2px]">
          <strong className="text-[12px] font-extrabold text-foreground">전체 순위</strong>
          <span className="text-[10px] font-bold text-muted-foreground">{activeCount}명</span>
        </div>

        {isLoading ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-[10px] rounded-[12px] border border-border bg-card text-muted-foreground">
            <Loader2 className="h-[24px] w-[24px] animate-spin text-brand-600" />
            <p className="text-[11px] font-semibold">랭킹을 집계하고 있습니다</p>
          </div>
        ) : activeCount === 0 ? (
          <div className="rounded-[12px] border border-dashed border-border bg-card px-[24px] py-[52px] text-center">
            <strong className="block text-[14px] font-extrabold text-foreground">아직 집계된 기록이 없습니다</strong>
            <p className="mt-[7px] text-[11px] leading-[1.6] text-muted-foreground">
              발언의 결과가 확인되거나 예측 투표가 쌓이면 순위가 표시됩니다.
            </p>
          </div>
        ) : activeTab === "speaker" ? (
          <ol className="overflow-hidden rounded-[12px] border border-border bg-card">
            {speakerList.map((item, index) => (
              <li
                key={`${item.speakerName}-${item.organization}`}
                className="flex min-w-0 items-center gap-[11px] border-b border-border/80 px-[12px] py-[13px] last:border-b-0"
              >
                <RankNumber rank={index + 1} />
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-black text-white">
                  {item.speakerName.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-[6px]">
                    <strong className="truncate text-[12px] font-extrabold text-foreground">{item.speakerName}</strong>
                    <span className="truncate rounded-[5px] bg-muted px-[5px] py-[2px] text-[9px] font-semibold text-muted-foreground">
                      {item.organization}
                    </span>
                  </span>
                  <span className="mt-[3px] block truncate text-[10px] text-muted-foreground">
                    발언 {item.totalClaims}건 · 실현 {item.realizedClaims}건 · 진행 {item.realizingClaims}건
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[9px] font-semibold text-muted-foreground">신뢰도</span>
                  <strong className="block text-[17px] font-black tracking-[-0.03em] text-brand-600 tabular-nums">
                    {item.factBattingAverage}%
                  </strong>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="overflow-hidden rounded-[12px] border border-border bg-card">
            {userList.map((item, index) => (
              <li
                key={item.userId}
                className="flex min-w-0 items-center gap-[11px] border-b border-border/80 px-[12px] py-[13px] last:border-b-0"
              >
                <RankNumber rank={index + 1} />
                <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-black text-white">
                  {item.userEmailMasked.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-[6px]">
                    <strong className="truncate text-[12px] font-extrabold text-foreground">{item.userEmailMasked}</strong>
                    <span className="truncate rounded-[5px] bg-brand-50 px-[5px] py-[2px] text-[9px] font-bold text-brand-700">
                      {item.badgeTitle}
                    </span>
                  </span>
                  <span className="mt-[3px] block truncate text-[10px] text-muted-foreground">
                    투표 {item.totalVotes}회 · 적중 {item.correctVotes}회
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[9px] font-semibold text-muted-foreground">적중률</span>
                  <strong className="block text-[17px] font-black tracking-[-0.03em] text-brand-600 tabular-nums">
                    {item.accuracyRate}%
                  </strong>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
