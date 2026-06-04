"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { DateInput, MonthInput } from "@/components/DateInputs";
import {
  createSignedEvidenceUrl,
  uploadEvidenceForRecord
} from "@/lib/evidence-client";
import {
  getIncomeSourceLabel,
  incomeSourceOptions
} from "@/lib/finance-options";

type IncomeRecord = {
  id: string;
  store_id: string;
  date: string;
  source: string;
  gross_amount: string | number;
  fee_amount: string | number | null;
  net_amount: string | number | null;
  settlement_period: string | null;
  evidence_file: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type IncomeFormState = {
  date: string;
  source: string;
  grossAmount: string;
  feeAmount: string;
  netAmount: string;
  settlementPeriod: string;
  note: string;
};

const emptyForm: IncomeFormState = {
  date: todayValue(),
  source: "",
  grossAmount: "",
  feeAmount: "0.00",
  netAmount: "0.00",
  settlementPeriod: currentMonthValue(),
  note: ""
};

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function getMonthRange(month: string) {
  const start = `${month}-01`;
  const nextMonth = new Date(`${start}T00:00:00`);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return {
    start,
    end: nextMonth.toISOString().slice(0, 10)
  };
}

function formatMoney(value: string | number | null) {
  if (value === null || value === "") {
    return "-";
  }

  const text = String(value);
  const [integerPart, decimalPart = "00"] = text.split(".");
  return `${integerPart}.${decimalPart.padEnd(2, "0").slice(0, 2)}`;
}

function formatSettlementPeriod(value: string | null) {
  if (!value) {
    return "*";
  }

  const [year, month] = value.slice(0, 7).split("-");
  return `${year}年${month}月`;
}

function validateOptionalAmount(value: string) {
  if (!value) {
    return true;
  }

  return /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value);
}

function amountToCents(value: string) {
  const [integerPart = "0", decimalPart = ""] = value.split(".");
  return (
    BigInt(integerPart || "0") * BigInt(100) +
    BigInt(decimalPart.padEnd(2, "0"))
  );
}

function centsToAmount(value: bigint) {
  const safeValue = value < BigInt(0) ? BigInt(0) : value;
  const integerPart = safeValue / BigInt(100);
  const decimalPart = String(safeValue % BigInt(100)).padStart(2, "0");
  return `${integerPart}.${decimalPart}`;
}

function calculateNetAmount(grossAmount: string, feeAmount: string) {
  if (!validateOptionalAmount(grossAmount) || !validateOptionalAmount(feeAmount)) {
    return "";
  }

  return centsToAmount(amountToCents(grossAmount || "0") - amountToCents(feeAmount || "0"));
}

