"use client";

import { ArchiveReference, REALITY_STATUS_LABEL, RealityStatus } from "@/domains/archive/model/archive.model";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Bookmark, Pin } from "lucide-react";
import { useAppData } from "@/lib/app-context";

function statusColor(status: RealityStatus) {
  switch (status) {
    case RealityStatus.REALIZING: return "bg-status-realizing text-white";
    case RealityStatus.FADING: return "bg-status-fading text-white";
    case RealityStatus.DEBATING: return "bg-status-debating text-white";
    case RealityStatus.DEFUNCT: return "bg-status-defunct text-white";
    case RealityStatus.REALIZED: return "bg-status-realized text-white";
    default: return "bg-muted text-muted-foreground";
  }
}

export function HetjeCard({ archive }: { archive: ArchiveReference }) {
  const { mySaved, tracked, toggleSaved, toggleTracked } = useAppData();
  const isSaved = mySaved.has(archive.id);
  const isTracked = tracked.has(archive.id);

  return (
    <div className="border-[1px] border-border bg-card rounded-[21px] p-[16px] flex flex-col gap-[10px]">
      <div className="flex items-center justify-between gap-[8px]">
        <Badge variant="outline" className="text-[10px] py-0 px-[8px] rounded-[999px]">
          {archive.speaker.name}
        </Badge>
        <Badge className={cn("text-[10px] py-[2px] px-[8px] rounded-[999px]", statusColor(archive.realityMeter.status))}>
          {REALITY_STATUS_LABEL[archive.realityMeter.status]}
        </Badge>
      </div>

      <h3 className="text-[15px] font-bold leading-[1.35] tracking-tight text-foreground line-clamp-3">
        &quot;{archive.coreClaim.quote}&quot;
      </h3>

      <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed">
        {archive.coreClaim.contextDescription}
      </p>

      <div className="flex items-center justify-between mt-[2px]">
        <span className="text-[11px] font-bold text-brand-600">
          팩트 지수 {archive.realityMeter.currentIndex}%
        </span>
        <div className="flex items-center gap-[6px]">
          <button
            type="button"
            onClick={() => toggleSaved(archive.id)}
            className={cn(
              "flex items-center gap-[4px] rounded-[999px] border-[1px] px-[8px] py-[4px] text-[10px] font-bold transition-colors",
              isSaved ? "bg-brand-50 text-brand-600 border-brand-100" : "bg-card text-muted-foreground border-border hover:bg-muted/40"
            )}
          >
            <Bookmark className="w-[11px] h-[11px]" />
            {isSaved ? "My HETJE" : "＋ My"}
          </button>
          <button
            type="button"
            onClick={() => toggleTracked(archive.id)}
            className={cn(
              "flex items-center gap-[4px] rounded-[999px] border-[1px] px-[8px] py-[4px] text-[10px] font-bold transition-colors",
              isTracked ? "bg-brand-50 text-brand-600 border-brand-100" : "bg-card text-muted-foreground border-border hover:bg-muted/40"
            )}
          >
            <Pin className="w-[11px] h-[11px]" />
            {isTracked ? "Tomorrow" : "📎 Tomorrow"}
          </button>
        </div>
      </div>
    </div>
  );
}
