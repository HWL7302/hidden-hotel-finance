"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase-client";
import {
  getInvestmentTypeLabel,
  investmentTypeOptions
} from "@/lib/finance-options";

const initialInvestmentTotal = 420000;

type InvestorRecord = {
  id: string;
  store_id: string;
  name: string;
  email: string | null;
  contact: string | null;
  notes: string | null;
  note: string | null;
  is_active: boolean;
};

type InvestmentRecord = {
  id: string;
  store_id: string;
  investor_id: string;
  investment_type: string;
  amount: string | number;
  share_ratio: string | number;
  investment_date: string;
  description: string | null;
  notes: string | null;
  created_at: string;
  investors?: InvestorRelation | null;
};

type InvestorRelation = {
  id: string;
  name: string;
  email: string | null;
  contact: string | null;
  notes: string | null;
  note: string | null;
};

type RawInvestmentRecord = Omit<InvestmentRecord, "investors"> & {
  investors?: InvestorRelation | InvestorRelation[] | null;
};

type InvestorFormState = {
  investorName: string;
  contact: string;
  amount: string;
  investmentType: string;
  investmentDate: string;
  description: string;
  notes: string;
};

const emptyForm: InvestorFormState = {
  investorName: "",
  contact: "",
  amount: "",
  investmentType: "cash",
  investmentDate: new Date().toISOString().slice(0, 10),
  description: "",
  notes: ""
};

