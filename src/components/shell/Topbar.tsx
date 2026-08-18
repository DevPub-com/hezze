"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Plus, Search, SlidersHorizontal, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/lib/app-context";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setIsCreating, openAuth, signOut, searchQuery, setSearchQuery } = useAppData();
  const [boardDetailOpen, setBoardDetailOpen] = useState(false);
  const [searchRoute, setSearchRoute] = useState<string | null>(null);
  const searchOpen = searchRoute === pathname;

  const pageTitle = pathname.startsWith("/my")
    ? "내 헷제"
    : pathname.startsWith("/tomorrow")
      ? "투모로우"
      : pathname.startsWith("/leaderboard")
        ? "랭킹"
        : null;

  useEffect(() => {
    const handleBoardDetail = (event: Event) => setBoardDetailOpen((event as CustomEvent<boolean>).detail);
    window.addEventListener("hezze:board-detail", handleBoardDetail);
    return () => window.removeEventListener("hezze:board-detail", handleBoardDetail);
  }, []);

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

  const handleSearch = () => {
    if (pathname === "/") {
      window.dispatchEvent(new Event("hezze:focus-search"));
      return;
    }
    setSearchRoute(searchOpen ? null : pathname);
  };

  const handleFilter = () => {
    document.querySelector<HTMLElement>("[data-page-filter]")?.focus();
  };

  if (pathname === "/" && boardDetailOpen) return null;

  return (
    <>
      {pageTitle && (
        <div
          aria-hidden="true"
          className={
            searchOpen
              ? "h-[calc(111px+env(safe-area-inset-top))]"
              : "h-[calc(60px+env(safe-area-inset-top))]"
          }
        />
      )}
      <header
        className={`${
          pageTitle
            ? "fixed inset-x-0 top-0 mx-auto w-full max-w-[560px]"
            : "sticky top-0"
        } z-30 border-b border-border/80 bg-card/95 px-[18px] pb-[10px] pt-[calc(10px+env(safe-area-inset-top))] backdrop-blur-xl`}
      >
      <div className="flex items-center gap-[10px]">
        {pageTitle ? (
          <strong className="block min-w-0 text-[22px] font-black tracking-[-0.045em] text-foreground">
            {pageTitle}
          </strong>
        ) : (
          <Link
            href="/"
            aria-label="헷제 메인으로 이동"
            onClick={() => window.dispatchEvent(new Event("hezze:show-board-list"))}
            className="flex min-w-0 items-center rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <b className="block text-[22px] font-black tracking-[-0.055em] text-foreground">헷제</b>
          </Link>
        )}

        <div className="ml-auto flex items-center gap-[7px]">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSearch}
            aria-label={searchOpen ? "검색 닫기" : "발언 검색"}
            className="h-[40px] w-[40px] rounded-[10px] text-foreground hover:bg-muted"
          >
            {searchOpen ? <X className="h-[19px] w-[19px]" /> : <Search className="h-[19px] w-[19px]" />}
          </Button>
          {pageTitle ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFilter}
              aria-label={`${pageTitle} 필터로 이동`}
              className="h-[40px] w-[40px] rounded-[10px] text-foreground hover:bg-muted"
            >
              <SlidersHorizontal className="h-[19px] w-[19px]" />
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={user ? signOut : openAuth}
                aria-label={user ? "로그아웃" : "로그인 또는 가입"}
                className="h-[40px] w-[40px] rounded-[10px] border border-border bg-background"
              >
                {user ? <LogOut className="h-[17px] w-[17px]" /> : <UserRound className="h-[17px] w-[17px]" />}
              </Button>
              <Button
                size="icon"
                onClick={handleNewHetje}
                aria-label="새 HETJE 만들기"
                className="h-[40px] w-[40px] rounded-[10px] bg-brand-600 shadow-none hover:bg-brand-700"
              >
                <Plus className="h-[19px] w-[19px]" />
              </Button>
            </>
          )}
        </div>
      </div>
      {pageTitle && searchOpen && (
        <div className="relative mt-[9px]">
          <Search className="pointer-events-none absolute left-[12px] top-1/2 h-[16px] w-[16px] -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={`${pageTitle}에서 검색`}
            aria-label={`${pageTitle} 검색어`}
            className="h-[42px] w-full rounded-[10px] border border-border bg-background pl-[38px] pr-[12px] text-[12px] font-semibold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      )}
      </header>
    </>
  );
}
