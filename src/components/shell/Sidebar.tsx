"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "🔥 HETJE Board", match: (path: string) => path === "/" },
  { href: "/my", label: "📚 My HETJE", match: (path: string) => path.startsWith("/my") },
  { href: "/tomorrow", label: "📰 My Tomorrow", match: (path: string) => path.startsWith("/tomorrow") },
  { href: "/around", label: "⌁ Around", match: (path: string) => path.startsWith("/around") },
  { href: "/leaderboard", label: "🏆 랭킹보드", match: (path: string) => path.startsWith("/leaderboard") },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex sticky top-0 h-screen w-[230px] shrink-0 flex-col border-r-[1px] border-border bg-card px-[14px] py-[18px]">
      <div className="flex items-center gap-[11px] px-[8px] pb-[20px]">
        <div className="w-[42px] h-[42px] rounded-[16px] bg-gradient-to-br from-brand-400 to-brand-700 grid place-items-center text-white font-black text-[18px]">
          H
        </div>
        <div>
          <b className="text-[20px] text-foreground">헷제</b>
          <small className="block text-muted-foreground text-[10px] mt-[2px]">
            The Lineage of Human Thought
          </small>
        </div>
      </div>

      <nav className="grid gap-[6px]">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-[15px] px-[13px] py-[12px] text-left text-[13px] font-bold transition-colors border-[1px] border-transparent",
                active
                  ? "bg-muted text-foreground border-border shadow-[inset_3px_0_0_var(--color-brand-500)]"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-[1px] border-border bg-muted/40 rounded-[16px] p-[12px]">
        <b className="block mb-[5px] text-[13px] text-foreground">Free Roam</b>
        <p className="m-0 text-muted-foreground text-[11px] leading-[1.45]">
          모든 게시판과 등록 기능을 자유롭게 눌러볼 수 있습니다.
        </p>
      </div>
    </aside>
  );
}
