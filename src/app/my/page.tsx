"use client";

import { useAppData } from "@/lib/app-context";
import { HetjeCard } from "@/components/hetje/HetjeCard";

export default function MyHetjePage() {
  const { archiveList, mySaved, searchQuery } = useAppData();
  const query = searchQuery.toLowerCase().trim();
  const items = archiveList
    .filter((archive) => mySaved.has(archive.id))
    .filter((archive) =>
      !query ||
      (archive.coreClaim.quote + archive.speaker.name + archive.speaker.organization).toLowerCase().includes(query)
    );

  return (
    <section className="px-[16px] sm:px-[24px] py-[24px] max-w-[1180px] mx-auto">
      <div className="mb-[18px]">
        <h1 className="text-[clamp(28px,5vw,52px)] leading-[1.0] tracking-[-0.05em] font-black text-foreground">
          My HETJE<br />
          <em className="not-italic text-brand-600">내 생각의 위키.</em>
        </h1>
        <p className="text-muted-foreground text-[13px] leading-relaxed mt-[10px]">
          내가 기억하고 싶은 생각을 모읍니다.
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
          아직 저장한 HETJE가 없습니다. Board에서 <b>＋ My HETJE</b>를 눌러 담아보세요.
        </div>
      )}
    </section>
  );
}
