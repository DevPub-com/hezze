"use client";

import { useState } from "react";
import { Loader2, Link as LinkIcon, PenLine, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckInterval, RealityStatus, REALITY_STATUS_LABEL, ArchiveReference } from "@/domains/archive/model/archive.model";
import { analyzeNewsUrl, createDirectArchive, updateVote } from "@/domains/archive/api/analyze.action";
import { useAppData } from "@/lib/app-context";

type Step = "mode" | "source" | "direct" | "route" | "position" | "done";
type RouteChoice = "my" | "tomorrow" | "both" | "skip";

function defaultExpiry(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().split("T")[0];
}

export function RegisterModal() {
  const { isCreating, setIsCreating, user, addArchive, markSaved, markTracked, setArchiveList, openAuth } = useAppData();

  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<"source" | "direct" | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inputUrl, setInputUrl] = useState("");
  const [directStatement, setDirectStatement] = useState("");
  const [directContext, setDirectContext] = useState("");

  const [checkInterval, setCheckInterval] = useState<CheckInterval>(CheckInterval.WEEKLY);
  const [expiryDate, setExpiryDate] = useState(defaultExpiry);
  const [targetDates, setTargetDates] = useState<string[]>([]);
  const [newTargetDate, setNewTargetDate] = useState("");

  const [routeChoice, setRouteChoice] = useState<RouteChoice>("skip");
  const [position, setPosition] = useState<RealityStatus | null>(null);
  const [createdArchive, setCreatedArchive] = useState<ArchiveReference | null>(null);

  if (!isCreating) return null;

  const reset = () => {
    setStep("mode");
    setMode(null);
    setIsBusy(false);
    setError(null);
    setInputUrl("");
    setDirectStatement("");
    setDirectContext("");
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
      const archive = await analyzeNewsUrl(inputUrl, checkInterval, expiryDate, targetDates);
      addArchive(archive);
      setCreatedArchive(archive);
      setStep("route");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleCreateDirect = async () => {
    if (!directStatement.trim()) return;
    try {
      setIsBusy(true);
      setError(null);
      const authorName = user?.email?.split("@")[0] ?? "나";
      const archive = await createDirectArchive(directStatement, directContext, checkInterval, expiryDate, targetDates, authorName);
      addArchive(archive);
      setCreatedArchive(archive);
      setStep("route");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "등록 중 오류가 발생했습니다.");
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
        const updatedVotes = await updateVote(createdArchive.id, status, createdArchive.userVotes, user.id);
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
          <b className="text-[15px] text-foreground">
            새 HETJE{mode === "source" ? " · 링크에서 찾기" : mode === "direct" ? " · 직접 쓰기" : ""}
          </b>
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

          {step === "mode" && (
            <div>
              <span className="text-[10px] font-black tracking-[0.12em] text-brand-600">START</span>
              <h2 className="text-[24px] font-black tracking-tight text-foreground mt-[6px] mb-[16px]">
                무엇을 남길까요?
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    setMode("source");
                    setStep("source");
                  }}
                  className="text-left border-[1px] border-border rounded-[16px] p-[16px] hover:border-brand-400 hover:bg-brand-50/40 transition-colors"
                >
                  <LinkIcon className="w-[18px] h-[18px] text-brand-600 mb-[8px]" />
                  <b className="block text-[14px] text-foreground mb-[4px]">🔗 링크에서 찾기</b>
                  <small className="text-[12px] text-muted-foreground">기사·YouTube 안의 의미 있는 발언</small>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("direct");
                    setStep("direct");
                  }}
                  className="text-left border-[1px] border-border rounded-[16px] p-[16px] hover:border-brand-400 hover:bg-brand-50/40 transition-colors"
                >
                  <PenLine className="w-[18px] h-[18px] text-brand-600 mb-[8px]" />
                  <b className="block text-[14px] text-foreground mb-[4px]">✍️ 내가 직접 쓰기</b>
                  <small className="text-[12px] text-muted-foreground">내 생각·가설·한 줄 인사이트</small>
                </button>
              </div>
            </div>
          )}

          {step === "source" && (
            <div className="space-y-[16px]">
              <div>
                <span className="text-[10px] font-black tracking-[0.12em] text-brand-600">SOURCE</span>
                <h2 className="text-[24px] font-black tracking-tight text-foreground mt-[6px]">어디서 발견했나요?</h2>
              </div>
              <div className="space-y-[6px]">
                <label className="text-[13px] font-semibold text-foreground">기사 · YouTube URL</label>
                <Input
                  type="url"
                  placeholder="https://news.example.com/article/123"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="rounded-[8px] h-[40px]"
                />
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
              <div className="flex justify-end gap-[8px] pt-[8px] border-t-[1px] border-border/50">
                <Button variant="ghost" onClick={() => setStep("mode")} className="rounded-[8px] h-[40px] text-[13px]">
                  뒤로
                </Button>
                <Button
                  onClick={handleAnalyzeSource}
                  disabled={isBusy || !inputUrl.trim()}
                  className="rounded-[8px] h-[40px] text-[13px] bg-brand-600 hover:bg-brand-700"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="w-[16px] h-[16px] mr-[6px] animate-spin" />
                      AI로 발언 찾는 중...
                    </>
                  ) : (
                    "AI로 발언 찾기"
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === "direct" && (
            <div className="space-y-[16px]">
              <div>
                <span className="text-[10px] font-black tracking-[0.12em] text-brand-600">DIRECT</span>
                <h2 className="text-[24px] font-black tracking-tight text-foreground mt-[6px]">내 생각을 한 줄로</h2>
              </div>
              <div className="space-y-[6px]">
                <label className="text-[13px] font-semibold text-foreground">HETJE 한 줄</label>
                <textarea
                  value={directStatement}
                  onChange={(e) => setDirectStatement(e.target.value)}
                  placeholder="AI 데이터센터 투자는 전력 인프라 슈퍼사이클을 만든다."
                  className="w-full min-h-[80px] border-[1px] border-input rounded-[8px] px-[12px] py-[10px] bg-background text-[14px] focus:outline-none focus:ring-[2px] focus:ring-ring"
                />
              </div>
              <div className="space-y-[6px]">
                <label className="text-[13px] font-semibold text-foreground">맥락 · 근거 (선택)</label>
                <textarea
                  value={directContext}
                  onChange={(e) => setDirectContext(e.target.value)}
                  placeholder="이 생각의 배경이나 근거를 짧게 남겨보세요."
                  className="w-full min-h-[60px] border-[1px] border-input rounded-[8px] px-[12px] py-[10px] bg-background text-[13px] focus:outline-none focus:ring-[2px] focus:ring-ring"
                />
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
              <div className="flex justify-end gap-[8px] pt-[8px] border-t-[1px] border-border/50">
                <Button variant="ghost" onClick={() => setStep("mode")} className="rounded-[8px] h-[40px] text-[13px]">
                  뒤로
                </Button>
                <Button
                  onClick={handleCreateDirect}
                  disabled={isBusy || !directStatement.trim()}
                  className="rounded-[8px] h-[40px] text-[13px] bg-brand-600 hover:bg-brand-700"
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="w-[16px] h-[16px] mr-[6px] animate-spin" />
                      등록 중...
                    </>
                  ) : (
                    "이 생각을 HETJE로 등록"
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
