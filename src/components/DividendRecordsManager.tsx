"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DateInput } from "@/components/DateInputs";
import { MonthToolbar } from "@/components/MonthToolbar";
import { createClient } from "@/lib/supabase-client";
import { isMonthlyClosingPermissionError } from "@/lib/month-lock";
import { canPerform, type AppRole } from "@/lib/permissions";

type IncomeRecord = {
  net_amount: string | number;
};

type ExpenseRecord = {
  amount: string | number;
  included_in_monthly_cost: boolean | null;
};

type InvestorRecord = {
  id: string;
  name: string;
  email: string | null;
  investment_amount: string | number;
  share_ratio: string | number;
  is_active: boolean;
};

type InvestorProfile = {
  id: string;
  investment_amount: string | number | null;
  share_ratio: string | number | null;
};

type DividendRecord = {
  id: string;
  store_id: string;
  settlement_month: string;
  investor_id: string;
  investor_name: string;
  share_ratio: string | number;
  expected_amount: string | number;
  paid_amount: string | number;
  status: DividendStatus;
  paid_date: string | null;
  receipt_id: string | null;
  notes: string | null;
  created_at: string;
};

type MonthlyClosingRecord = {
  is_locked: boolean | null;
};

type DividendStatus = "unpaid" | "paid" | "deferred";

type EditFormState = {
  paidAmount: string;
  status: DividendStatus;
  paidDate: string;
  notes: string;
};

const statusLabels: Record<DividendStatus, string> = {
  unpaid: "未发放",
  paid: "已发放",
  deferred: "暂缓发放"
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

function parseAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number) {
  return `${Math.round(value).toLocaleString("zh-CN")} RMB`;
}

function formatTableMoney(value: number) {
  return Math.round(value).toLocaleString("zh-CN");
}

function formatPercentFromFraction(value: string | number) {
  return `${(parseAmount(value) * 100).toFixed(2)}%`;
}

function isValidAmount(value: string) {
  return /^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value);
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

