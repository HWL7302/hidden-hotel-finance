"use client";

import { useEffect, useMemo, useState } from "react";
import {
  expenseCategoryOptions,
  getExpenseCategoryLabel,
  getIncomeSourceLabel,
  incomeSourceOptions
} from "@/lib/finance-options";
import { createClient } from "@/lib/supabase-client";

type IncomeRecord = {
  source: string;
  gross_amount: string | number;
  fee_amount: string | number;
  net_amount: string | number;
  evidence_file: string | null;
};

type ExpenseRecord = {
  category: string;
  amount: string | number;
  included_in_monthly_cost: boolean;
  evidence_file: string | null;
};

type IncomeSummary = {
  source: string;
  grossAmount: bigint;
  feeAmount: bigint;
  netAmount: bigint;
  recordCount: number;
  evidenceCount: number;
};

type ExpenseSummary = {
  category: string;
  amount: bigint;
  recordCount: number;
  evidenceCount: number;
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

function formatMoney(value: bigint) {
  const isNegative = value < BigInt(0);
  const absoluteValue = isNegative ? -value : value;
  const integerPart = absoluteValue / BigInt(100);
  const decimalPart = String(absoluteValue % BigInt(100)).padStart(2, "0");
  return `${isNegative ? "-" : ""}${integerPart}.${decimalPart}`;
}

function createIncomeSummaryMap() {
  return new Map(
    incomeSourceOptions.map((option) => [
      option.value,
      {
        source: option.value,
        grossAmount: BigInt(0),
        feeAmount: BigInt(0),
        netAmount: BigInt(0),
        recordCount: 0,
        evidenceCount: 0
      }
    ])
  );
}

function createExpenseSummaryMap() {
  return new Map(
    expenseCategoryOptions.map((option) => [
      option.value,
      {
        category: option.value,
        amount: BigInt(0),
        recordCount: 0,
        evidenceCount: 0
      }
    ])
  );
}

export function MonthlyClosingManager({
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
  const [error, setError] = useState(storeLoadError);
  const [isLoading, setIsLoading] = useState(false);

  async function loadMonthlySummary() {
    if (!defaultStoreId) {
      setError(
        storeLoadError ||
          "无法读取月度结算：没有可用的默认 store_id。请先确认当前用户 profile.store_id。"
      );
      return;
    }

    setError("");
    setIsLoading(true);
    const range = getMonthRange(month);
    const [incomeResult, expenseResult] = await Promise.all([
      supabase
        .from("incomes")
        .select("source,gross_amount,fee_amount,net_amount,evidence_file")
        .eq("store_id", defaultStoreId)
        .gte("settlement_period", range.start)
        .lt("settlement_period", range.end),
      supabase
        .from("expenses")
        .select("category,amount,included_in_monthly_cost,evidence_file")
        .eq("store_id", defaultStoreId)
        .gte("date", range.start)
        .lt("date", range.end)
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

    setIncomes((incomeResult.data ?? []) as IncomeRecord[]);
    setExpenses((expenseResult.data ?? []) as ExpenseRecord[]);
  }

  useEffect(() => {
    void loadMonthlySummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultStoreId, month]);

  const summary = useMemo(() => {
    const incomeMap = createIncomeSummaryMap();
    const expenseMap = createExpenseSummaryMap();
    let totalIncome = BigInt(0);
    let totalExpense = BigInt(0);
    let evidenceCount = 0;

    for (const income of incomes) {
      const item = incomeMap.get(income.source) ?? {
        source: income.source,
        grossAmount: BigInt(0),
        feeAmount: BigInt(0),
        netAmount: BigInt(0),
        recordCount: 0,
        evidenceCount: 0
      };
      item.grossAmount += amountToCents(income.gross_amount);
      item.feeAmount += amountToCents(income.fee_amount);
      item.netAmount += amountToCents(income.net_amount);
      item.recordCount += 1;
      item.evidenceCount += income.evidence_file ? 1 : 0;
      totalIncome += amountToCents(income.net_amount);
      evidenceCount += income.evidence_file ? 1 : 0;
      incomeMap.set(income.source, item);
    }

    for (const expense of expenses) {
      evidenceCount += expense.evidence_file ? 1 : 0;

      if (!expense.included_in_monthly_cost) {
        continue;
      }

      const item = expenseMap.get(expense.category) ?? {
        category: expense.category,
        amount: BigInt(0),
        recordCount: 0,
        evidenceCount: 0
      };
      item.amount += amountToCents(expense.amount);
      item.recordCount += 1;
      item.evidenceCount += expense.evidence_file ? 1 : 0;
      totalExpense += amountToCents(expense.amount);
      expenseMap.set(expense.category, item);
    }

    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      evidenceCount,
      recordCount: incomes.length + expenses.length,
      incomeRows: Array.from(incomeMap.values()).filter(
        (item) => item.recordCount > 0
      ) as IncomeSummary[],
      expenseRows: Array.from(expenseMap.values()).filter(
        (item) => item.recordCount > 0
      ) as ExpenseSummary[]
    };
  }, [expenses, incomes]);

  const cards = [
    { label: "本月收入合计", value: formatMoney(summary.totalIncome) },
    { label: "本月支出合计", value: formatMoney(summary.totalExpense) },
    { label: "本月净利润", value: formatMoney(summary.netProfit) },
    {
      label: "凭证完整度",
      value: `${summary.evidenceCount} / ${summary.recordCount}`
    }
  ];

  return (
    <section>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink">月度结算</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600">
            按月份汇总收入、支出和净利润，用于后续分红和经营分析。
          </p>
        </div>
        <label className="block text-sm font-medium text-ink">
          结算月份
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

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-stone-600">{card.label}</p>
            <p className="mt-3 text-2xl font-bold text-ink">
              {isLoading ? "读取中..." : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SummaryTable
          title="收入分类汇总"
          headers={["收入来源", "收入总额", "手续费", "净收入", "记录数", "凭证数"]}
          emptyText="当前月份暂无收入记录。"
          isLoading={isLoading}
          rows={summary.incomeRows.map((item) => [
            getIncomeSourceLabel(item.source),
            formatMoney(item.grossAmount),
            formatMoney(item.feeAmount),
            formatMoney(item.netAmount),
            String(item.recordCount),
            String(item.evidenceCount)
          ])}
        />
        <SummaryTable
          title="支出分类汇总"
          headers={["支出分类", "支出金额", "记录数", "凭证数"]}
          emptyText="当前月份暂无计入成本的支出记录。"
          isLoading={isLoading}
          rows={summary.expenseRows.map((item) => [
            getExpenseCategoryLabel(item.category),
            formatMoney(item.amount),
            String(item.recordCount),
            String(item.evidenceCount)
          ])}
        />
      </div>

      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-ink">后续功能预留</h3>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          当前为月度结算第一版。后续将增加可分配利润、投资人比例、应分红金额、是否已分红、分红凭证、月份锁定和导出月报。
        </p>
      </div>
    </section>
  );
}

function SummaryTable({
  title,
  headers,
  rows,
  emptyText,
  isLoading
}: {
  title: string;
  headers: string[];
  rows: string[][];
  emptyText: string;
  isLoading: boolean;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 px-5 py-4">
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-left text-stone-600">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-semibold">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {isLoading ? (
              <tr>
                <td className="px-4 py-6 text-stone-500" colSpan={headers.length}>
                  正在读取汇总数据...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-stone-500" colSpan={headers.length}>
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (
                    <td
                      key={`${row[0]}-${headers[index]}`}
                      className={
                        index === 0
                          ? "px-4 py-3 font-medium text-ink"
                          : "whitespace-nowrap px-4 py-3 text-stone-700"
                      }
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
