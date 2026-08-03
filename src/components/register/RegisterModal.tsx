"use client";

import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Check,
  Clock3,
  ExternalLink,
  Globe2,
  Loader2,
  MessageSquareText,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ArchiveReference,
  CheckInterval,
  HetjeIntent,
  HetjeStance,
} from "@/domains/archive/model/archive.model";
import {
  analyzeNewsUrlPreview,
  createArchiveFromNewsPreview,
  NewsAnalysisPreview,
} from "@/domains/archive/api/analyze.action";
import { useAppData } from "@/lib/app-context";

type Step = "source" | "intent" | "route" | "write" | "position" | "done";

const INTENT_OPTIONS = [
  {
    value: HetjeIntent.REMEMBER,
    title: "기억하고 싶어요",
    description: "골프 레슨, 학습 영상, 좋은 문장, 참고자료",
    destination: "My HETJE",
    icon: Brain,
  },
  {
    value: HetjeIntent.OPINION,
    title: "내 의견을 남기고 싶어요",
    description: "원본 콘텐츠에 대한 내 생각, 반박, 해석",
    destination: "My HETJE · 공개 선택 시 Board",
    icon: MessageSquareText,
  },
  {
    value: HetjeIntent.TRACK,
    title: "앞으로 확인하고 싶어요",
    description: "시간이 지나 맞는지 볼 주장, 약속, 예측",
    destination: "Tomorrow",
    icon: Clock3,
  },
  {
    value: HetjeIntent.SHARE,
    title: "남들과 공유하고 싶어요",
    description: "공개적으로 토론할 가치가 있는 주장이나 아젠다",
    destination: "Board",
    icon: Globe2,
  },
] as const;

const STANCE_OPTIONS = [
  { value: HetjeStance.AGREE, label: "동의", description: "핵심 주장에 동의해요" },
  { value: HetjeStance.HOLD, label: "보류", description: "근거를 더 보고 판단할래요" },
  { value: HetjeStance.DISAGREE, label: "비동의", description: "핵심 주장에 동의하지 않아요" },
] as const;

function defaultExpiry(): string {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return date.toISOString().split("T")[0];
}

function defaultRoutes(intent: HetjeIntent) {
  return {
    track: intent === HetjeIntent.TRACK,
    board: intent === HetjeIntent.SHARE,
  };
}

function intentLabel(intent: HetjeIntent) {
  return INTENT_OPTIONS.find((option) => option.value === intent)?.title ?? "기억하고 싶어요";
}

