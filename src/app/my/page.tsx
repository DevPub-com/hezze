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
    <section className="mx-auto max-w-[560px] px-[16px] py-[14px]">
      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-[12px]">
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
