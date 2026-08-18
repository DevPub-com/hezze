"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Activity, ChevronRight } from "lucide-react";
import { useAppData } from "@/lib/app-context";
import { cn } from "@/lib/utils";

type TomorrowTab = "changed" | "watching";

export default function TomorrowPage() {
  const { archiveList, tracked, searchQuery } = useAppData();
  const [activeTab, setActiveTab] = useState<TomorrowTab>("changed");
  const query = searchQuery.toLowerCase().trim();
  const items = archiveList
    .filter((archive) => tracked.has(archive.id))
    .filter((archive) =>
      !query ||
      (archive.coreClaim.quote + archive.speaker.name + archive.speaker.organization).toLowerCase().includes(query)
    );

  const updates = useMemo(
    () =>
      items
        .flatMap((archive) =>
          archive.timeline.map((event, index) => ({ archive, event, index }))
        )
        .sort(
          (a, b) =>
            new Date(b.event.recordedAt).getTime() - new Date(a.event.recordedAt).getTime()
        ),
    [items]
  );

  const changedArchiveIds = new Set(
    items.filter((archive) => archive.timeline.length > 1).map((archive) => archive.id)
  );
  const visibleUpdates =
    activeTab === "changed"
      ? updates.filter(({ archive, index }) => changedArchiveIds.has(archive.id) && index > 0)
      : updates.filter(({ index }) => index === 0);

  return (
    <section className="mx-auto min-h-[calc(100dvh-140px)] max-w-[560px] bg-background">
      <div className="border-b border-border bg-card px-[18px] py-[12px]">
        <div className="grid grid-cols-2 rounded-[10px] bg-muted p-[3px]" role="tablist" aria-label="투모로우 상태 필터">
          <button
            type="button"
            data-page-filter="true"
            role="tab"
            aria-selected={activeTab === "changed"}
            onClick={() => setActiveTab("changed")}
            className={cn(
              "min-h-[42px] rounded-[8px] text-[12px] font-extrabold transition-colors",
              activeTab === "changed" ? "bg-card text-brand-600 shadow-sm" : "text-muted-foreground"
            )}
          >
            변화 있음 <span className="ml-[3px] text-[11px]">{changedArchiveIds.size}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "watching"}
            onClick={() => setActiveTab("watching")}
            className={cn(
              "min-h-[42px] rounded-[8px] text-[12px] font-extrabold transition-colors",
              activeTab === "watching" ? "bg-card text-brand-600 shadow-sm" : "text-muted-foreground"
            )}
          >
            관찰 중 <span className="ml-[3px] text-[11px]">{items.length}</span>
          </button>
        </div>
      </div>

      <div className="space-y-[16px] px-[18px] py-[16px]">
        <div className="flex items-center gap-[12px] rounded-[12px] border border-brand-100 bg-brand-50 px-[14px] py-[13px]">
          <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px] bg-card text-brand-600">
            <Activity className="h-[20px] w-[20px]" />
          </div>
          <div className="min-w-0 flex-1">
            <strong className="block text-[13px] font-extrabold text-brand-700">
              오늘 새 변화 {visibleUpdates.length}건
            </strong>
            <p className="mt-[2px] text-[10px] text-brand-700/70">발언 이후의 변화와 결과를 시간순으로 확인하세요.</p>
          </div>
          <ChevronRight className="h-[17px] w-[17px] text-brand-600" />
        </div>

        {items.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-border bg-card px-[24px] py-[52px] text-center">
            <strong className="block text-[14px] font-extrabold text-foreground">아직 추적 중인 헷제가 없습니다</strong>
            <p className="mt-[7px] text-[12px] leading-relaxed text-muted-foreground">
              보드에서 중요한 발언을 선택하고 Tomorrow에 추가해 변화와 결과를 확인하세요.
            </p>
          </div>
        ) : visibleUpdates.length === 0 ? (
          <div className="rounded-[14px] border border-border bg-card px-[20px] py-[36px] text-center text-[12px] text-muted-foreground">
            선택한 조건에 해당하는 변화가 없습니다.
          </div>
        ) : (
          <div className="relative pl-[18px]">
            <div className="absolute bottom-[10px] left-[5px] top-[9px] w-px bg-border" aria-hidden="true" />
            <div className="space-y-[10px]">
              {visibleUpdates.map(({ archive, event, index }) => (
                <article key={`${archive.id}-${event.id}`} className="relative rounded-[12px] border border-border bg-card px-[14px] py-[13px]">
                  <span
                    className={cn(
                      "absolute left-[-18px] top-[18px] h-[11px] w-[11px] rounded-full border-[2px] border-background",
                      index === 0 ? "bg-emerald-500" : index === archive.timeline.length - 1 ? "bg-brand-600" : "bg-amber-500"
                    )}
                    aria-hidden="true"
                  />
                  <div className="flex items-center justify-between gap-[10px] text-[10px]">
                    <time className="font-semibold text-muted-foreground" dateTime={event.recordedAt}>
                      {new Date(event.recordedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </time>
                    <span className={cn("rounded-[5px] px-[6px] py-[3px] font-bold", index === 0 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                      {index === 0 ? "최초 발언" : "새 변화"}
                    </span>
                  </div>
                  <p className="mt-[9px] text-[11px] font-bold text-muted-foreground">{archive.speaker.name}</p>
                  <h3 className="mt-[2px] text-[13px] font-extrabold leading-[1.45] text-foreground">{event.title || archive.coreClaim.quote}</h3>
                  <p className="mt-[6px] line-clamp-2 text-[11px] leading-[1.55] text-muted-foreground">{event.summary}</p>
                  <Link href={`/?archive=${encodeURIComponent(archive.id)}`} className="relative mt-[10px] flex min-h-[44px] items-center justify-between border-t border-border/70 pt-[9px] text-[11px] font-bold text-brand-600">
                    원래 발언에서 전체 흐름 보기
                    <ChevronRight className="h-[15px] w-[15px]" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
