"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MenuIcon from "@/components/navigation/menu-icon";

export type AdminSidebarItem = {
  href: string;
  label: string;
  badge?: number;
  children?: {
    href: string;
    label: string;
    badge?: number;
  }[];
};

function isActivePath(pathname: string, href: string) {
  if (href === "/admin" || href === "/vecino" || href === "/superadmin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemHasActivePath(pathname: string, item: AdminSidebarItem) {
  return isActivePath(pathname, item.href) || Boolean(item.children?.some((child) => isActivePath(pathname, child.href)));
}

export default function AdminSidebarNav({ items }: { items: AdminSidebarItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active = itemHasActivePath(pathname, item);
        return (
          <div key={item.href} className="space-y-0.5">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-h-9 items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition",
                active
                  ? "border-orange-300/80 bg-orange-500 text-white shadow-[0_8px_18px_rgba(249,115,22,0.22)]"
                  : "border-white/10 bg-white/5 text-slate-200 hover:border-orange-300/55 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border",
                    active ? "border-white/25 bg-white/20 text-white" : "border-white/10 bg-white/5 text-slate-300",
                  ].join(" ")}
                >
                  <MenuIcon label={item.label} />
                </span>
                <span className="truncate">{item.label}</span>
              </span>

              {typeof item.badge === "number" && item.badge > 0 ? (
                <span className="shrink-0 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-black text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>

            {item.children?.length ? (
              <div className={active ? "ml-4 space-y-0.5 border-l border-white/10 pl-2.5 pt-1" : "hidden"}>
                {item.children.map((child) => {
                  const childActive = isActivePath(pathname, child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      aria-current={childActive ? "page" : undefined}
                      className={[
                        "flex min-h-8 items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition",
                        childActive
                          ? "bg-white/14 text-white"
                          : "text-slate-300 hover:bg-white/8 hover:text-white",
                      ].join(" ")}
                    >
                      <span className="truncate">{child.label}</span>
                      {typeof child.badge === "number" && child.badge > 0 ? (
                        <span className="shrink-0 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                          {child.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