export function IncomeManager({
  currentUserId,
  defaultStoreId,
  storeLoadError
}: {
  currentUserId: string;
  defaultStoreId: string | null;
  storeLoadError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [month, setMonth] = useState(currentMonthValue());
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [form, setForm] = useState<IncomeFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState(storeLoadError);
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  async function loadIncomes() {
    setError("");
    setNotice("");
    setIsLoading(true);

    const range = getMonthRange(month);
    let query = supabase
      .from("incomes")
      .select(
        "id,store_id,date,source,gross_amount,fee_amount,net_amount,settlement_period,note,evidence_file,created_by,created_at,updated_at"
      )
      .gte("date", range.start)
      .lt("date", range.end)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });

    if (defaultStoreId) {
      query = query.eq("store_id", defaultStoreId);
    }

    const { data, error: loadError } = await query;
    setIsLoading(false);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setIncomes((data ?? []) as IncomeRecord[]);
  }

  useEffect(() => {
    void loadIncomes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, defaultStoreId]);

  function updateForm<K extends keyof IncomeFormState>(
    key: K,
    value: IncomeFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateAmountAndNet(
    key: "grossAmount" | "feeAmount",
    value: string
  ) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      return {
        ...next,
        netAmount: calculateNetAmount(next.grossAmount, next.feeAmount)
      };
    });
  }

  function resetForm() {
    setEditingId(null);
    setEvidenceFile(null);
    setFileInputKey((current) => current + 1);
    setForm({
      ...emptyForm,
      date: todayValue(),
      feeAmount: "0.00",
      netAmount: "0.00",
      settlementPeriod: month
    });
  }

  function handleEvidenceFileChange(event: ChangeEvent<HTMLInputElement>) {
    setEvidenceFile(event.target.files?.[0] ?? null);
  }

  function startEdit(income: IncomeRecord) {
    setEditingId(income.id);
    setForm({
      date: income.date,
      source: income.source,
      grossAmount: String(income.gross_amount ?? ""),
      feeAmount: String(income.fee_amount ?? "0"),
      netAmount: String(income.net_amount ?? ""),
      settlementPeriod: income.settlement_period?.slice(0, 7) ?? "",
      note: income.note ?? ""
    });
    setError("");
    setNotice("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!defaultStoreId) {
      setError("无法保存收入：没有可用的默认 store_id。请先确认当前用户 profile.store_id 或 stores 表数据。");
      return;
    }

    if (!currentUserId) {
      setError("无法保存收入：当前登录用户信息为空。");
      return;
    }

    if (!form.grossAmount) {
      setError("请输入收入总额。");
      return;
    }

    if (
      !validateOptionalAmount(form.grossAmount) ||
      !validateOptionalAmount(form.feeAmount) ||
      !validateOptionalAmount(form.netAmount)
    ) {
      setError("金额格式不正确，请输入最多两位小数的非负金额。");
      return;
    }

    const feeAmount = form.feeAmount || "0";
    const netAmount = form.netAmount || calculateNetAmount(form.grossAmount, feeAmount);
    const calculatedNetAmount = calculateNetAmount(form.grossAmount, feeAmount);

    if (!netAmount) {
      setError("请输入净收入。");
      return;
    }

    if (
      amountToCents(netAmount) !== amountToCents(calculatedNetAmount) &&
      !form.note.trim()
    ) {
      setError("净收入金额与计算结果存在差额，请在备注中填写原因。");
      return;
    }

    setIsSaving(true);

    const payload = {
      store_id: defaultStoreId,
      date: form.date,
      source: form.source.trim(),
      gross_amount: form.grossAmount,
      fee_amount: feeAmount,
      net_amount: netAmount,
      settlement_period: `${form.settlementPeriod}-01`,
      note: form.note.trim() || null,
      created_by: currentUserId
    };

    const result = editingId
      ? await supabase
          .from("incomes")
          .update({
            date: payload.date,
            source: payload.source,
            gross_amount: payload.gross_amount,
            fee_amount: payload.fee_amount,
            net_amount: payload.net_amount,
            settlement_period: payload.settlement_period,
            note: payload.note
          })
          .eq("id", editingId)
          .select("id")
          .single()
      : await supabase.from("incomes").insert(payload).select("id").single();

    if (result.error) {
      setIsSaving(false);
      setError(result.error.message);
      return;
    }

    if (evidenceFile) {
      try {
        await uploadEvidenceForRecord({
          supabase,
          file: evidenceFile,
          storeId: defaultStoreId,
          userId: currentUserId,
          evidenceType: "income",
          relatedTable: "incomes",
          relatedRecordId: result.data.id
        });
      } catch (uploadError) {
        setIsSaving(false);
        setError(
          `收入记录已保存，但凭证上传失败：${
            uploadError instanceof Error ? uploadError.message : "未知错误"
          }`
        );
        await loadIncomes();
        return;
      }
    }

    setIsSaving(false);
    setNotice(editingId ? "收入记录已更新。" : "收入记录已新增。");
    resetForm();
    await loadIncomes();
  }

  async function handleDelete(income: IncomeRecord) {
    const confirmed = window.confirm(
      `确认删除 ${income.date} 的收入记录「${getIncomeSourceLabel(income.source)}」吗？`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setNotice("");

    const { error: deleteError } = await supabase
      .from("incomes")
      .delete()
      .eq("id", income.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setNotice("收入记录已删除。");
    await loadIncomes();
  }

  async function handleViewEvidence(evidenceId: string) {
    try {
      const signedUrl = await createSignedEvidenceUrl(supabase, evidenceId);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (viewError) {
      setError(viewError instanceof Error ? viewError.message : "凭证打开失败。");
    }
  }

  return (
    <section>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink">收入管理</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
            记录电竞酒店经营收入。Phase 2A 使用 Supabase `incomes` 表实现列表、新增、编辑、删除和月份筛选。
          </p>
        </div>
        <label className="block text-sm font-medium text-ink">
          筛选月份
          <MonthInput
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[380px_1fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
        >
          <h3 className="text-lg font-semibold text-ink">
            {editingId ? "编辑收入" : "新增收入"}
          </h3>

          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-ink">
              日期
              <DateInput
                required
                value={form.date}
                onChange={(event) => updateForm("date", event.target.value)}
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              来源
              <select
                required
                value={form.source}
                onChange={(event) => updateForm("source", event.target.value)}
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              >
                <option value="">请选择来源</option>
                {incomeSourceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-ink">
              收入总额
              <input
                type="text"
                required
                inputMode="decimal"
                value={form.grossAmount}
                onChange={(event) =>
                  updateAmountAndNet("grossAmount", event.target.value)
                }
                placeholder="0.00"
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              手续费
              <input
                type="text"
                inputMode="decimal"
                value={form.feeAmount}
                onChange={(event) =>
                  updateAmountAndNet("feeAmount", event.target.value)
                }
                placeholder="0.00"
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              净收入
              <input
                type="text"
                inputMode="decimal"
                value={form.netAmount}
                onChange={(event) => updateForm("netAmount", event.target.value)}
                placeholder="0.00"
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              结算周期
              <MonthInput
                required
                value={form.settlementPeriod}
                onChange={(event) =>
                  updateForm("settlementPeriod", event.target.value)
                }
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              凭证上传
              <input
                key={fileInputKey}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                onChange={handleEvidenceFileChange}
                className="mt-2 block w-full text-sm text-stone-700"
              />
              <span className="mt-1 block text-xs font-normal text-stone-500">
                可选。支持 jpg、jpeg、png 和 pdf，保存收入后自动关联。
              </span>
            </label>

            <label className="block text-sm font-medium text-ink">
              备注
              <textarea
                value={form.note}
                onChange={(event) => updateForm("note", event.target.value)}
                rows={3}
                placeholder="凭证上传将在后续阶段实现。"
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              />
            </label>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "保存中..." : editingId ? "保存修改" : "新增收入"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-ink transition hover:border-pine hover:text-pine"
              >
                取消
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() =>
              window.alert(
                "该功能预留中，后续将支持上传截图后自动识别金额、日期和来源，人工确认后生成收入记录。"
              )
            }
            className="mt-3 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-ink transition hover:border-pine hover:text-pine"
          >
            凭证识别录入（预留）
          </button>
        </form>

        <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
            <h3 className="text-lg font-semibold text-ink">收入列表</h3>
            <button
              type="button"
              onClick={() => void loadIncomes()}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-ink transition hover:border-pine hover:text-pine"
            >
              刷新
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-stone-50 text-left text-stone-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">日期</th>
                  <th className="px-4 py-3 font-semibold">来源</th>
                  <th className="px-4 py-3 font-semibold">收入总额</th>
                  <th className="px-4 py-3 font-semibold">手续费</th>
                  <th className="px-4 py-3 font-semibold">净收入</th>
                  <th className="px-4 py-3 font-semibold">结算周期</th>
                  <th className="px-4 py-3 font-semibold">凭证</th>
                  <th className="px-4 py-3 font-semibold">备注</th>
                  <th className="px-4 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-6 text-stone-500" colSpan={9}>
                      正在读取收入数据...
                    </td>
                  </tr>
                ) : incomes.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-stone-500" colSpan={9}>
                      当前月份暂无收入记录。
                    </td>
                  </tr>
                ) : (
                  incomes.map((income) => (
                    <tr key={income.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                        {income.date}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {getIncomeSourceLabel(income.source)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                        {formatMoney(income.gross_amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                        {formatMoney(income.fee_amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                        {formatMoney(income.net_amount)}
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        {formatSettlementPeriod(income.settlement_period)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {income.evidence_file ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleViewEvidence(income.evidence_file!)
                            }
                            className="text-sm font-medium text-pine hover:text-ink"
                          >
                            查看凭证
                          </button>
                        ) : (
                          <span className="text-stone-400">-</span>
                        )}
                      </td>
                      <td className="min-w-48 px-4 py-3 text-stone-700">
                        {income.note || "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(income)}
                            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-ink transition hover:border-pine hover:text-pine"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(income)}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                          >
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