export function RegisterModal() {
  const {
    isCreating,
    setIsCreating,
    addArchive,
    markSaved,
    markTracked,
  } = useAppData();

  const [step, setStep] = useState<Step>("source");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [analysisPreview, setAnalysisPreview] = useState<NewsAnalysisPreview | null>(null);
  const [intent, setIntent] = useState<HetjeIntent>(HetjeIntent.REMEMBER);
  const [trackEnabled, setTrackEnabled] = useState(false);
  const [boardEnabled, setBoardEnabled] = useState(false);
  const [userAgenda, setUserAgenda] = useState("");
  const [checkInterval, setCheckInterval] = useState<CheckInterval>(CheckInterval.WEEKLY);
  const [expiryDate, setExpiryDate] = useState(defaultExpiry);
  const [targetDates, setTargetDates] = useState<string[]>([]);
  const [newTargetDate, setNewTargetDate] = useState("");
  const [stance, setStance] = useState<HetjeStance | null>(null);
  const [createdArchive, setCreatedArchive] = useState<ArchiveReference | null>(null);

  if (!isCreating) return null;

  const reset = () => {
    setStep("source");
    setIsBusy(false);
    setError(null);
    setInputUrl("");
    setAnalysisPreview(null);
    setIntent(HetjeIntent.REMEMBER);
    setTrackEnabled(false);
    setBoardEnabled(false);
    setUserAgenda("");
    setCheckInterval(CheckInterval.WEEKLY);
    setExpiryDate(defaultExpiry());
    setTargetDates([]);
    setNewTargetDate("");
    setStance(null);
    setCreatedArchive(null);
  };

  const close = () => {
    setIsCreating(false);
    reset();
  };

  const chooseIntent = (nextIntent: HetjeIntent) => {
    const routes = defaultRoutes(nextIntent);
    setIntent(nextIntent);
    setTrackEnabled(routes.track);
    setBoardEnabled(routes.board);
    if (nextIntent !== HetjeIntent.OPINION) setStance(null);
  };

  const handleAnalyzeSource = async () => {
    if (!inputUrl.trim()) return;
    try {
      setIsBusy(true);
      setError(null);
      const result = await analyzeNewsUrlPreview(inputUrl);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (!result.preview) {
        setError("링크 분석 결과를 불러오지 못했습니다.");
        return;
      }
      setAnalysisPreview(result.preview);
      chooseIntent(result.preview.recommendedIntent);
      setStep("intent");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "링크 분석 중 오류가 발생했습니다.");
    } finally {
      setIsBusy(false);
    }
  };

  const addTargetDate = () => {
    if (!newTargetDate || targetDates.includes(newTargetDate)) return;
    setTargetDates([...targetDates, newTargetDate]);
    setNewTargetDate("");
  };

  const handleCreateArchive = async (creatorStance: HetjeStance | null = stance) => {
    if (!analysisPreview || !userAgenda.trim()) return;
    try {
      setIsBusy(true);
      setError(null);
      const archive = await createArchiveFromNewsPreview(analysisPreview, userAgenda, {
        intent,
        isPublic: boardEnabled,
        creatorStance,
        checkInterval: trackEnabled ? checkInterval : CheckInterval.WEEKLY,
        expiryDate: trackEnabled ? expiryDate : undefined,
        targetDates: trackEnabled ? targetDates : [],
      });
      addArchive(archive);
      await markSaved(archive.id);
      if (trackEnabled) await markTracked(archive.id);
      setCreatedArchive(archive);
      setStance(creatorStance);
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "HETJE 저장 중 오류가 발생했습니다.");
    } finally {
      setIsBusy(false);
    }
  };

  const moveFromWrite = () => {
    if (intent === HetjeIntent.OPINION) {
      setStep("position");
      return;
    }
    void handleCreateArchive(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-[16px]">
      <div className="max-h-[94dvh] w-full max-w-[620px] overflow-auto rounded-t-[28px] border border-border bg-card shadow-2xl sm:rounded-[24px]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card/95 px-[18px] py-[14px] backdrop-blur-xl">
          <div>
            <b className="block text-[15px] text-foreground">새 HETJE</b>
            <span className="text-[10px] text-muted-foreground">원본 콘텐츠 한 개, 남기는 방법은 내가 선택</span>
          </div>
          <Button variant="ghost" size="sm" onClick={close} className="h-[32px] rounded-[8px] text-[13px]">
            닫기
          </Button>
        </div>

        <div className="p-[20px] sm:p-[24px]">
          {error && (
            <div role="alert" className="mb-[16px] rounded-[10px] border border-red-200 bg-red-50 p-[12px] text-[12px] text-red-600">
              {error}
            </div>
          )}

          {step === "source" && (
            <div className="space-y-[20px]">
              <StepHeading eyebrow="1 · LINK" title="남기고 싶은 링크를 넣어주세요">
                YouTube, 기사, 블로그, 리포트 등 공개 링크의 핵심 내용을 먼저 읽습니다.
              </StepHeading>
              <div className="space-y-[7px]">
                <label htmlFor="hetje-source-url" className="text-[13px] font-semibold text-foreground">
                  원본 콘텐츠 링크 <span className="text-brand-600">*</span>
                </label>
                <Input
                  id="hetje-source-url"
                  type="url"
                  inputMode="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={inputUrl}
                  onChange={(event) => setInputUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleAnalyzeSource();
                  }}
                  className="h-[46px] rounded-[11px] px-[12px] text-[13px]"
                />
              </div>
              <Button
                onClick={handleAnalyzeSource}
                disabled={isBusy || !inputUrl.trim()}
                className="h-[46px] w-full rounded-[11px] bg-brand-600 text-[13px] hover:bg-brand-700"
              >
                {isBusy ? <><Loader2 className="mr-[6px] h-[16px] w-[16px] animate-spin" />원본 콘텐츠를 읽는 중...</> : "원본 콘텐츠 분석하기"}
              </Button>
            </div>
          )}

          {step === "intent" && analysisPreview && (
            <div className="space-y-[18px]">
              <StepHeading eyebrow="2 · INTENT" title="이 링크에서 무엇을 남기고 싶나요?">
                AI 추천을 먼저 골라두었습니다. 목적이 다르면 직접 바꾸세요.
              </StepHeading>
              <SourcePreview preview={analysisPreview} />
              <div className="rounded-[14px] border border-brand-200 bg-brand-50/60 p-[13px]">
                <div className="flex items-center gap-[6px] text-[11px] font-black text-brand-700">
                  <span className="rounded-full bg-brand-600 px-[7px] py-[2px] text-white">AI 추천</span>
                  {intentLabel(analysisPreview.recommendedIntent)}
                </div>
                <p className="mt-[6px] text-[12px] leading-[1.55] text-muted-foreground">
                  {analysisPreview.recommendationReason}
                </p>
              </div>
              <div role="radiogroup" aria-label="링크를 남기는 목적" className="grid grid-cols-1 gap-[9px] sm:grid-cols-2">
                {INTENT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = intent === option.value;
                  const recommended = analysisPreview.recommendedIntent === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => chooseIntent(option.value)}
                      className={cn(
                        "min-h-[132px] rounded-[16px] border p-[14px] text-left transition-all",
                        selected ? "border-brand-500 bg-brand-50 shadow-[0_0_0_3px_rgba(37,99,235,0.08)]" : "border-border bg-background hover:border-brand-200"
                      )}
                    >
                      <div className="flex items-center justify-between gap-[8px]">
                        <Icon className={cn("h-[20px] w-[20px]", selected ? "text-brand-600" : "text-muted-foreground")} />
                        {recommended && <Badge className="rounded-full bg-brand-600 text-[9px]">AI 추천</Badge>}
                      </div>
                      <b className="mt-[9px] block text-[14px] text-foreground">{option.title}</b>
                      <span className="mt-[4px] block text-[11px] leading-[1.45] text-muted-foreground">{option.description}</span>
                      <span className="mt-[8px] block text-[10px] font-bold text-brand-600">{option.destination}</span>
                    </button>
                  );
                })}
              </div>
              <Button onClick={() => setStep("route")} className="h-[46px] w-full rounded-[11px] bg-brand-600 text-[13px] hover:bg-brand-700">
                저장 경로 확인
              </Button>
            </div>
          )}

          {step === "route" && analysisPreview && (
            <div className="space-y-[18px]">
              <StepHeading eyebrow="3 · ROUTE" title="어디에서 다시 볼까요?">
                My HETJE는 기본 저장소입니다. Tomorrow와 Board는 사용자가 바꿀 수 있습니다.
              </StepHeading>
              <div className="grid gap-[9px] sm:grid-cols-3">
                <RouteCard icon={BookOpen} title="My HETJE" description="모든 HETJE의 기본 저장소" selected locked />
                <RouteCard
                  icon={Clock3}
                  title="Tomorrow"
                  description="시간이 지나면 다시 확인"
                  selected={trackEnabled}
                  onClick={() => setTrackEnabled((current) => !current)}
                />
                <RouteCard
                  icon={Globe2}
                  title="Board"
                  description="다른 사람에게 공개"
                  selected={boardEnabled}
                  onClick={() => setBoardEnabled((current) => !current)}
                />
              </div>

              {trackEnabled && (
                <div className="space-y-[12px] rounded-[16px] border border-blue-200 bg-blue-50/60 p-[14px]">
                  <div>
                    <b className="text-[13px] text-blue-900">Tomorrow 추적 설정</b>
                    <p className="mt-[3px] text-[11px] text-blue-700/80">Tomorrow에 추가한 HETJE만 AI가 다시 확인합니다.</p>
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
                    removeTargetDate={(date) => setTargetDates(targetDates.filter((item) => item !== date))}
                  />
                </div>
              )}

              <div className="flex gap-[8px]">
                <Button variant="outline" onClick={() => setStep("intent")} className="h-[46px] rounded-[11px] px-[13px] text-[13px]">
                  <ArrowLeft className="mr-[5px] h-[15px] w-[15px]" />목적 수정
                </Button>
                <Button onClick={() => setStep("write")} className="h-[46px] flex-1 rounded-[11px] bg-brand-600 text-[13px] hover:bg-brand-700">
                  내 한 줄 남기기
                </Button>
              </div>
            </div>
          )}

          {step === "write" && analysisPreview && (
            <div className="space-y-[18px]">
              <StepHeading eyebrow="4 · MY LINE" title="내가 남길 한 줄을 적어주세요">
                요약을 복사하는 대신, 나중에 다시 봐도 의미가 통하는 내 말로 남겨보세요.
              </StepHeading>
              <SourcePreview preview={analysisPreview} compact />
              <div className="space-y-[7px]">
                <label htmlFor="hetje-user-agenda" className="text-[13px] font-semibold text-foreground">
                  내 한 줄 <span className="text-brand-600">*</span>
                </label>
                <textarea
                  id="hetje-user-agenda"
                  value={userAgenda}
                  onChange={(event) => setUserAgenda(event.target.value)}
                  placeholder={intent === HetjeIntent.REMEMBER ? "나중에 기억하고 싶은 핵심을 적어주세요." : "이 콘텐츠에서 내가 남기고 싶은 생각을 적어주세요."}
                  maxLength={280}
                  autoFocus
                  className="min-h-[112px] w-full resize-y rounded-[11px] border border-input bg-background px-[12px] py-[11px] text-[14px] leading-[1.55] focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="text-right text-[10px] text-muted-foreground">{userAgenda.length}/280</div>
              </div>
              <div className="flex gap-[8px]">
                <Button variant="outline" onClick={() => setStep("route")} className="h-[46px] rounded-[11px] px-[13px] text-[13px]">
                  <ArrowLeft className="mr-[5px] h-[15px] w-[15px]" />경로 수정
                </Button>
                <Button
                  onClick={moveFromWrite}
                  disabled={isBusy || !userAgenda.trim()}
                  className="h-[46px] flex-1 rounded-[11px] bg-brand-600 text-[13px] hover:bg-brand-700"
                >
                  {intent === HetjeIntent.OPINION ? "내 입장 선택" : isBusy ? "저장하는 중..." : "HETJE 저장"}
                </Button>
              </div>
            </div>
          )}

          {step === "position" && (
            <div className="space-y-[18px]">
              <StepHeading eyebrow="5 · POSITION" title="이 주장에 대한 내 입장은?">
                입장은 내 의견과 함께 저장됩니다. 아직 판단하기 어렵다면 보류를 고르세요.
              </StepHeading>
              <div role="radiogroup" aria-label="내 입장" className="grid gap-[9px] sm:grid-cols-3">
                {STANCE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={stance === option.value}
                    onClick={() => setStance(option.value)}
                    className={cn(
                      "rounded-[14px] border p-[13px] text-left transition-colors",
                      stance === option.value ? "border-brand-500 bg-brand-50" : "border-border bg-background hover:border-brand-200"
                    )}
                  >
                    <b className="block text-[13px] text-foreground">{option.label}</b>
                    <span className="mt-[4px] block text-[10px] leading-[1.4] text-muted-foreground">{option.description}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-[8px]">
                <Button variant="outline" onClick={() => setStep("write")} className="h-[46px] rounded-[11px] px-[13px] text-[13px]">
                  <ArrowLeft className="mr-[5px] h-[15px] w-[15px]" />한 줄 수정
                </Button>
                <Button
                  onClick={() => void handleCreateArchive()}
                  disabled={isBusy || !stance}
                  className="h-[46px] flex-1 rounded-[11px] bg-brand-600 text-[13px] hover:bg-brand-700"
                >
                  {isBusy ? <><Loader2 className="mr-[6px] h-[16px] w-[16px] animate-spin" />저장하는 중...</> : "HETJE 저장"}
                </Button>
              </div>
            </div>
          )}

          {step === "done" && createdArchive && (
            <div className="space-y-[18px] text-center">
              <div className="mx-auto grid h-[52px] w-[52px] place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-[25px] w-[25px]" />
              </div>
              <StepHeading eyebrow="DONE" title="남겼습니다">
                하나의 HETJE로 저장했고, 선택한 곳에서 다시 볼 수 있습니다.
              </StepHeading>
              <div className="rounded-[16px] border border-border bg-background p-[15px] text-left">
                <div className="flex flex-wrap gap-[6px]">
                  <Badge variant="outline" className="rounded-full text-[10px]">My HETJE</Badge>
                  {trackEnabled && <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-[10px] text-blue-700">Tomorrow</Badge>}
                  {boardEnabled && <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">Board 공개</Badge>}
                  {stance && <Badge variant="outline" className="rounded-full text-[10px]">{STANCE_OPTIONS.find((option) => option.value === stance)?.label}</Badge>}
                </div>
                <h3 className="mt-[10px] text-[15px] font-bold leading-[1.45] text-foreground">&quot;{createdArchive.coreClaim.quote}&quot;</h3>
              </div>
              <Button onClick={close} className="h-[46px] w-full rounded-[11px] bg-brand-600 text-[13px] hover:bg-brand-700">저장된 HETJE 보기</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[10px] font-black tracking-[0.12em] text-brand-600">{eyebrow}</span>
      <h2 className="mt-[6px] text-[23px] font-black tracking-[-0.035em] text-foreground">{title}</h2>
      <p className="mt-[6px] text-[12px] leading-[1.6] text-muted-foreground">{children}</p>
    </div>
  );
}

function SourcePreview({ preview, compact = false }: { preview: NewsAnalysisPreview; compact?: boolean }) {
  return (
    <article className="rounded-[14px] border border-border bg-background p-[14px]">
      <div className="flex flex-wrap items-center gap-[6px]">
        <Badge variant="outline" className="rounded-full text-[10px]">원본 콘텐츠</Badge>
        <Badge variant="secondary" className="rounded-full text-[10px]">{preview.newsCategory}</Badge>
      </div>
      <h3 className="mt-[9px] text-[14px] font-extrabold leading-[1.45] text-foreground">{preview.title}</h3>
      {!compact && <p className="mt-[7px] text-[12px] leading-[1.6] text-muted-foreground">{preview.summary}</p>}
      <div className="mt-[9px] flex items-center justify-between gap-[10px] border-t border-border pt-[9px]">
        <span className="truncate text-[10px] text-muted-foreground">{preview.sourceVenue}</span>
        <a href={preview.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-[4px] text-[11px] font-bold text-brand-600">
          원본 열기 <ExternalLink className="h-[12px] w-[12px]" />
        </a>
      </div>
    </article>
  );
}

function RouteCard({ icon: Icon, title, description, selected, locked = false, onClick }: {
  icon: typeof BookOpen;
  title: string;
  description: string;
  selected: boolean;
  locked?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={locked}
      onClick={onClick}
      className={cn(
        "rounded-[15px] border p-[13px] text-left transition-colors disabled:cursor-default disabled:opacity-100",
        selected ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:border-brand-200"
      )}
    >
      <div className="flex items-center justify-between">
        <Icon className="h-[19px] w-[19px]" />
        {locked && <span className="text-[9px] font-bold opacity-70">기본 저장</span>}
      </div>
      <b className="mt-[8px] block text-[13px]">{title}</b>
      <span className={cn("mt-[3px] block text-[10px] leading-[1.4]", selected ? "text-background/70" : "text-muted-foreground")}>{description}</span>
    </button>
  );
}

function SettingsFields(props: {
  checkInterval: CheckInterval;
  setCheckInterval: (value: CheckInterval) => void;
  expiryDate: string;
  setExpiryDate: (value: string) => void;
  targetDates: string[];
  newTargetDate: string;
  setNewTargetDate: (value: string) => void;
  addTargetDate: () => void;
  removeTargetDate: (date: string) => void;
}) {
  return (
    <div className="space-y-[11px]">
      <div className="grid gap-[10px] sm:grid-cols-2">
        <label className="space-y-[5px] text-[11px] font-semibold text-blue-900">
          <span>AI 체크 주기</span>
          <select
            value={props.checkInterval}
            onChange={(event) => props.setCheckInterval(event.target.value as CheckInterval)}
            className="h-[40px] w-full rounded-[8px] border border-blue-200 bg-background px-[10px] text-[12px] text-foreground"
          >
            <option value={CheckInterval.DAILY}>매일</option>
            <option value={CheckInterval.WEEKLY}>매주</option>
            <option value={CheckInterval.MONTHLY}>매월</option>
          </select>
        </label>
        <label className="space-y-[5px] text-[11px] font-semibold text-blue-900">
          <span>추적 만료일</span>
          <Input type="date" value={props.expiryDate} onChange={(event) => props.setExpiryDate(event.target.value)} className="h-[40px] rounded-[8px] border-blue-200 bg-background text-[12px]" />
        </label>
      </div>
      <div className="space-y-[6px]">
        <label htmlFor="hetje-target-date" className="text-[11px] font-semibold text-blue-900">중간 점검일 (선택)</label>
        <div className="flex gap-[7px]">
          <Input id="hetje-target-date" type="date" value={props.newTargetDate} onChange={(event) => props.setNewTargetDate(event.target.value)} className="h-[38px] flex-1 rounded-[8px] border-blue-200 bg-background text-[12px]" />
          <Button type="button" variant="outline" onClick={props.addTargetDate} className="h-[38px] rounded-[8px] border-blue-200 bg-background text-[12px]">추가</Button>
        </div>
        {props.targetDates.length > 0 && (
          <div className="flex flex-wrap gap-[6px] pt-[2px]">
            {props.targetDates.map((date) => (
              <Badge key={date} variant="secondary" className="gap-[4px] rounded-full px-[8px] py-[3px] text-[10px]">
                {date}
                <button type="button" aria-label={`${date} 중간 점검일 삭제`} onClick={() => props.removeTargetDate(date)}>
                  <Trash2 className="h-[11px] w-[11px]" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
