"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import { DateInput, MonthInput } from "@/components/DateInputs";
import {
  createSignedEvidenceUrl,
  uploadEvidenceForRecord
} from "@/lib/evidence-client";
import {
  expenseCategoryOptions,
  getExpenseCategoryLabel,
  paymentMethodOptions
} from "@/lib/finance-options";

type ExpenseRecord = {
  id: string;
  store_id: string;
  date: string;
  category: string;
  amount: string | number;
  payee: string | null;
  payment_method: string | null;
  included_in_monthly_cost: boolean | null;
  note: string | null;
  evidence_file: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ExpenseFormState = {
  date: string;
  category: string;
  amount: string;
  payee: string;
  paymentMethod: string;
  includedInMonthlyCost: boolean;
  note: string;
};

const emptyForm: ExpenseFormState = {
  date: todayValue(),
  category: "",
  amount: "",
  payee: "",
  paymentMethod: "",
  includedInMonthlyCost: true,
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

function validateAmount(value: string) {
  return /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value);
}

export function ExpenseManager({
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
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [form, setForm] = useState<ExpenseFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState(storeLoadError);
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  async function loadExpenses() {
    setError("");
    setNotice("");
    setIsLoading(true);

    const range = getMonthRange(month);
    let query = supabase
      .from("expenses")
      .select(
        "id,store_id,date,category,amount,payee,payment_method,included_in_monthly_cost,note,evidence_file,created_by,created_at,updated_at"
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

    setExpenses((data ?? []) as ExpenseRecord[]);
  }

  useEffect(() => {
    void loadExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, defaultStoreId]);

  function updateForm<K extends keyof ExpenseFormState>(
    key: K,
    value: ExpenseFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditingId(null);
    setEvidenceFile(null);
    setFileInputKey((current) => current + 1);
    setForm({ ...emptyForm, date: todayValue() });
  }

  function handleEvidenceFileChange(event: ChangeEvent<HTMLInputElement>) {
    setEvidenceFile(event.target.files?.[0] ?? null);
  }

  function startEdit(expense: ExpenseRecord) {
    setEditingId(expense.id);
    setForm({
      date: expense.date,
      category: expense.category,
      amount: String(expense.amount ?? ""),
      payee: expense.payee ?? "",
      paymentMethod: expense.payment_method ?? "",
      includedInMonthlyCost: Boolean(expense.included_in_monthly_cost),
      note: expense.note ?? ""
    });
    setError("");
    setNotice("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!defaultStoreId) {
      setError("无法保存支出：没有可用的默认 store_id。请先确认当前用户 profile.store_id 或 stores 表数据。");
      return;
    }

    if (!currentUserId) {
      setError("无法保存支出：当前登录用户信息为空。");
      return;
    }

    if (!validateAmount(form.amount)) {
      setError("金额格式不正确，请输入最多两位小数的非负金额。");
      return;
    }

    setIsSaving(true);

    const payload = {
      store_id: defaultStoreId,
      date: form.date,
      category: form.category.trim(),
      amount: form.amount,
      payee: form.payee.trim() || null,
      payment_method: form.paymentMethod.trim() || null,
      included_in_monthly_cost: form.includedInMonthlyCost,
      note: form.note.trim() || null,
      created_by: currentUserId
    };

    const result = editingId
      ? await supabase
          .from("expenses")
          .update({
            date: payload.date,
            category: payload.category,
            amount: payload.amount,
            payee: payload.payee,
            payment_method: payload.payment_method,
            included_in_monthly_cost: payload.included_in_monthly_cost,
            note: payload.note
          })
          .eq("id", editingId)
          .select("id")
          .single()
      : await supabase.from("expenses").insert(payload).select("id").single();

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
          evidenceType: "expense",
          relatedTable: "expenses",
          relatedRecordId: result.data.id
        });
      } catch (uploadError) {
        setIsSaving(false);
        setError(
          `支出记录已保存，但凭证上传失败：${
            uploadError instanceof Error ? uploadError.message : "未知错误"
          }`
        );
        await loadExpenses();
        return;
      }
    }

    setIsSaving(false);
    setNotice(editingId ? "支出记录已更新。" : "支出记录已新增。");
    resetForm();
    await loadExpenses();
  }

  async function handleDelete(expense: ExpenseRecord) {
    const confirmed = window.confirm(
      `确认删除 ${expense.date} 的支出记录「${getExpenseCategoryLabel(expense.category)}」吗？`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setNotice("");

    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expense.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setNotice("支出记录已删除。");
    await loadExpenses();
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
          <h2 className="text-2xl font-bold text-ink">支出管理</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
            记录运营支出、成本和费用。Phase 2B 使用 Supabase `expenses` 表实现列表、新增、编辑、删除和按月查看。
          </p>
        </div>
        <label className="block text-sm font-medium text-ink">
          选择月份
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
          className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
        >
          <h3 className="text-lg font-semibold text-ink">
            {editingId ? "编辑支出" : "新增支出"}
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
              分类
              <select
                required
                value={form.category}
                onChange={(event) => updateForm("category", event.target.value)}
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              >
                <option value="">请选择分类</option>
                {expenseCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-ink">
              金额
              <input
                type="text"
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(event) => updateForm("amount", event.target.value)}
                placeholder="0.00"
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              收款方
              <input
                type="text"
                value={form.payee}
                onChange={(event) => updateForm("payee", event.target.value)}
                placeholder="例如：物业、供应商"
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              支付方式
              <select
                value={form.paymentMethod}
                onChange={(event) =>
                  updateForm("paymentMethod", event.target.value)
                }
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              >
                <option value="">请选择支付方式</option>
                {paymentMethodOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-3 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={form.includedInMonthlyCost}
                onChange={(event) =>
                  updateForm("includedInMonthlyCost", event.target.checked)
                }
                className="h-4 w-4 rounded border-stone-300 text-pine focus:ring-pine"
              />
              计入月度成本
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
                可选。支持 jpg、jpeg、png 和 pdf，保存支出后自动关联。
              </span>
            </label>

            <label className="block text-sm font-medium text-ink">
              备注
              <textarea
                value={form.note}
                onChange={(event) => updateForm("note", event.target.value)}
                rows={3}
                placeholder="补充支出说明"
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              />
            </label>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white transition hover:bg-slateblue disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "保存中..." : editingId ? "保存修改" : "新增支出"}
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
                "该功能预留中，后续将支持上传截图后自动识别金额、日期和分类，人工确认后生成支出记录。"
              )
            }
            className="mt-3 rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600 transition hover:border-pine hover:text-pine"
          >
            凭证识别录入（预留）
          </button>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
            <h3 className="text-lg font-semibold text-ink">支出列表</h3>
            <button
              type="button"
              onClick={() => void loadExpenses()}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-ink transition hover:border-pine hover:text-pine"
            >
              刷新
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">日期</th>
                  <th className="px-4 py-3 font-semibold">分类</th>
                  <th className="px-4 py-3 font-semibold">金额</th>
                  <th className="px-4 py-3 font-semibold">收款方</th>
                  <th className="px-4 py-3 font-semibold">支付方式</th>
                  <th className="px-4 py-3 font-semibold">月度成本</th>
                  <th className="px-4 py-3 font-semibold">凭证</th>
                  <th className="px-4 py-3 font-semibold">备注</th>
                  <th className="px-4 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-6 text-stone-500" colSpan={9}>
                      正在读取支出数据...
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-stone-500" colSpan={9}>
                      当前月份暂无支出记录。
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                        {expense.date}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {getExpenseCategoryLabel(expense.category)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                        {formatMoney(expense.amount)}
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        {expense.payee || "-"}
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        {expense.payment_method || "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                        {expense.included_in_monthly_cost ? "是" : "否"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {expense.evidence_file ? (
                          <button
                            type="button"
                            onClick={() =>
                              void handleViewEvidence(expense.evidence_file!)
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
                        {expense.note || "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(expense)}
                            className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-ink transition hover:border-pine hover:text-pine"
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(expense)}
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

