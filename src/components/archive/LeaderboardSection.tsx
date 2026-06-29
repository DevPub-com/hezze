"use client";

import { useState, useEffect } from "react";
import { SpeakerRankItem, UserRankItem } from "@/domains/archive/model/archive.model";
import { fetchSpeakerLeaderboard, fetchUserLeaderboard } from "@/domains/archive/api/analyze.action";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Target, Loader2 } from "lucide-react";

export function LeaderboardSection() {
  const [activeTab, setActiveTab] = useState<"speaker" | "user">("speaker");
  const [speakerList, setSpeakerList] = useState<SpeakerRankItem[]>([]);
  const [userList, setUserList] = useState<UserRankItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadLeaderboardData() {
      try {
        setIsLoading(true);
        const [speakers, users] = await Promise.all([
          fetchSpeakerLeaderboard(),
          fetchUserLeaderboard(),
        ]);
        setSpeakerList(speakers);
        setUserList(users);
      } catch (error: unknown) {
        console.error("리더보드 로드 실패:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadLeaderboardData();
  }, []);

  return (
    <div className="max-w-[1000px] mx-auto p-[16px] sm:p-[24px] space-y-[20px]">
      <div className="flex justify-center mb-[8px]">
        <div className="flex bg-muted/60 p-[4px] rounded-[14px] border-[1px] border-border/50">
          <button
            onClick={() => setActiveTab("speaker")}
            className={`flex items-center space-x-[6px] px-[18px] py-[10px] rounded-[10px] text-[13px] font-bold transition-all ${
              activeTab === "speaker"
                ? "bg-card text-brand-600 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy className="w-[16px] h-[18px]" />
            <span>🏆 인물 팩트 타율 순위</span>
          </button>
          <button
            onClick={() => setActiveTab("user")}
            className={`flex items-center space-x-[6px] px-[18px] py-[10px] rounded-[10px] text-[13px] font-bold transition-all ${
              activeTab === "user"
                ? "bg-card text-brand-600 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Target className="w-[16px] h-[18px]" />
            <span>🔮 성지 예측 명예의 전당</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-[60px] text-muted-foreground space-y-[12px]">
          <Loader2 className="w-[32px] h-[32px] animate-spin text-brand-500" />
          <p className="text-[13px] font-semibold">랭킹 데이터를 열심히 집계하고 있어요...</p>
        </div>
      ) : activeTab === "speaker" ? (
        <Card className="border-border/50 shadow-md rounded-[16px] overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-brand-50 via-background to-background border-b-[1px] border-border/50 pb-[16px] pt-[20px]">
            <div className="flex items-center justify-between">
              <div className="space-y-[4px]">
                <CardTitle className="text-[18px] font-extrabold text-foreground flex items-center gap-[8px]">
                  <span>🏆 인물별 팩트 타율 리더보드</span>
                </CardTitle>
                <p className="text-[12px] text-muted-foreground">
                  말한 공약과 발언을 진짜로 실현시킨 비율이 높은 순위예요!
                </p>
              </div>
              <Badge className="bg-brand-100 text-brand-700 hover:bg-brand-100 border-brand-200 text-[11px] py-[4px] px-[10px] rounded-[20px] font-bold">
                실시간 집계 중
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-[0px]">
            {speakerList.length === 0 ? (
              <div className="p-[40px] text-center text-muted-foreground text-[13px]">
                아직 데이터가 모이지 않았어요. 첫 뉴스를 등록하고 팩트 타율을 확인해 보세요!
              </div>
            ) : (
              <div className="divide-y-[1px] divide-border/40">
                {speakerList.map((speakerItem, index) => {
                  const rankNumber = index + 1;
                  return (
                    <div
                      key={speakerItem.speakerName + speakerItem.organization}
                      className="flex items-center justify-between p-[16px] sm:p-[20px] hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center space-x-[16px]">
                        <div className="flex items-center justify-center w-[36px] h-[36px] rounded-full font-black text-[15px] shrink-0">
                          {rankNumber === 1 ? (
                            <span className="text-[22px]">🥇</span>
                          ) : rankNumber === 2 ? (
                            <span className="text-[22px]">🥈</span>
                          ) : rankNumber === 3 ? (
                            <span className="text-[22px]">🥉</span>
                          ) : (
                            <span className="text-muted-foreground font-mono">{rankNumber}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-[8px]">
                            <h4 className="text-[15px] font-bold text-foreground">{speakerItem.speakerName}</h4>
                            <span className="text-[11px] px-[6px] py-[2px] rounded-[4px] bg-muted text-muted-foreground font-medium">
                              {speakerItem.organization}
                            </span>
                          </div>
                          <p className="text-[12px] text-muted-foreground mt-[2px]">
                            총 {speakerItem.totalClaims}건 발언 중 🎉 성공 {speakerItem.realizedClaims}건, 🚀 진행 {speakerItem.realizingClaims}건
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="block text-[10px] text-muted-foreground font-semibold">팩트 타율</span>
                        <span className="text-[20px] font-black text-brand-600 tracking-tight">
                          {speakerItem.factBattingAverage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 shadow-md rounded-[16px] overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-purple-50 via-background to-background border-b-[1px] border-border/50 pb-[16px] pt-[20px]">
            <div className="flex items-center justify-between">
              <div className="space-y-[4px]">
                <CardTitle className="text-[18px] font-extrabold text-foreground flex items-center gap-[8px]">
                  <span>🔮 성지 예측 명예의 전당</span>
                </CardTitle>
                <p className="text-[12px] text-muted-foreground">
                  미래의 소식 흐름을 족집게처럼 정확히 예측한 유저 랭킹보드예요!
                </p>
              </div>
              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200 text-[11px] py-[4px] px-[10px] rounded-[20px] font-bold">
                TOP 예측가
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-[0px]">
            {userList.length === 0 ? (
              <div className="p-[40px] text-center text-muted-foreground text-[13px]">
                아직 투표 참여자가 없어요! 뉴스 카드에서 내 생각을 투표하고 1위 예측가가 되어 보세요!
              </div>
            ) : (
              <div className="divide-y-[1px] divide-border/40">
                {userList.map((userItem, index) => {
                  const rankNumber = index + 1;
                  return (
                    <div
                      key={userItem.userId}
                      className="flex items-center justify-between p-[16px] sm:p-[20px] hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center space-x-[16px]">
                        <div className="flex items-center justify-center w-[36px] h-[36px] rounded-full font-black text-[15px] shrink-0">
                          {rankNumber === 1 ? (
                            <span className="text-[22px]">👑</span>
                          ) : rankNumber === 2 ? (
                            <span className="text-[22px]">🌟</span>
                          ) : rankNumber === 3 ? (
                            <span className="text-[22px]">✨</span>
                          ) : (
                            <span className="text-muted-foreground font-mono">{rankNumber}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-[8px]">
                            <h4 className="text-[14px] font-bold text-foreground font-mono">{userItem.userEmailMasked}</h4>
                            <Badge variant="outline" className="text-[10px] py-[1px] px-[6px] rounded-[4px] border-purple-200 text-purple-700 bg-purple-50">
                              {userItem.badgeTitle}
                            </Badge>
                          </div>
                          <p className="text-[12px] text-muted-foreground mt-[2px]">
                            총 {userItem.totalVotes}회 투표 중 {userItem.correctVotes}회 예측 적중!
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="block text-[10px] text-muted-foreground font-semibold">예측 적중률</span>
                        <span className="text-[20px] font-black text-purple-600 tracking-tight">
                          {userItem.accuracyRate}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
