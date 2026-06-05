"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";

const navigationItems = [
  { href: "/dashboard", label: "首页" },
  { href: "/dashboard/income", label: "收入管理" },
  { href: "/dashboard/expenses", label: "支出管理" },
  { href: "/dashboard/rooms", label: "房间/月租" },
  { href: "/dashboard/monthly-closing", label: "月度结算" },
  { href: "/dashboard/investors", label: "投资人管理" },
  { href: "/dashboard/dividends", label: "分红记录" },
  { href: "/dashboard/evidence", label: "凭证中心" },
  { href: "/dashboard/reports", label: "导出报表" },
  { href: "/dashboard/audit-logs", label: "审计日志" }
];

export function DashboardShell({
  userEmail,
  children
}: {
  userEmail: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === href;
    }

    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-5 py-6 lg:block">
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
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-paper px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">当前登录用户</p>
              <p className="text-sm font-medium text-ink">{userEmail}</p>
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="px-6 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