export function DividendRecordsManager({
  currentRole,
  defaultStoreId,
  storeLoadError
}: {
  currentRole: AppRole;
  defaultStoreId: string | null;
  storeLoadError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const canGenerateDividends = canPerform(currentRole, "generateDividends");
  const canRefreshDividends = canPerform(currentRole, "refreshDividends");
  const canEditDividends = canPerform(currentRole, "editDividends");
  const canMarkDividendsPaid = canPerform(currentRole, "markDividendsPaid");
  const canMarkDividendsDeferred = canPerform(
    currentRole,
    "markDividendsDeferred"
  );
  const [month, setMonth] = useState(currentMonthValue);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [investors, setInvestors] = useState<InvestorRecord[]>([]);
  const [records, setRecords] = useState<DividendRecord[]>([]);
  const [editingRecord, setEditingRecord] = useState<DividendRecord | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    paidAmount: "",
    status: "unpaid",
    paidDate: "",
    notes: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMonthLocked, setIsMonthLocked] = useState(false);
  const [error, setError] = useState(storeLoadError);
  const [notice, setNotice] = useState("");

  const selectedMonthStart = `${month}-01`;

  const summary = useMemo(() => {
    const totalIncome = incomes.reduce(
      (sum, income) => sum + parseAmount(income.net_amount),
      0
    );
    const totalExpense = expenses.reduce((sum, expense) => {
      if (!expense.included_in_monthly_cost) {
        return sum;
      }

      return sum + parseAmount(expense.amount);
    }, 0);
    const netProfit = roundMoney(totalIncome - totalExpense);
    const distributableProfit = netProfit > 0 ? netProfit : 0;
    const paidAmount = records.reduce((sum, record) => {
      if (record.status !== "paid") {
        return sum;
      }

      return sum + parseAmount(record.paid_amount);
    }, 0);
    const unpaidAmount = records.reduce((sum, record) => {
      if (record.status === "paid") {
        return sum;
      }

      return sum + parseAmount(record.expected_amount);
    }, 0);

    return {
      totalIncome,
      totalExpense,
      netProfit,
      distributableProfit,
      paidAmount: roundMoney(paidAmount),
      unpaidAmount: roundMoney(unpaidAmount)
    };
  }, [expenses, incomes, records]);

  async function loadDividendData() {
    if (!defaultStoreId) {
      setError(
        storeLoadError ||
          "无法读取分红数据：当前用户没有绑定 store_id。请先确认 profile.store_id。"
      );
      return;
    }

    setError("");
    setNotice("");
    setIsLoading(true);

    const range = getMonthRange(month);
    const isInvestorView = currentRole === "viewer";

    const investorQuery = isInvestorView
      ? supabase.rpc("current_investor_profile")
      : supabase
          .from("investors")
          .select("id,name,email,investment_amount,share_ratio,is_active")
          .eq("store_id", defaultStoreId)
          .eq("is_active", true)
          .order("created_at", { ascending: true });

    const [incomeResult, expenseResult, investorResult, closingResult] =
      await Promise.all([
        supabase
          .from("incomes")
          .select("net_amount")
          .eq("store_id", defaultStoreId)
          .gte("settlement_period", range.start)
          .lt("settlement_period", range.end),
        supabase
          .from("expenses")
          .select("amount,included_in_monthly_cost")
          .eq("store_id", defaultStoreId)
          .gte("date", range.start)
          .lt("date", range.end),
        investorQuery,
        supabase
          .from("monthly_closings")
          .select("is_locked")
          .eq("store_id", defaultStoreId)
          .eq("month", selectedMonthStart)
          .maybeSingle()
      ]);

    setIsLoading(false);

    if (incomeResult.error) {
      setError(incomeResult.error.message);
      return;
    }

    if (expenseResult.error) {
      setError(expenseResult.error.message);
      return;
    }

    if (investorResult.error) {
      setError(investorResult.error.message);
      return;
    }

    const loadedInvestors = isInvestorView
      ? []
      : ((investorResult.data ?? []) as InvestorRecord[]);
    const matchedInvestorId = isInvestorView
      ? ((investorResult.data as InvestorProfile[] | null)?.[0]?.id ?? null)
      : null;

    if (isInvestorView && !matchedInvestorId) {
      setIncomes((incomeResult.data ?? []) as IncomeRecord[]);
      setExpenses((expenseResult.data ?? []) as ExpenseRecord[]);
      setInvestors([]);
      setRecords([]);
      setIsMonthLocked(Boolean((closingResult.data as MonthlyClosingRecord | null)?.is_locked));
      setError("当前账号尚未绑定投资人信息，请联系管理员确认登录邮箱。");
      return;
    }

    let dividendQuery = supabase
      .from("dividend_records")
      .select(
        "id,store_id,settlement_month,investor_id,investor_name,share_ratio,expected_amount,paid_amount,status,paid_date,receipt_id,notes,created_at"
      )
      .eq("store_id", defaultStoreId)
      .eq("settlement_month", selectedMonthStart)
      .order("created_at", { ascending: true });

    if (isInvestorView && matchedInvestorId) {
      dividendQuery = dividendQuery.eq("investor_id", matchedInvestorId);
    }

    const dividendResult = await dividendQuery;

    if (dividendResult.error) {
      setError(dividendResult.error.message);
      return;
    }

    if (
      closingResult.error &&
      !isMonthlyClosingPermissionError(closingResult.error)
    ) {
      setError(closingResult.error.message);
      return;
    }

    setIncomes((incomeResult.data ?? []) as IncomeRecord[]);
    setExpenses((expenseResult.data ?? []) as ExpenseRecord[]);
    setInvestors(loadedInvestors);
    setRecords((dividendResult.data ?? []) as DividendRecord[]);
    setIsMonthLocked(Boolean((closingResult.data as MonthlyClosingRecord | null)?.is_locked));
  }

  useEffect(() => {
    void loadDividendData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStoreId, month]);

  async function handleGenerate() {
    if (!defaultStoreId) {
      setError("无法生成分红记录：当前用户没有绑定 store_id。");
      return;
    }

    setError("");
    setNotice("");

    if (!canGenerateDividends) {
      setError("当前账号无权生成分红记录。");
      return;
    }

    if (isMonthLocked) {
      setError("当前月份已锁定，不能重新生成当月分红记录。");
      return;
    }

    if (records.length > 0) {
      setError("本月分红记录已存在，请勿重复生成。");
      return;
    }

    if (summary.netProfit <= 0) {
      setError("本月无可分红利润。");
      return;
    }

    const activeInvestors = investors.filter(
      (investor) =>
        investor.is_active &&
        parseAmount(investor.investment_amount) > 0 &&
        parseAmount(investor.share_ratio) > 0
    );

    if (activeInvestors.length === 0) {
      setError("当前没有可生成分红的有效投资人。");
      return;
    }

    const payload = activeInvestors.map((investor) => {
      const expectedAmount = roundMoney(
        summary.distributableProfit * parseAmount(investor.share_ratio)
      );

      return {
        store_id: defaultStoreId,
        settlement_month: selectedMonthStart,
        investor_id: investor.id,
        investor_name: investor.name,
        share_ratio: investor.share_ratio,
        expected_amount: expectedAmount,
        paid_amount: expectedAmount,
        status: "unpaid" as DividendStatus,
        paid_date: null,
        receipt_id: null,
        notes: null
      };
    });

    setIsGenerating(true);
    const { error: insertError } = await supabase
      .from("dividend_records")
      .insert(payload);
    setIsGenerating(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setNotice("本月分红记录已生成。");
    await loadDividendData();
  }

  function startEdit(record: DividendRecord) {
    if (!canEditDividends) {
      setError("当前账号无权编辑分红记录。");
      return;
    }

    setEditingRecord(record);
    setEditForm({
      paidAmount: String(record.paid_amount ?? ""),
      status: record.status,
      paidDate: record.paid_date ?? "",
      notes: record.notes ?? ""
    });
    setError("");
    setNotice("");
  }

  function cancelEdit() {
    setEditingRecord(null);
    setEditForm({
      paidAmount: "",
      status: "unpaid",
      paidDate: "",
      notes: ""
    });
  }

  async function saveRecord(
    record: DividendRecord,
    updates: Partial<Pick<DividendRecord, "paid_amount" | "status" | "paid_date" | "notes">>
  ) {
    setError("");
    setNotice("");

    if (!canEditDividends) {
      setError("当前账号无权编辑分红记录。");
      return false;
    }

    const nextPaidAmount = parseAmount(updates.paid_amount ?? record.paid_amount);
    const expectedAmount = parseAmount(record.expected_amount);
    const nextNotes = updates.notes ?? record.notes ?? "";

    if (roundMoney(nextPaidAmount) !== roundMoney(expectedAmount) && !nextNotes.trim()) {
      setError("实发金额与应分红金额不一致，请在备注中填写原因。");
      return false;
    }

    setIsSaving(true);
    const { error: updateError } = await supabase
      .from("dividend_records")
      .update({
        ...updates,
        notes: nextNotes.trim() || null
      })
      .eq("id", record.id);
    setIsSaving(false);

    if (updateError) {
      setError(updateError.message);
      return false;
    }

    setNotice("分红记录已更新。");
    await loadDividendData();
    return true;
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingRecord) {
      return;
    }

    if (!isValidAmount(editForm.paidAmount)) {
      setError("请填写正确的实发金额，最多保留两位小数。");
      return;
    }

    const saved = await saveRecord(editingRecord, {
      paid_amount: editForm.paidAmount,
      status: editForm.status,
      paid_date: editForm.status === "paid" ? editForm.paidDate || todayValue() : null,
      notes: editForm.notes
    });

    if (saved) {
      cancelEdit();
    }
  }

  async function markPaid(record: DividendRecord) {
    if (!canMarkDividendsPaid) {
      setError("当前账号无权标记分红为已发放。");
      return;
    }

    await saveRecord(record, {
      status: "paid",
      paid_amount: record.paid_amount || record.expected_amount,
      paid_date: record.paid_date ?? todayValue(),
      notes: record.notes
    });
  }

  async function markDeferred(record: DividendRecord) {
    if (!canMarkDividendsDeferred) {
      setError("当前账号无权标记分红为暂缓发放。");
      return;
    }

    await saveRecord(record, {
      status: "deferred",
      paid_date: null,
      notes: record.notes
    });
  }

  async function handleDelete(record: DividendRecord) {
    if (
      !canPerform(currentRole, "deleteDividendRecord", {
        dividendStatus: record.status
      })
    ) {
      setError(
        record.status === "paid"
          ? "当前账号无权删除已发放分红记录。"
          : "当前账号无权删除分红记录。"
      );
      return;
    }

    const confirmed = window.confirm(
      `确认删除 ${record.investor_name} 在 ${month} 的分红记录吗？`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setNotice("");
    const { error: deleteError } = await supabase
      .from("dividend_records")
      .delete()
      .eq("id", record.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setNotice("分红记录已删除。");
    await loadDividendData();
  }

  async function handleRefreshDividends() {
    if (!defaultStoreId) {
      setError("无法刷新分红记录：当前用户没有绑定 store_id。");
      return;
    }

    setError("");
    setNotice("");

    if (!canRefreshDividends) {
      setError("当前账号无权刷新分红数据。");
      return;
    }

    const range = getMonthRange(month);
    setIsRefreshing(true);
    const [incomeResult, expenseResult, investorResult, dividendResult] =
      await Promise.all([
        supabase
          .from("incomes")
          .select("net_amount")
          .eq("store_id", defaultStoreId)
          .gte("settlement_period", range.start)
          .lt("settlement_period", range.end),
        supabase
          .from("expenses")
          .select("amount,included_in_monthly_cost")
          .eq("store_id", defaultStoreId)
          .gte("date", range.start)
          .lt("date", range.end),
        supabase
          .from("investors")
          .select("id,name,investment_amount,share_ratio,is_active")
          .eq("store_id", defaultStoreId)
          .eq("is_active", true)
          .order("created_at", { ascending: true }),
        supabase
          .from("dividend_records")
          .select(
            "id,store_id,settlement_month,investor_id,investor_name,share_ratio,expected_amount,paid_amount,status,paid_date,receipt_id,notes,created_at"
          )
          .eq("store_id", defaultStoreId)
          .eq("settlement_month", selectedMonthStart)
          .order("created_at", { ascending: true })
      ]);

    if (incomeResult.error) {
      setIsRefreshing(false);
      setError(incomeResult.error.message);
      return;
    }

    if (expenseResult.error) {
      setIsRefreshing(false);
      setError(expenseResult.error.message);
      return;
    }

    if (investorResult.error) {
      setIsRefreshing(false);
      setError(investorResult.error.message);
      return;
    }

    if (dividendResult.error) {
      setIsRefreshing(false);
      setError(dividendResult.error.message);
      return;
    }

    const latestIncomes = (incomeResult.data ?? []) as IncomeRecord[];
    const latestExpenses = (expenseResult.data ?? []) as ExpenseRecord[];
    const latestInvestors = (investorResult.data ?? []) as InvestorRecord[];
    const latestRecords = (dividendResult.data ?? []) as DividendRecord[];

    if (latestRecords.length === 0) {
      setIsRefreshing(false);
      setError("请先生成本月分红记录。");
      return;
    }

    const totalIncome = latestIncomes.reduce(
      (sum, income) => sum + parseAmount(income.net_amount),
      0
    );
    const totalExpense = latestExpenses.reduce((sum, expense) => {
      if (!expense.included_in_monthly_cost) {
        return sum;
      }

      return sum + parseAmount(expense.amount);
    }, 0);
    const latestNetProfit = roundMoney(totalIncome - totalExpense);
    const distributableProfit = latestNetProfit > 0 ? latestNetProfit : 0;

    if (latestNetProfit <= 0) {
      setIsRefreshing(false);
      setError("当前月份无可分红利润。");
      return;
    }

    const investorById = new Map(
      latestInvestors.map((investor) => [investor.id, investor])
    );
    const refreshableRecords = latestRecords.filter(
      (record) => record.status === "unpaid" || record.status === "deferred"
    );

    if (refreshableRecords.length === 0) {
      setIsRefreshing(false);
      setNotice("本月没有未发放或暂缓发放的分红记录需要刷新。");
      setIncomes(latestIncomes);
      setExpenses(latestExpenses);
      setInvestors(latestInvestors);
      setRecords(latestRecords);
      return;
    }

    const updateResults = await Promise.all(
      refreshableRecords.map((record) => {
        const investor = investorById.get(record.investor_id);
        const nextShareRatio = investor?.share_ratio ?? record.share_ratio;
        const expectedAmount = roundMoney(
          distributableProfit * parseAmount(nextShareRatio)
        );

        return supabase
          .from("dividend_records")
          .update({
            investor_name: investor?.name ?? record.investor_name,
            share_ratio: nextShareRatio,
            expected_amount: expectedAmount,
            paid_amount:
              record.status === "unpaid" ? expectedAmount : record.paid_amount
          })
          .eq("id", record.id);
      })
    );

    setIsRefreshing(false);

    const updateError = updateResults.find((result) => result.error)?.error;
    if (updateError) {
      setError(updateError.message);
      return;
    }

    setNotice("本月分红数据已刷新，已发放记录未修改。");
    await loadDividendData();
  }

  const cards =
    currentRole === "viewer"
      ? [
          { label: "我的累计分红", value: formatMoney(summary.paidAmount + summary.unpaidAmount) },
          { label: "我的待发放分红", value: formatMoney(summary.unpaidAmount) },
          { label: "我的已发放分红", value: formatMoney(summary.paidAmount) },
          { label: "本月记录数", value: String(records.length) }
        ]
      : [
          { label: "本月净利润", value: formatMoney(summary.netProfit) },
          { label: "可分配利润", value: formatMoney(summary.distributableProfit) },
          { label: "已发放金额", value: formatMoney(summary.paidAmount) },
          { label: "未发放金额", value: formatMoney(summary.unpaidAmount) }
        ];

  return (
    <section>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink">分红记录</h2>
        </div>
        <MonthToolbar
          month={month}
          onMonthChange={setMonth}
          action={
            canGenerateDividends ? (
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating || isLoading || isMonthLocked}
                className="rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-white transition hover:bg-slateblue disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMonthLocked
                  ? "月份已锁定"
                  : isGenerating
                    ? "生成中..."
                    : "生成本月分红记录"}
              </button>
            ) : null
          }
        />
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

      {isMonthLocked ? (
        <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          当前月份已锁定，不能重新生成当月分红记录。
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
          >
            <p className="text-sm font-medium text-stone-600">{card.label}</p>
            <p className="mt-3 text-2xl font-bold text-ink">
              {isLoading ? "读取中..." : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-4">
          <h3 className="text-lg font-semibold text-ink">
            {currentRole === "viewer" ? "我的分红记录" : "本月分红明细"}
          </h3>
          {canRefreshDividends ? (
            <button
              type="button"
              onClick={() => void handleRefreshDividends()}
              disabled={isRefreshing || isLoading}
              className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-ink transition hover:border-pine hover:text-pine disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? "刷新中..." : "刷新"}
            </button>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <TableHead>投资人姓名</TableHead>
                <TableHead>当前持股比例</TableHead>
                <TableHead>应分红金额（RMB）</TableHead>
                <TableHead>实发金额（RMB）</TableHead>
                <TableHead>发放状态</TableHead>
                <TableHead>发放日期</TableHead>
                <TableHead>备注</TableHead>
                <TableHead>操作</TableHead>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={8}>
                    正在读取分红记录...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-stone-500" colSpan={8}>
                    当前月份暂无分红记录。
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="align-top">
                    <TableCell>{record.investor_name}</TableCell>
                    <TableCell>{formatPercentFromFraction(record.share_ratio)}</TableCell>
                    <TableCell>
                      {formatTableMoney(parseAmount(record.expected_amount))}
                    </TableCell>
                    <TableCell>
                      {formatTableMoney(parseAmount(record.paid_amount))}
                    </TableCell>
                    <TableCell>{statusLabels[record.status]}</TableCell>
                    <TableCell>{record.paid_date ?? "-"}</TableCell>
                    <td className="max-w-64 px-4 py-3 text-stone-700">
                      <div className="max-h-20 overflow-y-auto whitespace-pre-wrap break-words pr-2">
                        {record.notes || "-"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                      <div className="flex flex-wrap gap-2">
                        {canEditDividends ? (
                          <button
                            type="button"
                            onClick={() => startEdit(record)}
                            className="font-medium text-pine hover:underline"
                          >
                            编辑
                          </button>
                        ) : null}
                        {canMarkDividendsPaid ? (
                          <button
                            type="button"
                            onClick={() => void markPaid(record)}
                            className="font-medium text-emerald-700 hover:underline"
                          >
                            标记已发放
                          </button>
                        ) : null}
                        {canMarkDividendsDeferred ? (
                          <button
                            type="button"
                            onClick={() => void markDeferred(record)}
                            className="font-medium text-amber-700 hover:underline"
                          >
                            标记暂缓
                          </button>
                        ) : null}
                        {canPerform(currentRole, "deleteDividendRecord", {
                          dividendStatus: record.status
                        }) ? (
                          <button
                            type="button"
                            onClick={() => void handleDelete(record)}
                            className="font-medium text-red-700 hover:underline"
                          >
                            删除
                          </button>
                        ) : null}
                        {!canEditDividends &&
                        !canMarkDividendsPaid &&
                        !canMarkDividendsDeferred &&
                        !canPerform(currentRole, "deleteDividendRecord", {
                          dividendStatus: record.status
                        }) ? (
                          <span className="text-stone-400">-</span>
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

      {editingRecord ? (
        <form
          onSubmit={handleEditSubmit}
          className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-ink">编辑分红记录</h3>
              <p className="mt-1 text-sm text-stone-600">
                {editingRecord.investor_name}，应分红金额：
                {formatTableMoney(parseAmount(editingRecord.expected_amount))} RMB
              </p>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="text-sm font-medium text-stone-500 hover:text-ink"
            >
              取消编辑
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <label className="block">
              <span className="text-sm font-medium text-stone-700">
                实发金额（RMB）
              </span>
              <input
                value={editForm.paidAmount}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    paidAmount: event.target.value
                  }))
                }
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-stone-700">发放状态</span>
              <select
                value={editForm.status}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    status: event.target.value as DividendStatus
                  }))
                }
                className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
              >
                <option value="unpaid">未发放</option>
                <option value="paid">已发放</option>
                <option value="deferred">暂缓发放</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-stone-700">发放日期</span>
              <DateInput
                value={editForm.paidDate}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    paidDate: event.target.value
                  }))
                }
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-md bg-pine px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "保存中..." : "保存修改"}
              </button>
            </div>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-stone-700">备注</span>
            <textarea
              value={editForm.notes}
              onChange={(event) =>
                setEditForm((current) => ({
                  ...current,
                  notes: event.target.value
                }))
              }
              className="mt-1 min-h-24 w-full rounded-md border border-stone-300 px-3 py-2 text-sm outline-none focus:border-pine"
              placeholder="实发金额与应分红金额不一致时，请填写原因。"
            />
          </label>
        </form>
      ) : null}
    </section>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 font-semibold">{children}</th>;
}

function TableCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="whitespace-nowrap px-4 py-3 text-stone-700">
      {children}
    </td>
  );
}

