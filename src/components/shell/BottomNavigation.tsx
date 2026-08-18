"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, Home, Trophy, Waypoints } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "보드", icon: Home, match: (path: string) => path === "/" },
  { href: "/my", label: "내 헷제", icon: BookOpen, match: (path: string) => path.startsWith("/my") },
  { href: "/tomorrow", label: "투모로우", icon: Waypoints, match: (path: string) => path.startsWith("/tomorrow") },
  { href: "/leaderboard", label: "랭킹", icon: Trophy, match: (path: string) => path.startsWith("/leaderboard") },
];

export function BottomNavigation() {
  const pathname = usePathname();
  const [boardDetailOpen, setBoardDetailOpen] = useState(false);

  useEffect(() => {
    const handleBoardDetail = (event: Event) => setBoardDetailOpen((event as CustomEvent<boolean>).detail);
    window.addEventListener("hezze:board-detail", handleBoardDetail);
    return () => window.removeEventListener("hezze:board-detail", handleBoardDetail);
  }, []);

  if (pathname === "/" && boardDetailOpen) return null;

  return (
    <nav
      aria-label="주요 내비게이션"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto grid w-full max-w-[560px] grid-cols-4 border-t border-border/90 bg-card/97 px-[8px] pt-[5px] pb-[calc(5px+env(safe-area-inset-bottom))] backdrop-blur-xl"
    >
      {NAV_ITEMS.map((item) => {
        const active = item.match(pathname);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-[56px] flex-col items-center justify-center gap-[4px] text-[10px] font-bold transition-colors active:text-brand-700",
              active ? "text-brand-600" : "text-muted-foreground"
            )}
          >
            <Icon className="relative h-[20px] w-[20px]" strokeWidth={active ? 2.5 : 2} />
            <span className="relative whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
