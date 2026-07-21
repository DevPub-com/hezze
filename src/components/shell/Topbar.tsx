"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/lib/app-context";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setIsCreating, openAuth, signOut } = useAppData();

  const handleNewHetje = () => {
    if (!user) {
      openAuth();
      return;
    }
    setIsCreating(true);
    if (pathname !== "/") {
      router.push("/");
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-card/92 px-[16px] pt-[calc(10px+env(safe-area-inset-top))] pb-[10px] backdrop-blur-xl">
      <div className="flex items-center gap-[10px]">
        <Link
          href="/"
          aria-label="헷제 메인으로 이동"
          onClick={() => window.dispatchEvent(new Event("hezze:show-board-list"))}
          className="flex min-w-0 items-center rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <b className="block text-[20px] tracking-[-0.04em] text-foreground">헷제</b>
        </Link>

        <div className="ml-auto flex items-center gap-[7px]">
          <Button
            variant="ghost"
            size="icon"
            onClick={user ? signOut : openAuth}
            aria-label={user ? "로그아웃" : "로그인 또는 가입"}
            className="h-[38px] w-[38px] rounded-full border border-border bg-background"
          >
            {user ? <LogOut className="h-[17px] w-[17px]" /> : <UserRound className="h-[17px] w-[17px]" />}
          </Button>
          <Button
            size="icon"
            onClick={handleNewHetje}
            aria-label="새 HETJE 만들기"
            className="h-[38px] w-[38px] rounded-full bg-brand-600 shadow-[0_8px_18px_rgba(37,99,235,0.25)] hover:bg-brand-700"
          >
            <Plus className="h-[19px] w-[19px]" />
          </Button>
        </div>
      </div>

    </header>
  );
}
