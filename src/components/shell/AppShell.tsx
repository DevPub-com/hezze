"use client";

import { useState, ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppDataProvider, useAppData } from "@/lib/app-context";
import { Topbar } from "./Topbar";
import { BottomNavigation } from "./BottomNavigation";
import { RegisterModal } from "@/components/register/RegisterModal";
import { getAuthErrorMessage, getAuthRedirectUrl, getSignUpOutcome } from "@/lib/auth-flow";

function AuthModal() {
  const { authModalOpen, closeAuth } = useAppData();
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  if (!authModalOpen) return null;

  const handleResendConfirmation = async () => {
    const email = authEmail.trim();
    if (!email) {
      setError("인증 메일을 받을 이메일 주소를 입력해 주세요.");
      return;
    }

    setError(null);
    setNotice(null);
    setIsBusy(true);
    try {
      const { error } = await getSupabaseClient().auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: getAuthRedirectUrl(window.location.origin) },
      });
      if (error) throw error;
      setNotice("인증 메일을 다시 보냈습니다. 가장 최근에 받은 링크를 열어 주세요.");
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      setIsBusy(true);
      if (isSignUp) {
        const { data, error } = await getSupabaseClient().auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { emailRedirectTo: getAuthRedirectUrl(window.location.origin) },
        });
        if (error) throw error;
        const outcome = getSignUpOutcome(data);
        if (!outcome.authenticated) {
          setNotice(outcome.message);
          setIsSignUp(false);
          setAuthPassword("");
          return;
        }
      } else {
        const { error } = await getSupabaseClient().auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });
        if (error) throw error;
      }
      closeAuth();
      setAuthEmail("");
      setAuthPassword("");
      setNotice(null);
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-[16px]">
      <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="bg-card w-full max-w-[400px] rounded-[12px] border-[1px] border-border shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-[24px] border-b-[1px] border-border">
          <h2 id="auth-title" className="text-[18px] font-bold text-foreground">
            {isSignUp ? "헷제 서비스 회원가입" : "헷제 서비스 로그인"}
          </h2>
          <p className="text-[12px] text-muted-foreground mt-[2px]">
            시민 평가단 피드백 투표에 참여하기 위해 접속해 주십시오.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-[24px] space-y-[16px]">
          {error && (
            <div role="alert" className="p-[10px] bg-red-50 text-red-600 rounded-[6px] border-[1px] border-red-200 text-[12px]">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="p-[10px] bg-emerald-50 text-emerald-700 rounded-[6px] border-[1px] border-emerald-200 text-[12px] leading-relaxed">
              {notice}
            </div>
          )}
          <div className="space-y-[6px]">
            <label className="text-[12px] font-semibold text-foreground">이메일 주소</label>
            <Input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
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
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={6}
              required
            />
          </div>
          <div className="flex flex-col gap-[8px] pt-[8px]">
            <Button type="submit" disabled={isBusy} className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-[6px] h-[40px] text-[13px]">
              {isBusy ? "처리 중..." : isSignUp ? "회원가입" : "로그인하기"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setNotice(null);
              }}
              className="w-full text-[12px] text-brand-600 hover:text-brand-700"
            >
              {isSignUp ? "이미 계정이 있으신가요? 로그인" : "계정이 없으신가요? 회원가입"}
            </Button>
            {!isSignUp && authEmail.trim() && (
              <Button
                type="button"
                variant="ghost"
                disabled={isBusy}
                onClick={handleResendConfirmation}
                className="w-full text-[12px] text-muted-foreground hover:text-brand-700"
              >
                인증 메일 다시 보내기
              </Button>
            )}
            <Button type="button" variant="outline" onClick={closeAuth} className="w-full text-[12px] rounded-[6px]">
              닫기
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppDataProvider>
      <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_#dbeafe_0,_#f8fafc_34%,_#eef2f7_100%)]">
        <div className="relative mx-auto min-h-[100dvh] w-full max-w-[560px] overflow-x-hidden bg-background shadow-[0_0_60px_rgba(15,23,42,0.12)]">
          <Topbar />
          <div className="pb-[calc(70px+env(safe-area-inset-bottom))]">{children}</div>
          <BottomNavigation />
        </div>
      </div>
      <AuthModal />
      <RegisterModal />
    </AppDataProvider>
  );
}
