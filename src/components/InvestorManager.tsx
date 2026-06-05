"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DateInput } from "@/components/DateInputs";
import { createClient } from "@/lib/supabase-client";
import {
  getInvestmentTypeLabel,
  investmentTypeOptions
} from "@/lib/finance-options";

type InvestorRecord = {
  id: string;
  store_id: string;
  name: string;
  email: string | null;
  contact: string | null;
  permission_role: string | null;
  notes: string | null;
  note: string | null;
  is_active: boolean;
};

type InvestorRelation = {
  id: string;
  name: string;
  email: string | null;
  contact: string | null;
  permission_role: string | null;
  notes: string | null;
  note: string | null;
};

type InvestmentRecord = {
  id: string;
  store_id: string;
  investor_id: string;
  investment_type: string;
  amount: string | number;
  share_ratio: string | number;
  investment_date: string;
  notes: string | null;
  created_at: string;
  investors?: InvestorRelation | null;
};

type RawInvestmentRecord = Omit<InvestmentRecord, "investors"> & {
  investors?: InvestorRelation | InvestorRelation[] | null;
};

type PaidDividendRecord = {
  investor_id: string;
  paid_amount: string | number;
};

type InvestorFormState = {
  investorName: string;
  contact: string;
  amount: string;
  investmentType: string;
  investmentDate: string;
  notes: string;
};

const emptyForm: InvestorFormState = {
  investorName: "",
  contact: "",
  amount: "",
  investmentType: "cash",
  investmentDate: new Date().toISOString().slice(0, 10),
  notes: ""
};

function formatMoney(value: number) {
  const rounded = Math.round(value);
  return `${rounded.toLocaleString("zh-CN")} RMB`;
}

function formatTableMoney(value: number) {
  return Math.round(value).toLocaleString("zh-CN");
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function getPermissionRoleLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    viewer: "仅查看",
    operator: "经营方",
    admin: "管理员"
  };

  return labels[value ?? "viewer"] ?? "仅查看";
}

