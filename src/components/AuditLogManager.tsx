"use client";

import { useEffect, useMemo, useState } from "react";
import { MonthInput } from "@/components/DateInputs";
import { createClient } from "@/lib/supabase-client";
import type { AppRole } from "@/lib/permissions";

type AuditLogRecord = {
  id: string;
  user_email: string | null;
  user_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  details: Record<string, unknown> | null;
  table_name: string | null;
  record_id: string | null;
  reason: string | null;
  created_at: string;
};

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString(),
    end: new Date(Date.UTC(year, monthNumber, 1)).toISOString()
  };
}

const actionLabels: Record<string, string> = {
  create: "新增",
  update: "编辑",
  delete: "删除",
  upload: "上传",
  download: "下载",
  export: "导出",
  lock: "锁定",
  unlock: "解锁",
  generate: "生成",
  refresh: "刷新",
  mark_paid: "标记已发放",
  mark_deferred: "标记暂缓"
};

const targetLabels: Record<string, string> = {
  income: "收入",
  expense: "支出",
  voucher: "凭证",
  room: "房间",
  monthly_rent: "月租记录",
  investor: "投资人",
  investment_record: "投资记录",
  dividend: "分红",
  report: "报表",
  settlement: "月度结算"
};

function formatDetails(details: Record<string, unknown> | null) {
  if (!details) {
    return "-";
  }

  return JSON.stringify(details);
}

export function AuditLogManager({
  currentRole,
  defaultStoreId,
  storeLoadError
}: {
  currentRole: AppRole;
  defaultStoreId: string | null;
  storeLoadError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [month, setMonth] = useState(currentMonthValue);
  const [userFilter, setUserFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [records, setRecords] = useState<AuditLogRecord[]>([]);
  const [error, setError] = useState(storeLoadError);
  const [isLoading, setIsLoading] = useState(false);

  async function loadLogs() {
    if (currentRole !== "admin") {
      setError("当前账号无权查看审计日志。");
      return;
    }

    if (!defaultStoreId) {
      setError(storeLoadError || "无法读取审计日志：当前账号没有绑定门店。");
      return;
    }

    const range = getMonthRange(month);
    setIsLoading(true);

    let query = supabase
      .from("audit_logs")
      .select(
        "id,user_email,user_role,action,target_type,target_id,target_name,details,table_name,record_id,reason,created_at"
      )
      .eq("store_id", defaultStoreId)
      .gte("created_at", range.start)
      .lt("created_at", range.end)
      .order("created_at", { ascending: false })
      .limit(300);

    if (userFilter.trim()) {
      query = query.ilike("user_email", `%${userFilter.trim()}%`);
    }

    if (actionFilter !== "all") {
      query = query.eq("action", actionFilter);
    }

    if (targetFilter !== "all") {
      query = query.eq("target_type", targetFilter);
    }

    const { data, error: loadError } = await query;
    setIsLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setError("");
    setRecords((data ?? []) as AuditLogRecord[]);
  }

  useEffect(() => {
    void loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRole, defaultStoreId, month, actionFilter, targetFilter]);

  return (
    <section>
      <div>
        <h2 className="text-2xl font-bold text-ink">审计日志</h2>
      </div>

      {error ? (
        <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-end gap-4 border-b border-stone-200 px-5 py-4">
          <label className="flex items-center gap-3 text-sm font-medium text-ink">
            <span className="whitespace-nowrap">显示月份：</span>
            <MonthInput
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-ink">
            <span className="whitespace-nowrap">操作用户：</span>
            <input
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              onBlur={() => void loadLogs()}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
              placeholder="邮箱关键词"
            />
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-ink">
            <span className="whitespace-nowrap">操作类型：</span>
            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="all">全部</option>
              {Object.entries(actionLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-ink">
            <span className="whitespace-nowrap">操作对象：</span>
            <select
              value={targetFilter}
              onChange={(event) => setTargetFilter(event.target.value)}
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="all">全部</option>
              {Object.entries(targetLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void loadLogs()}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-ink transition hover:border-pine hover:text-pine"
          >
            刷新
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">操作时间</th>
                <th className="px-4 py-3 font-semibold">操作用户</th>
                <th className="px-4 py-3 font-semibold">权限</th>
                <th className="px-4 py-3 font-semibold">操作类型</th>
                <th className="px-4 py-3 font-semibold">操作对象</th>
                <th className="px-4 py-3 font-semibold">操作内容</th>
                <th className="px-4 py-3 font-semibold">详情</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={7}>
                    正在读取审计日志...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={7}>
                    当前筛选条件下暂无审计日志。
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                      {new Date(record.created_at).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {record.user_email || "-"}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {record.user_role || "-"}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {actionLabels[record.action] ?? record.action}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {targetLabels[record.target_type ?? ""] ??
                        record.target_type ??
                        record.table_name ??
                        "-"}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {record.target_name || record.reason || "-"}
                    </td>
                    <td className="max-w-md px-4 py-3 text-stone-700">
                      <div className="max-h-20 overflow-y-auto whitespace-pre-wrap break-words">
                        {formatDetails(record.details)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
