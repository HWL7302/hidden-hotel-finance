import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";

const navigationItems = [
  { href: "/dashboard", label: "首页仪表盘" },
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
  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-stone-200 bg-white p-6 lg:block">
        <div>
          <p className="text-sm font-semibold text-brass">Hidden Hotel</p>
          <h1 className="mt-1 text-xl font-bold text-ink">财务管理</h1>
        </div>
        <nav className="mt-8 space-y-1">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 hover:text-pine"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-stone-200 bg-paper/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-500">当前登录用户</p>
              <p className="text-sm font-medium text-ink">{userEmail}</p>
            </div>
            <SignOutButton />
          </div>
        </header>
        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