function parseAmount(value: string | number | null) {
  if (value === null || value === "") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateShareRatio(amount: string | number, baseline: number) {
  if (baseline <= 0) {
    return 0;
  }

  return (parseAmount(amount) / baseline) * 100;
}

function isValidAmount(value: string) {
  return /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value);
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
  const [paidDividendRecords, setPaidDividendRecords] = useState<
    PaidDividendRecord[]
  >([]);
  const [baselineAmount, setBaselineAmount] = useState<number | null>(null);
  const [baselineInput, setBaselineInput] = useState("");
  const [form, setForm] = useState<InvestorFormState>(emptyForm);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingInvestorId, setEditingInvestorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingBaseline, setIsSavingBaseline] = useState(false);
  const [error, setError] = useState(storeLoadError);
  const [notice, setNotice] = useState("");

  const effectiveBaseline = baselineAmount ?? 0;
  const calculatedShareRatio = calculateShareRatio(
    form.amount || "0",
    effectiveBaseline
  );

  const totalRegisteredAmount = records.reduce(
    (sum, record) => sum + parseAmount(record.amount),
    0
  );
  const totalRegisteredShare = calculateShareRatio(
    totalRegisteredAmount,
    effectiveBaseline
  );
  const remainingAmount = effectiveBaseline - totalRegisteredAmount;

  const investorSummaries = useMemo(() => {
    const paidDividendMap = new Map<string, number>();

    for (const dividend of paidDividendRecords) {
      paidDividendMap.set(
        dividend.investor_id,
        (paidDividendMap.get(dividend.investor_id) ?? 0) +
          parseAmount(dividend.paid_amount)
      );
    }

    const summaryMap = new Map<
      string,
      {
        id: string;
        name: string;
        amount: number;
        share: number;
        paybackProgress: number;
        recordCount: number;
        permissionRole: string;
        contact: string;
      }
    >();

    for (const record of records) {
      const investor =
        record.investors ??
        investors.find((currentInvestor) => currentInvestor.id === record.investor_id) ??
        null;
      const investorName =
        investor?.name ??
        "未命名投资人";
      const current = summaryMap.get(record.investor_id) ?? {
        id: record.investor_id,
        name: investorName,
        amount: 0,
        share: 0,
        paybackProgress: 0,
        recordCount: 0,
        permissionRole: investor?.permission_role ?? "viewer",
        contact: investor?.email ?? investor?.contact ?? "-"
      };

      current.amount += parseAmount(record.amount);
      current.share = calculateShareRatio(current.amount, effectiveBaseline);
      current.paybackProgress =
        current.amount > 0
          ? ((paidDividendMap.get(record.investor_id) ?? 0) / current.amount) *
            100
          : 0;
      current.recordCount += 1;
      current.permissionRole = investor?.permission_role ?? "viewer";
      current.contact = investor?.email ?? investor?.contact ?? "-";
      summaryMap.set(record.investor_id, current);
    }

    return Array.from(summaryMap.values()).sort((a, b) => b.amount - a.amount);
  }, [effectiveBaseline, investors, paidDividendRecords, records]);

  async function ensureFinanceSettings() {
    if (!defaultStoreId) {
      return null;
    }

    const { data: existingSetting, error: loadError } = await supabase
      .from("store_finance_settings")
      .select("investment_baseline")
      .eq("store_id", defaultStoreId)
      .maybeSingle();

    if (loadError) {
      throw loadError;
    }

    if (existingSetting) {
      return parseAmount(existingSetting.investment_baseline);
    }

    const { data: createdSetting, error: insertError } = await supabase
      .from("store_finance_settings")
      .insert({ store_id: defaultStoreId })
      .select("investment_baseline")
      .single();

    if (insertError) {
      throw insertError;
    }

    return parseAmount(createdSetting.investment_baseline);
  }

  async function loadInvestors() {
    setError("");
    setNotice("");
    setIsLoading(true);

    try {
      const loadedBaseline = await ensureFinanceSettings();

      if (loadedBaseline !== null) {
        setBaselineAmount(loadedBaseline);
        setBaselineInput(String(Math.round(loadedBaseline)));
      }

      let investorQuery = supabase
        .from("investors")
        .select("id,store_id,name,email,contact,permission_role,notes,note,is_active")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      let recordQuery = supabase
        .from("investment_records")
        .select(
          "id,store_id,investor_id,investment_type,amount,share_ratio,investment_date,notes,created_at,investors(id,name,email,contact,permission_role,notes,note)"
        )
        .order("investment_date", { ascending: false })
        .order("created_at", { ascending: false });

      let dividendQuery = supabase
        .from("dividend_records")
        .select("investor_id,paid_amount")
        .eq("status", "paid");

      if (defaultStoreId) {
        investorQuery = investorQuery.eq("store_id", defaultStoreId);
        recordQuery = recordQuery.eq("store_id", defaultStoreId);
        dividendQuery = dividendQuery.eq("store_id", defaultStoreId);
      }

      const [investorResult, recordResult, dividendResult] = await Promise.all([
        investorQuery,
        recordQuery,
        dividendQuery
      ]);

      if (investorResult.error) {
        throw investorResult.error;
      }

      if (recordResult.error) {
        throw recordResult.error;
      }

      if (dividendResult.error) {
        throw dividendResult.error;
      }

      setInvestors((investorResult.data ?? []) as InvestorRecord[]);
      setPaidDividendRecords(
        (dividendResult.data ?? []) as PaidDividendRecord[]
      );
      setRecords(
        ((recordResult.data ?? []) as RawInvestmentRecord[]).map((record) => ({
          ...record,
          investors: Array.isArray(record.investors)
            ? record.investors[0] ?? null
            : record.investors ?? null
        }))
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "加载失败。");
    } finally {
      setIsLoading(false);
    }
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
          notes: form.notes.trim() || null,
          note: form.notes.trim() || null
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
        permission_role: "viewer",
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

  async function updateInvestorTotals(investorId: string, baseline: number) {
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
        share_ratio: calculateShareRatio(totalAmount, baseline) / 100
      })
      .eq("id", investorId);

    if (updateError) {
      throw updateError;
    }
  }

  async function updateAllShareRatios(nextBaseline: number) {
    const investorIds = Array.from(new Set(records.map((record) => record.investor_id)));

    await Promise.all(
      records.map((record) =>
        supabase
          .from("investment_records")
          .update({
            share_ratio: calculateShareRatio(record.amount, nextBaseline)
          })
          .eq("id", record.id)
      )
    );

    await Promise.all(
      investorIds.map((investorId) => updateInvestorTotals(investorId, nextBaseline))
    );
  }

  async function handleBaselineSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!defaultStoreId) {
      setError("当前账号未绑定门店，无法保存项目总投资基准。");
      return;
    }

    if (!isValidAmount(baselineInput) || parseAmount(baselineInput) <= 0) {
      setError("请填写大于 0 的项目总投资基准金额。");
      return;
    }

    const nextBaseline = parseAmount(baselineInput);
    setIsSavingBaseline(true);

    try {
      const { error: upsertError } = await supabase
        .from("store_finance_settings")
        .upsert({
          store_id: defaultStoreId,
          investment_baseline: nextBaseline
        });

      if (upsertError) {
        throw upsertError;
      }

      await updateAllShareRatios(nextBaseline);
      setBaselineAmount(nextBaseline);
      setNotice("项目总投资基准已更新，持股比例已按新基准重新计算。");
      await loadInvestors();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败。");
    } finally {
      setIsSavingBaseline(false);
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

    if (form.investmentType === "other" && !form.notes.trim()) {
      setError("投资类型为其他时，请在备注中填写具体说明。");
      return;
    }

    if (!defaultStoreId) {
      setError("当前账号未绑定门店，无法保存投资记录。");
      return;
    }

    if (!baselineAmount || baselineAmount <= 0) {
      setError("请先设置有效的项目总投资基准。");
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
        description: null,
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

      await updateInvestorTotals(investorId, baselineAmount);
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
      await updateInvestorTotals(record.investor_id, effectiveBaseline);
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

  function handlePermissionClick() {
    window.alert(
      "权限功能预留中，后续将支持按角色控制可查看内容和可操作功能。"
    );
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
        <SummaryCard
          title="项目总投资基准"
          value={baselineAmount === null ? "未设置" : formatMoney(baselineAmount)}
        />
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

      <form
        onSubmit={handleBaselineSubmit}
        className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] md:flex-row md:items-end"
      >
        <label className="block md:w-72">
          <span className="text-sm font-medium text-stone-700">
            修改项目总投资基准
          </span>
          <input
            value={baselineInput}
            onChange={(event) => setBaselineInput(event.target.value)}
            inputMode="decimal"
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
            placeholder="例如 420000"
          />
        </label>
        <button
          type="submit"
          disabled={isSavingBaseline}
          className="rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSavingBaseline ? "保存中..." : "保存基准金额"}
        </button>
        <p className="text-sm text-stone-500">
          持股比例 = 投资金额 / 项目总投资基准 x 100
        </p>
      </form>

      {remainingAmount < 0 ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          当前登记投资额已超过基准金额，请确认是否属于追加投资或录入错误。
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
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
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
                房租入股将作为投资记录处理，不计入前两年实际支出。例如：5000/月 x 24 个月，永久股权。
              </div>
            ) : null}

            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                投资日期
              </span>
              <DateInput
                required
                value={form.investmentDate}
                onChange={(event) =>
                  updateForm("investmentDate", event.target.value)
                }
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-stone-700">备注</span>
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                className="mt-1 min-h-24 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
                placeholder="例如：房租入股，5000/月 x 24个月，永久股权。"
              />
            </label>

            <div className="rounded-md border border-stone-200 bg-paper px-4 py-3 text-sm text-stone-700">
              自动计算持股比例：
              <span className="ml-2 font-semibold text-ink">
                {formatPercent(calculatedShareRatio)}
              </span>
              <p className="mt-1 text-xs text-stone-500">
                计算公式：投资金额 / 项目总投资基准 x 100。分红暂缓领取不会自动增加股份比例。
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
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="border-b border-stone-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-ink">投资人汇总</h3>
            </div>
            <div className="overflow-hidden">
              <table className="w-full table-fixed divide-y divide-stone-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <TableHead>投资人姓名</TableHead>
                    <TableHead>累计投资金额（RMB）</TableHead>
                    <TableHead>当前持股比例</TableHead>
                    <TableHead>回本进度</TableHead>
                    <TableHead>投资记录数</TableHead>
                    <TableHead>权限</TableHead>
                    <TableHead>联系方式</TableHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {investorSummaries.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-stone-500" colSpan={7}>
                        暂无投资人汇总。
                      </td>
                    </tr>
                  ) : (
                    investorSummaries.map((summary) => (
                      <tr key={summary.id}>
                        <TableCell>{summary.name}</TableCell>
                        <TableCell>{formatTableMoney(summary.amount)}</TableCell>
                        <TableCell>{formatPercent(summary.share)}</TableCell>
                        <TableCell>{formatPercent(summary.paybackProgress)}</TableCell>
                        <TableCell>{summary.recordCount}</TableCell>
                        <td className="px-4 py-3 text-stone-700">
                          <div className="flex flex-col gap-1">
                            <span>{getPermissionRoleLabel(summary.permissionRole)}</span>
                            <button
                              type="button"
                              onClick={handlePermissionClick}
                              className="w-fit text-sm font-medium text-pine hover:underline"
                            >
                              修改权限
                            </button>
                          </div>
                        </td>
                        <TableCell>{summary.contact || "-"}</TableCell>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="border-b border-stone-200 px-5 py-4">
              <h3 className="text-lg font-semibold text-ink">
                投资人 / 投资记录列表
              </h3>
            </div>

            <div className="overflow-hidden">
              <table className="w-full table-fixed divide-y divide-stone-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <TableHead className="w-28">投资人姓名</TableHead>
                    <TableHead className="w-24">投资类型</TableHead>
                    <TableHead className="w-28">投资金额（RMB）</TableHead>
                    <TableHead className="w-28">当前持股比例</TableHead>
                    <TableHead className="w-28">投资日期</TableHead>
                    <TableHead className="w-64">备注</TableHead>
                    <TableHead className="w-24">操作</TableHead>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {isLoading ? (
                    <tr>
                      <td className="px-4 py-6 text-stone-500" colSpan={7}>
                        正在加载投资记录...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td className="px-4 py-6 text-stone-500" colSpan={7}>
                        暂无投资记录。
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.id} className="align-top">
                        <TableCell>{record.investors?.name ?? "-"}</TableCell>
                        <TableCell>
                          {getInvestmentTypeLabel(record.investment_type)}
                        </TableCell>
                        <TableCell>{formatTableMoney(parseAmount(record.amount))}</TableCell>
                        <TableCell>
                          {formatPercent(
                            calculateShareRatio(record.amount, effectiveBaseline)
                          )}
                        </TableCell>
                        <TableCell>{record.investment_date}</TableCell>
                        <td className="px-4 py-3 text-stone-700">
                          <div className="max-h-20 w-full overflow-y-auto whitespace-pre-wrap break-words pr-2">
                            {record.notes || "-"}
                          </div>
                        </td>
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

function TableHead({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`px-4 py-3 font-semibold ${className}`}>{children}</th>;
}

function TableCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="truncate px-4 py-3 text-stone-700" title={String(children ?? "")}>
      {children}
    </td>
  );
}

