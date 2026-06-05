"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MonthInput } from "@/components/DateInputs";
import { createSignedEvidenceUrl } from "@/lib/evidence-client";
import { createClient } from "@/lib/supabase-client";

type EvidenceType = "income" | "expense" | "other";
type EvidenceFilter = "all" | EvidenceType;

type EvidenceRecord = {
  id: string;
  evidence_type: EvidenceType;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  related_table: string | null;
  related_record_id: string | null;
  created_at: string;
};

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, monthNumber, 1)).toISOString();
  return { start, end };
}

function getEvidenceTypeLabel(type: EvidenceType) {
  if (type === "income") {
    return "收入";
  }

  if (type === "expense") {
    return "支出";
  }

  return "其他";
}

function getRelatedRecordLink(record: EvidenceRecord) {
  if (!record.related_table || !record.related_record_id) {
    return null;
  }

  if (record.related_table === "incomes") {
    return { href: "/dashboard/income", label: "查看收入记录" };
  }

  if (record.related_table === "expenses") {
    return { href: "/dashboard/expenses", label: "查看支出记录" };
  }

  return null;
}

export function EvidenceManager({
  currentRole,
  defaultStoreId,
  storeLoadError
}: {
  currentRole: string;
  defaultStoreId: string | null;
  storeLoadError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const canManage = currentRole === "admin" || currentRole === "operator";
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [month, setMonth] = useState(getCurrentMonth);
  const [typeFilter, setTypeFilter] = useState<EvidenceFilter>("all");
  const [error, setError] = useState(storeLoadError);
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function loadRecords() {
    if (!defaultStoreId) {
      return;
    }

    const { start, end } = getMonthRange(month);
    setIsLoading(true);
    let query = supabase
      .from("evidence_files")
      .select(
        "id,evidence_type,file_name,storage_bucket,storage_path,related_table,related_record_id,created_at"
      )
      .eq("store_id", defaultStoreId)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });

    if (typeFilter !== "all") {
      query = query.eq("evidence_type", typeFilter);
    }

    const { data, error: loadError } = await query;
    setIsLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setError("");
    setRecords((data ?? []) as EvidenceRecord[]);
  }

  useEffect(() => {
    void loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStoreId, month, typeFilter]);

  async function handleView(record: EvidenceRecord) {
    try {
      setError("");
      const signedUrl = await createSignedEvidenceUrl(supabase, record.id);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "凭证打开失败。");
    }
  }

  async function handleDelete(record: EvidenceRecord) {
    if (!window.confirm(`确认删除凭证「${record.file_name}」吗？`)) {
      return;
    }

    setError("");
    setNotice("");

    if (record.related_table && record.related_record_id) {
      const { error: unlinkError } = await supabase
        .from(record.related_table)
        .update({ evidence_file: null })
        .eq("id", record.related_record_id)
        .eq("evidence_file", record.id);

      if (unlinkError) {
        setError(unlinkError.message);
        return;
      }
    }

    const { error: deleteError } = await supabase
      .from("evidence_files")
      .delete()
      .eq("id", record.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    const { error: storageError } = await supabase.storage
      .from(record.storage_bucket)
      .remove([record.storage_path]);

    if (storageError) {
      setError(`凭证记录已删除，但 Storage 文件清理失败：${storageError.message}`);
      return;
    }

    setNotice("凭证已删除。");
    await loadRecords();
  }

  return (
    <section>
      <div>
        <h2 className="text-2xl font-bold text-ink">凭证档案</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
          统一查看收入和支出录入时上传的凭证。文件保存在 Supabase Storage，后续将在此提供批量下载能力。
        </p>
      </div>

      {error ? (
        <p className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 px-5 py-4">
          <div className="flex flex-wrap gap-4">
            <label className="text-sm font-medium text-ink">
              选择月份
              <MonthInput
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-ink">
              凭证类型
              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as EvidenceFilter)
                }
                className="mt-2 block rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">全部</option>
                <option value="income">收入凭证</option>
                <option value="expense">支出凭证</option>
                <option value="other">其他凭证</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            批量下载（预留）
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">上传时间</th>
                <th className="px-4 py-3 font-semibold">类型</th>
                <th className="px-4 py-3 font-semibold">文件名</th>
                <th className="px-4 py-3 font-semibold">关联记录</th>
                <th className="px-4 py-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={5}>
                    正在读取凭证...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={5}>
                    当前筛选范围暂无凭证记录。
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                      {new Date(record.created_at).toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {getEvidenceTypeLabel(record.evidence_type)}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {record.file_name}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {getRelatedRecordLink(record) ? (
                        <Link
                          href={getRelatedRecordLink(record)!.href}
                          className="font-medium text-pine hover:text-ink"
                        >
                          {getRelatedRecordLink(record)!.label}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleView(record)}
                          className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-ink"
                        >
                          查看凭证
                        </button>
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => void handleDelete(record)}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700"
                          >
                            删除
                          </button>
                        ) : null}
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

