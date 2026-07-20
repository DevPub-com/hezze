"use client";

import { useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckInterval, RealityStatus, REALITY_STATUS_LABEL, ArchiveReference } from "@/domains/archive/model/archive.model";
import {
  analyzeNewsUrlPreview,
  createArchiveFromNewsPreview,
  NewsAnalysisPreview,
} from "@/domains/archive/api/analyze.action";
import { updateVote } from "@/domains/archive/api/vote.action";
import { useAppData } from "@/lib/app-context";

type Step = "source" | "agenda" | "route" | "position" | "done";
type RouteChoice = "my" | "tomorrow" | "both" | "skip";

function defaultExpiry(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().split("T")[0];
}

export function RegisterModal() {
  const { isCreating, setIsCreating, user, addArchive, markSaved, markTracked, setArchiveList, openAuth } = useAppData();

  const [step, setStep] = useState<Step>("source");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inputUrl, setInputUrl] = useState("");
  const [analysisPreview, setAnalysisPreview] = useState<NewsAnalysisPreview | null>(null);
  const [userAgenda, setUserAgenda] = useState("");

  const [checkInterval, setCheckInterval] = useState<CheckInterval>(CheckInterval.WEEKLY);
  const [expiryDate, setExpiryDate] = useState(defaultExpiry);
  const [targetDates, setTargetDates] = useState<string[]>([]);
  const [newTargetDate, setNewTargetDate] = useState("");

  const [routeChoice, setRouteChoice] = useState<RouteChoice>("skip");
  const [position, setPosition] = useState<RealityStatus | null>(null);
  const [createdArchive, setCreatedArchive] = useState<ArchiveReference | null>(null);

  if (!isCreating) return null;

  const reset = () => {
    setStep("source");
    setIsBusy(false);
    setError(null);
    setInputUrl("");
    setAnalysisPreview(null);
    setUserAgenda("");
    setCheckInterval(CheckInterval.WEEKLY);
    setExpiryDate(defaultExpiry());
    setTargetDates([]);
    setNewTargetDate("");
    setRouteChoice("skip");
    setPosition(null);
    setCreatedArchive(null);
  };

  const close = () => {
    setIsCreating(false);
    reset();
  };

  const addTargetDate = () => {
    if (!newTargetDate) return;
    if (!targetDates.includes(newTargetDate)) {
      setTargetDates([...targetDates, newTargetDate]);
    }
    setNewTargetDate("");
  };

  const handleAnalyzeSource = async () => {
    if (!inputUrl.trim()) return;
    try {
      setIsBusy(true);
      setError(null);
      const preview = await analyzeNewsUrlPreview(inputUrl);
      setAnalysisPreview(preview);
      setStep("agenda");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "링크 분석 중 오류가 발생했습니다.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateArchive = async () => {
    if (!analysisPreview || !userAgenda.trim()) return;
    try {
      setIsBusy(true);
      setError(null);
      const authorName = user?.email?.split("@")[0] ?? "나";
      const archive = await createArchiveFromNewsPreview(
        analysisPreview,
        userAgenda,
        checkInterval,
        expiryDate,
        targetDates,
        authorName
      );
      addArchive(archive);
      setCreatedArchive(archive);
      setStep("route");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "HETJE 등록 중 오류가 발생했습니다.");
    } finally {
      setIsBusy(false);
    }
  };

  const applyRoute = () => {
    if (!createdArchive) return;
    if (routeChoice === "my" || routeChoice === "both") markSaved(createdArchive.id);
    if (routeChoice === "tomorrow" || routeChoice === "both") markTracked(createdArchive.id);
    setStep("position");
  };

  const applyPosition = async (status: RealityStatus | null) => {
    setPosition(status);
    if (status && createdArchive && user) {
      try {
        const updatedVotes = await updateVote(createdArchive.id, status, createdArchive.userVotes);
        setArchiveList((prev) =>
          prev.map((a) => (a.id === createdArchive.id ? { ...a, userVotes: updatedVotes } : a))
        );
      } catch {
        // best-effort: 투표 실패는 등록 완료를 막지 않습니다.
      }
    }
    setStep("done");
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-[16px]">
      <div className="bg-card w-full max-w-[560px] max-h-[92vh] overflow-auto rounded-[20px] border-[1px] border-border shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-[18px] py-[16px] border-b-[1px] border-border bg-card">
          <b className="text-[15px] text-foreground">새 HETJE</b>
          <Button variant="ghost" size="sm" onClick={close} className="rounded-[6px] text-[13px] h-[32px]">
            닫기
          </Button>
        </div>

        <div className="p-[20px]">
          {error && (
            <div className="mb-[16px] p-[12px] bg-red-50 text-red-600 rounded-[8px] border-[1px] border-red-200 text-[12px]">
              {error}
            </div>
          )}

          {step === "source" && (
            <div className="space-y-[18px]">
              <div>
                <span className="text-[10px] font-black tracking-[0.12em] text-brand-600">1 / 2 · LINK</span>
                <h2 className="text-[22px] font-black tracking-tight text-foreground mt-[6px]">
                  먼저 링크를 읽어볼게요
                </h2>
                <p className="text-[12px] leading-[1.6] text-muted-foreground mt-[6px]">
                  기사나 YouTube 링크를 넣으면 핵심 내용을 먼저 정리합니다.
                </p>
              </div>
              <div className="space-y-[7px]">
                <label htmlFor="hetje-source-url" className="text-[13px] font-semibold text-foreground">
                  기사 · YouTube 링크 <span className="text-brand-600">*</span>
                </label>
                <Input
                  id="hetje-source-url"
                  type="url"
                  placeholder="https://news.example.com/article/123"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="rounded-[10px] h-[44px] px-[12px] text-[13px]"
                />
              </div>
              <div className="pt-[10px] border-t-[1px] border-border/50">
                <Button
                  onClick={handleAnalyzeSource}
                  disabled={isBusy || !inputUrl.trim()}
                  className="w-full rounded-[10px] h-[44px] text-[13px] bg-brand-600 hover:bg-brand-700"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="w-[16px] h-[16px] mr-[6px] animate-spin" />
                      링크를 읽는 중...
                    </>
                  ) : (
                    "링크 분석하기"
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "agenda" && analysisPreview && (
            <div className="space-y-[18px]">
              <div>
                <span className="text-[10px] font-black tracking-[0.12em] text-brand-600">2 / 2 · AGENDA</span>
                <h2 className="mt-[6px] text-[22px] font-black tracking-tight text-foreground">
                  읽어본 뒤, 내 관점을 남겨요
                </h2>
                <p className="mt-[6px] text-[12px] leading-[1.6] text-muted-foreground">
                  아래 분석을 확인하고 내가 중요하게 보는 의견이나 추적할 아젠다를 적어주세요.
                </p>
              </div>

              <article className="rounded-[14px] border border-brand-100 bg-brand-50/40 p-[14px]">
                <span className="mb-[8px] block text-[10px] font-black tracking-[0.08em] text-brand-600">
                  분석한 기사
                </span>
                <div className="mb-[9px] flex flex-wrap items-center gap-[6px]">
                  <Badge variant="outline" className="rounded-full border-brand-200 bg-background text-[10px] text-brand-700">
                    {analysisPreview.newsCategory}
                  </Badge>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    팩트 지수 {analysisPreview.realityIndex}%
                  </span>
                </div>
                <h3 className="text-[15px] font-extrabold leading-[1.45] text-foreground">
                  {analysisPreview.title}
                </h3>
                <p className="mt-[8px] text-[12px] leading-[1.65] text-muted-foreground">
                  {analysisPreview.summary}
                </p>
                <div className="mt-[10px] flex items-center justify-between gap-[10px] border-t border-brand-100 pt-[10px]">
                  <span className="truncate text-[10px] text-muted-foreground">
                    {analysisPreview.sourceVenue}
                  </span>
                  <a
                    href={analysisPreview.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-[4px] text-[11px] font-bold text-brand-600 hover:text-brand-700"
                  >
                    원문 열기 <ExternalLink className="h-[12px] w-[12px]" />
                  </a>
                </div>
              </article>

              <div className="space-y-[7px]">
                <label htmlFor="hetje-user-agenda" className="text-[13px] font-semibold text-foreground">
                  내 의견 / 아젠다 <span className="text-brand-600">*</span>
                </label>
                <textarea
                  id="hetje-user-agenda"
                  value={userAgenda}
                  onChange={(e) => setUserAgenda(e.target.value)}
                  placeholder="기사에서 놓치면 안 된다고 생각한 관점이나 앞으로 확인할 주제를 적어보세요."
                  maxLength={280}
                  autoFocus
                  className="w-full min-h-[104px] resize-y rounded-[10px] border border-input bg-background px-[12px] py-[11px] text-[14px] leading-[1.55] focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="text-right text-[10px] text-muted-foreground">{userAgenda.length}/280</div>
              </div>

              <SettingsFields
                checkInterval={checkInterval}
                setCheckInterval={setCheckInterval}
                expiryDate={expiryDate}
                setExpiryDate={setExpiryDate}
                targetDates={targetDates}
                newTargetDate={newTargetDate}
                setNewTargetDate={setNewTargetDate}
                addTargetDate={addTargetDate}
                removeTargetDate={(d) => setTargetDates(targetDates.filter((x) => x !== d))}
              />

              <div className="flex gap-[8px] border-t border-border/50 pt-[10px]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    setStep("source");
                  }}
                  className="h-[44px] rounded-[10px] px-[13px] text-[13px]"
                >
                  <ArrowLeft className="mr-[5px] h-[15px] w-[15px]" />
                  링크 수정
                </Button>
                <Button
                  onClick={handleCreateArchive}
                  disabled={isBusy || !userAgenda.trim()}
                  className="h-[44px] flex-1 rounded-[10px] bg-brand-600 text-[13px] hover:bg-brand-700"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="mr-[6px] h-[16px] w-[16px] animate-spin" />
                      등록하는 중...
                    </>
                  ) : (
                    "내 아젠다로 등록"
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "route" && createdArchive && (
            <div className="space-y-[16px]">
              <div>
                <span className="text-[10px] font-black tracking-[0.12em] text-brand-600">USE IT</span>
                <h2 className="text-[24px] font-black tracking-tight text-foreground mt-[6px]">어떻게 쓸까요?</h2>
              </div>
              <div className="border-[1px] border-brand-100 bg-brand-50/40 rounded-[12px] p-[14px]">
                <h3 className="text-[15px] font-bold text-foreground leading-snug">
                  &quot;{createdArchive.coreClaim.quote}&quot;
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[8px]">
                {([
                  { key: "my", title: "📚 My HETJE에 저장", desc: "오래 기억할 개인 위키에 보관합니다." },
                  { key: "tomorrow", title: "📎 Tomorrow로 추적", desc: "앞으로 어떻게 되는지 계속 추적합니다." },
                  { key: "both", title: "📚📎 저장 + 추적", desc: "보관하면서 동시에 추적합니다." },
                  { key: "skip", title: "지금은 안 함", desc: "Board에만 남깁니다." },
                ] as { key: RouteChoice; title: string; desc: string }[]).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRouteChoice(opt.key)}
                    className={cn(
                      "text-left border-[1px] rounded-[12px] p-[12px] transition-colors",
                      routeChoice === opt.key
                        ? "border-brand-500 bg-brand-50/60"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <b className="block text-[13px] text-foreground mb-[2px]">{opt.title}</b>
                    <small className="text-[11px] text-muted-foreground">{opt.desc}</small>
                  </button>
                ))}
              </div>
              <div className="flex justify-end pt-[8px] border-t-[1px] border-border/50">
                <Button onClick={applyRoute} className="rounded-[8px] h-[40px] text-[13px] bg-brand-600 hover:bg-brand-700">
                  이대로 계속
                </Button>
              </div>
            </div>
          )}

          {step === "position" && createdArchive && (
            <div className="space-y-[16px]">
              <div>
                <span className="text-[10px] font-black tracking-[0.12em] text-brand-600">POSITION</span>
                <h2 className="text-[24px] font-black tracking-tight text-foreground mt-[6px]">당신은 어떻게 보나요?</h2>
                <p className="text-[12px] text-muted-foreground mt-[6px]">
                  발화자의 주장과 당신의 입장은 다를 수 있습니다.
                  {!user && " (로그인하면 입장이 집계에 반영됩니다.)"}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-[8px]">
                {(Object.keys(REALITY_STATUS_LABEL) as RealityStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      if (!user) {
                        openAuth();
                        return;
                      }
                      applyPosition(status);
                    }}
                    className={cn(
                      "border-[1px] rounded-[12px] p-[10px] text-[12px] font-bold text-foreground transition-colors",
                      position === status ? "border-brand-500 bg-brand-50/60" : "border-border hover:bg-muted/40"
                    )}
                  >
                    {REALITY_STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
              <div className="flex justify-between pt-[8px] border-t-[1px] border-border/50">
                <Button variant="ghost" onClick={() => applyPosition(null)} className="rounded-[8px] h-[40px] text-[13px]">
                  건너뛰기
                </Button>
              </div>
            </div>
          )}

          {step === "done" && createdArchive && (
            <div className="space-y-[16px]">
              <div>
                <span className="text-[10px] font-black tracking-[0.12em] text-brand-600">DONE</span>
                <h2 className="text-[24px] font-black tracking-tight text-foreground mt-[6px]">등록 완료</h2>
              </div>
              <div className="border-[1px] border-brand-100 bg-brand-50/40 rounded-[12px] p-[14px]">
                <div className="flex items-center gap-[6px] text-brand-600 mb-[6px]">
                  <Check className="w-[14px] h-[14px]" />
                  <span className="text-[11px] font-bold">HETJE가 등록되었습니다</span>
                </div>
                <h3 className="text-[15px] font-bold text-foreground leading-snug">
                  &quot;{createdArchive.coreClaim.quote}&quot;
                </h3>
                <div className="flex flex-wrap gap-[6px] mt-[10px]">
                  {(routeChoice === "my" || routeChoice === "both") && (
                    <Badge variant="outline" className="text-[10px] rounded-[999px]">📚 My HETJE</Badge>
                  )}
                  {(routeChoice === "tomorrow" || routeChoice === "both") && (
                    <Badge variant="outline" className="text-[10px] rounded-[999px]">📎 Tomorrow</Badge>
                  )}
                  {position && (
                    <Badge variant="outline" className="text-[10px] rounded-[999px]">
                      입장: {REALITY_STATUS_LABEL[position]}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex justify-end pt-[8px] border-t-[1px] border-border/50">
                <Button onClick={close} className="rounded-[8px] h-[40px] text-[13px] bg-brand-600 hover:bg-brand-700">
                  앱 둘러보기
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsFields(props: {
  checkInterval: CheckInterval;
  setCheckInterval: (v: CheckInterval) => void;
  expiryDate: string;
  setExpiryDate: (v: string) => void;
  targetDates: string[];
  newTargetDate: string;
  setNewTargetDate: (v: string) => void;
  addTargetDate: () => void;
  removeTargetDate: (d: string) => void;
}) {
  return (
    <div className="space-y-[12px]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
        <div className="space-y-[6px]">
          <label className="text-[13px] font-semibold text-foreground">AI 체크 주기</label>
          <select
            value={props.checkInterval}
            onChange={(e) => props.setCheckInterval(e.target.value as CheckInterval)}
            className="w-full h-[40px] border-[1px] border-input rounded-[8px] px-[12px] bg-background text-[13px] focus:outline-none focus:ring-[2px] focus:ring-ring"
          >
            <option value={CheckInterval.DAILY}>매일</option>
            <option value={CheckInterval.WEEKLY}>매주</option>
            <option value={CheckInterval.MONTHLY}>매월</option>
          </select>
        </div>
        <div className="space-y-[6px]">
          <label className="text-[13px] font-semibold text-foreground">추적 만료 일자</label>
          <Input
            type="date"
            value={props.expiryDate}
            onChange={(e) => props.setExpiryDate(e.target.value)}
            className="rounded-[8px] h-[40px] text-[13px]"
          />
        </div>
      </div>
      <div className="space-y-[8px]">
        <label className="text-[13px] font-semibold text-foreground">중간 점검 일자 (선택)</label>
        <div className="flex gap-[8px]">
          <Input
            type="date"
            value={props.newTargetDate}
            onChange={(e) => props.setNewTargetDate(e.target.value)}
            className="rounded-[8px] h-[36px] flex-1 text-[13px]"
          />
          <Button type="button" variant="outline" onClick={props.addTargetDate} className="h-[36px] rounded-[8px]">
            추가
          </Button>
        </div>
        {props.targetDates.length > 0 && (
          <div className="flex flex-wrap gap-[6px] pt-[4px]">
            {props.targetDates.map((date) => (
              <Badge key={date} variant="secondary" className="flex items-center gap-[4px] py-[3px] px-[8px] rounded-[999px] text-[11px]">
                {date}
                <button type="button" onClick={() => props.removeTargetDate(date)} className="text-muted-foreground hover:text-foreground">
                  <Trash2 className="w-[12px] h-[12px]" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
