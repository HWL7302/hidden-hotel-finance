"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MonthInput } from "@/components/DateInputs";
import { createSignedEvidenceUrl } from "@/lib/evidence-client";
import { createClient } from "@/lib/supabase-client";
import { logAuditEvent } from "@/lib/audit-client";
import { canPerform, type AppRole } from "@/lib/permissions";

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

function getEvidenceCardTypeLabel(type: EvidenceType) {
  return `${getEvidenceTypeLabel(type)}凭证`;
}

function getRelatedRecordLink(record: EvidenceRecord, month: string) {
  if (!record.related_table || !record.related_record_id) {
    return null;
  }

  const search = `?highlight=${record.related_record_id}&month=${month}`;

  if (record.related_table === "incomes") {
    return { href: `/dashboard/income${search}`, label: "查看收入记录" };
  }

  if (record.related_table === "expenses") {
    return { href: `/dashboard/expenses${search}`, label: "查看支出记录" };
  }

  return null;
}

export function EvidenceManager({
  currentRole,
  defaultStoreId,
  storeLoadError
}: {
  currentRole: AppRole;
  defaultStoreId: string | null;
  storeLoadError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const canManage = canPerform(currentRole, "deleteEvidence");
  const canBatchDownload = canPerform(currentRole, "batchDownloadEvidence");
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [month, setMonth] = useState(getCurrentMonth);
  const [typeFilter, setTypeFilter] = useState<EvidenceFilter>("all");
  const [error, setError] = useState(storeLoadError);
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);

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
    if (!canManage) {
      setError("当前账号无权删除凭证。");
      return;
    }

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
    await logAuditEvent({
      supabase,
      storeId: defaultStoreId,
      userRole: currentRole,
      action: "delete",
      targetType: "voucher",
      targetId: record.id,
      targetName: record.file_name,
      details: {
        evidence_type: record.evidence_type,
        related_table: record.related_table,
        related_record_id: record.related_record_id
      }
    });
    await loadRecords();
  }

  async function handleBatchDownload() {
    setError("");
    setNotice("");

    if (!canBatchDownload) {
      setError("当前账号无权批量下载凭证。");
      return;
    }

    if (records.length === 0) {
      setError("当前筛选条件下没有可下载的凭证。");
      return;
    }

    setIsBatchDownloading(true);

    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      for (const [index, record] of records.entries()) {
        const signedUrl = await createSignedEvidenceUrl(supabase, record.id);
        const response = await fetch(signedUrl);

        if (!response.ok) {
          throw new Error(`凭证「${record.file_name}」下载失败。`);
        }

        const blob = await response.blob();
        zip.file(`${String(index + 1).padStart(3, "0")}_${record.file_name}`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `凭证_${month}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      await logAuditEvent({
        supabase,
        storeId: defaultStoreId,
        userRole: currentRole,
        action: "download",
        targetType: "voucher",
        targetName: `凭证_${month}.zip`,
        details: {
          month,
          evidence_type: typeFilter,
          file_count: records.length
        }
      });

      setNotice(`已打包下载 ${records.length} 个凭证文件。`);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "批量下载凭证失败。"
      );
    } finally {
      setIsBatchDownloading(false);
    }
  }

  return (
    <section>
      <div>
        <h2 className="text-2xl font-bold text-ink">凭证档案</h2>
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
        <div className="flex flex-col gap-4 border-b border-stone-200 px-5 py-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap">
            <label className="flex flex-col gap-2 text-sm font-medium text-ink sm:flex-row sm:items-center sm:gap-3">
              <span className="whitespace-nowrap">显示月份：</span>
              <MonthInput
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium text-ink sm:flex-row sm:items-center sm:gap-3">
              <span className="whitespace-nowrap">凭证类型：</span>
              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(event.target.value as EvidenceFilter)
                }
                className="block w-full rounded-md border border-stone-300 bg-white px-3 py-3 text-sm sm:w-auto sm:py-2"
              >
                <option value="all">全部</option>
                <option value="income">收入凭证</option>
                <option value="expense">支出凭证</option>
                <option value="other">其他凭证</option>
              </select>
            </label>
          </div>
          {canBatchDownload ? (
            <button
              type="button"
              onClick={() => void handleBatchDownload()}
              disabled={isBatchDownloading || isLoading}
              className="min-h-11 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-ink transition hover:border-pine hover:text-pine disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBatchDownloading ? "打包中..." : "批量下载"}
            </button>
          ) : null}
        </div>

        <div className="hidden overflow-x-auto md:block">
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
                      {getRelatedRecordLink(record, month) ? (
                        <Link
                          href={getRelatedRecordLink(record, month)!.href}
                          className="font-medium text-pine hover:text-ink"
                        >
                          {getRelatedRecordLink(record, month)!.label}
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

        <div className="space-y-3 p-4 md:hidden">
          {isLoading ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-stone-500">
              正在读取凭证...
            </p>
          ) : records.length === 0 ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-stone-500">
              当前筛选范围暂无凭证记录。
            </p>
          ) : (
            records.map((record) => {
              const relatedLink = getRelatedRecordLink(record, month);

              return (
                <article
                  key={record.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <p className="text-sm font-semibold text-ink">
                    {getEvidenceCardTypeLabel(record.evidence_type)}
                  </p>
                  <p className="mt-3 break-all text-sm font-medium text-ink">
                    {record.file_name}
                  </p>
                  <div className="mt-3 text-sm">
                    <span className="text-stone-500">关联记录：</span>
                    {relatedLink ? (
                      <Link
                        href={relatedLink.href}
                        className="font-medium text-pine hover:text-ink"
                      >
                        {relatedLink.label}
                      </Link>
                    ) : (
                      <span className="text-stone-500">—</span>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleView(record)}
                      className="min-h-11 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-ink"
                    >
                      查看凭证
                    </button>
                    {canManage ? (
                      <button
                        type="button"
                        onClick={() => void handleDelete(record)}
                        className="min-h-11 rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700"
                      >
                        删除
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

