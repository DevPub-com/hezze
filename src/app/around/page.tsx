"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppData } from "@/lib/app-context";
import { ClaimRelation, RelationType, RELATION_TYPE_LABEL, ArchiveReference } from "@/domains/archive/model/archive.model";
import { fetchRelationsForArchive, createRelation, deleteRelation } from "@/domains/archive/api/relation.action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Plus, X } from "lucide-react";

const COLUMN_ORDER: RelationType[] = [RelationType.SUPPORTS, RelationType.CONTRADICTS, RelationType.DERIVED];

const COLUMN_TONE: Record<RelationType, string> = {
  [RelationType.SUPPORTS]: "text-status-realizing",
  [RelationType.CONTRADICTS]: "text-status-defunct",
  [RelationType.DERIVED]: "text-status-debating",
};

export default function AroundPage() {
  const { archiveList, user, openAuth } = useAppData();

  const [focusId, setFocusId] = useState<string | null>(null);
  const [relations, setRelations] = useState<ClaimRelation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [targetId, setTargetId] = useState("");
  const [relationType, setRelationType] = useState<RelationType>(RelationType.SUPPORTS);
  const [isSaving, setIsSaving] = useState(false);

  const effectiveFocusId = focusId ?? archiveList[0]?.id ?? null;
  const focus = archiveList.find((a) => a.id === effectiveFocusId);

  const loadRelations = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const rows = await fetchRelationsForArchive(id);
      setRelations(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "관계를 불러오지 못했습니다.");
      setRelations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!effectiveFocusId) {
        if (!cancelled) setRelations([]);
        return;
      }
      await loadRelations(effectiveFocusId);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [effectiveFocusId, loadRelations]);

  const archiveById = (id: string): ArchiveReference | undefined => archiveList.find((a) => a.id === id);

  const grouped = (type: RelationType) =>
    relations
      .filter((rel) => rel.relationType === type)
      .map((rel) => ({ rel, archive: archiveById(rel.targetArchiveId) }))
      .filter((item): item is { rel: ClaimRelation; archive: ArchiveReference } => Boolean(item.archive));

  const handleConnect = async () => {
    if (!effectiveFocusId || !targetId) return;
    if (!user) {
      openAuth();
      return;
    }
    try {
      setIsSaving(true);
      setError(null);
      await createRelation(effectiveFocusId, targetId, relationType);
      setTargetId("");
      await loadRelations(effectiveFocusId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "연결에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async (relationId: string) => {
    if (!effectiveFocusId) return;
    if (!user) {
      openAuth();
      return;
    }
    try {
      setError(null);
      await deleteRelation(relationId);
      await loadRelations(effectiveFocusId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "연결 해제에 실패했습니다.");
    }
  };

  const connectableArchives = archiveList.filter(
    (a) => a.id !== effectiveFocusId && !relations.some((rel) => rel.targetArchiveId === a.id && rel.relationType === relationType)
  );

  return (
    <section className="mx-auto max-w-[560px] px-[16px] py-[16px]">
      {error && (
        <div role="alert" className="mb-[10px] rounded-[12px] border border-red-200 bg-red-50 px-[12px] py-[10px] text-[11px] leading-relaxed text-red-600">
          {error}
        </div>
      )}

      {focus ? (
        <>
          <div className="mb-[10px] rounded-[16px] border border-brand-100 bg-brand-50/40 p-[14px]">
            <label htmlFor="focus-archive" className="mb-[7px] block text-[11px] font-bold text-brand-600">기준 HETJE</label>
            <select
              id="focus-archive"
              value={effectiveFocusId ?? ""}
              onChange={(e) => setFocusId(e.target.value)}
              className="h-[42px] w-full truncate rounded-[10px] border border-input bg-background px-[11px] text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {archiveList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.speaker.name} · {a.coreClaim.quote}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-[12px] rounded-[16px] border border-border bg-card p-[14px]">
            <div className="mb-[9px] flex items-center gap-[6px] text-foreground">
              <Plus className="w-[14px] h-[14px] text-brand-600" />
              <b className="text-[13px]">다른 HETJE와 연결</b>
            </div>
            <div className="flex flex-col gap-[7px]">
              <label htmlFor="target-archive" className="sr-only">연결할 HETJE</label>
              <select
                id="target-archive"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="h-[40px] w-full truncate rounded-[10px] border border-input bg-background px-[11px] text-[12px] focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">연결할 HETJE 선택...</option>
                {connectableArchives.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.coreClaim.quote}
                  </option>
                ))}
              </select>
              <label htmlFor="relation-type" className="sr-only">관계 방향</label>
              <select
                id="relation-type"
                value={relationType}
                onChange={(e) => setRelationType(e.target.value as RelationType)}
                className="h-[40px] w-full rounded-[10px] border border-input bg-background px-[11px] text-[12px] focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {COLUMN_ORDER.map((type) => (
                  <option key={type} value={type}>
                    {RELATION_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleConnect}
                disabled={isSaving || !targetId}
                className="h-[40px] rounded-[10px] bg-brand-600 text-[12px] font-bold hover:bg-brand-700"
              >
                {isSaving ? <Loader2 className="w-[14px] h-[14px] animate-spin" /> : "연결"}
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="py-[40px] text-center text-muted-foreground text-[13px]">
              <Loader2 className="w-[18px] h-[18px] animate-spin inline-block" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-[9px]">
              {COLUMN_ORDER.map((type) => {
                const items = grouped(type);
                return (
                  <div key={type} className="rounded-[16px] border border-border bg-card p-[14px]">
                    <h3 className={cn("mb-[7px] text-[13px] font-bold", COLUMN_TONE[type])}>
                      {RELATION_TYPE_LABEL[type]} {items.length}
                    </h3>
                    {items.length > 0 ? (
                      items.map(({ rel, archive }) => (
                        <div key={rel.id} className="border-b border-border/60 py-[9px] last:border-0">
                          <div className="flex items-start justify-between gap-[8px]">
                            <b className="block text-[13px] text-foreground line-clamp-2 leading-snug">
                              {archive.coreClaim.quote}
                            </b>
                            <button
                              type="button"
                              onClick={() => handleDisconnect(rel.id)}
                              className="shrink-0 text-muted-foreground hover:text-red-500"
                              aria-label="연결 해제"
                            >
                              <X className="w-[13px] h-[13px]" />
                            </button>
                          </div>
                          <Badge variant="outline" className="mt-[6px] text-[9px] py-0 px-[6px] rounded-[999px]">
                            {archive.speaker.name}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-muted-foreground/70 italic leading-relaxed">
                        아직 연결된 HETJE가 없습니다.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="py-[60px] text-center text-muted-foreground text-[13px]">
          표시할 HETJE가 없습니다.
        </div>
      )}
    </section>
  );
}
