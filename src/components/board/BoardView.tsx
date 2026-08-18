"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { REALITY_STATUS_LABEL, RealityStatus, CheckInterval, NotificationLog, REALIZATION_TRAJECTORY_LABEL } from "@/domains/archive/model/archive.model";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FileText, AlertCircle, Link as LinkIcon, Users, Loader2, Search, Bell, Clock, ArrowLeft, Pin, Bookmark, CheckCircle2, Share2, X, Radio, CalendarDays, ListChecks, Check } from "lucide-react";
import { analyzeTimelineUpdate, runPeriodicCheckForArchive } from "@/domains/archive/api/analyze.action";
import { updateVote, fetchUserVote, fetchVoteSummary } from "@/domains/archive/api/vote.action";
import { ViralShareModal } from "@/components/archive/ViralShareModal";
import { useAppData } from "@/lib/app-context";
import { formatArchivePostedAt } from "@/lib/format-archive-posted-at";

export function BoardView({ initialArchiveId = null }: { initialArchiveId?: string | null }) {
  const {
    archiveList,
    setArchiveList,
    user,
    isLoading,
    setIsLoading,
    errorMessage,
    setErrorMessage,
    searchQuery,
    setSearchQuery,
    mySaved,
    toggleSaved,
    tracked,
    toggleTracked,
    openAuth,
  } = useAppData();

  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(initialArchiveId);
  const [mobileView, setMobileView] = useState<"list" | "detail">(
    initialArchiveId ? "detail" : "list"
  );

  useEffect(() => {
    const showBoardList = () => {
      setSelectedArchiveId(null);
      setMobileView("list");
    };

    window.addEventListener("hezze:show-board-list", showBoardList);
    return () => window.removeEventListener("hezze:show-board-list", showBoardList);
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("hezze:board-detail", { detail: mobileView === "detail" }));
    return () => {
      window.dispatchEvent(new CustomEvent("hezze:board-detail", { detail: false }));
    };
  }, [mobileView]);

  const [userVote, setUserVote] = useState<RealityStatus | null>(null);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [viralModalOpen, setViralModalOpen] = useState(false);

  const [timelineUrl, setTimelineUrl] = useState("");
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState("전체");
  const [trackingSheetOpen, setTrackingSheetOpen] = useState(false);
  const [trackingInterval, setTrackingInterval] = useState<CheckInterval>(CheckInterval.WEEKLY);
  const [importantOnly, setImportantOnly] = useState(true);

  useEffect(() => {
    const focusSearch = () => {
      setMobileView("list");
      window.setTimeout(() => document.getElementById("board-search")?.focus(), 0);
    };

    window.addEventListener("hezze:focus-search", focusSearch);
    return () => window.removeEventListener("hezze:focus-search", focusSearch);
  }, []);

  const publicArchiveList = archiveList.filter((archive) => archive.isPublic);
  const activeArchiveId = selectedArchiveId ?? publicArchiveList[0]?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadUserVote() {
      if (!activeArchiveId || !user) {
        if (!cancelled) setUserVote(null);
        return;
      }
      try {
        const [vote, voteSummary] = await Promise.all([
          fetchUserVote(activeArchiveId),
          fetchVoteSummary(activeArchiveId),
        ]);
        if (cancelled) return;
        setUserVote(vote);
        setArchiveList((currentList) =>
          currentList.map((archive) =>
            archive.id === activeArchiveId ? { ...archive, userVotes: voteSummary } : archive
          )
        );
      } catch {
        if (!cancelled) setUserVote(null);
      }
    }
    loadUserVote();
    return () => {
      cancelled = true;
    };
  }, [activeArchiveId, setArchiveList, user]);


  const handleAddTimelineItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!timelineUrl.trim() || !activeArchiveId) return;

    const currentArchive = archiveList.find((archive) => archive.id === activeArchiveId);
    if (!currentArchive) return;

    try {
      setIsTimelineLoading(true);
      setErrorMessage(null);
      const { timelineItem, updatedRealityIndex, updatedStatus } = await analyzeTimelineUpdate(
        currentArchive,
        timelineUrl
      );

      const updatedList = archiveList.map((archive) => {
        if (archive.id === activeArchiveId) {
          const newNotificationLog: NotificationLog = {
            id: "log-" + Date.now(),
            recordedAt: new Date().toISOString(),
            message: `관련 기사 분석을 기반으로 타임라인이 갱신되었습니다. 지수: ${updatedRealityIndex}%, 상태: ${REALITY_STATUS_LABEL[updatedStatus]}`,
          };
          return {
            ...archive,
            realityMeter: {
              currentIndex: updatedRealityIndex,
              status: updatedStatus,
            },
            timeline: [...archive.timeline, timelineItem],
            notificationLogs: [newNotificationLog, ...archive.notificationLogs],
          };
        }
        return archive;
      });

      setArchiveList(updatedList);
      setTimelineUrl("");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "타임라인 분석 중 오류가 발생했습니다.");
    } finally {
      setIsTimelineLoading(false);
    }
  };

  const handleVote = async (status: RealityStatus) => {
    if (!user) {
      openAuth();
      return;
    }
    if (!activeArchiveId) return;
    const currentArchive = archiveList.find((archive) => archive.id === activeArchiveId);
    if (!currentArchive) return;

    try {
      setErrorMessage(null);
      const updatedVotes = await updateVote(activeArchiveId, status);

      const updatedList = archiveList.map((archive) => {
        if (archive.id === activeArchiveId) {
          return {
            ...archive,
            userVotes: updatedVotes,
          };
        }
        return archive;
      });
      setArchiveList(updatedList);
      setUserVote(status);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "투표 반영에 실패했습니다.");
    }
  };

  const handleSimulatePeriodicCheck = async () => {
    if (!activeArchiveId) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const updatedArchive = await runPeriodicCheckForArchive(activeArchiveId);
      const updatedList = archiveList.map((archive) => {
        if (archive.id === activeArchiveId) {
          return updatedArchive;
        }
        return archive;
      });
      setArchiveList(updatedList);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "정기 분석에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColorClass = (status: RealityStatus) => {
    switch (status) {
      case RealityStatus.REALIZING: return "bg-status-realizing text-white";
      case RealityStatus.FADING: return "bg-status-fading text-white";
      case RealityStatus.DEBATING: return "bg-status-debating text-white";
      case RealityStatus.DEFUNCT: return "bg-status-defunct text-white";
      case RealityStatus.REALIZED: return "bg-status-realized text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIndicatorColorClass = (status: RealityStatus) => {
    switch (status) {
      case RealityStatus.REALIZING: return "bg-status-realizing";
      case RealityStatus.FADING: return "bg-status-fading";
      case RealityStatus.DEBATING: return "bg-status-debating";
      case RealityStatus.DEFUNCT: return "bg-status-defunct";
      case RealityStatus.REALIZED: return "bg-status-realized";
      default: return "bg-brand-500";
    }
  };

  const filteredArchiveList = publicArchiveList.filter((archive) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      archive.coreClaim.quote.toLowerCase().includes(query) ||
      archive.speaker.name.toLowerCase().includes(query) ||
      archive.speaker.organization.toLowerCase().includes(query) ||
      archive.evidence.sourceVenue.toLowerCase().includes(query)
    );
    const matchesTopic = activeTopic === "전체" || archive.newsCategory?.includes(activeTopic);
    return matchesSearch && matchesTopic;
  });

  const selectedArchive = archiveList.find((archive) => archive.id === activeArchiveId);

  return (
    <main className="bg-background">
        <div className={cn(
          "flex min-h-[420px] flex-col overflow-hidden",
          mobileView === "detail"
            ? "h-[100dvh]"
            : "h-[calc(100dvh-132px-env(safe-area-inset-top)-env(safe-area-inset-bottom))]"
        )}>
          <aside className={cn("h-full w-full shrink-0 flex-col bg-background", mobileView === "list" ? "flex" : "hidden")}>
            <div className="space-y-[13px] border-b border-border bg-card px-[18px] pb-[14px] pt-[16px]">
              <div className="flex items-end justify-between gap-[12px]">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-600">Board</p>
                  <h1 className="mt-[2px] text-[21px] font-black tracking-[-0.04em] text-foreground">오늘 확인할 발언</h1>
                </div>
                <span className="pb-[2px] text-[11px] font-bold text-muted-foreground">{filteredArchiveList.length}건</span>
              </div>
              <div className="relative">
                <Search className="absolute left-[12px] top-[11px] h-[16px] w-[16px] text-muted-foreground" />
                <Input
                  id="board-search"
                  type="text"
                  placeholder="인물, 키워드, 주제 검색"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-[38px] rounded-[9px] border-border bg-background pl-[36px] text-[12px] shadow-none"
                />
              </div>
              <div className="flex gap-[7px] overflow-x-auto pb-[1px] [scrollbar-width:none]">
                {["전체", "정치", "경제", "사회"].map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    aria-pressed={activeTopic === topic}
                    onClick={() => setActiveTopic(topic)}
                    className={cn(
                      "min-h-[36px] shrink-0 rounded-[8px] border px-[14px] text-[11px] font-extrabold transition-colors",
                      activeTopic === topic
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-border bg-card text-muted-foreground hover:border-brand-200"
                    )}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-[10px] overflow-y-auto px-[14px] py-[12px]">
              {filteredArchiveList.map((archive) => {
                const isSelected = archive.id === activeArchiveId;
                const isSaved = mySaved.has(archive.id);
                return (
                  <article
                    key={archive.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedArchiveId(archive.id);
                      setErrorMessage(null);
                      setMobileView("detail");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedArchiveId(archive.id);
                        setErrorMessage(null);
                        setMobileView("detail");
                      }
                    }}
                    className={cn(
                      "w-full cursor-pointer rounded-[14px] border bg-card px-[15px] py-[14px] text-left transition-colors",
                      isSelected ? "border-brand-500 ring-2 ring-brand-100" : "border-border hover:border-brand-200"
                    )}
                  >
                    <div className="flex items-start gap-[10px]">
                      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-extrabold text-white">
                        {archive.speaker.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-[5px]">
                          <strong className="truncate text-[12px] font-extrabold text-foreground">{archive.speaker.name}</strong>
                          <span className="inline-flex shrink-0 items-center gap-[3px] text-[9px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-[11px] w-[11px]" />
                            공식 출처 확인
                          </span>
                        </div>
                        <p className="mt-[1px] truncate text-[9px] text-muted-foreground">{archive.speaker.organization}</p>
                      </div>
                      <button
                        type="button"
                        aria-label={isSaved ? "내 헷제에서 제거" : "내 헷제에 저장"}
                        aria-pressed={isSaved}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSaved(archive.id);
                        }}
                        className={cn("flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[10px]", isSaved ? "bg-brand-50 text-brand-600" : "text-muted-foreground hover:bg-muted")}
                      >
                        <Bookmark className={cn("h-[17px] w-[17px]", isSaved && "fill-current")} />
                      </button>
                    </div>

                    <p className="mt-[11px] line-clamp-2 text-[14px] font-extrabold leading-[1.45] tracking-[-0.015em] text-foreground">
                      &quot;{archive.coreClaim.quote}&quot;
                    </p>
                    <p className="mt-[6px] line-clamp-2 text-[11px] leading-[1.55] text-muted-foreground">{archive.coreClaim.contextDescription}</p>

                    <div className="mt-[11px] flex items-center justify-between gap-[10px] border-t border-border/70 pt-[9px]">
                      <div className="flex min-w-0 items-center gap-[4px] text-[9px] text-muted-foreground">
                        <Clock className="h-[11px] w-[11px] shrink-0" aria-hidden="true" />
                        <time className="truncate" dateTime={archive.evidence.recordedAt}>{formatArchivePostedAt(archive.evidence.recordedAt)}</time>
                      </div>
                      <div className="flex shrink-0 items-center gap-[5px]">
                        {archive.newsCategory && <span className="rounded-[5px] bg-muted px-[6px] py-[3px] text-[9px] font-semibold text-muted-foreground">{archive.newsCategory}</span>}
                        <span className="rounded-[5px] bg-brand-50 px-[6px] py-[3px] text-[9px] font-bold text-brand-700">지수 {archive.realityMeter.currentIndex}</span>
                      </div>
                    </div>
                  </article>
                );
              })}

              {filteredArchiveList.length === 0 && (
                <div className="rounded-[14px] border border-dashed border-border bg-card py-[48px] text-center text-[12px] text-muted-foreground">
                  검색 조건에 맞는 발언이 없습니다.
                </div>
              )}
            </div>
          </aside>

        <section className={cn("h-full flex-1 flex-col overflow-hidden bg-background", mobileView === "detail" ? "flex" : "hidden")}>
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/95 px-[10px] backdrop-blur-lg">
            <Button
              variant="ghost"
              onClick={() => setMobileView("list")}
              aria-label="발언 목록으로 돌아가기"
              className="h-[48px] w-[48px] rounded-[10px] p-0 text-foreground"
            >
              <ArrowLeft className="h-[19px] w-[19px]" />
            </Button>
            <strong className="text-[14px] font-extrabold text-foreground">발언 상세</strong>
            <Button
              variant="ghost"
              onClick={() => setViralModalOpen(true)}
              aria-label="발언 공유"
              className="h-[48px] w-[48px] rounded-[10px] p-0 text-foreground"
            >
              <Share2 className="h-[18px] w-[18px]" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
          {errorMessage && (
            <div className="m-[24px] p-[16px] bg-red-50 text-red-600 rounded-[8px] border-[1px] border-red-200 text-[13px]">
              {errorMessage}
            </div>
          )}

          {selectedArchive ? (
            <div className="mx-auto max-w-[560px] space-y-[16px] p-[14px]">
              <div className="grid grid-cols-1 gap-[16px]">
                <div className="space-y-[16px]">
                  <Card className="overflow-hidden rounded-[14px] border-border shadow-none">
                    <CardContent className="p-[18px]">
                      <div className="flex items-center justify-between gap-[10px]">
                        <span className="inline-flex items-center gap-[5px] text-[10px] font-extrabold text-emerald-700">
                          <CheckCircle2 className="h-[14px] w-[14px]" />
                          공식 출처 확인
                        </span>
                        <span className={cn("rounded-[6px] px-[7px] py-[4px] text-[9px] font-extrabold", getStatusColorClass(selectedArchive.realityMeter.status))}>
                          {REALITY_STATUS_LABEL[selectedArchive.realityMeter.status].replace(/^[^\s]+\s/, "")}
                        </span>
                      </div>

                      <blockquote className="mt-[18px] text-[21px] font-black leading-[1.42] tracking-[-0.035em] text-foreground">
                        &quot;{selectedArchive.coreClaim.quote}&quot;
                      </blockquote>

                      <div className="mt-[20px] flex items-center gap-[12px] border-t border-border pt-[16px]">
                          {selectedArchive.speaker.imageUrl ? (
                            <div className="relative h-[44px] w-[44px] shrink-0 overflow-hidden rounded-full border border-border">
                              <Image
                                src={selectedArchive.speaker.imageUrl}
                                alt={selectedArchive.speaker.name}
                                className="object-cover"
                                fill
                                sizes="48px"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full bg-brand-600 text-[14px] font-extrabold text-white">
                              {selectedArchive.speaker.name.charAt(0)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-[6px]">
                              <span className="text-[13px] font-extrabold text-foreground">
                                {selectedArchive.speaker.name}
                              </span>
                            </div>
                            <div className="mt-[1px] truncate text-[10px] text-muted-foreground">
                              {selectedArchive.speaker.position}, {selectedArchive.speaker.organization}
                            </div>
                            <div className="mt-[4px] flex items-center gap-[4px] text-[9px] text-muted-foreground">
                              <Clock className="h-[12px] w-[12px]" aria-hidden="true" />
                              <time dateTime={selectedArchive.evidence.recordedAt}>
                                {formatArchivePostedAt(selectedArchive.evidence.recordedAt)}
                              </time>
                            </div>
                          </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-[14px] border-border shadow-none">
                    <CardHeader className="pb-[12px] border-b-[1px] border-border/50">
                      <div className="flex items-center gap-[8px] text-muted-foreground">
                        <AlertCircle className="w-[18px] h-[18px]" />
                        <CardTitle className="text-[14px] font-extrabold text-foreground">한 줄 요약</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-[16px]">
                      {selectedArchive.evidence.sourceUrl ? (
                        <a
                          href={selectedArchive.evidence.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-[13px] text-muted-foreground leading-relaxed hover:text-brand-600 transition-colors cursor-pointer"
                        >
                          {selectedArchive.coreClaim.contextDescription}
                        </a>
                      ) : (
                        <p className="text-[13px] text-muted-foreground leading-relaxed">
                          {selectedArchive.coreClaim.contextDescription}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-[12px]">
                    <CardHeader className="pb-[12px] border-b-[1px] border-border/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[15px] font-bold">사람들의 생각은 어떤가요?</CardTitle>
                        <Users className="w-[16px] h-[16px] text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-[16px] space-y-[16px]">
                      <p className="text-[12px] text-muted-foreground">
                        이 말이 진짜 이뤄지고 있는 것 같은지 아래 버튼을 눌러 알려주세요!
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-[8px]">
                        {(Object.keys(REALITY_STATUS_LABEL) as RealityStatus[]).map((status) => {
                          const userVoteCount = selectedArchive.userVotes?.[status] || 0;
                          return (
                            <button
                              key={status}
                              onClick={() => handleVote(status)}
                              className={cn(
                                "flex flex-col items-center justify-center p-[10px] rounded-[6px] border-[1px] transition-colors gap-[4px] text-center",
                                userVote === status
                                  ? "border-brand-500 bg-brand-50/50 text-brand-600 font-bold"
                                  : "border-border bg-card hover:bg-muted/40"
                              )}
                            >
                              <span className="text-[11px] font-semibold text-foreground">
                                {REALITY_STATUS_LABEL[status]}
                              </span>
                              <Badge variant="secondary" className="text-[10px] font-mono py-0 px-[4px] rounded-[3px]">
                                {userVoteCount}표
                              </Badge>
                            </button>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-[12px]">
                    <CardHeader className="pb-[12px] border-b-[1px] border-border/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[15px] font-bold">변화 타임라인</CardTitle>
                        <Clock className="w-[16px] h-[16px] text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-[20px] space-y-[24px]">
                      <div className="relative border-l-[2px] border-border/60 ml-[10px] pl-[20px] space-y-[24px]">
                        {selectedArchive.timeline.map((event) => (
                          <div key={event.id} className="relative group">
                            <div className={cn(
                              "absolute left-[-27px] top-[12px] w-[12px] h-[12px] rounded-full ring-[4px] ring-background z-10",
                              getStatusIndicatorColorClass(event.status)
                            )} />
                            {event.sourceUrl ? (
                              <a
                                href={event.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block space-y-[6px] hover:bg-muted/40 p-[8px] -m-[8px] rounded-[6px] transition-colors"
                              >
                                <div className="flex flex-wrap items-center gap-[6px] text-[11px]">
                                  <span className="font-semibold text-muted-foreground">
                                    {new Date(event.recordedAt).toLocaleDateString("ko-KR", {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric"
                                    })}
                                  </span>
                                  <span className="text-border">|</span>
                                  <span className="text-muted-foreground font-medium flex items-center gap-[2px]">
                                    <LinkIcon className="w-[10px] h-[10px]" />
                                    {event.sourceVenue}
                                  </span>
                                </div>
                                <h4 className="text-[13px] font-bold text-foreground flex items-center gap-[8px] group-hover:text-brand-600 transition-colors">
                                  {event.title}
                                  <Badge className={cn("text-[9px] py-0 px-[4px] rounded-[3px]", getStatusColorClass(event.status))}>
                                    팩트 지수 {event.realityIndex}%
                                  </Badge>
                                  {event.trajectory && (
                                    <Badge variant="outline" className="text-[9px] py-0 px-[4px] rounded-[3px] border-brand-300 text-brand-700 bg-brand-50">
                                      {REALIZATION_TRAJECTORY_LABEL[event.trajectory]}
                                    </Badge>
                                  )}
                                </h4>
                                <p className="text-[12px] text-muted-foreground leading-relaxed">
                                  {event.summary}
                                </p>
                              </a>
                            ) : (
                              <div className="space-y-[6px]">
                                <div className="flex flex-wrap items-center gap-[6px] text-[11px]">
                                  <span className="font-semibold text-muted-foreground">
                                    {new Date(event.recordedAt).toLocaleDateString("ko-KR", {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric"
                                    })}
                                  </span>
                                  <span className="text-border">|</span>
                                  <span className="text-muted-foreground font-medium flex items-center gap-[2px]">
                                    <LinkIcon className="w-[10px] h-[10px]" />
                                    {event.sourceVenue}
                                  </span>
                                </div>
                                <h4 className="text-[13px] font-bold text-foreground flex items-center gap-[8px]">
                                  {event.title}
                                  <Badge className={cn("text-[9px] py-0 px-[4px] rounded-[3px]", getStatusColorClass(event.status))}>
                                    팩트 지수 {event.realityIndex}%
                                  </Badge>
                                  {event.trajectory && (
                                    <Badge variant="outline" className="text-[9px] py-0 px-[4px] rounded-[3px] border-brand-300 text-brand-700 bg-brand-50">
                                      {REALIZATION_TRAJECTORY_LABEL[event.trajectory]}
                                    </Badge>
                                  )}
                                </h4>
                                <p className="text-[12px] text-muted-foreground leading-relaxed">
                                  {event.summary}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="pt-[16px] border-t-[1px] border-border/50">
                        <form onSubmit={handleAddTimelineItem} className="space-y-[12px]">
                          <div className="space-y-[4px]">
                            <label className="text-[12px] font-semibold text-foreground">관련된 새 뉴스 링크를 추가하세요</label>
                            <div className="flex gap-[8px]">
                              <Input
                                type="url"
                                placeholder="https://... 뉴스 URL 입력"
                                value={timelineUrl}
                                onChange={(event) => setTimelineUrl(event.target.value)}
                                className="rounded-[6px] h-[36px] flex-1 text-[12px]"
                                required
                              />
                              <Button
                                type="submit"
                                disabled={isTimelineLoading || !timelineUrl}
                                className="rounded-[6px] h-[36px] text-[12px] bg-brand-600 hover:bg-brand-700"
                              >
                                {isTimelineLoading ? (
                                  <Loader2 className="w-[14px] h-[14px] animate-spin" />
                                ) : (
                                  "추적하기"
                                )}
                              </Button>
                            </div>
                          </div>
                        </form>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-[16px] sm:space-y-[24px]">
                  <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden rounded-[12px]">
                    <div className={cn("absolute top-0 left-0 w-full h-[4px]", getStatusIndicatorColorClass(selectedArchive.realityMeter.status))} />
                    <CardHeader className="pb-[8px] pt-[16px]">
                      <CardTitle className="text-[15px] font-bold flex justify-between items-center">
                        AI 팩트 측정기
                        <Badge className={cn("rounded-[4px] text-[11px] py-[2px] px-[6px]", getStatusColorClass(selectedArchive.realityMeter.status))}>
                          {REALITY_STATUS_LABEL[selectedArchive.realityMeter.status]}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-[12px] space-y-[16px]">
                      <div>
                        <div className="flex items-baseline justify-between mb-[6px]">
                          <span className="text-[11px] text-muted-foreground font-semibold">AI 팩트 지수</span>
                          <span className="text-[20px] font-black tracking-tight text-foreground">
                            {selectedArchive.realityMeter.currentIndex}%
                          </span>
                        </div>
                        <Progress
                          value={selectedArchive.realityMeter.currentIndex}
                          className="h-[8px] rounded-[9999px]"
                          indicatorColorClass={getStatusIndicatorColorClass(selectedArchive.realityMeter.status)}
                        />
                      </div>

                      {(() => {
                        const totalVotes = Object.values(selectedArchive.userVotes || {}).reduce((accumulator, voteCount) => accumulator + voteCount, 0);
                        const currentVotes = selectedArchive.userVotes?.[selectedArchive.realityMeter.status] || 0;
                        const agreement = totalVotes > 0 ? Math.round((currentVotes / totalVotes) * 100) : 0;
                        return (
                          <div className="pt-[10px] border-t-[1px] border-border/40">
                            <div className="flex items-baseline justify-between mb-[6px]">
                              <span className="text-[11px] text-muted-foreground font-semibold">시민 감시단 동의율</span>
                              <span className="text-[16px] font-bold text-emerald-600">
                                {agreement}%
                              </span>
                            </div>
                            <Progress
                              value={agreement}
                              className="h-[6px] rounded-[9999px]"
                              indicatorColorClass="bg-emerald-500"
                            />
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 shadow-sm rounded-[12px]">
                    <CardHeader className="pb-[12px] border-b-[1px] border-border/50">
                      <CardTitle className="text-[14px] font-bold">자동 추적 설정</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-[16px] space-y-[12px]">
                      <div className="flex justify-between items-center text-[12px]">
                        <span className="text-muted-foreground font-medium">자동 체크 주기</span>
                        <span className="font-semibold text-foreground">
                          {selectedArchive.checkInterval === CheckInterval.DAILY ? "매일" : selectedArchive.checkInterval === CheckInterval.WEEKLY ? "매주" : "매월"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[12px]">
                        <span className="text-muted-foreground font-medium">추적 만료 일자</span>
                        <span className="font-semibold text-foreground">
                          {new Date(selectedArchive.expiryDate).toLocaleDateString("ko-KR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric"
                          })}
                        </span>
                      </div>
                      
                      <div className="pt-[4px]">
                        <span className="text-[11px] font-semibold text-muted-foreground block mb-[6px]">중간 강제 점검 목표일</span>
                        {selectedArchive.targetDates && selectedArchive.targetDates.length > 0 ? (
                          <div className="flex flex-wrap gap-[4px]">
                            {selectedArchive.targetDates.map((date) => (
                              <Badge key={date} variant="outline" className="text-[10px] rounded-[4px] py-0 px-[6px]">
                                {date}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/60 italic block">설정된 일자가 없습니다.</span>
                        )}
                      </div>

                      <div className="pt-[8px] border-t-[1px] border-border/50">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleSimulatePeriodicCheck}
                          disabled={isLoading}
                          className="w-full h-[32px] rounded-[6px] text-[11px]"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-[12px] h-[12px] mr-[4px] animate-spin" />
                              분석 실행 중...
                            </>
                          ) : (
                            <>
                              <Clock className="w-[12px] h-[12px] mr-[4px]" />
                              최신 소식 다시 확인하기
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 shadow-sm rounded-[12px] bg-gradient-to-br from-brand-50 to-brand-100/30 border-brand-100">
                    <CardHeader className="pb-[12px] border-b-[1px] border-brand-100/50">
                      <CardTitle className="text-[14px] font-bold text-brand-900">스마트 리포트</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-[16px] space-y-[12px]">
                      <p className="text-[11px] text-brand-900/70 leading-relaxed">
                        이 뉴스의 진행 상황과 사람들의 의견을 한눈에 보는 깔끔한 보고서로 만들었어요.
                      </p>
                      <Button
                        onClick={() => setReportModalOpen(true)}
                        className="w-full h-[36px] bg-brand-600 hover:bg-brand-700 text-white rounded-[6px] text-[12px]"
                      >
                        <FileText className="w-[14px] h-[14px] mr-[4px]" />
                        리포트 바로보기
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 shadow-sm rounded-[12px]">
                    <CardHeader className="pb-[12px] border-b-[1px] border-border/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[14px] font-bold">감시 기록 및 알림</CardTitle>
                        <Bell className="w-[14px] h-[14px] text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-[12px]">
                      <div className="space-y-[12px] max-h-[250px] overflow-y-auto pr-[4px]">
                        {selectedArchive.notificationLogs && selectedArchive.notificationLogs.length > 0 ? (
                          selectedArchive.notificationLogs.map((log) => (
                            <div key={log.id} className="text-[11px] space-y-[2px] leading-relaxed border-b-[1px] border-border/30 pb-[8px] last:border-0 last:pb-0">
                              <span className="text-muted-foreground/80 font-medium block">
                                {new Date(log.recordedAt).toLocaleString("ko-KR", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </span>
                              <span className="text-foreground/90 font-medium">
                                {(() => {
                                  const rawMessage = log.message;
                                  if (rawMessage.includes("기사 분석 완료:")) {
                                    return rawMessage.replace(/기사 분석 완료: 카테고리 \[(.*?)\], 최초 현실화 지수 \[(.*?)\%\]/, "첫 분석 완료: [$1] 소식이며, AI 팩트 지수 $2%로 추적을 시작합니다.");
                                  }
                                  if (rawMessage.includes("정기 AI 분석 실행: 관련 새로운 뉴스 기사 발견")) {
                                    return "새로운 관련 뉴스를 찾아 분석했습니다.";
                                  }
                                  if (rawMessage.includes("정기 AI 분석 결과 추가 변동 사항이 없습니다")) {
                                    return "최신 소식을 확인했지만 아직 새로운 변화는 없습니다.";
                                  }
                                  return rawMessage;
                                })()}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-[11px] text-muted-foreground/60 italic text-center py-[10px]">
                            로그가 비어있습니다.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 shadow-sm rounded-[12px]">
                    <CardHeader className="pb-[12px] border-b-[1px] border-border/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[14px] font-bold">집단지성 신뢰도 지표</CardTitle>
                        <Users className="w-[14px] h-[14px] text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-[16px]">
                      {(() => {
                        const totalVotes = Object.values(selectedArchive.userVotes || {}).reduce((sum, count) => sum + count, 0);
                        if (totalVotes === 0) {
                          return (
                            <div className="text-[11px] text-muted-foreground/60 italic text-center py-[20px]">
                              아직 시민 평가 투표가 없습니다. 위의 투표 버튼을 눌러 첫 의견을 남겨주십시오.
                            </div>
                          );
                        }

                        return (
                          <>
                            <div className="text-[11px] text-muted-foreground mb-[12px]">
                              참여 평가자 총 {totalVotes.toLocaleString()}명 실시간 투표 집계 기반
                            </div>
                            <div className="space-y-[12px]">
                              {(Object.keys(REALITY_STATUS_LABEL) as RealityStatus[])
                                .map((status) => {
                                  const count = selectedArchive.userVotes?.[status] || 0;
                                  const percentage = Math.round((count / totalVotes) * 100);
                                  return (
                                    <div key={status} className="space-y-[4px]">
                                      <div className="flex justify-between text-[11px]">
                                        <span className="font-semibold text-foreground">{REALITY_STATUS_LABEL[status]}</span>
                                        <span className="text-muted-foreground font-medium">{percentage}% ({count.toLocaleString()}명)</span>
                                      </div>
                                      <Progress
                                        value={percentage}
                                        className="h-[6px] bg-muted/50 rounded-[9999px]"
                                        indicatorColorClass={getStatusIndicatorColorClass(status)}
                                      />
                                    </div>
                                  );
                                })}
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] text-center px-[24px]">
              <Clock className="w-[48px] h-[48px] text-muted-foreground/50 mb-[16px] animate-spin-slow" />
              <h3 className="text-[16px] font-semibold text-foreground mb-[4px]">선택된 뉴스 없음</h3>
              <p className="text-[13px] text-muted-foreground max-w-[320px] leading-relaxed">
                좌측 목록에서 HETJE를 선택하거나, 우측 상단의 <b>＋ 새 HETJE</b> 버튼을 눌러 새로운 HETJE를 등록하세요.
              </p>
            </div>
          )}
          </div>

          {selectedArchive && (
            <div className="sticky bottom-0 z-20 grid grid-cols-[1fr_auto] gap-[8px] border-t border-border bg-card/97 px-[14px] pb-[calc(12px+env(safe-area-inset-bottom))] pt-[10px] backdrop-blur-xl">
              <Button
                type="button"
                aria-pressed={tracked.has(selectedArchive.id)}
                onClick={() => {
                  if (tracked.has(selectedArchive.id)) toggleTracked(selectedArchive.id);
                  else {
                    setTrackingInterval(selectedArchive.checkInterval ?? CheckInterval.WEEKLY);
                    setTrackingSheetOpen(true);
                  }
                }}
                className="h-[46px] gap-[7px] rounded-[10px] bg-brand-600 text-[12px] font-extrabold text-white shadow-none hover:bg-brand-700"
              >
                <Pin className={cn("h-[16px] w-[16px]", tracked.has(selectedArchive.id) && "fill-current")} />
                {tracked.has(selectedArchive.id) ? "Tomorrow 추가됨" : "Tomorrow에 추가"}
              </Button>
              {selectedArchive.evidence.sourceUrl && (
                <a
                  href={selectedArchive.evidence.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="원본 컨텐츠 보기"
                  className="inline-flex h-[46px] min-w-[48px] items-center justify-center gap-[6px] rounded-[10px] border border-brand-200 px-[13px] text-[11px] font-extrabold text-brand-600"
                >
                  <LinkIcon className="h-[17px] w-[17px]" />
                  <span className="hidden min-[390px]:inline">원본 컨텐츠</span>
                </a>
              )}
            </div>
          )}
        </section>
      </div>

      {trackingSheetOpen && selectedArchive && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45" role="presentation" onClick={() => setTrackingSheetOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracking-sheet-title"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[560px] rounded-t-[22px] bg-card px-[18px] pb-[calc(18px+env(safe-area-inset-bottom))] pt-[9px] shadow-[0_-18px_50px_rgba(15,23,42,0.18)]"
          >
            <div className="mx-auto h-[4px] w-[38px] rounded-full bg-slate-300" />
            <div className="mt-[12px] flex items-start justify-between gap-[12px]">
              <div>
                <h2 id="tracking-sheet-title" className="text-[19px] font-black tracking-[-0.03em] text-foreground">어떻게 추적할까요?</h2>
                <p className="mt-[4px] text-[11px] text-muted-foreground">변화가 생기면 선택한 주기에 맞춰 정리합니다.</p>
              </div>
              <button type="button" aria-label="추적 설정 닫기" onClick={() => setTrackingSheetOpen(false)} className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted">
                <X className="h-[19px] w-[19px]" />
              </button>
            </div>

            <div className="mt-[18px] space-y-[9px]">
              {[
                { value: CheckInterval.DAILY, title: "새로운 변화가 있을 때", description: "주요 변화가 생길 때마다 알림", icon: Radio },
                { value: CheckInterval.WEEKLY, title: "매일 한 번 요약", description: "하루의 변화를 한 번에 정리", icon: CalendarDays },
                { value: CheckInterval.MONTHLY, title: "주간 리포트", description: "매주 핵심 흐름을 요약", icon: ListChecks },
              ].map((option) => {
                const Icon = option.icon;
                const selected = trackingInterval === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTrackingInterval(option.value)}
                    className={cn(
                      "flex min-h-[64px] w-full items-center gap-[12px] rounded-[11px] border px-[13px] text-left transition-colors",
                      selected ? "border-brand-500 bg-brand-50" : "border-border bg-card hover:border-brand-200"
                    )}
                  >
                    <Icon className={cn("h-[20px] w-[20px] shrink-0", selected ? "text-brand-600" : "text-muted-foreground")} />
                    <span className="min-w-0 flex-1">
                      <strong className="block text-[12px] font-extrabold text-foreground">{option.title}</strong>
                      <span className="mt-[2px] block text-[10px] text-muted-foreground">{option.description}</span>
                    </span>
                    {selected && <span className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-brand-600 text-white"><Check className="h-[13px] w-[13px]" /></span>}
                  </button>
                );
              })}
            </div>

            <div className="mt-[14px] flex min-h-[56px] items-center justify-between rounded-[11px] border border-border px-[13px]">
              <div>
                <strong className="block text-[12px] font-extrabold text-foreground">중요 변화만 알림</strong>
                <span className="mt-[2px] block text-[10px] text-muted-foreground">영향도가 높은 변화만 알려드려요.</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={importantOnly}
                onClick={() => setImportantOnly((current) => !current)}
                className={cn("relative h-[28px] w-[48px] rounded-full transition-colors", importantOnly ? "bg-brand-600" : "bg-slate-300")}
              >
                <span className={cn("absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-transform", importantOnly ? "translate-x-[23px]" : "translate-x-[3px]")} />
              </button>
            </div>

            <Button
              type="button"
              onClick={() => {
                setArchiveList((current) => current.map((archive) => archive.id === selectedArchive.id ? { ...archive, checkInterval: trackingInterval } : archive));
                if (!tracked.has(selectedArchive.id)) toggleTracked(selectedArchive.id);
                setTrackingSheetOpen(false);
              }}
              className="mt-[16px] h-[48px] w-full rounded-[10px] bg-brand-600 text-[13px] font-extrabold text-white shadow-none hover:bg-brand-700"
            >
              Tomorrow에 추가
            </Button>
          </div>
        </div>
      )}

      {reportModalOpen && selectedArchive && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-[16px] overflow-y-auto no-print">
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              body, html {
                background: white !important;
                color: black !important;
              }
              main, header, aside, section, .no-print {
                display: none !important;
              }
              #print-area {
                display: block !important;
                position: absolute;
                left: 0;
                top: 0;
                width: 100% !important;
                padding: 40px !important;
                box-sizing: border-box;
              }
            }
          `}} />
          <div className="bg-card w-full max-w-[800px] rounded-[12px] border-[1px] border-border shadow-lg overflow-hidden my-[40px]">
            <div className="p-[20px] border-b-[1px] border-border flex items-center justify-between bg-muted/20">
              <h2 className="text-[16px] font-bold text-foreground">AI 신호 분석 보고서 미리보기</h2>
              <div className="flex items-center gap-[8px]">
                <Button
                  onClick={() => window.print()}
                  className="bg-brand-600 hover:bg-brand-700 text-white rounded-[6px] text-[12px] h-[32px]"
                >
                  출력 / PDF 저장
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReportModalOpen(false)}
                  className="rounded-[6px] text-[12px] h-[32px]"
                >
                  닫기
                </Button>
              </div>
            </div>

            <div className="p-[16px] sm:p-[40px] overflow-y-auto max-h-[70vh] bg-white text-slate-900 font-sans" id="print-area">
              <div className="border-[1px] sm:border-[2px] border-slate-900 p-[16px] sm:p-[24px] space-y-[24px]">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-b-[2px] border-slate-900 pb-[16px] gap-[12px]">
                  <div>
                    <span className="text-[10px] sm:text-[11px] font-mono text-slate-500 uppercase tracking-wider block">HEZZE NEWS ANALYSIS REPORT</span>
                    <h1 className="text-[18px] sm:text-[22px] font-extrabold text-slate-900 tracking-tight mt-[4px]">뉴스 분석 보고서</h1>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 block">보고서 번호: {selectedArchive.referenceNumber}</span>
                    <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 block">발행 일자: {new Date().toLocaleDateString("ko-KR")}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-[12px] sm:gap-[16px] text-[12px] border-b-[1px] border-slate-200 pb-[16px]">
                  <div>
                    <span className="font-bold text-slate-500 block">뉴스 분류</span>
                    <span className="font-semibold text-slate-900 mt-[2px] block">{selectedArchive.category === "ENTRY.QUOTE" ? "핵심 발언" : "공약 약속"}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">뉴스 카테고리</span>
                    <span className="font-semibold text-slate-900 mt-[2px] block">{selectedArchive.newsCategory}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500 block">현재 리얼리티 지수</span>
                    <span className="font-bold text-brand-600 mt-[2px] block">{selectedArchive.realityMeter.currentIndex}% ({REALITY_STATUS_LABEL[selectedArchive.realityMeter.status]})</span>
                  </div>
                </div>

                <div className="space-y-[8px]">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider border-l-[3px] border-slate-900 pl-[8px]">1. 핵심 주장 및 신호 정보</h3>
                  <blockquote className="bg-slate-50 border-l-[4px] border-slate-300 p-[16px] text-[14px] italic font-medium text-slate-800 leading-relaxed">
                    &quot;{selectedArchive.coreClaim.quote}&quot;
                  </blockquote>
                  <div className="text-[12px] text-slate-700 mt-[8px]">
                    <span className="font-bold">대상 인물:</span> {selectedArchive.speaker.name} ({selectedArchive.speaker.position}, {selectedArchive.speaker.organization})
                  </div>
                </div>

                <div className="space-y-[8px]">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider border-l-[3px] border-slate-900 pl-[8px]">2. 요약 및 맥락 분석</h3>
                  <p className="text-[12px] text-slate-700 leading-relaxed bg-slate-50 p-[16px] rounded-[6px]">
                    {selectedArchive.coreClaim.contextDescription}
                  </p>
                </div>

                <div className="space-y-[12px]">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider border-l-[3px] border-slate-900 pl-[8px]">3. 현실화 추적 연대기 (진행 경과)</h3>
                  <div className="border-[1px] border-slate-200 rounded-[6px] overflow-hidden overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px] min-w-[500px]">
                      <thead>
                        <tr className="bg-slate-50 border-b-[1px] border-slate-200">
                          <th className="p-[10px] font-bold text-slate-700 w-[100px]">기록일</th>
                          <th className="p-[10px] font-bold text-slate-700 w-[120px]">출처</th>
                          <th className="p-[10px] font-bold text-slate-700">사건 제목 및 분석 내용</th>
                          <th className="p-[10px] font-bold text-slate-700 w-[80px] text-right">판정 지수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedArchive.timeline.map((event) => (
                          <tr key={event.id} className="border-b-[1px] border-slate-100 last:border-0 hover:bg-slate-50/50">
                            <td className="p-[10px] text-slate-600 font-medium">{new Date(event.recordedAt).toLocaleDateString("ko-KR")}</td>
                            <td className="p-[10px] text-slate-600 font-bold">{event.sourceVenue}</td>
                            <td className="p-[10px] space-y-[4px]">
                              <div className="font-bold text-slate-900">{event.title}</div>
                              <div className="text-slate-600 leading-relaxed text-[10px]">{event.summary}</div>
                            </td>
                            <td className="p-[10px] text-slate-900 font-bold text-right">{event.realityIndex}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-[8px] border-t-[1px] border-slate-200 pt-[16px]">
                  <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wider border-l-[3px] border-slate-900 pl-[8px]">4. 집단지성 신뢰도 분포</h3>
                  {(() => {
                    const totalVotes = Object.values(selectedArchive.userVotes || {}).reduce((sum, count) => sum + count, 0);
                    if (totalVotes === 0) {
                      return <div className="text-[11px] text-slate-500 italic p-[10px]">등록된 시민 평가단 투표가 없습니다.</div>;
                    }
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[8px] sm:gap-[12px] bg-slate-50 p-[16px] rounded-[6px]">
                            {(Object.keys(REALITY_STATUS_LABEL) as RealityStatus[])
                              .filter((status) => (selectedArchive.userVotes?.[status] || 0) > 0)
                              .map((status) => {
                                const count = selectedArchive.userVotes?.[status] || 0;
                                const percentage = Math.round((count / totalVotes) * 100);
                            return (
                              <div key={status} className="flex justify-between items-center text-[11px] border-b-[1px] border-slate-200/60 pb-[4px] last:border-0">
                                <span className="font-bold text-slate-700">{REALITY_STATUS_LABEL[status]}</span>
                                <span className="font-mono text-slate-900">{percentage}% ({count}명)</span>
                              </div>
                            );
                          })}
                      </div>
                    );
                  })()}
                </div>

                <div className="text-center pt-[24px] border-t-[2px] border-slate-900 text-slate-500 text-[10px] font-mono">
                  HEZZE NEWS ANALYSIS ENGINE • AUTOMATICALLY GENERATED DOCUMENT
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ViralShareModal
        isOpen={viralModalOpen}
        onClose={() => setViralModalOpen(false)}
        archive={selectedArchive || null}
      />
    </main>
  );
}
