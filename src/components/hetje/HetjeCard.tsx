"use client";

import Link from "next/link";
import { Bookmark, CheckCircle2, Clock3 } from "lucide-react";
import { ArchiveReference, RealityStatus } from "@/domains/archive/model/archive.model";
import { cn } from "@/lib/utils";
import { useAppData } from "@/lib/app-context";
import { formatArchivePostedAt } from "@/lib/format-archive-posted-at";

const STATUS_LABEL: Record<RealityStatus, string> = {
  [RealityStatus.REALIZING]: "진행 중",
  [RealityStatus.FADING]: "동력 약화",
  [RealityStatus.DEBATING]: "논쟁 중",
  [RealityStatus.DEFUNCT]: "중단",
  [RealityStatus.REALIZED]: "실현",
};

function statusColor(status: RealityStatus) {
  switch (status) {
    case RealityStatus.REALIZING:
      return "bg-emerald-50 text-emerald-700";
    case RealityStatus.FADING:
      return "bg-amber-50 text-amber-700";
    case RealityStatus.DEBATING:
      return "bg-blue-50 text-blue-700";
    case RealityStatus.DEFUNCT:
      return "bg-red-50 text-red-700";
    case RealityStatus.REALIZED:
      return "bg-emerald-50 text-emerald-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function HetjeCard({ archive }: { archive: ArchiveReference }) {
  const { mySaved, toggleSaved } = useAppData();
  const isSaved = mySaved.has(archive.id);

  return (
    <article className="group relative rounded-[14px] border border-border bg-card px-[15px] py-[14px] transition-colors hover:border-brand-200 focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100">
      <div className="flex items-start gap-[11px]">
        <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-full bg-brand-600 text-[12px] font-extrabold text-white">
          {archive.speaker.name.charAt(0)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-[6px]">
            <strong className="truncate text-[13px] font-extrabold text-foreground">
              {archive.speaker.name}
            </strong>
            <span className="inline-flex shrink-0 items-center gap-[3px] text-[10px] font-bold text-emerald-700">
              <CheckCircle2 className="h-[12px] w-[12px]" aria-hidden="true" />
              공식 출처 확인
            </span>
          </div>
          <p className="mt-[1px] truncate text-[10px] text-muted-foreground">
            {archive.evidence.sourceVenue} · {archive.speaker.organization}
          </p>
        </div>

        <button
          type="button"
          aria-label={isSaved ? "내 헷제에서 제거" : "내 헷제에 저장"}
          aria-pressed={isSaved}
          onClick={() => toggleSaved(archive.id)}
          className={cn(
            "relative z-[2] flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[10px] transition-colors",
            isSaved ? "bg-brand-50 text-brand-600" : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Bookmark className={cn("h-[18px] w-[18px]", isSaved && "fill-current")} />
        </button>
      </div>

      <h3 className="mt-[12px] text-[15px] font-extrabold leading-[1.42] tracking-[-0.02em] text-foreground">
        <Link
          href={`/?archive=${encodeURIComponent(archive.id)}`}
          aria-label={`${archive.coreClaim.quote} 상세 보기`}
          className="after:absolute after:inset-0 after:z-[1] after:rounded-[14px] focus-visible:outline-none group-hover:text-brand-700"
        >
          &quot;{archive.coreClaim.quote}&quot;
        </Link>
      </h3>

      <p className="mt-[7px] line-clamp-2 text-[12px] leading-[1.6] text-muted-foreground">
        {archive.coreClaim.contextDescription}
      </p>

      <div className="mt-[12px] flex items-center justify-between gap-[8px] border-t border-border/70 pt-[10px]">
        <div className="flex min-w-0 items-center gap-[4px] text-[10px] text-muted-foreground">
          <Clock3 className="h-[12px] w-[12px] shrink-0" aria-hidden="true" />
          <time className="truncate" dateTime={archive.evidence.recordedAt}>
            {formatArchivePostedAt(archive.evidence.recordedAt)}
          </time>
        </div>
        <div className="flex shrink-0 items-center gap-[6px]">
          {archive.newsCategory && (
            <span className="rounded-[5px] bg-muted px-[6px] py-[3px] text-[9px] font-semibold text-muted-foreground">
              {archive.newsCategory}
            </span>
          )}
          <span className={cn("rounded-[5px] px-[6px] py-[3px] text-[9px] font-bold", statusColor(archive.realityMeter.status))}>
            {STATUS_LABEL[archive.realityMeter.status]}
          </span>
        </div>
      </div>
    </article>
  );
}
