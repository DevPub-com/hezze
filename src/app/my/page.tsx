"use client";

import { useState } from "react";
import { useAppData } from "@/lib/app-context";
import { HetjeCard } from "@/components/hetje/HetjeCard";
import { cn } from "@/lib/utils";

export default function MyHetjePage() {
  const { archiveList, mySaved, searchQuery } = useAppData();
  const [activeFilter, setActiveFilter] = useState("전체");
  const query = searchQuery.toLowerCase().trim();
  const items = archiveList
    .filter((archive) => mySaved.has(archive.id))
    .filter((archive) =>
      !query ||
      (archive.coreClaim.quote + archive.speaker.name + archive.speaker.organization).toLowerCase().includes(query)
    );
  const visibleItems = items.filter((archive) => {
    if (activeFilter === "전체") return true;
    if (activeFilter === "발언") return archive.category === "ENTRY.QUOTE";
    return archive.category === "ENTRY.PROMISE";
  });

  return (
    <section className="mx-auto min-h-[calc(100dvh-140px)] max-w-[560px] bg-background">
      <div className="border-b border-border bg-card px-[18px] py-[12px]">
        <div className="flex items-center gap-[7px]" role="group" aria-label="내 헷제 유형 필터">
          {["전체", "발언", "공약"].map((filter) => (
            <button
              key={filter}
              type="button"
              data-page-filter={filter === "전체" ? "true" : undefined}
              aria-pressed={activeFilter === filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "min-h-[36px] rounded-[8px] border px-[13px] text-[11px] font-extrabold transition-colors",
                activeFilter === filter ? "border-brand-600 bg-brand-600 text-white" : "border-border bg-card text-muted-foreground"
              )}
            >
              {filter}
            </button>
          ))}
          <span className="ml-auto text-[10px] font-bold text-muted-foreground">{visibleItems.length}개</span>
        </div>
        <p className="mt-[9px] text-[10px] text-muted-foreground">다시 확인할 발언을 모아두는 개인 보관함입니다.</p>
      </div>

      <div className="px-[14px] py-[12px]">
        <div className="mb-[10px] flex items-center justify-between px-[2px]">
          <strong className="text-[12px] font-extrabold text-foreground">저장한 헷제</strong>
          <span className="text-[10px] font-medium text-muted-foreground">다시 볼 발언</span>
        </div>
        {visibleItems.length > 0 ? (
          <div className="grid grid-cols-1 gap-[10px]">
            {visibleItems.map((archive) => (
              <HetjeCard key={archive.id} archive={archive} />
            ))}
          </div>
        ) : (
          <div className="rounded-[14px] border border-dashed border-border bg-card px-[24px] py-[52px] text-center">
            <strong className="block text-[14px] font-extrabold text-foreground">저장한 헷제가 없습니다</strong>
            <p className="mt-[7px] text-[12px] leading-relaxed text-muted-foreground">
              보드의 북마크 버튼으로 나중에 다시 볼 발언을 저장하세요.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
