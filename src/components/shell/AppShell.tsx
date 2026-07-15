"use client";

import { useState, ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppDataProvider, useAppData } from "@/lib/app-context";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { RegisterModal } from "@/components/register/RegisterModal";

function AuthModal() {
  const { authModalOpen, closeAuth } = useAppData();
  const [isSignUp, setIsSignUp] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  if (!authModalOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      setIsBusy(true);
      if (isSignUp) {
        const { error } = await getSupabaseClient().auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        alert("가입 성공! 로그인되었습니다.");
      } else {
        const { error } = await getSupabaseClient().auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      }
      closeAuth();
      setAuthEmail("");
      setAuthPassword("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "인증 처리 실패");
    } finally {
      setIsBusy(false);
    }
  };

  return (
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
        <form onSubmit={handleSubmit} className="p-[24px] space-y-[16px]">
          {error && (
            <div className="p-[10px] bg-red-50 text-red-600 rounded-[6px] border-[1px] border-red-200 text-[12px]">
              {error}
            </div>
          )}
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
            <Button type="submit" disabled={isBusy} className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-[6px] h-[40px] text-[13px]">
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
      <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[230px_1fr]">
        <Sidebar />
        <div className="min-w-0">
          <Topbar />
          <div className="max-w-[1400px] mx-auto">{children}</div>
        </div>
      </div>
      <AuthModal />
      <RegisterModal />
    </AppDataProvider>
  );
}
