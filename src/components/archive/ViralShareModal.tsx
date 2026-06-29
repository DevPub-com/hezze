"use client";

import { useState } from "react";
import { ArchiveReference, REALITY_STATUS_LABEL, RealityStatus } from "@/domains/archive/model/archive.model";
import { Button } from "@/components/ui/button";
import { Share2, Check, Copy, Sparkles, X } from "lucide-react";

interface ViralShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  archive: ArchiveReference | null;
}

export function ViralShareModal({ isOpen, onClose, archive }: ViralShareModalProps) {
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !archive) return null;

  const totalVotes = Object.values(archive.userVotes).reduce((accumulator, currentVoteCount) => accumulator + currentVoteCount, 0);
  const currentStatusVoteCount = archive.userVotes[archive.realityMeter.status] || 0;
  const agreementPercentage = totalVotes > 0 ? Math.round((currentStatusVoteCount / totalVotes) * 100) : 100;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error: unknown) {
      console.error("링크 복사 실패:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[4px] p-[16px]">
      <div className="relative w-full max-w-[480px] bg-card border-[1px] border-border/60 rounded-[20px] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-[20px] border-b-[1px] border-border/40 bg-muted/30">
          <div className="flex items-center space-x-[8px]">
            <Sparkles className="w-[18px] h-[18px] text-brand-500" />
            <h3 className="text-[16px] font-bold text-foreground">🌟 &quot;이거 봐, 내 말이 맞았잖아!&quot;</h3>
          </div>
          <button
            onClick={onClose}
            className="p-[6px] text-muted-foreground hover:text-foreground rounded-[8px] hover:bg-muted/60 transition-colors"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        <div className="p-[24px] space-y-[20px]">
          <div className="relative p-[24px] rounded-[16px] bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 text-white shadow-lg space-y-[16px] overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center px-[10px] py-[4px] rounded-[20px] text-[11px] font-bold bg-white/20 backdrop-blur-[4px] text-white">
                #성지순례왔습니다 #예언적중 #팩트폭격
              </span>
              <span className="text-[12px] text-white/70 font-medium">
                {archive.referenceNumber}
              </span>
            </div>

            <div className="space-y-[8px]">
              <h4 className="text-[18px] font-extrabold leading-snug tracking-tight text-white line-clamp-3">
                &quot;{archive.coreClaim.quote}&quot;
              </h4>
              <p className="text-[12px] text-white/80 line-clamp-2">
                {archive.speaker.name} ({archive.speaker.organization})
              </p>
            </div>

            <div className="pt-[12px] border-t-[1px] border-white/15 flex items-center justify-between">
              <div>
                <span className="block text-[10px] text-white/60 font-medium">AI 팩트 지수</span>
                <span className="text-[22px] font-black tracking-tight text-brand-300">
                  {archive.realityMeter.currentIndex}%
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] text-white/60 font-medium">지금 소식 상태</span>
                <span className="inline-block px-[10px] py-[2px] rounded-[6px] text-[12px] font-bold bg-white/10 text-white">
                  {REALITY_STATUS_LABEL[archive.realityMeter.status as RealityStatus]}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] text-white/60 font-medium">사람들의 동의율</span>
                <span className="text-[16px] font-bold text-emerald-400">
                  {agreementPercentage}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex space-x-[12px]">
            <Button
              onClick={handleCopyLink}
              className="flex-1 h-[44px] bg-brand-600 hover:bg-brand-700 text-white rounded-[10px] text-[13px] font-semibold transition-all shadow-md"
            >
              {isCopied ? (
                <>
                  <Check className="w-[16px] h-[16px] mr-[6px]" />
                  링크 복사 완료!
                </>
              ) : (
                <>
                  <Copy className="w-[16px] h-[16px] mr-[6px]" />
                  🔗 성지순례 링크 바로 복사
                </>
              )}
            </Button>
            <Button
              onClick={() => alert("자랑용 카드가 클립보드에 생성되었습니다.")}
              variant="outline"
              className="h-[44px] px-[16px] rounded-[10px] text-[13px] font-semibold border-border/80"
            >
              <Share2 className="w-[16px] h-[16px] mr-[6px]" />
              📲 자랑하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
