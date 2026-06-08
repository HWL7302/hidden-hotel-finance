"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MonthInput } from "@/components/DateInputs";
import {
  getExpenseCategoryLabel,
  getIncomeSourceLabel
} from "@/lib/finance-options";
import type { AppRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase-client";
import * as XLSX from "xlsx";

type IncomeRecord = {
  date: string;
  source: string;
  gross_amount: string | number;
  fee_amount: string | number;
  net_amount: string | number;
  settlement_period: string;
  note: string | null;
};

type ExpenseRecord = {
  date: string;
  category: string;
  payee: string | null;
  amount: string | number;
  included_in_monthly_cost: boolean | null;
  note: string | null;
};

type InvestorRecord = {
  id: string;
  store_id?: string | null;
  name: string;
  email: string | null;
  investment_amount: string | number | null;
  share_ratio: string | number | null;
};

type ExportInvestor = InvestorRecord & {
  investor_ids: string[];
};

type InvestorProfile = {
  id: string;
  store_id: string;
  investment_amount: string | number | null;
  share_ratio: string | number | null;
};

type InvestmentRecord = {
  investor_id: string;
  amount: string | number;
};

type DividendStatus = "unpaid" | "paid" | "deferred";

type DividendRecord = {
  settlement_month: string;
  investor_id: string;
  investor_name: string;
  expected_amount: string | number;
  paid_amount: string | number;
  status: DividendStatus;
  paid_date: string | null;
};

type CountSummary = {
  incomeCount: number;
  expenseCount: number;
  dividendCount: number;
};

type ReportType = "operation" | "investment";

const emptyCounts: CountSummary = {
  incomeCount: 0,
  expenseCount: 0,
  dividendCount: 0
};

const dividendStatusLabels: Record<DividendStatus, string> = {
  unpaid: "未发放",
  paid: "已发放",
  deferred: "暂缓发放"
};

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function addMonths(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function compareMonth(left: string, right: string) {
  return left.localeCompare(right);
}

function getMonthRange(startMonth: string, endMonth: string) {
  return {
    start: `${startMonth}-01`,
    end: `${addMonths(endMonth, 1)}-01`
  };
}

function buildMonthList(startMonth: string, endMonth: string) {
  const months: string[] = [];
  let current = startMonth;

  while (compareMonth(current, endMonth) <= 0) {
    months.push(current);
    current = addMonths(current, 1);
  }

  return months;
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

function sumAmounts<T>(
  records: T[],
  read: (record: T) => string | number | null | undefined
) {
  return roundMoney(
    records.reduce((sum, record) => sum + parseAmount(read(record)), 0)
  );
}

function appendSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  rows: Record<string, string | number | null>[]
) {
  const worksheet = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

function appendHorizontalSummarySheet({
  workbook,
  sheetName,
  startMonth,
  endMonth,
  totalIncome,
  totalExpense,
  totalNetProfit
}: {
  workbook: XLSX.WorkBook;
  sheetName: string;
  startMonth: string;
  endMonth: string;
  totalIncome: number;
  totalExpense: number;
  totalNetProfit: number;
}) {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [`导出期间：${startMonth} ～ ${endMonth}`],
    [],
    ["项目", "总收入", "总支出", "总净利润"],
    ["金额", totalIncome, totalExpense, totalNetProfit]
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(workbook, fileName, { compression: true });
}

function getTotalCount(counts: CountSummary, includeDividendCount: boolean) {
  return (
    counts.incomeCount +
    counts.expenseCount +
    (includeDividendCount ? counts.dividendCount : 0)
  );
}

function normalizeInvestorName(record: InvestorRecord) {
  return (record.name || record.email || record.id).trim().toLowerCase();
}

function groupInvestorsForExport(records: InvestorRecord[]) {
  const map = new Map<string, ExportInvestor>();

  for (const record of records) {
    const key = normalizeInvestorName(record);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...record,
        id: key,
        investment_amount: parseAmount(record.investment_amount),
        share_ratio: parseAmount(record.share_ratio),
        investor_ids: [record.id]
      });
      continue;
    }

    if (!existing.investor_ids.includes(record.id)) {
      existing.investor_ids.push(record.id);
    }

    existing.investment_amount = roundMoney(
      parseAmount(existing.investment_amount) + parseAmount(record.investment_amount)
    );
    existing.share_ratio = roundMoney(
      parseAmount(existing.share_ratio) + parseAmount(record.share_ratio)
    );
  }

  return Array.from(map.values());
}

