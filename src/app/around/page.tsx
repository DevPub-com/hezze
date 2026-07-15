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
  const { archiveList } = useAppData();

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
    <section className="px-[16px] sm:px-[24px] py-[24px] max-w-[1180px] mx-auto">
      <div className="mb-[18px]">
        <h1 className="text-[clamp(28px,5vw,52px)] leading-[1.0] tracking-[-0.05em] font-black text-foreground">
          이 HETJE 주변<br />
          <em className="not-italic text-brand-600">생각의 지형.</em>
        </h1>
        <p className="text-muted-foreground text-[13px] leading-relaxed mt-[10px]">
          같은 방향·반대 방향·파생 아젠다를 봅니다.
        </p>
      </div>

      {error && (
        <div className="mb-[14px] p-[12px] bg-red-50 text-red-600 rounded-[8px] border-[1px] border-red-200 text-[12px]">
          {error}
        </div>
      )}

      {focus ? (
        <>
          <div className="border-[1px] border-brand-100 bg-brand-50/40 rounded-[21px] p-[18px] mb-[14px]">
            <label className="text-[11px] font-bold text-brand-600 block mb-[8px]">기준 HETJE</label>
            <select
              value={effectiveFocusId ?? ""}
              onChange={(e) => setFocusId(e.target.value)}
              className="w-full border-[1px] border-input rounded-[10px] px-[12px] py-[10px] bg-background text-[14px] font-semibold focus:outline-none focus:ring-[2px] focus:ring-ring"
            >
              {archiveList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.speaker.name} · {a.coreClaim.quote}
                </option>
              ))}
            </select>
          </div>

          <div className="border-[1px] border-border bg-card rounded-[16px] p-[14px] mb-[16px]">
            <div className="flex items-center gap-[6px] text-foreground mb-[10px]">
              <Plus className="w-[14px] h-[14px] text-brand-600" />
              <b className="text-[13px]">다른 HETJE와 연결</b>
            </div>
            <div className="flex flex-col sm:flex-row gap-[8px]">
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="flex-1 border-[1px] border-input rounded-[10px] px-[12px] h-[40px] bg-background text-[13px] focus:outline-none focus:ring-[2px] focus:ring-ring"
              >
                <option value="">연결할 HETJE 선택...</option>
                {connectableArchives.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.coreClaim.quote}
                  </option>
                ))}
              </select>
              <select
                value={relationType}
                onChange={(e) => setRelationType(e.target.value as RelationType)}
                className="sm:w-[160px] border-[1px] border-input rounded-[10px] px-[12px] h-[40px] bg-background text-[13px] focus:outline-none focus:ring-[2px] focus:ring-ring"
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
                className="h-[40px] rounded-[10px] text-[13px] bg-brand-600 hover:bg-brand-700"
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-[12px]">
              {COLUMN_ORDER.map((type) => {
                const items = grouped(type);
                return (
                  <div key={type} className="border-[1px] border-border bg-card rounded-[21px] p-[16px]">
                    <h3 className={cn("text-[14px] font-bold mb-[10px]", COLUMN_TONE[type])}>
                      {RELATION_TYPE_LABEL[type]} {items.length}
                    </h3>
                    {items.length > 0 ? (
                      items.map(({ rel, archive }) => (
                        <div key={rel.id} className="py-[11px] border-b-[1px] border-border/60 last:border-0">
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
                      <p className="text-[11px] text-muted-foreground/70 italic">
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
