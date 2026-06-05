"use client";

import { useEffect, useMemo, useState } from "react";
import { MonthInput } from "@/components/DateInputs";
import { createClient } from "@/lib/supabase-client";

type IncomeRecord = {
  net_amount: string | number | null;
  evidence_file: string | null;
};

type ExpenseRecord = {
  amount: string | number | null;
  included_in_monthly_cost: boolean | null;
  evidence_file: string | null;
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
    const [
      incomeResult,
      expenseResult,
      investmentResult,
      financeSettingResult,
      monthlyDividendResult,
      paidDividendResult
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
        .eq("status", "paid")
    ]);

    setIsLoading(false);

    const loadError =
      incomeResult.error ??
      expenseResult.error ??
      investmentResult.error ??
      financeSettingResult.error ??
      monthlyDividendResult.error ??
      paidDividendResult.error;

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
          <h2 className="text-2xl font-bold text-ink">
            Hidden Hotel 财务首页
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
            汇总当前月份经营结果、投资登记、分红发放和本月提醒，用于快速查看项目经营状态。
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

      {isLoading ? (
        <p className="mt-5 rounded-md border border-stone-200 bg-white px-4 py-3 text-sm text-stone-500">
          正在读取首页数据...
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {operationCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-stone-500">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-ink">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {investmentCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-stone-500">{card.label}</p>
            <p className="mt-3 text-2xl font-semibold text-ink">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-ink">本月提醒</h3>
        {hasReminder ? (
          <ul className="mt-4 grid gap-3 text-sm text-stone-700 sm:grid-cols-2 xl:grid-cols-3">
            {reminders.map((item) => (
              <li key={item} className="rounded-md bg-stone-50 px-3 py-2">
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