export function ReportExportManager({
  currentRole,
  userEmail,
  defaultStoreId,
  storeLoadError
}: {
  currentRole: AppRole;
  userEmail: string;
  defaultStoreId: string | null;
  storeLoadError: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [operationStartMonth, setOperationStartMonth] = useState(currentMonthValue);
  const [operationEndMonth, setOperationEndMonth] = useState(currentMonthValue);
  const [investmentStartMonth, setInvestmentStartMonth] = useState(currentMonthValue);
  const [investmentEndMonth, setInvestmentEndMonth] = useState(currentMonthValue);
  const [investors, setInvestors] = useState<InvestorRecord[]>([]);
  const [selectedInvestorId, setSelectedInvestorId] = useState("all");
  const [viewerInvestor, setViewerInvestor] = useState<InvestorRecord | null>(null);
  const [error, setError] = useState(storeLoadError);
  const [notice, setNotice] = useState("");
  const [isLoadingInvestors, setIsLoadingInvestors] = useState(false);
  const [isExportingOperation, setIsExportingOperation] = useState(false);
  const [isExportingInvestment, setIsExportingInvestment] = useState(false);
  const [operationCount, setOperationCount] = useState<CountSummary>(emptyCounts);
  const [investmentCount, setInvestmentCount] = useState<CountSummary>(emptyCounts);

  const canExportOperation =
    currentRole === "admin" || currentRole === "operator" || currentRole === "viewer";
  const canExportInvestment = currentRole === "admin" || currentRole === "viewer";
  const canSelectInvestor = currentRole === "admin";
  const effectiveStoreId = viewerInvestor?.store_id ?? defaultStoreId;
  const investorOptions = useMemo(
    () => groupInvestorsForExport(investors),
    [investors]
  );

  useEffect(() => {
    async function loadInvestors() {
      if (!canExportInvestment) {
        return;
      }

      setIsLoadingInvestors(true);

      if (currentRole === "viewer") {
        const { data, error: profileError } = await supabase
          .rpc("current_investor_profile")
          .maybeSingle();

        setIsLoadingInvestors(false);

        if (profileError) {
          setError(profileError.message);
          return;
        }

        const profile = data as InvestorProfile | null;

        if (!profile?.id) {
          setViewerInvestor(null);
          setSelectedInvestorId("");
          return;
        }

        const fallbackInvestor: InvestorRecord = {
          id: profile.id,
          store_id: profile.store_id,
          name: "当前投资人",
          email: userEmail,
          investment_amount: profile.investment_amount,
          share_ratio: profile.share_ratio
        };

        setViewerInvestor(fallbackInvestor);
        setInvestors([fallbackInvestor]);
        setSelectedInvestorId(profile.id);
        return;
      }

      if (!defaultStoreId) {
        setIsLoadingInvestors(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from("investors")
        .select("id,name,email,investment_amount,share_ratio")
        .eq("store_id", defaultStoreId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      setIsLoadingInvestors(false);

      if (loadError) {
        setError(loadError.message);
        return;
      }

      setInvestors((data ?? []) as InvestorRecord[]);
      setViewerInvestor(null);
    }

    void loadInvestors();
  }, [canExportInvestment, currentRole, defaultStoreId, supabase, userEmail]);

  useEffect(() => {
    async function refreshCounts() {
      if (!effectiveStoreId) {
        return;
      }

      try {
        validateMonthRange(operationStartMonth, operationEndMonth);
        setOperationCount(
          await countRecords("operation", operationStartMonth, operationEndMonth)
        );
      } catch {
        setOperationCount(emptyCounts);
      }
    }

    void refreshCounts();
  }, [effectiveStoreId, operationEndMonth, operationStartMonth]);

  useEffect(() => {
    async function refreshCounts() {
      if (!effectiveStoreId || !canExportInvestment) {
        return;
      }

      try {
        validateMonthRange(investmentStartMonth, investmentEndMonth);
        setInvestmentCount(
          await countRecords(
            "investment",
            investmentStartMonth,
            investmentEndMonth,
            selectedInvestorId
          )
        );
      } catch {
        setInvestmentCount(emptyCounts);
      }
    }

    void refreshCounts();
  }, [
    canExportInvestment,
    effectiveStoreId,
    investmentEndMonth,
    investmentStartMonth,
    selectedInvestorId
  ]);

  async function countRecords(
    type: ReportType,
    startMonth: string,
    endMonth: string,
    investorId = "all"
  ) {
    if (!effectiveStoreId) {
      throw new Error("当前用户没有绑定 store_id，无法导出报表。");
    }

    const range = getMonthRange(startMonth, endMonth);
    const [incomeCountResult, expenseCountResult, dividendCountResult] =
      await Promise.all([
        supabase
          .from("incomes")
          .select("id", { count: "exact", head: true })
          .eq("store_id", effectiveStoreId)
          .gte("settlement_period", range.start)
          .lt("settlement_period", range.end),
        supabase
          .from("expenses")
          .select("id", { count: "exact", head: true })
          .eq("store_id", effectiveStoreId)
          .gte("date", range.start)
          .lt("date", range.end),
        type === "investment"
          ? (() => {
              let query = supabase
                .from("dividend_records")
                .select("id", { count: "exact", head: true })
                .eq("store_id", effectiveStoreId)
                .gte("settlement_month", range.start)
                .lt("settlement_month", range.end);

              if (investorId !== "all") {
                const investorIds = getSelectedInvestors().flatMap(
                  (investor) => investor.investor_ids
                );

                if (investorIds.length > 0) {
                  query = query.in("investor_id", investorIds);
                } else {
                  query = query.eq("investor_id", investorId);
                }
              }

              return query;
            })()
          : Promise.resolve({ count: 0, error: null })
      ]);

    const loadError =
      incomeCountResult.error ??
      expenseCountResult.error ??
      dividendCountResult.error;

    if (loadError) {
      throw loadError;
    }

    const counts = {
      incomeCount: incomeCountResult.count ?? 0,
      expenseCount: expenseCountResult.count ?? 0,
      dividendCount: dividendCountResult.count ?? 0
    };

    return counts;
  }

  function validateMonthRange(startMonth: string, endMonth: string) {
    if (compareMonth(endMonth, startMonth) < 0) {
      throw new Error("结束月份不能早于开始月份。");
    }
  }

  function checkLargeExport(counts: CountSummary, includeDividendCount: boolean) {
    const total = getTotalCount(counts, includeDividendCount);

    if (total > 10000) {
      throw new Error("当前导出数据量超过建议范围。请缩小时间区间后再导出。");
    }

    if (total > 5000) {
      const dividendLine = includeDividendCount
        ? `\n分红记录：${counts.dividendCount} 条`
        : "";

      return window.confirm(
        `数据量较大，生成时间可能需要数十秒，请耐心等待。\n\n收入记录：${counts.incomeCount} 条\n支出记录：${counts.expenseCount} 条${dividendLine}\n导出总记录：${total} 条\n\n是否继续导出？`
      );
    }

    return true;
  }

  async function fetchOperationData(startMonth: string, endMonth: string) {
    if (!effectiveStoreId) {
      throw new Error("当前用户没有绑定 store_id，无法导出报表。");
    }

    const range = getMonthRange(startMonth, endMonth);
    const [incomeResult, expenseResult] = await Promise.all([
      supabase
        .from("incomes")
        .select("date,source,gross_amount,fee_amount,net_amount,settlement_period,note")
        .eq("store_id", effectiveStoreId)
        .gte("settlement_period", range.start)
        .lt("settlement_period", range.end)
        .order("date", { ascending: true }),
      supabase
        .from("expenses")
        .select("date,category,payee,amount,included_in_monthly_cost,note")
        .eq("store_id", effectiveStoreId)
        .gte("date", range.start)
        .lt("date", range.end)
        .order("date", { ascending: true })
    ]);

    const loadError = incomeResult.error ?? expenseResult.error;

    if (loadError) {
      throw loadError;
    }

    return {
      incomes: (incomeResult.data ?? []) as IncomeRecord[],
      expenses: (expenseResult.data ?? []) as ExpenseRecord[]
    };
  }

  function getOperationTotals(incomes: IncomeRecord[], expenses: ExpenseRecord[]) {
    const costExpenses = expenses.filter((expense) =>
      Boolean(expense.included_in_monthly_cost)
    );
    const totalIncome = sumAmounts(incomes, (income) => income.net_amount);
    const totalExpense = sumAmounts(costExpenses, (expense) => expense.amount);

    return {
      costExpenses,
      totalIncome,
      totalExpense,
      totalNetProfit: roundMoney(totalIncome - totalExpense)
    };
  }

  function buildOperationWorkbook({
    startMonth,
    endMonth,
    incomes,
    expenses
  }: {
    startMonth: string;
    endMonth: string;
    incomes: IncomeRecord[];
    expenses: ExpenseRecord[];
  }) {
    const workbook = XLSX.utils.book_new();
    const { costExpenses, totalIncome, totalExpense, totalNetProfit } =
      getOperationTotals(incomes, expenses);
    const monthRows = buildMonthList(startMonth, endMonth).map((month) => {
      const monthlyIncome = sumAmounts(
        incomes.filter((income) => income.settlement_period.slice(0, 7) === month),
        (income) => income.net_amount
      );
      const monthlyExpense = sumAmounts(
        costExpenses.filter((expense) => expense.date.slice(0, 7) === month),
        (expense) => expense.amount
      );

      return {
        月份: month,
        收入: monthlyIncome,
        支出: monthlyExpense,
        净利润: roundMoney(monthlyIncome - monthlyExpense)
      };
    });

    appendHorizontalSummarySheet({
      workbook,
      sheetName: "经营汇总",
      startMonth,
      endMonth,
      totalIncome,
      totalExpense,
      totalNetProfit
    });
    appendSheet(
      workbook,
      "收入明细",
      incomes.map((income) => ({
        日期: income.date,
        来源: getIncomeSourceLabel(income.source),
        金额: parseAmount(income.gross_amount),
        手续费: parseAmount(income.fee_amount),
        净收入: parseAmount(income.net_amount),
        备注: income.note ?? ""
      }))
    );
    appendSheet(
      workbook,
      "支出明细",
      expenses.map((expense) => ({
        日期: expense.date,
        类别: getExpenseCategoryLabel(expense.category),
        收款方: expense.payee ?? "",
        金额: parseAmount(expense.amount),
        备注: expense.note ?? ""
      }))
    );
    appendSheet(workbook, "月度汇总", monthRows);

    return workbook;
  }

  async function handleOperationExport() {
    setError("");
    setNotice("");

    try {
      validateMonthRange(operationStartMonth, operationEndMonth);
      setIsExportingOperation(true);
      const counts = await countRecords(
        "operation",
        operationStartMonth,
        operationEndMonth
      );
      setOperationCount(counts);

      if (!checkLargeExport(counts, false)) {
        return;
      }

      const data = await fetchOperationData(operationStartMonth, operationEndMonth);
      const workbook = buildOperationWorkbook({
        startMonth: operationStartMonth,
        endMonth: operationEndMonth,
        ...data
      });
      downloadWorkbook(
        workbook,
        `经营报表_${operationStartMonth}~${operationEndMonth}.xlsx`
      );
      setNotice("经营报表 Excel 已生成。");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "导出失败。");
    } finally {
      setIsExportingOperation(false);
    }
  }

  function getSelectedInvestors() {
    if (currentRole === "viewer") {
      return viewerInvestor
        ? [
            {
              ...viewerInvestor,
              investor_ids: [viewerInvestor.id]
            }
          ]
        : [];
    }

    if (selectedInvestorId === "all") {
      return investorOptions;
    }

    return investorOptions.filter((investor) => investor.id === selectedInvestorId);
  }

  async function fetchInvestmentData(startMonth: string, endMonth: string) {
    const selectedInvestors = getSelectedInvestors();
    const investorIds = selectedInvestors.flatMap((investor) => investor.investor_ids);

    if (investorIds.length === 0) {
      throw new Error("当前没有可导出的投资人数据。");
    }

    const range = getMonthRange(startMonth, endMonth);
    const [operationData, investmentResult, dividendResult, cumulativeResult] =
      await Promise.all([
        fetchOperationData(startMonth, endMonth),
        currentRole === "viewer"
          ? Promise.resolve({ data: [], error: null })
          : supabase
              .from("investment_records")
              .select("investor_id,amount")
              .eq("store_id", effectiveStoreId)
              .in("investor_id", investorIds),
        supabase
          .from("dividend_records")
          .select(
            "settlement_month,investor_id,investor_name,expected_amount,paid_amount,status,paid_date"
          )
          .eq("store_id", effectiveStoreId)
          .in("investor_id", investorIds)
          .gte("settlement_month", range.start)
          .lt("settlement_month", range.end)
          .order("settlement_month", { ascending: true }),
        supabase
          .from("dividend_records")
          .select(
            "settlement_month,investor_id,investor_name,expected_amount,paid_amount,status,paid_date"
          )
          .eq("store_id", effectiveStoreId)
          .in("investor_id", investorIds)
          .eq("status", "paid")
      ]);

    const loadError =
      investmentResult.error ?? dividendResult.error ?? cumulativeResult.error;

    if (loadError) {
      throw loadError;
    }

    return {
      ...operationData,
      selectedInvestors,
      investmentRecords: (investmentResult.data ?? []) as InvestmentRecord[],
      dividendRecords: (dividendResult.data ?? []) as DividendRecord[],
      cumulativeDividends: (cumulativeResult.data ?? []) as DividendRecord[]
    };
  }

  function buildInvestmentWorkbook({
    startMonth,
    endMonth,
    incomes,
    expenses,
    selectedInvestors,
    investmentRecords,
    dividendRecords,
    cumulativeDividends
  }: {
    startMonth: string;
    endMonth: string;
    incomes: IncomeRecord[];
    expenses: ExpenseRecord[];
    selectedInvestors: ExportInvestor[];
    investmentRecords: InvestmentRecord[];
    dividendRecords: DividendRecord[];
    cumulativeDividends: DividendRecord[];
  }) {
    const workbook = XLSX.utils.book_new();
    const { totalIncome, totalExpense, totalNetProfit } = getOperationTotals(
      incomes,
      expenses
    );

    appendSheet(
      workbook,
      "投资收益汇总",
      selectedInvestors.map((investor) => {
        const investorInvestmentRecords = investmentRecords.filter(
          (record) => investor.investor_ids.includes(record.investor_id)
        );
        const investorInvestment = sumAmounts(
          investorInvestmentRecords,
          (record) => record.amount
        );
        const effectiveInvestment =
          investorInvestment || parseAmount(investor.investment_amount);
        const investorDividends = dividendRecords.filter(
          (record) => investor.investor_ids.includes(record.investor_id)
        );
        const displayName =
          investor.name === "当前投资人"
            ? investorDividends[0]?.investor_name ?? investor.name
            : investor.name;
        const expectedDividend = sumAmounts(
          investorDividends,
          (record) => record.expected_amount
        );
        const paidDividend = sumAmounts(
          investorDividends.filter((record) => record.status === "paid"),
          (record) => record.paid_amount
        );
        const unpaidDividend = sumAmounts(
          investorDividends.filter((record) => record.status !== "paid"),
          (record) => record.expected_amount
        );
        const cumulativeDividend = sumAmounts(
          cumulativeDividends.filter((record) =>
            investor.investor_ids.includes(record.investor_id)
          ),
          (record) => record.paid_amount
        );

        return {
          投资人: displayName,
          投资金额: effectiveInvestment,
          当前持股比例: `${(parseAmount(investor.share_ratio) * 100).toFixed(2)}%`,
          区间净利润: totalNetProfit,
          区间应分红: expectedDividend,
          区间已发放分红: paidDividend,
          区间待发放分红: unpaidDividend,
          累计分红: cumulativeDividend,
          回本进度:
            effectiveInvestment > 0
              ? `${((cumulativeDividend / effectiveInvestment) * 100).toFixed(2)}%`
              : "0%"
        };
      })
    );
    appendSheet(
      workbook,
      "分红记录",
      dividendRecords.map((record) => ({
        投资人: record.investor_name,
        月份: record.settlement_month.slice(0, 7),
        应分红金额: parseAmount(record.expected_amount),
        实发金额: parseAmount(record.paid_amount),
        状态: dividendStatusLabels[record.status],
        发放日期: record.paid_date ?? ""
      }))
    );
    appendHorizontalSummarySheet({
      workbook,
      sheetName: "项目经营概览",
      startMonth,
      endMonth,
      totalIncome,
      totalExpense,
      totalNetProfit
    });

    return workbook;
  }

  async function handleInvestmentExport() {
    setError("");
    setNotice("");

    try {
      validateMonthRange(investmentStartMonth, investmentEndMonth);
      setIsExportingInvestment(true);
      const counts = await countRecords(
        "investment",
        investmentStartMonth,
        investmentEndMonth,
        selectedInvestorId
      );
      setInvestmentCount(counts);

      if (!checkLargeExport(counts, true)) {
        return;
      }

      const data = await fetchInvestmentData(
        investmentStartMonth,
        investmentEndMonth
      );
      const workbook = buildInvestmentWorkbook({
        startMonth: investmentStartMonth,
        endMonth: investmentEndMonth,
        ...data
      });
      downloadWorkbook(
        workbook,
        `投资报表_${investmentStartMonth}~${investmentEndMonth}.xlsx`
      );
      setNotice("投资报表 Excel 已生成。");
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "导出失败。");
    } finally {
      setIsExportingInvestment(false);
    }
  }

  if (!canExportOperation && !canExportInvestment) {
    return (
      <section>
        <h2 className="text-2xl font-bold text-ink">导出报表</h2>
        <p className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          当前角色没有报表导出权限。
        </p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-ink">导出报表</h2>

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

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {canExportOperation ? (
          <ReportCard
            title="经营报表"
            startMonth={operationStartMonth}
            endMonth={operationEndMonth}
            onStartMonthChange={setOperationStartMonth}
            onEndMonthChange={setOperationEndMonth}
            buttonLabel="导出经营报表 Excel"
            isExporting={isExportingOperation}
            counts={operationCount}
            includeDividendCount={false}
            onExport={() => void handleOperationExport()}
          />
        ) : null}

        {canExportInvestment ? (
          <ReportCard
            title="投资报表"
            startMonth={investmentStartMonth}
            endMonth={investmentEndMonth}
            onStartMonthChange={setInvestmentStartMonth}
            onEndMonthChange={setInvestmentEndMonth}
            buttonLabel="导出投资报表 Excel"
            isExporting={isExportingInvestment}
            counts={investmentCount}
            includeDividendCount
            onExport={() => void handleInvestmentExport()}
          >
            {canSelectInvestor ? (
              <label className="block text-sm font-medium text-ink">
                投资人
                <select
                  value={selectedInvestorId}
                  onChange={(event) => setSelectedInvestorId(event.target.value)}
                  disabled={isLoadingInvestors}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
                >
                  <option value="all">全部投资人</option>
                  {investorOptions.map((investor) => (
                    <option key={investor.id} value={investor.id}>
                      {investor.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </ReportCard>
        ) : null}
      </div>
    </section>
  );
}

function ReportCard({
  title,
  startMonth,
  endMonth,
  onStartMonthChange,
  onEndMonthChange,
  buttonLabel,
  isExporting,
  counts,
  includeDividendCount,
  onExport,
  children
}: {
  title: string;
  startMonth: string;
  endMonth: string;
  onStartMonthChange: (month: string) => void;
  onEndMonthChange: (month: string) => void;
  buttonLabel: string;
  isExporting: boolean;
  counts: CountSummary;
  includeDividendCount: boolean;
  onExport: () => void;
  children?: ReactNode;
}) {
  const totalCount = getTotalCount(counts, includeDividendCount);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <h3 className="text-xl font-semibold text-ink">{title}</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-ink">
          开始月份
          <MonthInput
            value={startMonth}
            onChange={(event) => onStartMonthChange(event.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-ink">
          结束月份
          <MonthInput
            value={endMonth}
            onChange={(event) => onEndMonthChange(event.target.value)}
          />
        </label>
        {children ? <div className="md:col-span-2">{children}</div> : null}
      </div>
      <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-sm text-stone-600">
        <p>收入记录：{counts.incomeCount} 条</p>
        <p>支出记录：{counts.expenseCount} 条</p>
        {includeDividendCount ? <p>分红记录：{counts.dividendCount} 条</p> : null}
        <p className="font-medium text-ink">导出总记录：{totalCount} 条</p>
      </div>
      <button
        type="button"
        onClick={onExport}
        disabled={isExporting}
        className="mt-5 rounded-lg bg-pine px-4 py-2 text-sm font-semibold text-white transition hover:bg-slateblue disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isExporting ? "生成中..." : buttonLabel}
      </button>
    </div>
  );
}
