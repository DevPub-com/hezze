"use client";

import { useAppData } from "@/lib/app-context";
import { HetjeCard } from "@/components/hetje/HetjeCard";

export default function TomorrowPage() {
  const { archiveList, tracked, searchQuery } = useAppData();
  const query = searchQuery.toLowerCase().trim();
  const items = archiveList
    .filter((archive) => tracked.has(archive.id))
    .filter((archive) =>
      !query ||
      (archive.coreClaim.quote + archive.speaker.name + archive.speaker.organization).toLowerCase().includes(query)
    );

  return (
    <section className="px-[16px] sm:px-[24px] py-[24px] max-w-[1180px] mx-auto">
      <div className="mb-[18px]">
        <h1 className="text-[clamp(28px,5vw,52px)] leading-[1.0] tracking-[-0.05em] font-black text-foreground">
          My Tomorrow<br />
          <em className="not-italic text-brand-600">시간이 다시 부른다.</em>
        </h1>
        <p className="text-muted-foreground text-[13px] leading-relaxed mt-[10px]">
          의미 있게 움직인 미래만 돌아옵니다.
        </p>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[12px]">
          {items.map((archive) => (
            <HetjeCard key={archive.id} archive={archive} />
          ))}
        </div>
      ) : (
        <div className="py-[60px] text-center text-muted-foreground text-[13px]">
          아직 추적 중인 HETJE가 없습니다. Board에서 <b>📎 Tomorrow</b>를 눌러 추적을 시작하세요.
        </div>
      )}
    </section>
  );
}
