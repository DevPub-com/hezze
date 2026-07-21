"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <nav
      aria-label="주요 내비게이션"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto grid w-full max-w-[560px] grid-cols-4 border-t border-border/80 bg-card/95 px-[6px] pt-[7px] pb-[calc(7px+env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl"
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
              "relative flex min-h-[49px] flex-col items-center justify-center gap-[3px] rounded-[14px] text-[10px] font-bold transition-all active:scale-95",
              active ? "text-brand-600" : "text-muted-foreground"
            )}
          >
            {active && <span className="absolute inset-x-[12px] top-0 h-[28px] rounded-[12px] bg-brand-50" />}
            <Icon className="relative h-[20px] w-[20px]" strokeWidth={active ? 2.5 : 2} />
            <span className="relative whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
