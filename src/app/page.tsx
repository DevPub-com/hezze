"use client";

import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { REALITY_STATUS_LABEL, RealityStatus, ArchiveReference, CheckInterval, NotificationLog } from "@/domains/archive/model/archive.model";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FileText, AlertCircle, Link as LinkIcon, Users, Loader2, Search, Plus, Trash2, Bell, Clock, ArrowLeft } from "lucide-react";
import { analyzeNewsUrl, analyzeTimelineUpdate, fetchArchivesList, updateVote, purgeAllArchives, fetchUserVote } from "@/domains/archive/api/analyze.action";

export default function ArchiveDashboard() {
  const [archiveList, setArchiveList] = useState<ArchiveReference[]>([]);
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const [user, setUser] = useState<User | null>(null);
  const [userVote, setUserVote] = useState<RealityStatus | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  const [reportModalOpen, setReportModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [inputUrl, setInputUrl] = useState("");
  const [checkInterval, setCheckInterval] = useState<CheckInterval>(CheckInterval.WEEKLY);
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0];
  });
  const [targetDates, setTargetDates] = useState<string[]>([]);
  const [newTargetDate, setNewTargetDate] = useState("");

  const [timelineUrl, setTimelineUrl] = useState("");
  const [isTimelineLoading, setIsTimelineLoading] = useState(false);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setIsLoading(true);
        const list = await fetchArchivesList();
        setArchiveList(list);
        if (list.length > 0) {
          setSelectedArchiveId(list[0].id);
        }
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : "데이터 로드에 실패했습니다.");
      } finally {
        setIsLoading(false);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadUserVote() {
      if (!selectedArchiveId || !user) {
        setUserVote(null);
        return;
      }
      try {
        const vote = await fetchUserVote(selectedArchiveId, user.id);
        setUserVote(vote);
      } catch {
        setUserVote(null);
      }
    }
    loadUserVote();
  }, [selectedArchiveId, user]);

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    try {
      setIsLoading(true);
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
        alert("가입 성공! 로그인되었습니다.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) throw error;
      }
      setAuthModalOpen(false);
      setAuthEmail("");
      setAuthPassword("");
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "인증 처리 실패");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUserVote(null);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : "로그아웃 실패");
    }
  };

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
      setSelectedArchiveId(newArchive.id);
      setMobileView("detail");
      setIsCreating(false);
      setInputUrl("");
      setCheckInterval(CheckInterval.WEEKLY);
      const threeMonthsLater = new Date();
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
      setExpiryDate(threeMonthsLater.toISOString().split("T")[0]);
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
      setIsSignUp(false);
      setAuthModalOpen(true);
      return;
    }
    if (!selectedArchiveId) return;
    const currentArchive = archiveList.find((archive) => archive.id === selectedArchiveId);
    if (!currentArchive) return;

    try {
      setErrorMessage(null);
      const updatedVotes = await updateVote(selectedArchiveId, status, currentArchive.userVotes, user.id);

      const updatedList = archiveList.map((archive) => {
        if (archive.id === selectedArchiveId) {
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

  const handleSimulatePeriodicCheck = () => {
    if (!selectedArchiveId) return;
    const updatedList = archiveList.map((archive) => {
      if (archive.id === selectedArchiveId) {
        const labelText = archive.checkInterval === CheckInterval.DAILY ? "매일" : archive.checkInterval === CheckInterval.WEEKLY ? "매주" : "매월";
        const newNotificationLog: NotificationLog = {
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
      <header className="border-b-[1px] border-border bg-card px-[16px] sm:px-[24px] py-[12px] sm:py-[16px]">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-[12px]">
          <div className="flex items-center gap-[8px]">
            <Clock className="w-[20px] h-[20px] sm:w-[24px] sm:h-[24px] text-brand-600 animate-pulse shrink-0" />
            <h1 className="text-[16px] sm:text-[20px] font-bold tracking-tight text-foreground whitespace-nowrap">
              헷제 기업 구매 신호 아카이버
            </h1>
          </div>
          <div className="flex items-center gap-[8px] sm:gap-[12px] flex-wrap justify-start sm:justify-end w-full sm:w-auto">
            {user ? (
              <div className="flex items-center gap-[12px]">
                <span className="text-[12px] text-muted-foreground font-semibold">
                  {user.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="rounded-[6px] text-[13px] hover:bg-muted"
                >
                  로그아웃
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSignUp(false);
                  setAuthModalOpen(true);
                }}
                className="rounded-[6px] text-[13px]"
              >
                로그인 / 가입
              </Button>
            )}
            <Button 
              size="sm" 
              onClick={() => {
                setIsCreating(true);
                setSelectedArchiveId(null);
                setMobileView("detail");
              }}
              className="rounded-[6px] text-[13px] bg-brand-600 hover:bg-brand-700"
            >
              <Plus className="w-[16px] h-[16px] mr-[4px]" />
              신규 시그널 추적
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row h-[calc(100vh-100px)] lg:h-[calc(100vh-73px)] overflow-hidden">
        <aside className={cn("w-full lg:w-[380px] shrink-0 border-r-[1px] border-border bg-card flex flex-col h-full", mobileView === "list" ? "flex" : "hidden lg:flex")}>
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
                    setMobileView("detail");
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

        <section className={cn("flex-1 overflow-y-auto bg-muted/20 h-full", mobileView === "detail" ? "block" : "hidden lg:block")}>
          <div className="lg:hidden px-[24px] pt-[24px] pb-0">
            <Button
              variant="ghost"
              onClick={() => setMobileView("list")}
              className="flex items-center gap-[6px] text-[13px] text-muted-foreground hover:text-foreground pl-0 h-[44px]"
            >
              <ArrowLeft className="w-[16px] h-[16px]" />
              목록으로 돌아가기
            </Button>
          </div>

          {errorMessage && (
            <div className="m-[24px] p-[16px] bg-red-50 text-red-600 rounded-[8px] border-[1px] border-red-200 text-[13px]">
              {errorMessage}
            </div>
          )}

          {isCreating ? (
            <div className="max-w-[700px] mx-auto my-[20px] sm:my-[40px] px-[16px] sm:px-[24px]">
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
                          setMobileView("list");
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
            <div className="max-w-[1000px] mx-auto p-[16px] sm:p-[24px] space-y-[16px] sm:space-y-[24px]">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-[16px] sm:gap-[24px]">
                <div className="lg:col-span-2 space-y-[16px] sm:space-y-[24px]">
                  <Card className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300 rounded-[12px]">
                    <CardHeader className="bg-muted/30 border-b-[1px] border-border/50 pb-[12px]">
                      <div className="flex items-center gap-[8px] text-brand-600">
                        <FileText className="w-[18px] h-[18px]" />
                        <CardTitle className="text-[15px] font-bold">핵심 주장 및 신호 정보</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-[24px]">
                      {selectedArchive.evidence.sourceUrl ? (
                        <a
                          href={selectedArchive.evidence.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block border-l-[4px] border-brand-500 hover:border-brand-600 pl-[16px] italic text-[18px] font-medium leading-relaxed text-foreground hover:text-brand-600 transition-colors mb-[24px] cursor-pointer"
                        >
                          &quot;{selectedArchive.coreClaim.quote}&quot;
                        </a>
                      ) : (
                        <blockquote className="border-l-[4px] border-brand-500 pl-[16px] italic text-[18px] font-medium leading-relaxed text-foreground mb-[24px]">
                          &quot;{selectedArchive.coreClaim.quote}&quot;
                        </blockquote>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-[16px] pt-[16px] border-t-[1px] border-border">
                        <div className="flex items-center gap-[12px]">
                          {selectedArchive.speaker.imageUrl ? (
                            <div className="relative w-[48px] h-[48px] rounded-full overflow-hidden border-[1px] border-border shrink-0">
                              <img
                                src={selectedArchive.speaker.imageUrl}
                                alt={selectedArchive.speaker.name}
                                className="object-cover w-full h-full"
                              />
                            </div>
                          ) : (
                            <div className="w-[48px] h-[48px] rounded-full bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center text-white font-bold text-[16px] shrink-0 border-[1px] border-brand-100 shadow-sm">
                              {selectedArchive.speaker.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-foreground text-[14px]">
                              {selectedArchive.speaker.name}
                            </div>
                            <div className="text-[12px] text-muted-foreground">
                              {selectedArchive.speaker.position}, {selectedArchive.speaker.organization}
                            </div>
                          </div>
                        </div>

                        {selectedArchive.evidence.sourceUrl && (
                          <a
                            href={selectedArchive.evidence.sourceUrl}
                            target="_blank; noreferrer"
                            className="inline-flex items-center justify-center gap-[6px] rounded-[6px] text-[12px] font-semibold border-[1px] border-brand-200 text-brand-600 hover:bg-brand-50 shrink-0 w-full sm:w-auto h-[36px] px-[12px] transition-colors"
                          >
                            <LinkIcon className="w-[14px] h-[14px]" />
                            원본 기사 바로가기
                          </a>
                        )}
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
                        <CardTitle className="text-[15px] font-bold">현실화 추적 연대기</CardTitle>
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
                                    리얼리티 {event.realityIndex}%
                                  </Badge>
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
                                    리얼리티 {event.realityIndex}%
                                  </Badge>
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

                <div className="space-y-[16px] sm:space-y-[24px]">
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

                  <Card className="border-border/50 shadow-sm rounded-[12px] bg-gradient-to-br from-brand-50 to-brand-100/30 border-brand-100">
                    <CardHeader className="pb-[12px] border-b-[1px] border-brand-100/50">
                      <CardTitle className="text-[14px] font-bold text-brand-900">B2B 신호 컨설팅 리포트</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-[16px] space-y-[12px]">
                      <p className="text-[11px] text-brand-900/70 leading-relaxed">
                        이 구매 신호의 핵심 정보, 타임라인 전개 상황, 그리고 집단지성 신뢰 지표를 정돈된 A4 양식의 PDF 컨설팅 리포트로 발행합니다.
                      </p>
                      <Button
                        onClick={() => setReportModalOpen(true)}
                        className="w-full h-[36px] bg-brand-600 hover:bg-brand-700 text-white rounded-[6px] text-[12px]"
                      >
                        <FileText className="w-[14px] h-[14px] mr-[4px]" />
                        AI 분석 보고서 발행
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

      {authModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-[16px]">
          <div className="bg-card w-full max-w-[400px] rounded-[12px] border-[1px] border-border shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-[24px] border-b-[1px] border-border">
              <h2 className="text-[18px] font-bold text-foreground">
                {isSignUp ? "헷제 서비스 회원가입" : "헷제 서비스 로그인"}
              </h2>
              <p className="text-[12px] text-muted-foreground mt-[2px]">
                시민 평가단 피드백 투표에 참여하기 위해 접속해 주십시오.
              </p>
            </div>
            <form onSubmit={handleAuthSubmit} className="p-[24px] space-y-[16px]">
              <div className="space-y-[6px]">
                <label className="text-[12px] font-semibold text-foreground">이메일 주소</label>
                <Input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </div>
              <div className="space-y-[6px]">
                <label className="text-[12px] font-semibold text-foreground">비밀번호</label>
                <Input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="flex flex-col gap-[8px] pt-[8px]">
                <Button type="submit" className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-[6px] h-[40px] text-[13px]">
                  {isSignUp ? "가입 및 로그인" : "로그인하기"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="w-full text-[12px] text-brand-600 hover:text-brand-700"
                >
                  {isSignUp ? "이미 계정이 있으신가요? 로그인" : "계정이 없으신가요? 회원가입"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAuthModalOpen(false)}
                  className="w-full text-[12px] rounded-[6px]"
                >
                  닫기
                </Button>
              </div>
            </form>
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
                    <span className="text-[10px] sm:text-[11px] font-mono text-slate-500 uppercase tracking-wider block">HEZZE SIGNAL ADVISORY REPORT</span>
                    <h1 className="text-[18px] sm:text-[22px] font-extrabold text-slate-900 tracking-tight mt-[4px]">기업 신호 분석 컨설팅 보고서</h1>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 block">보고서 번호: {selectedArchive.referenceNumber}</span>
                    <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 block">발행 일자: {new Date().toLocaleDateString("ko-KR")}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-[12px] sm:gap-[16px] text-[12px] border-b-[1px] border-slate-200 pb-[16px]">
                  <div>
                    <span className="font-bold text-slate-500 block">신호 분류</span>
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
                        {(Object.entries(selectedArchive.userVotes) as [RealityStatus, number][])
                          .filter(([, count]) => count > 0)
                          .map(([status, count]) => {
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
                  HEZZE INTELLIGENCE SIGNAL ANALYSIS ENGINE • AUTOMATICALLY GENERATED DOCUMENT
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
