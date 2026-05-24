"use client";

import { useState } from "react";
import { MOCK_ARCHIVE_DATA } from "@/domains/archive/api/mock/archive.mock";
import { REALITY_STATUS_LABEL, RealityStatus, ArchiveReference } from "@/domains/archive/model/archive.model";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FileText, AlertCircle, Calendar, Link as LinkIcon, Users, Loader2, Search } from "lucide-react";
import { analyzeNewsUrl } from "@/domains/archive/api/analyze.action";

export default function ArchiveDetailScreen() {
  const [data, setData] = useState<ArchiveReference | null>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const result = await analyzeNewsUrl(url);
      setData(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
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

  return (
    <main className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header & URL Input Section */}
        <div className="space-y-6">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            News Signal Analyzer
          </h1>
          <p className="text-muted-foreground">뉴스 기사 URL을 입력하면 B2B 비즈니스 구매 신호 및 현실화 지표를 분석합니다.</p>
          
          <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-3">
            <Input 
              type="url" 
              placeholder="https://news.example.com/article/123" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
              required
            />
            <Button type="submit" disabled={loading || !url}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              {loading ? "분석 중..." : "분석하기"}
            </Button>
          </form>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-md border border-red-200 text-sm">
              {error}
            </div>
          )}
        </div>

        {!data && !loading && !error && (
          <div className="py-20 text-center border-2 border-dashed border-border rounded-xl">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted mb-4">
              <Search className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">분석 대기 중</h3>
            <p className="text-muted-foreground text-sm">기사 링크를 입력하고 분석하기 버튼을 눌러주세요.</p>
          </div>
        )}

        {/* Data Display Section */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Main Content Column */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Core Claim Card */}
              <Card className="overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
                  <div className="flex items-center gap-2 text-brand-600">
                    <FileText className="w-5 h-5" />
                    <CardTitle className="text-lg">Core Claim</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <blockquote className="border-l-4 border-brand-500 pl-6 italic text-xl font-medium leading-relaxed text-foreground mb-8 relative">
                    <span className="absolute -left-3 -top-3 text-4xl text-brand-200">&quot;</span>
                    {data.coreClaim.quote}
                    <span className="absolute -bottom-6 text-4xl text-brand-200">&quot;</span>
                  </blockquote>
                  
                  <div className="flex items-center gap-4 mt-8 pt-6 border-t border-border">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={data.speaker.imageUrl} 
                        alt={data.speaker.name}
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          e.currentTarget.src = "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=150&auto=format&fit=crop";
                        }}
                      />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">{data.speaker.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {data.speaker.position}, {data.speaker.organization}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Context Card */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="w-5 h-5" />
                    <CardTitle className="text-lg text-foreground">Context & Analysis</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {data.coreClaim.contextDescription}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Column */}
            <div className="space-y-8">
              
              {/* Reality Meter Card */}
              <Card className="border-border/50 shadow-sm relative overflow-hidden">
                <div className={cn("absolute top-0 left-0 w-full h-1", getStatusIndicatorColorClass(data.realityMeter.status))} />
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex justify-between items-center">
                    Reality Meter
                    <Badge className={getStatusColorClass(data.realityMeter.status)}>
                      {REALITY_STATUS_LABEL[data.realityMeter.status]}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-bold tracking-tighter text-foreground">
                      {data.realityMeter.currentIndex}%
                    </span>
                    <span className="text-sm text-muted-foreground font-medium">Realized</span>
                  </div>
                  <Progress 
                    value={data.realityMeter.currentIndex} 
                    className="h-2.5" 
                    indicatorColorClass={getStatusIndicatorColorClass(data.realityMeter.status)}
                  />
                </CardContent>
              </Card>

              {/* Record Details Card */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-4 border-b border-border/50">
                  <CardTitle className="text-base">Record Details</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Record Date</div>
                      <div className="font-medium text-foreground">
                        {new Date(data.evidence.recordedAt).toLocaleDateString('ko-KR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <LinkIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="break-all">
                      <div className="text-muted-foreground text-xs">Source Venue</div>
                      <div className="font-medium text-foreground">{data.evidence.sourceVenue}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Observation Stats Card */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-4 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Signal Confidence</CardTitle>
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="text-xs text-muted-foreground mb-4">
                    Based on {data.observationStats.totalObservers.toLocaleString()} virtual observers
                  </div>
                  <div className="space-y-4">
                    {(Object.entries(data.observationStats.distribution) as [RealityStatus, number][])
                      .filter(([, count]) => count > 0)
                      .sort((a, b) => b[1] - a[1])
                      .map(([status, count]) => {
                        const percentage = Math.round((count / data.observationStats.totalObservers) * 100);
                        return (
                          <div key={status} className="space-y-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium text-foreground">{REALITY_STATUS_LABEL[status]}</span>
                              <span className="text-muted-foreground">{percentage}% ({count.toLocaleString()})</span>
                            </div>
                            <Progress 
                              value={percentage} 
                              className="h-1.5 bg-muted/50" 
                              indicatorColorClass={getStatusIndicatorColorClass(status)}
                            />
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        )}
      </div>
    </main>
  );
}
