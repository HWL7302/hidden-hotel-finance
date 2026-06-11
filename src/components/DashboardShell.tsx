"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { getNavigationItemsForRole, type AppRole } from "@/lib/permissions";

export function DashboardShell({
  userEmail,
  currentRole,
  children
}: {
  userEmail: string;
  currentRole: AppRole;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigationItems = getNavigationItemsForRole(currentRole);

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === href;
    }

    return pathname.startsWith(href);
  }

  return (
    <div className="app-background min-h-screen overflow-x-hidden">
      <header className="app-background sticky top-0 z-30 border-b border-slate-200 px-4 py-3 md:hidden">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="打开菜单"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-lg leading-none text-ink shadow-sm"
          >
            ☰
          </button>
          <p className="truncate text-center text-base font-semibold text-ink">
            隐藏款电竞酒店
          </p>
          <SignOutButton />
        </div>
      </header>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="关闭菜单"
            className="absolute inset-0 bg-slate-900/30"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="app-background relative h-full w-72 max-w-[82vw] border-r border-slate-200 px-5 py-6 shadow-2xl">
            <div className="rounded-xl border border-slate-100 bg-paper px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-pine">
                Hidden Hotel
              </p>
              <h1 className="mt-1 text-xl font-bold text-ink">财务管理</h1>
            </div>
            <nav className="mt-6 space-y-1.5">
              {navigationItems.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-pine/10 text-slateblue shadow-[inset_3px_0_0_#48b8b0]"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slateblue"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}

      <aside className="app-background fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 px-5 py-6 lg:block">
        <div className="rounded-xl border border-slate-100 bg-paper px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-pine">
            Hidden Hotel
          </p>
          <h1 className="mt-1 text-xl font-bold text-ink">财务管理</h1>
        </div>
        <nav className="mt-6 space-y-1.5">
          {navigationItems.map((item) => {
            const active = isActive(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-pine/10 text-slateblue shadow-[inset_3px_0_0_#48b8b0]"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slateblue"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="app-background sticky top-0 z-10 hidden border-b border-slate-200 px-6 py-4 md:block">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">当前登录用户</p>
              <p className="text-sm font-medium text-ink">{userEmail}</p>
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
