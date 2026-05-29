"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-client";

type IncomeStatus = "draft" | "confirmed" | "locked" | "void";

type IncomeRecord = {
  id: string;
  store_id: string;
  income_date: string;
  category: string;
  amount: string | number;
  payment_method: string | null;
  description: string | null;
  status: IncomeStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type IncomeFormState = {
  incomeDate: string;
  category: string;
  amount: string;
  paymentMethod: string;
  description: string;
  status: IncomeStatus;
};

const emptyForm: IncomeFormState = {
  incomeDate: new Date().toISOString().slice(0, 10),
  category: "",
  amount: "",
  paymentMethod: "",
  description: "",
  status: "draft"
};

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

function formatMoney(value: string | number) {
  const text = String(value);
  const [integerPart, decimalPart = "00"] = text.split(".");
  return `${integerPart}.${decimalPart.padEnd(2, "0").slice(0, 2)}`;
}

function validateAmount(value: string) {
  return /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value);
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

  async function loadIncomes() {
    setError("");
    setNotice("");
    setIsLoading(true);

    const range = getMonthRange(month);
    let query = supabase
      .from("incomes")
      .select(
        "id,store_id,income_date,category,amount,payment_method,description,status,created_by,created_at,updated_at"
      )
      .gte("income_date", range.start)
      .lt("income_date", range.end)
      .order("income_date", { ascending: false })
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

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, incomeDate: `${month}-01` });
  }

  function startEdit(income: IncomeRecord) {
    setEditingId(income.id);
    setForm({
      incomeDate: income.income_date,
      category: income.category,
      amount: String(income.amount),
      paymentMethod: income.payment_method ?? "",
      description: income.description ?? "",
      status: income.status
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

    if (!validateAmount(form.amount)) {
      setError("金额格式不正确，请输入最多两位小数的非负金额。");
      return;
    }

    setIsSaving(true);

    const payload = {
      store_id: defaultStoreId,
      income_date: form.incomeDate,
      category: form.category.trim(),
      amount: form.amount,
      payment_method: form.paymentMethod.trim() || null,
      description: form.description.trim() || null,
      status: form.status,
      created_by: currentUserId
    };

    const result = editingId
      ? await supabase
          .from("incomes")
          .update({
            income_date: payload.income_date,
            category: payload.category,
            amount: payload.amount,
            payment_method: payload.payment_method,
            description: payload.description,
            status: payload.status
          })
          .eq("id", editingId)
      : await supabase.from("incomes").insert(payload);

    setIsSaving(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setNotice(editingId ? "收入记录已更新。" : "收入记录已新增。");
    resetForm();
    await loadIncomes();
  }

  async function handleDelete(income: IncomeRecord) {
    const confirmed = window.confirm(
      `确认删除 ${income.income_date} 的收入记录「${income.category}」吗？`
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
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="mt-2 block rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
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
              <input
                type="date"
                required
                value={form.incomeDate}
                onChange={(event) => updateForm("incomeDate", event.target.value)}
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              分类
              <input
                type="text"
                required
                value={form.category}
                onChange={(event) => updateForm("category", event.target.value)}
                placeholder="例如：客房收入、饮品收入"
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              />
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
              支付方式
              <input
                type="text"
                value={form.paymentMethod}
                onChange={(event) =>
                  updateForm("paymentMethod", event.target.value)
                }
                placeholder="例如：现金、微信、支付宝"
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              />
            </label>

            <label className="block text-sm font-medium text-ink">
              状态
              <select
                value={form.status}
                onChange={(event) =>
                  updateForm("status", event.target.value as IncomeStatus)
                }
                className="mt-2 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
              >
                <option value="draft">草稿</option>
                <option value="confirmed">已确认</option>
                <option value="locked">已锁定</option>
                <option value="void">作废</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-ink">
              说明
              <textarea
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
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
                  <th className="px-4 py-3 font-semibold">分类</th>
                  <th className="px-4 py-3 font-semibold">金额</th>
                  <th className="px-4 py-3 font-semibold">支付方式</th>
                  <th className="px-4 py-3 font-semibold">状态</th>
                  <th className="px-4 py-3 font-semibold">说明</th>
                  <th className="px-4 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {isLoading ? (
                  <tr>
                    <td className="px-4 py-6 text-stone-500" colSpan={7}>
                      正在读取收入数据...
                    </td>
                  </tr>
                ) : incomes.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-stone-500" colSpan={7}>
                      当前月份暂无收入记录。
                    </td>
                  </tr>
                ) : (
                  incomes.map((income) => (
                    <tr key={income.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                        {income.income_date}
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {income.category}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                        {formatMoney(income.amount)}
                      </td>
                      <td className="px-4 py-3 text-stone-700">
                        {income.payment_method || "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                        {income.status}
                      </td>
                      <td className="min-w-48 px-4 py-3 text-stone-700">
                        {income.description || "-"}
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
