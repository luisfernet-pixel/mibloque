"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MenuIcon from "@/components/navigation/menu-icon";

type MenuItem = {
  href: string;
  label: string;
  badge?: number;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/admin" || href === "/vecino" || href === "/superadmin") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function ActiveNav({
  items,
  className,
}: {
  items: MenuItem[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={className}>
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={[
              "shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition md:rounded-xl md:px-3.5 md:py-2 md:text-sm [@media(max-height:820px)]:px-2 [@media(max-height:820px)]:py-1 [@media(max-height:820px)]:text-[11px]",
              active
                ? "border-orange-300 bg-orange-500 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_10px_24px_rgba(249,115,22,0.32)] hover:bg-orange-500"
                : "border-white/55 bg-white/5 text-white hover:border-orange-300 hover:bg-orange-500/15 hover:text-white",
            ].join(" ")}
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={[
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                  active ? "border-white/25 bg-white/20 text-white" : "border-white/15 bg-white/5 text-slate-200",
                ].join(" ")}
              >
                <MenuIcon label={item.label} className="h-3 w-3" />
              </span>
              <span>{item.label}</span>
              {typeof item.badge === "number" && item.badge > 0 ? (
                <span
                  className={
                    active
                      ? "rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold text-white"
                      : "rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white"
                  }
                >
                  {item.badge}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
