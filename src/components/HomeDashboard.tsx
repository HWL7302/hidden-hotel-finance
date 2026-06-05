"use client";

import { useEffect, useMemo, useState } from "react";
import { MonthInput } from "@/components/DateInputs";
import { createClient } from "@/lib/supabase-client";

type IncomeRecord = {
  net_amount: string | number | null;
  evidence_file: string | null;
};

type TrendIncomeRecord = IncomeRecord & {
  settlement_period: string | null;
};

type ExpenseRecord = {
  amount: string | number | null;
  included_in_monthly_cost: boolean | null;
  evidence_file: string | null;
};

type TrendExpenseRecord = ExpenseRecord & {
  date: string;
};

type InvestmentRecord = {
  amount: string | number | null;
};

type FinanceSetting = {
  investment_baseline: string | number | null;
};

type DividendRecord = {
  paid_amount: string | number | null;
  status: string;
};

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonthOption(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function addMonths(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return formatMonthOption(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

function buildTrendMonths(selectedMonth: string) {
  return Array.from({ length: 6 }, (_, index) => addMonths(selectedMonth, index - 1));
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

function amountToCents(value: string | number | null) {
  const text = String(value ?? "0");
  const [integerPart = "0", decimalPart = ""] = text.split(".");

  return (
    BigInt(integerPart || "0") * BigInt(100) +
    BigInt(decimalPart.padEnd(2, "0").slice(0, 2))
  );
}

function formatMoney(value: bigint, withUnit = true) {
  const isNegative = value < BigInt(0);
  const absoluteValue = isNegative ? -value : value;
  const integerPart = absoluteValue / BigInt(100);
  const text = integerPart.toLocaleString("en-US");

  return `${isNegative ? "-" : ""}${text}${withUnit ? " RMB" : ""}`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0%";
  }

  return `${value.toFixed(2)}%`;
}

export function HomeDashboard({
  defaultStoreId,
  storeLoadError
}: {
  defaultStoreId: string | null;
  storeLoadError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [month, setMonth] = useState(currentMonthValue);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [investments, setInvestments] = useState<InvestmentRecord[]>([]);
  const [financeSetting, setFinanceSetting] = useState<FinanceSetting | null>(
    null
  );
  const [monthlyDividends, setMonthlyDividends] = useState<DividendRecord[]>([]);
  const [paidDividends, setPaidDividends] = useState<DividendRecord[]>([]);
  const [trendIncomes, setTrendIncomes] = useState<TrendIncomeRecord[]>([]);
  const [trendExpenses, setTrendExpenses] = useState<TrendExpenseRecord[]>([]);
  const [error, setError] = useState(storeLoadError);
  const [isLoading, setIsLoading] = useState(false);

  async function loadDashboard() {
    if (!defaultStoreId) {
      setError(storeLoadError || "暂无可用门店，无法读取首页数据。");
      return;
    }

    setError("");
    setIsLoading(true);

    const range = getMonthRange(month);
    const trendMonths = buildTrendMonths(month);
    const trendRange = {
      start: `${trendMonths[0]}-01`,
      end: getMonthRange(trendMonths[trendMonths.length - 1]).end
    };
    const [
      incomeResult,
      expenseResult,
      investmentResult,
      financeSettingResult,
      monthlyDividendResult,
      paidDividendResult,
      trendIncomeResult,
      trendExpenseResult
    ] = await Promise.all([
      supabase
        .from("incomes")
        .select("net_amount,evidence_file")
        .eq("store_id", defaultStoreId)
        .gte("settlement_period", range.start)
        .lt("settlement_period", range.end),
      supabase
        .from("expenses")
        .select("amount,included_in_monthly_cost,evidence_file")
        .eq("store_id", defaultStoreId)
        .gte("date", range.start)
        .lt("date", range.end),
      supabase
        .from("investment_records")
        .select("amount")
        .eq("store_id", defaultStoreId),
      supabase
        .from("store_finance_settings")
        .select("investment_baseline")
        .eq("store_id", defaultStoreId)
        .maybeSingle(),
      supabase
        .from("dividend_records")
        .select("paid_amount,status")
        .eq("store_id", defaultStoreId)
        .gte("settlement_month", range.start)
        .lt("settlement_month", range.end),
      supabase
        .from("dividend_records")
        .select("paid_amount,status")
        .eq("store_id", defaultStoreId)
        .eq("status", "paid"),
      supabase
        .from("incomes")
        .select("net_amount,evidence_file,settlement_period")
        .eq("store_id", defaultStoreId)
        .gte("settlement_period", trendRange.start)
        .lt("settlement_period", trendRange.end),
      supabase
        .from("expenses")
        .select("amount,included_in_monthly_cost,evidence_file,date")
        .eq("store_id", defaultStoreId)
        .gte("date", trendRange.start)
        .lt("date", trendRange.end)
    ]);

    setIsLoading(false);

    const loadError =
      incomeResult.error ??
      expenseResult.error ??
      investmentResult.error ??
      financeSettingResult.error ??
      monthlyDividendResult.error ??
      paidDividendResult.error ??
      trendIncomeResult.error ??
      trendExpenseResult.error;

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setIncomes((incomeResult.data ?? []) as IncomeRecord[]);
    setExpenses((expenseResult.data ?? []) as ExpenseRecord[]);
    setInvestments((investmentResult.data ?? []) as InvestmentRecord[]);
    setFinanceSetting((financeSettingResult.data ?? null) as FinanceSetting | null);
    setMonthlyDividends(
      (monthlyDividendResult.data ?? []) as DividendRecord[]
    );
    setPaidDividends((paidDividendResult.data ?? []) as DividendRecord[]);
    setTrendIncomes((trendIncomeResult.data ?? []) as TrendIncomeRecord[]);
    setTrendExpenses((trendExpenseResult.data ?? []) as TrendExpenseRecord[]);
  }

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStoreId, month]);

  const summary = useMemo(() => {
    const totalIncome = incomes.reduce(
      (sum, income) => sum + amountToCents(income.net_amount),
      BigInt(0)
    );
    const totalExpense = expenses.reduce((sum, expense) => {
      if (!expense.included_in_monthly_cost) {
        return sum;
      }

      return sum + amountToCents(expense.amount);
    }, BigInt(0));
    const netProfit = totalIncome - totalExpense;
    const distributableProfit = netProfit > BigInt(0) ? netProfit : BigInt(0);
    const registeredInvestment = investments.reduce(
      (sum, record) => sum + amountToCents(record.amount),
      BigInt(0)
    );
    const baseline = amountToCents(
      financeSetting?.investment_baseline ?? "420000"
    );
    const paidDividendAmount = paidDividends.reduce(
      (sum, record) => sum + amountToCents(record.paid_amount),
      BigInt(0)
    );
    const registeredShareRatio =
      baseline > BigInt(0)
        ? (Number(registeredInvestment) / Number(baseline)) * 100
        : 0;
    const paybackProgress =
      registeredInvestment > BigInt(0)
        ? (Number(paidDividendAmount) / Number(registeredInvestment)) * 100
        : 0;
    const incomeWithoutEvidenceCount = incomes.filter(
      (income) => !income.evidence_file
    ).length;
    const expenseWithoutEvidenceCount = expenses.filter(
      (expense) => !expense.evidence_file
    ).length;
    const unpaidDividendCount = monthlyDividends.filter(
      (record) => record.status !== "paid"
    ).length;

    return {
      totalIncome,
      totalExpense,
      netProfit,
      distributableProfit,
      registeredInvestment,
      registeredShareRatio,
      paidDividendAmount,
      paybackProgress,
      incomeCount: incomes.length,
      expenseCount: expenses.length,
      incomeWithoutEvidenceCount,
      expenseWithoutEvidenceCount,
      unpaidDividendCount
    };
  }, [expenses, financeSetting, incomes, investments, monthlyDividends, paidDividends]);

  const operationCards = [
    { label: "本月收入", value: formatMoney(summary.totalIncome) },
    { label: "本月支出", value: formatMoney(summary.totalExpense) },
    { label: "本月净利润", value: formatMoney(summary.netProfit) },
    { label: "可分红金额", value: formatMoney(summary.distributableProfit) }
  ];

  const investmentCards = [
    {
      label: "当前登记投资额",
      value: formatMoney(summary.registeredInvestment)
    },
    {
      label: "当前登记股份",
      value: formatPercent(summary.registeredShareRatio)
    },
    {
      label: "累计已发放分红",
      value: formatMoney(summary.paidDividendAmount)
    },
    {
      label: "总回本进度",
      value: formatPercent(summary.paybackProgress)
    }
  ];

  const trendData = useMemo(() => {
    const months = buildTrendMonths(month);
    const data = months.map((item) => ({
      month: item,
      income: BigInt(0),
      expense: BigInt(0),
      netProfit: BigInt(0)
    }));
    const byMonth = new Map(data.map((item) => [item.month, item]));

    for (const income of trendIncomes) {
      const item = income.settlement_period
        ? byMonth.get(income.settlement_period.slice(0, 7))
        : null;

      if (item) {
        item.income += amountToCents(income.net_amount);
      }
    }

    for (const expense of trendExpenses) {
      if (!expense.included_in_monthly_cost) {
        continue;
      }

      const item = byMonth.get(expense.date.slice(0, 7));

      if (item) {
        item.expense += amountToCents(expense.amount);
      }
    }

    for (const item of data) {
      item.netProfit = item.income - item.expense;
    }

    const maxAmount = data.reduce((max, item) => {
      const monthMax = item.income > item.expense ? item.income : item.expense;
      return monthMax > max ? monthMax : max;
    }, BigInt(0));

    return { data, maxAmount };
  }, [month, trendExpenses, trendIncomes]);

  const reminders = [
    `本月收入记录数：${summary.incomeCount}`,
    `本月支出记录数：${summary.expenseCount}`,
    `无凭证收入记录数：${summary.incomeWithoutEvidenceCount}`,
    `无凭证支出记录数：${summary.expenseWithoutEvidenceCount}`,
    `未发放分红记录数：${summary.unpaidDividendCount}`
  ];
  const hasReminder =
    summary.incomeCount > 0 ||
    summary.expenseCount > 0 ||
    summary.incomeWithoutEvidenceCount > 0 ||
    summary.expenseWithoutEvidenceCount > 0 ||
    summary.unpaidDividendCount > 0;

  return (
    <section>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink">Hidden Hotel 财务管理</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
            汇总当前月份经营结果、投资登记、分红发放和经营提醒，用于快速查看项目经营状态。
          </p>
        </div>
        <label className="block min-w-40 text-sm font-medium text-ink lg:mr-[42%]">
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

      {isLoading ? (
        <p className="mt-5 rounded-md border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">
          正在读取首页数据...
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {operationCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
          >
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-ink">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">月收入支出趋势</h3>
            <p className="mt-1 text-sm text-slate-500">
              展示当前选择月份附近 6 个月的收入、支出和净利润。
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-pine" />
              收入
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slateblue" />
              支出
            </span>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          {trendData.data.map((item) => {
            const incomeHeight =
              trendData.maxAmount > BigInt(0)
                ? Math.max(8, Math.round((Number(item.income) / Number(trendData.maxAmount)) * 100))
                : 0;
            const expenseHeight =
              trendData.maxAmount > BigInt(0)
                ? Math.max(8, Math.round((Number(item.expense) / Number(trendData.maxAmount)) * 100))
                : 0;

            return (
              <div key={item.month} className="rounded-lg bg-slate-50 px-3 py-3">
                <div className="flex h-36 items-end justify-center gap-3">
                  <div className="flex h-full w-7 items-end rounded-full bg-white">
                    <div
                      className="w-full rounded-full bg-pine"
                      style={{ height: `${incomeHeight}%` }}
                    />
                  </div>
                  <div className="flex h-full w-7 items-end rounded-full bg-white">
                    <div
                      className="w-full rounded-full bg-slateblue"
                      style={{ height: `${expenseHeight}%` }}
                    />
                  </div>
                </div>
                <p className="mt-3 text-center text-sm font-semibold text-ink">
                  {item.month}
                </p>
                <div className="mt-2 space-y-1 text-xs text-slate-500">
                  <p>收入：{formatMoney(item.income, false)}</p>
                  <p>支出：{formatMoney(item.expense, false)}</p>
                  <p>净利润：{formatMoney(item.netProfit, false)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {investmentCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
          >
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-ink">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <h3 className="text-lg font-semibold text-ink">经营提醒</h3>
        {hasReminder ? (
          <ul className="mt-4 grid gap-3 text-sm text-stone-700 sm:grid-cols-2 xl:grid-cols-3">
            {reminders.map((item) => (
              <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-stone-500">暂无异常提醒</p>
        )}
      </div>
    </section>
  );
}
