export const ADMIN_EMAIL = "kiu9ninomi@gmail.com";

export const roleOptions = [
  { value: "admin", label: "管理员" },
  { value: "operator", label: "经营方" },
  { value: "viewer", label: "投资人" }
] as const;

export type AppRole = (typeof roleOptions)[number]["value"];

export type DashboardPageKey =
  | "home"
  | "income"
  | "expenses"
  | "rooms"
  | "monthlyClosing"
  | "investors"
  | "dividends"
  | "evidence"
  | "reports"
  | "auditLogs";

export type PermissionAction =
  | "manageIncome"
  | "manageExpenses"
  | "uploadEvidence"
  | "deleteEvidence"
  | "batchDownloadEvidence"
  | "toggleMonthLock"
  | "manageInvestors"
  | "manageInvestorPermissions"
  | "manageInvestmentBaseline"
  | "generateDividends"
  | "refreshDividends"
  | "editDividends"
  | "markDividendsPaid"
  | "markDividendsDeferred"
  | "deleteDividendRecord";

export type PermissionContext = {
  dividendStatus?: "unpaid" | "paid" | "deferred";
};

export const navigationItems: {
  key: DashboardPageKey;
  href: string;
  label: string;
}[] = [
  { key: "home", href: "/dashboard", label: "首页" },
  { key: "income", href: "/dashboard/income", label: "收入管理" },
  { key: "expenses", href: "/dashboard/expenses", label: "支出管理" },
  { key: "rooms", href: "/dashboard/rooms", label: "房间/月租" },
  { key: "monthlyClosing", href: "/dashboard/monthly-closing", label: "月度结算" },
  { key: "investors", href: "/dashboard/investors", label: "投资人管理" },
  { key: "dividends", href: "/dashboard/dividends", label: "分红记录" },
  { key: "evidence", href: "/dashboard/evidence", label: "凭证中心" },
  { key: "reports", href: "/dashboard/reports", label: "导出报表" },
  { key: "auditLogs", href: "/dashboard/audit-logs", label: "审计日志" }
];

const pageAccess: Record<AppRole, DashboardPageKey[]> = {
  admin: navigationItems.map((item) => item.key),
  operator: [
    "home",
    "income",
    "expenses",
    "rooms",
    "monthlyClosing",
    "evidence",
    "reports"
  ],
  viewer: [
    "home",
    "rooms",
    "monthlyClosing",
    "dividends",
    "evidence",
    "reports"
  ]
};

const actionAccess: Record<
  Exclude<PermissionAction, "deleteDividendRecord">,
  AppRole[]
> = {
  manageIncome: ["admin", "operator"],
  manageExpenses: ["admin", "operator"],
  uploadEvidence: ["admin", "operator"],
  deleteEvidence: ["admin"],
  batchDownloadEvidence: ["admin", "viewer"],
  toggleMonthLock: ["admin"],
  manageInvestors: ["admin"],
  manageInvestorPermissions: ["admin"],
  manageInvestmentBaseline: ["admin"],
  generateDividends: ["admin"],
  refreshDividends: ["admin"],
  editDividends: ["admin"],
  markDividendsPaid: ["admin"],
  markDividendsDeferred: ["admin"]
};

export function normalizeRole(value: string | null | undefined): AppRole {
  return roleOptions.some((option) => option.value === value)
    ? (value as AppRole)
    : "viewer";
}

export function getRoleLabel(role: AppRole) {
  return roleOptions.find((option) => option.value === role)?.label ?? "投资人";
}

export function canAccessPage(role: AppRole, page: DashboardPageKey) {
  return pageAccess[role].includes(page);
}

export function getNavigationItemsForRole(role: AppRole) {
  return navigationItems.filter((item) => canAccessPage(role, item.key));
}

export function canPerform(
  role: AppRole,
  action: PermissionAction,
  context: PermissionContext = {}
) {
  if (action === "deleteDividendRecord") {
    return role === "admin" && context.dividendStatus !== undefined;
  }

  return actionAccess[action].includes(role);
}
