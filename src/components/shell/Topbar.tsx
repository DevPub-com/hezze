"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAppData } from "@/lib/app-context";

const MOBILE_NAV = [
  { href: "/", label: "🔥 Board", match: (p: string) => p === "/" },
  { href: "/my", label: "📚 My", match: (p: string) => p.startsWith("/my") },
  { href: "/tomorrow", label: "📰 Tomorrow", match: (p: string) => p.startsWith("/tomorrow") },
  { href: "/around", label: "⌁ Around", match: (p: string) => p.startsWith("/around") },
  { href: "/leaderboard", label: "🏆 랭킹", match: (p: string) => p.startsWith("/leaderboard") },
];

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, searchQuery, setSearchQuery, setIsCreating, openAuth, signOut } = useAppData();

  const handleNewHetje = () => {
    setIsCreating(true);
    if (pathname !== "/") {
      router.push("/");
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b-[1px] border-border bg-card/90 backdrop-blur-md">
      <div className="flex items-center gap-[10px] px-[12px] sm:px-[18px] py-[12px]">
        <div className="relative flex-1 max-w-[560px]">
          <Search className="absolute left-[14px] top-[11px] w-[16px] h-[16px] text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="HETJE, 발제자, 주제 검색"
            className="pl-[38px] h-[40px] rounded-[999px] text-[13px]"
          />
        </div>

        <div className="ml-auto flex items-center gap-[8px] sm:gap-[12px]">
          {user ? (
            <div className="hidden sm:flex items-center gap-[12px]">
              <span className="text-[12px] text-muted-foreground font-semibold">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={signOut} className="rounded-[6px] text-[13px] hover:bg-muted">
                로그아웃
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={openAuth} className="rounded-[6px] text-[13px]">
              로그인 / 가입
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleNewHetje}
            className="rounded-[999px] text-[13px] bg-brand-600 hover:bg-brand-700"
          >
            <Plus className="w-[16px] h-[16px] mr-[4px]" />
            새 HETJE
          </Button>
          <div className="hidden sm:grid w-[38px] h-[38px] rounded-full bg-gradient-to-br from-brand-400 to-brand-700 place-items-center text-white font-black text-[13px]">
            {user?.email?.charAt(0).toUpperCase() ?? "JY"}
          </div>
        </div>
      </div>

      <nav className="lg:hidden flex gap-[6px] overflow-x-auto px-[12px] pb-[10px]">
        {MOBILE_NAV.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-[999px] px-[12px] py-[6px] text-[12px] font-bold transition-colors border-[1px]",
                active
                  ? "bg-brand-50 text-brand-600 border-brand-100"
                  : "bg-muted/40 text-muted-foreground border-border"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
