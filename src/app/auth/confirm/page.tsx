"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";
import { getAuthCallbackAction } from "@/lib/auth-flow";

type ConfirmationState = "checking" | "success" | "error";

export default function AuthConfirmPage() {
  const router = useRouter();
  const [state, setState] = useState<ConfirmationState>("checking");
  const [message, setMessage] = useState("인증 링크를 확인하고 있습니다.");

  useEffect(() => {
    let cancelled = false;
    let redirectTimer: ReturnType<typeof setTimeout> | undefined;

    async function confirmEmail() {
      const action = getAuthCallbackAction(window.location.href);
      if (action.kind === "error") {
        if (!cancelled) {
          setState("error");
          setMessage(action.message);
        }
        return;
      }

      const supabase = getSupabaseClient();
      let authError: Error | null = null;

      if (action.kind === "exchange_code") {
        const { error } = await supabase.auth.exchangeCodeForSession(action.code);
        authError = error;
      } else if (action.kind === "verify_otp") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: action.tokenHash,
          type: action.type as EmailOtpType,
        });
        authError = error;
      } else {
        const { data, error } = await supabase.auth.getSession();
        authError = error;
        if (!error && !data.session) {
          authError = new Error("인증 정보가 없거나 인증 링크가 만료되었습니다.");
        }
      }

      if (cancelled) return;
      if (authError) {
        setState("error");
        setMessage(authError.message || "이메일 인증을 완료하지 못했습니다.");
        return;
      }

      setState("success");
      setMessage("이메일 인증과 로그인이 완료되었습니다.");
      redirectTimer = setTimeout(() => router.replace("/"), 900);
    }

    confirmEmail().catch((error: unknown) => {
      if (!cancelled) {
        setState("error");
        setMessage(error instanceof Error ? error.message : "이메일 인증을 완료하지 못했습니다.");
      }
    });

    return () => {
      cancelled = true;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [router]);

  return (
    <main className="flex min-h-[calc(100dvh-60px)] items-center justify-center px-[20px] py-[32px]">
      <section className="w-full max-w-[380px] rounded-[18px] border border-border bg-card p-[24px] text-center shadow-sm">
        {state === "checking" && <Loader2 className="mx-auto h-[34px] w-[34px] animate-spin text-brand-600" />}
        {state === "success" && <CheckCircle2 className="mx-auto h-[36px] w-[36px] text-emerald-600" />}
        {state === "error" && <XCircle className="mx-auto h-[36px] w-[36px] text-red-500" />}

        <h1 className="mt-[14px] text-[20px] font-black tracking-tight text-foreground">
          {state === "checking" ? "이메일 인증 확인 중" : state === "success" ? "인증 완료" : "인증 실패"}
        </h1>
        <p className="mt-[8px] text-[13px] leading-[1.65] text-muted-foreground">{message}</p>

        {state === "error" && (
          <Link
            href="/"
            className="mt-[18px] inline-flex h-[42px] items-center justify-center rounded-[10px] bg-brand-600 px-[18px] text-[13px] font-bold text-white hover:bg-brand-700"
          >
            홈에서 다시 시도
          </Link>
        )}
      </section>
    </main>
  );
}
