"use client";

import { useState, useEffect } from "react";
import { REALITY_STATUS_LABEL, RealityStatus, ArchiveReference, CheckInterval } from "@/domains/archive/model/archive.model";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FileText, AlertCircle, Link as LinkIcon, Users, Loader2, Search, Plus, Trash2, Bell, Clock } from "lucide-react";
import { analyzeNewsUrl, analyzeTimelineUpdate } from "@/domains/archive/api/analyze.action";

export default function ArchiveDashboard() {
  const [archiveList, setArchiveList] = useState<ArchiveReference[]>(() => {
    if (typeof window !== "undefined") {
      const savedArchives = localStorage.getItem("hezze_archives");
      if (savedArchives) {
        try {
          return JSON.parse(savedArchives) as ArchiveReference[];
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const savedArchives = localStorage.getItem("hezze_archives");
      if (savedArchives) {
        try {
          const parsed = JSON.parse(savedArchives) as ArchiveReference[];
          if (parsed.length > 0) {
            return parsed[0].id;
          }
        } catch {
          return null;
        }
      }
    }
    return null;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [inputUrl, setInputUrl] = useState("");
  const [checkInterval, setCheckInterval] = useState<CheckInterval>(CheckInterval.WEEKLY);
  const [expiryDate, setExpiryDate] = useState("");
  const [targetDates, setTargetDates] = useState<string[]>([]);
  const [newTargetDate, setNewTargetDate] = useState("");

  const [timelineUrl, setTimelineUrl] = useState("");
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedArchives = localStorage.getItem("hezze_archives");
      if (!savedArchives) {
        localStorage.setItem("hezze_archives", JSON.stringify([]));
      }
    }
  }, []);

  const handleCreateArchive = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inputUrl.trim()) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const newArchive = await analyzeNewsUrl(
        inputUrl,
        checkInterval,
        expiryDate,
        targetDates
      );
      const updatedList = [newArchive, ...archiveList];
      setArchiveList(updatedList);
      localStorage.setItem("hezze_archives", JSON.stringify(updatedList));
      setSelectedArchiveId(newArchive.id);
      setIsCreating(false);
      setInputUrl("");
      setCheckInterval(CheckInterval.WEEKLY);
      setExpiryDate("");
      setTargetDates([]);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTimelineItem = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!timelineUrl.trim() || !selectedArchiveId) return;

    const currentArchive = archiveList.find((archive) => archive.id === selectedArchiveId);
    if (!currentArchive) return;

    try {
      setIsTimelineLoading(true);
      setErrorMessage(null);
      const { timelineItem, updatedRealityIndex, updatedStatus } = await analyzeTimelineUpdate(
        currentArchive,
        timelineUrl
      );

      const updatedList = archiveList.map((archive) => {
        if (archive.id === selectedArchiveId) {
          const newNotificationLog = {
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
      localStorage.setItem("hezze_archives", JSON.stringify(updatedList));
      setTimelineUrl("");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "타임라인 분석 중 오류가 발생했습니다.");
    } finally {
      setIsTimelineLoading(false);
    }
  };

  const handleVote = (status: RealityStatus) => {
    if (!selectedArchiveId) return;
    const updatedList = archiveList.map((archive) => {
      if (archive.id === selectedArchiveId) {
        const currentVotes = { ...archive.userVotes };
        currentVotes[status] = (currentVotes[status] || 0) + 1;

        const currentDistribution = { ...archive.observationStats.distribution };
        currentDistribution[status] = (currentDistribution[status] || 0) + 1;

        const newTotalObservers = archive.observationStats.totalObservers + 1;

        return {
          ...archive,
          userVotes: currentVotes,
          observationStats: {
            totalObservers: newTotalObservers,
            distribution: currentDistribution,
          },
        };
      }
      return archive;
    });
    setArchiveList(updatedList);
    localStorage.setItem("hezze_archives", JSON.stringify(updatedList));
  };

  const handleSimulatePeriodicCheck = () => {
    if (!selectedArchiveId) return;
    const updatedList = archiveList.map((archive) => {
      if (archive.id === selectedArchiveId) {
        const labelText = archive.checkInterval === CheckInterval.DAILY ? "매일" : archive.checkInterval === CheckInterval.WEEKLY ? "매주" : "매월";
        const newNotificationLog = {
          id: "log-" + Date.now(),
          recordedAt: new Date().toISOString(),
          message: `${labelText} 정기 AI 분석 스케줄이 수동으로 촉발되었습니다. 추가 변동 사항이 없습니다.`,
        };
        return {
          ...archive,
          notificationLogs: [newNotificationLog, ...archive.notificationLogs],
        };
      }
      return archive;
    });
    setArchiveList(updatedList);
    localStorage.setItem("hezze_archives", JSON.stringify(updatedList));
  };

  const handleAddTargetDate = () => {
    if (!newTargetDate) return;
    if (!targetDates.includes(newTargetDate)) {
      setTargetDates([...targetDates, newTargetDate]);
    }
    setNewTargetDate("");
  };

  const handleRemoveTargetDate = (dateToRemove: string) => {
    setTargetDates(targetDates.filter((date) => date !== dateToRemove));
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

  const filteredArchiveList = archiveList.filter((archive) => {
    const query = searchQuery.toLowerCase();
    return (
      archive.coreClaim.quote.toLowerCase().includes(query) ||
      archive.speaker.name.toLowerCase().includes(query) ||
      archive.speaker.organization.toLowerCase().includes(query)
    );
  });

  const selectedArchive = archiveList.find((archive) => archive.id === selectedArchiveId);

  return (
    <main className="min-h-screen bg-background font-sans">
      <header className="border-b-[1px] border-border bg-card px-[24px] py-[16px]">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <Clock className="w-[24px] h-[24px] text-brand-600 animate-pulse" />
            <h1 className="text-[20px] font-bold tracking-tight text-foreground">
              헷제 기업 구매 신호 아카이버
            </h1>
          </div>
          <Button 
            size="sm" 
            onClick={() => {
              setIsCreating(true);
              setSelectedArchiveId(null);
            }}
            className="rounded-[6px] text-[13px] bg-brand-600 hover:bg-brand-700"
          >
            <Plus className="w-[16px] h-[16px] mr-[4px]" />
            신규 시그널 추적
          </Button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row h-[calc(100vh-73px)] overflow-hidden">
        <aside className="w-full lg:w-[380px] shrink-0 border-r-[1px] border-border bg-card flex flex-col h-full">
          <div className="p-[16px] border-b-[1px] border-border space-y-[12px]">
            <div className="relative">
              <Search className="absolute left-[12px] top-[10px] w-[16px] h-[16px] text-muted-foreground" />
              <Input
                type="text"
                placeholder="인물, 소속, 발언 검색..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-[36px] h-[36px] rounded-[6px] text-[13px]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y-[1px] divide-border/60">
            {filteredArchiveList.map((archive) => {
              const isSelected = archive.id === selectedArchiveId;
              return (
                <button
                  key={archive.id}
                  onClick={() => {
                    setSelectedArchiveId(archive.id);
                    setIsCreating(false);
                    setErrorMessage(null);
                  }}
                  className={cn(
                    "w-full text-left p-[16px] transition-colors flex flex-col gap-[8px]",
                    isSelected ? "bg-brand-50/70 border-l-[3px] border-brand-600 pl-[13px]" : "hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-[8px]">
                    <div className="flex items-center gap-[4px]">
                      <Badge variant="outline" className="text-[10px] py-0 px-[6px] rounded-[4px]">
                        {archive.category === "ENTRY.QUOTE" ? "핵심 발언" : "공약 약속"}
                      </Badge>
                      {archive.newsCategory && (
                        <Badge variant="secondary" className="text-[10px] py-0 px-[6px] rounded-[4px] bg-brand-50 text-brand-600 border-brand-100">
                          {archive.newsCategory}
                        </Badge>
                      )}
                    </div>
                    <Badge className={cn("text-[10px] py-[2px] px-[6px] rounded-[4px]", getStatusColorClass(archive.realityMeter.status))}>
                      {REALITY_STATUS_LABEL[archive.realityMeter.status]}
                    </Badge>
                  </div>
                  
                  <p className="text-[13px] font-medium text-foreground line-clamp-2 leading-relaxed">
                    &quot;{archive.coreClaim.quote}&quot;
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-[4px]">
                    <span className="font-semibold text-foreground/80">
                      {archive.speaker.name} ({archive.speaker.organization})
                    </span>
                    <span className="font-bold text-brand-600">
                      리얼리티 {archive.realityMeter.currentIndex}%
                    </span>
                  </div>
                </button>
              );
            })}

            {filteredArchiveList.length === 0 && (
              <div className="py-[40px] text-center text-muted-foreground text-[13px]">
                검색 조건에 맞는 시그널이 없습니다.
              </div>
            )}
          </div>
        </aside>

        <section className="flex-1 overflow-y-auto bg-muted/20 h-full">
          {errorMessage && (
            <div className="m-[24px] p-[16px] bg-red-50 text-red-600 rounded-[8px] border-[1px] border-red-200 text-[13px]">
              {errorMessage}
            </div>
          )}

          {isCreating ? (
            <div className="max-w-[700px] mx-auto my-[40px] px-[24px]">
              <Card className="border-border/60 shadow-md rounded-[12px]">
                <CardHeader className="border-b-[1px] border-border/50 pb-[16px]">
                  <CardTitle className="text-[18px] font-bold">새로운 뉴스 시그널 등록 및 스케줄 설정</CardTitle>
                </CardHeader>
                <CardContent className="pt-[24px] space-y-[20px]">
                  <form onSubmit={handleCreateArchive} className="space-y-[20px]">
                    <div className="space-y-[6px]">
                      <label className="text-[13px] font-semibold text-foreground">뉴스 기사 URL</label>
                      <Input
                        type="url"
                        placeholder="https://news.example.com/article/123"
                        value={inputUrl}
                        onChange={(event) => setInputUrl(event.target.value)}
                        className="rounded-[6px] h-[40px]"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
                      <div className="space-y-[6px]">
                        <label className="text-[13px] font-semibold text-foreground">AI 현실성 체크 주기</label>
                        <select
                          value={checkInterval}
                          onChange={(event) => setCheckInterval(event.target.value as CheckInterval)}
                          className="w-full h-[40px] border-[1px] border-input rounded-[6px] px-[12px] bg-background text-[13px] focus:outline-none focus:ring-[2px] focus:ring-ring"
                        >
                          <option value={CheckInterval.DAILY}>매일</option>
                          <option value={CheckInterval.WEEKLY}>매주</option>
                          <option value={CheckInterval.MONTHLY}>매월</option>
                        </select>
                      </div>

                      <div className="space-y-[6px]">
                        <label className="text-[13px] font-semibold text-foreground">감시 종료(만료) 일자</label>
                        <Input
                          type="date"
                          value={expiryDate}
                          onChange={(event) => setExpiryDate(event.target.value)}
                          className="rounded-[6px] h-[40px] text-[13px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-[8px]">
                      <label className="text-[13px] font-semibold text-foreground flex items-center justify-between">
                        <span>특정 점검 일자 추가</span>
                        <span className="text-[11px] text-muted-foreground font-normal">중간 점검이 강제되는 특별 일정을 지정합니다.</span>
                      </label>
                      <div className="flex gap-[8px]">
                        <Input
                          type="date"
                          value={newTargetDate}
                          onChange={(event) => setNewTargetDate(event.target.value)}
                          className="rounded-[6px] h-[36px] flex-1 text-[13px]"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAddTargetDate}
                          className="h-[36px] rounded-[6px]"
                        >
                          추가
                        </Button>
                      </div>

                      {targetDates.length > 0 && (
                        <div className="flex flex-wrap gap-[6px] pt-[6px]">
                          {targetDates.map((date) => (
                            <Badge key={date} variant="secondary" className="flex items-center gap-[4px] py-[3px] px-[8px] rounded-[4px] text-[11px]">
                              {date}
                              <button
                                type="button"
                                onClick={() => handleRemoveTargetDate(date)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Trash2 className="w-[12px] h-[12px]" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-[12px] pt-[8px] border-t-[1px] border-border/50">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setIsCreating(false);
                          if (archiveList.length > 0) {
                            setSelectedArchiveId(archiveList[0].id);
                          }
                        }}
                        className="rounded-[6px] h-[40px] text-[13px]"
                      >
                        취소
                      </Button>
                      <Button
                        type="submit"
                        disabled={isLoading || !inputUrl}
                        className="rounded-[6px] h-[40px] text-[13px] bg-brand-600 hover:bg-brand-700"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-[16px] h-[16px] mr-[6px] animate-spin" />
                            뉴스 분석 및 설정 중...
                          </>
                        ) : (
                          "추적 시작하기"
                        )}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          ) : selectedArchive ? (
            <div className="max-w-[1000px] mx-auto p-[24px] space-y-[24px]">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-[24px]">
                <div className="lg:col-span-2 space-y-[24px]">
                  <Card className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-[12px]">
                    <CardHeader className="bg-muted/30 border-b-[1px] border-border/50 pb-[12px]">
                      <div className="flex items-center gap-[8px] text-brand-600">
                        <FileText className="w-[18px] h-[18px]" />
                        <CardTitle className="text-[15px] font-bold">핵심 주장 및 신호 정보</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-[24px]">
                      <blockquote className="border-l-[4px] border-brand-500 pl-[16px] italic text-[18px] font-medium leading-relaxed text-foreground mb-[24px]">
                        &quot;{selectedArchive.coreClaim.quote}&quot;
                      </blockquote>

                      <div className="flex items-center gap-[12px] pt-[16px] border-t-[1px] border-border">
                        <div className="relative w-[48px] h-[48px] rounded-full overflow-hidden border-[1px] border-border">
                          <img
                            src={selectedArchive.speaker.imageUrl}
                            alt={selectedArchive.speaker.name}
                            className="object-cover w-full h-full"
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground text-[14px]">
                            {selectedArchive.speaker.name}
                          </div>
                          <div className="text-[12px] text-muted-foreground">
                            {selectedArchive.speaker.position}, {selectedArchive.speaker.organization}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-[12px]">
                    <CardHeader className="pb-[12px] border-b-[1px] border-border/50">
                      <div className="flex items-center gap-[8px] text-muted-foreground">
                        <AlertCircle className="w-[18px] h-[18px]" />
                        <CardTitle className="text-[15px] font-bold text-foreground">상세 요약 및 맥락 분석</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-[16px]">
                      <p className="text-[13px] text-muted-foreground leading-relaxed">
                        {selectedArchive.coreClaim.contextDescription}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-[12px]">
                    <CardHeader className="pb-[12px] border-b-[1px] border-border/50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[15px] font-bold">시민 평가단 피드백</CardTitle>
                        <Users className="w-[16px] h-[16px] text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-[16px] space-y-[16px]">
                      <p className="text-[12px] text-muted-foreground">
                        현재 이 발언의 현실화 진행도에 대해 투표해 주세요. 집단 지성을 통한 관측 신뢰도 평가에 반영됩니다.
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-[8px]">
                        {(Object.keys(REALITY_STATUS_LABEL) as RealityStatus[]).map((status) => {
                          const userVoteCount = selectedArchive.userVotes?.[status] || 0;
                          return (
                            <button
                              key={status}
                              onClick={() => handleVote(status)}
                              className="flex flex-col items-center justify-center p-[10px] rounded-[6px] border-[1px] border-border bg-card hover:bg-muted/40 transition-colors gap-[4px] text-center"
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
                        <CardTitle className="text-[15px] font-bold">현실화 추적 연대기</CardTitle>
                        <Clock className="w-[16px] h-[16px] text-muted-foreground" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-[20px] space-y-[24px]">
                      <div className="relative border-l-[2px] border-border/60 ml-[10px] pl-[20px] space-y-[24px]">
                        {selectedArchive.timeline.map((event) => (
                          <div key={event.id} className="relative">
                            <div className={cn(
                              "absolute left-[-27px] top-[4px] w-[12px] h-[12px] rounded-full ring-[4px] ring-background",
                              getStatusIndicatorColorClass(event.status)
                            )} />
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
                                {event.sourceUrl && (
                                  <a
                                    href={event.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-brand-600 hover:underline inline-flex items-center gap-[2px]"
                                  >
                                    기사 보기
                                  </a>
                                )}
                              </div>
                              <h4 className="text-[13px] font-bold text-foreground flex items-center gap-[8px]">
                                {event.title}
                                <Badge className={cn("text-[9px] py-0 px-[4px] rounded-[3px]", getStatusColorClass(event.status))}>
                                  리얼리티 {event.realityIndex}%
                                </Badge>
                              </h4>
                              <p className="text-[12px] text-muted-foreground leading-relaxed">
                                {event.summary}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-[16px] border-t-[1px] border-border/50">
                        <form onSubmit={handleAddTimelineItem} className="space-y-[12px]">
                          <div className="space-y-[4px]">
                            <label className="text-[12px] font-semibold text-foreground">AI 점검 실행 (관련 뉴스 기사 추가 분석)</label>
                            <div className="flex gap-[8px]">
                              <Input
                                type="url"
                                placeholder="추적할 관련 뉴스 기사 URL을 입력하십시오..."
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
                                  "분석"
                                )}
                              </Button>
                            </div>
                          </div>
                        </form>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-[24px]">
                  <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 relative overflow-hidden rounded-[12px]">
                    <div className={cn("absolute top-0 left-0 w-full h-[4px]", getStatusIndicatorColorClass(selectedArchive.realityMeter.status))} />
                    <CardHeader className="pb-[8px] pt-[16px]">
                      <CardTitle className="text-[15px] font-bold flex justify-between items-center">
                        현실화 측정기
                        <Badge className={cn("rounded-[4px] text-[11px] py-[2px] px-[6px]", getStatusColorClass(selectedArchive.realityMeter.status))}>
                          {REALITY_STATUS_LABEL[selectedArchive.realityMeter.status]}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-[12px]">
                      <div className="flex items-baseline gap-[4px] mb-[12px]">
                        <span className="text-[32px] font-bold tracking-tighter text-foreground">
                          {selectedArchive.realityMeter.currentIndex}%
                        </span>
                        <span className="text-[11px] text-muted-foreground font-semibold">현실화 진행도</span>
                      </div>
                      <Progress
                        value={selectedArchive.realityMeter.currentIndex}
                        className="h-[8px] rounded-[9999px]"
                        indicatorColorClass={getStatusIndicatorColorClass(selectedArchive.realityMeter.status)}
                      />
                    </CardContent>
                  </Card>

                  <Card className="border-border/50 shadow-sm rounded-[12px]">
                    <CardHeader className="pb-[12px] border-b-[1px] border-border/50">
                      <CardTitle className="text-[14px] font-bold">감시 스케줄링 설정</CardTitle>
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
                          className="w-full h-[32px] rounded-[6px] text-[11px]"
                        >
                          <Clock className="w-[12px] h-[12px] mr-[4px]" />
                          정기 분석 강제 기동 (시뮬레이션)
                        </Button>
                      </div>
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
                              <span className="text-foreground/90 font-medium">{log.message}</span>
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
                              {(Object.entries(selectedArchive.userVotes) as [RealityStatus, number][])
                                .sort((a, b) => b[1] - a[1])
                                .map(([status, count]) => {
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
              <h3 className="text-[16px] font-semibold text-foreground mb-[4px]">선택된 시그널 없음</h3>
              <p className="text-[13px] text-muted-foreground max-w-[320px] leading-relaxed">
                좌측 목록에서 시그널을 선택하거나, 우측 상단의 신규 시그널 추적 버튼을 눌러 새로운 감시 일정을 등록하십시오.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