function formatMoney(value: number) {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function parseAmount(value: string | number | null) {
  if (value === null || value === "") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateShareRatio(amount: string | number) {
  return (parseAmount(amount) / initialInvestmentTotal) * 100;
}

function isValidAmount(value: string) {
  return /^-?(0|[1-9]\d*)(\.\d{1,2})?$/.test(value);
}

export function InvestorManager({
  currentRole,
  defaultStoreId,
  storeLoadError
}: {
  currentRole: string;
  defaultStoreId: string | null;
  storeLoadError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [investors, setInvestors] = useState<InvestorRecord[]>([]);
  const [records, setRecords] = useState<InvestmentRecord[]>([]);
  const [form, setForm] = useState<InvestorFormState>(emptyForm);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingInvestorId, setEditingInvestorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(storeLoadError);
  const [notice, setNotice] = useState("");

  const calculatedShareRatio = calculateShareRatio(form.amount || "0");

  const totalRegisteredAmount = records.reduce(
    (sum, record) => sum + parseAmount(record.amount),
    0
  );
  const totalRegisteredShare = records.reduce(
    (sum, record) => sum + parseAmount(record.share_ratio),
    0
  );
  const remainingAmount = initialInvestmentTotal - totalRegisteredAmount;

  const investorSummaries = useMemo(() => {
    const summaryMap = new Map<string, { name: string; amount: number; share: number }>();

    for (const record of records) {
      const investorName =
        record.investors?.name ??
        investors.find((investor) => investor.id === record.investor_id)?.name ??
        "未命名投资人";
      const current = summaryMap.get(record.investor_id) ?? {
        name: investorName,
        amount: 0,
        share: 0
      };

      current.amount += parseAmount(record.amount);
      current.share += parseAmount(record.share_ratio);
      summaryMap.set(record.investor_id, current);
    }

    return Array.from(summaryMap.values()).sort((a, b) => b.amount - a.amount);
  }, [investors, records]);

  async function loadInvestors() {
    setError("");
    setNotice("");
    setIsLoading(true);

    let investorQuery = supabase
      .from("investors")
      .select("id,store_id,name,email,contact,notes,note,is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    let recordQuery = supabase
      .from("investment_records")
      .select(
        "id,store_id,investor_id,investment_type,amount,share_ratio,investment_date,description,notes,created_at,investors(id,name,email,contact,notes,note)"
      )
      .order("investment_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (defaultStoreId) {
      investorQuery = investorQuery.eq("store_id", defaultStoreId);
      recordQuery = recordQuery.eq("store_id", defaultStoreId);
    }

    const [investorResult, recordResult] = await Promise.all([
      investorQuery,
      recordQuery
    ]);

    setIsLoading(false);

    if (investorResult.error) {
      setError(investorResult.error.message);
      return;
    }

    if (recordResult.error) {
      setError(recordResult.error.message);
      return;
    }

    setInvestors((investorResult.data ?? []) as InvestorRecord[]);
    setRecords(
      ((recordResult.data ?? []) as RawInvestmentRecord[]).map((record) => ({
        ...record,
        investors: Array.isArray(record.investors)
          ? record.investors[0] ?? null
          : record.investors ?? null
      }))
    );
  }

  useEffect(() => {
    void loadInvestors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStoreId]);

  function updateForm<K extends keyof InvestorFormState>(
    key: K,
    value: InvestorFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingRecordId(null);
    setEditingInvestorId(null);
    setError("");
    setNotice("");
  }

  function startEdit(record: InvestmentRecord) {
    setEditingRecordId(record.id);
    setEditingInvestorId(record.investor_id);
    setForm({
      investorName: record.investors?.name ?? "",
      contact: record.investors?.email ?? record.investors?.contact ?? "",
      amount: String(record.amount ?? ""),
      investmentType: record.investment_type,
      investmentDate: record.investment_date,
      description: record.description ?? "",
      notes: record.notes ?? record.investors?.notes ?? record.investors?.note ?? ""
    });
    setError("");
    setNotice("");
  }

  async function findOrCreateInvestor() {
    if (!defaultStoreId) {
      throw new Error("当前账号未绑定门店，无法保存投资记录。");
    }

    if (editingInvestorId) {
      const { error: updateError } = await supabase
        .from("investors")
        .update({
          name: form.investorName.trim(),
          email: form.contact.trim() || null,
          contact: form.contact.trim() || null,
          notes: form.notes.trim() || null
        })
        .eq("id", editingInvestorId);

      if (updateError) {
        throw updateError;
      }

      return editingInvestorId;
    }

    const existingInvestor = investors.find(
      (investor) =>
        investor.name.trim() === form.investorName.trim() &&
        investor.store_id === defaultStoreId
    );

    if (existingInvestor) {
      return existingInvestor.id;
    }

    const amount = parseAmount(form.amount);
    const { data, error: insertError } = await supabase
      .from("investors")
      .insert({
        store_id: defaultStoreId,
        name: form.investorName.trim(),
        email: form.contact.trim() || null,
        contact: form.contact.trim() || null,
        investment_amount: amount,
        share_ratio: calculatedShareRatio / 100,
        notes: form.notes.trim() || null,
        note: form.notes.trim() || null,
        is_active: true
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    return data.id as string;
  }

  async function updateInvestorTotals(investorId: string) {
    const { data, error: recordsError } = await supabase
      .from("investment_records")
      .select("amount")
      .eq("investor_id", investorId);

    if (recordsError) {
      throw recordsError;
    }

    const totalAmount = (data ?? []).reduce(
      (sum, record) => sum + parseAmount(record.amount),
      0
    );

    const { error: updateError } = await supabase
      .from("investors")
      .update({
        investment_amount: totalAmount,
        share_ratio: totalAmount / initialInvestmentTotal
      })
      .eq("id", investorId);

    if (updateError) {
      throw updateError;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (currentRole && currentRole !== "admin") {
      setError("当前页面第一版仅用于管理员维护投资人数据。");
      return;
    }

    if (!form.investorName.trim()) {
      setError("请填写投资人姓名。");
      return;
    }

    if (!isValidAmount(form.amount)) {
      setError("请填写正确的投资金额，最多保留两位小数。");
      return;
    }

    if (!defaultStoreId) {
      setError("当前账号未绑定门店，无法保存投资记录。");
      return;
    }

    setIsSaving(true);

    try {
      const investorId = await findOrCreateInvestor();
      const payload = {
        store_id: defaultStoreId,
        investor_id: investorId,
        investment_type: form.investmentType,
        amount: form.amount,
        share_ratio: calculatedShareRatio,
        investment_date: form.investmentDate,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null
      };

      const result = editingRecordId
        ? await supabase
            .from("investment_records")
            .update(payload)
            .eq("id", editingRecordId)
        : await supabase.from("investment_records").insert(payload);

      if (result.error) {
        throw result.error;
      }

      await updateInvestorTotals(investorId);
      setNotice(editingRecordId ? "投资记录已更新。" : "投资记录已新增。");
      resetForm();
      await loadInvestors();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(record: InvestmentRecord) {
    const confirmed = window.confirm(
      `确认删除 ${record.investors?.name ?? "该投资人"} 的这条投资记录吗？`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setNotice("");

    const { error: deleteError } = await supabase
      .from("investment_records")
      .delete()
      .eq("id", record.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    try {
      await updateInvestorTotals(record.investor_id);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "投资人汇总字段更新失败。"
      );
      return;
    }

    setNotice("投资记录已删除。");
    await loadInvestors();
  }

  return (
    <section>
      <div>
        <h2 className="text-2xl font-bold text-ink">投资人管理</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
          记录投资人、投资金额、投资类型和持股比例，用于后续分红、回本进度和权限查看。
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <SummaryCard title="初始总投资" value="420,000 RMB" />
        <SummaryCard
          title="当前登记投资额"
          value={formatMoney(totalRegisteredAmount)}
        />
        <SummaryCard
          title="当前登记股份"
          value={formatPercent(totalRegisteredShare)}
        />
        <SummaryCard
          title="待登记金额"
          value={formatMoney(remainingAmount)}
          tone={remainingAmount < 0 ? "warning" : "default"}
        />
      </div>

      {remainingAmount < 0 ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          当前登记投资额已超过初始总投资，请确认是否属于追加投资、股权调整或录入错误。
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[420px_1fr]">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-ink">
              {editingRecordId ? "编辑投资记录" : "新增投资记录"}
            </h3>
            {editingRecordId ? (
              <button
                type="button"
                onClick={resetForm}
                className="text-sm font-medium text-stone-500 hover:text-ink"
              >
                取消编辑
              </button>
            ) : null}
          </div>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                投资人姓名
              </span>
              <input
                required
                value={form.investorName}
                onChange={(event) => updateForm("investorName", event.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                邮箱 / 联系方式
              </span>
              <input
                value={form.contact}
                onChange={(event) => updateForm("contact", event.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                投资金额
              </span>
              <input
                required
                inputMode="decimal"
                value={form.amount}
                onChange={(event) => updateForm("amount", event.target.value)}
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
                placeholder="例如 42000"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                投资类型
              </span>
              <select
                required
                value={form.investmentType}
                onChange={(event) =>
                  updateForm("investmentType", event.target.value)
                }
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
              >
                {investmentTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {form.investmentType === "rent_equity" ? (
              <div className="rounded-md border border-brass/30 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                房租入股将作为投资记录处理，不计入前两年实际支出。本项目房东示例：5,000 RMB/月 x 24 个月 = 120,000 RMB 永久股权。
              </div>
            ) : null}

            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                投资日期
              </span>
              <input
                type="date"
                required
                value={form.investmentDate}
                onChange={(event) =>
                  updateForm("investmentDate", event.target.value)
                }
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">说明</span>
              <textarea
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                className="mt-1 min-h-20 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">备注</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                className="mt-1 min-h-20 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
              />
            </label>

            <div className="rounded-md border border-stone-200 bg-paper px-4 py-3 text-sm text-stone-700">
              自动计算持股比例：
              <span className="ml-2 font-semibold text-ink">
                {formatPercent(calculatedShareRatio)}
              </span>
              <p className="mt-1 text-xs text-stone-500">
                计算公式：投资金额 / 420000 x 100。分红暂缓领取不会自动增加股份比例。
              </p>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "保存中..." : editingRecordId ? "保存修改" : "新增投资记录"}
            </button>
          </div>
        </form>

        <div className="space-y-6">
          <div className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-ink">投资人汇总</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {investorSummaries.length === 0 ? (
                <p className="text-sm text-stone-500">暂无投资人汇总。</p>
              ) : (
                investorSummaries.map((summary) => (
                  <div
                    key={summary.name}
                    className="rounded-md border border-stone-200 bg-paper px-4 py-3"
                  >
                    <p className="font-medium text-ink">{summary.name}</p>
                    <p className="mt-1 text-sm text-stone-600">
                      累计投资：{formatMoney(summary.amount)}
                    </p>
                    <p className="text-sm text-stone-600">
                      当前持股：{formatPercent(summary.share)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
            <div className="border-b border-stone-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-ink">
                投资人 / 投资记录列表
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-stone-200 text-sm">
                <thead className="bg-paper text-left text-stone-600">
                  <tr>
                    <TableHead>投资人姓名</TableHead>
                    <TableHead>投资类型</TableHead>
                    <TableHead>投资金额</TableHead>
                    <TableHead>当前持股比例</TableHead>
                    <TableHead>投资日期</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead>操作</TableHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {isLoading ? (
                    <tr>
                      <td className="px-4 py-6 text-stone-500" colSpan={8}>
                        正在加载投资记录...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-stone-500" colSpan={8}>
                        暂无投资记录。
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.id}>
                        <TableCell>{record.investors?.name ?? "-"}</TableCell>
                        <TableCell>
                          {getInvestmentTypeLabel(record.investment_type)}
                        </TableCell>
                        <TableCell>{formatMoney(parseAmount(record.amount))}</TableCell>
                        <TableCell>
                          {formatPercent(parseAmount(record.share_ratio))}
                        </TableCell>
                        <TableCell>{record.investment_date}</TableCell>
                        <TableCell>{record.description || "-"}</TableCell>
                        <TableCell>{record.notes || "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(record)}
                              className="text-sm font-medium text-pine hover:underline"
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(record)}
                              className="text-sm font-medium text-red-700 hover:underline"
                            >
                              删除
                            </button>
                          </div>
                        </TableCell>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SummaryCard({
  title,
  value,
  tone = "default"
}: {
  title: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div
      className={`rounded-lg border bg-white p-4 shadow-sm ${
        tone === "warning" ? "border-amber-300" : "border-stone-200"
      }`}
    >
      <p className="text-sm text-stone-500">{title}</p>
      <p className="mt-2 text-xl font-bold text-ink">{value}</p>
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 font-semibold">{children}</th>
  );
}

function TableCell({ children }: { children: React.ReactNode }) {
  return <td className="whitespace-nowrap px-4 py-3 text-stone-700">{children}</td>;
}
