"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MonthInput } from "@/components/DateInputs";
import {
  expenseCategoryOptions,
  getExpenseCategoryLabel,
  getIncomeSourceLabel,
  incomeSourceOptions
} from "@/lib/finance-options";
import type { AppRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase-client";
import * as XLSX from "xlsx-js-style";

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

function roundDisplayedMoney(value: string | number | null | undefined) {
  return Math.round(parseAmount(value));
}

function sumAmounts<T>(
  records: T[],
  read: (record: T) => string | number | null | undefined
) {
  return roundMoney(
    records.reduce((sum, record) => sum + parseAmount(read(record)), 0)
  );
}

const moneyFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});
const operationReportHeaderFill = "E6F4F1";
const operationReportSectionFill = "F0FAF7";

function formatMoney(value: string | number | null | undefined) {
  return moneyFormatter.format(roundMoney(parseAmount(value)));
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

function formatReportMonth(month: string) {
  const [year, monthNumber] = month.split("-");
  return `${year}年${Number(monthNumber)}月`;
}

function buildOperationSummaryTitle(startMonth: string, endMonth: string) {
  const period =
    startMonth === endMonth
      ? formatReportMonth(startMonth)
      : `${formatReportMonth(startMonth)}-${formatReportMonth(endMonth)}`;

  return `${period} 隐藏款电竞酒店经营情况汇总表`;
}

function sumByValue<T>(
  records: T[],
  value: string,
  readKey: (record: T) => string,
  readAmount: (record: T) => string | number | null | undefined
) {
  return sumAmounts(
    records.filter((record) => readKey(record) === value),
    readAmount
  );
}

function appendOperationSummarySheet({
  workbook,
  startMonth,
  endMonth,
  incomes,
  expenses,
  cumulativeNetProfit
}: {
  workbook: XLSX.WorkBook;
  startMonth: string;
  endMonth: string;
  incomes: IncomeRecord[];
  expenses: ExpenseRecord[];
  cumulativeNetProfit: number;
}) {
  const fixedCostCategories = [
    "rent",
    "salary",
    "utilities",
    "network",
    "game_membership"
  ];
  const dailyExpenseCategories = [
    "cleaning_supplies",
    "repair",
    "platform_promotion",
    "other"
  ];
  const dailyOtherCategories = new Set([
    ...dailyExpenseCategories,
    ...expenseCategoryOptions
      .map((option) => option.value)
      .filter((value) => !fixedCostCategories.includes(value))
  ]);
  const totalGrossIncome = sumAmounts(incomes, (income) => income.gross_amount);
  const totalFee = sumAmounts(incomes, (income) => income.fee_amount);
  const totalNetIncome = sumAmounts(incomes, (income) => income.net_amount);
  const fixedCostTotal = sumAmounts(
    expenses.filter((expense) => fixedCostCategories.includes(expense.category)),
    (expense) => expense.amount
  );
  const dailyExpenseTotal = sumAmounts(
    expenses.filter((expense) => dailyOtherCategories.has(expense.category)),
    (expense) => expense.amount
  );
  const totalExpense = roundMoney(fixedCostTotal + dailyExpenseTotal);
  const netProfit = roundMoney(totalNetIncome - totalExpense);
  const profitRate = totalNetIncome === 0 ? "*" : netProfit / totalNetIncome;
  const rows: (string | number | null)[][] = [
    [buildOperationSummaryTitle(startMonth, endMonth), null, null, null],
    ["编制单位：隐藏款电竞酒店", null, "单位：元", null],
    ["序号", "项目", "金额", "备注"],
    ["一、收入项目", null, null, null]
  ];

  incomeSourceOptions.forEach((option, index) => {
    rows.push([
      index + 1,
      option.label,
      formatMoney(sumByValue(
        incomes,
        option.value,
        (income) => income.source,
        (income) => income.gross_amount
      )),
      ""
    ]);
  });

  rows.push(
    [incomeSourceOptions.length + 1, "合计营业额", formatMoney(totalGrossIncome), ""],
    [incomeSourceOptions.length + 2, "手续费", formatMoney(totalFee), ""],
    [
      incomeSourceOptions.length + 3,
      "本期实际收入",
      formatMoney(totalNetIncome),
      "收入净额 = 合计营业额 - 手续费"
    ],
    ["二、固定经营成本", null, null, null]
  );

  fixedCostCategories.forEach((category, index) => {
    rows.push([
      index + 1,
      getExpenseCategoryLabel(category),
      formatMoney(sumByValue(
        expenses,
        category,
        (expense) => expense.category,
        (expense) => expense.amount
      )),
      ""
    ]);
  });

  rows.push(
    [fixedCostCategories.length + 1, "固定成本合计", formatMoney(fixedCostTotal), ""],
    ["三、日常经营费用", null, null, null]
  );

  dailyExpenseCategories.forEach((category, index) => {
    const amount =
      category === "other"
        ? sumAmounts(
            expenses.filter((expense) => dailyOtherCategories.has(expense.category)),
            (expense) => expense.amount
          ) -
          sumAmounts(
            expenses.filter(
              (expense) =>
                dailyExpenseCategories.includes(expense.category) &&
                expense.category !== "other"
            ),
            (expense) => expense.amount
          )
        : sumByValue(
            expenses,
            category,
            (expense) => expense.category,
            (expense) => expense.amount
          );

    rows.push([index + 1, getExpenseCategoryLabel(category), formatMoney(amount), ""]);
  });

  rows.push(
    [dailyExpenseCategories.length + 1, "日常费用合计", formatMoney(dailyExpenseTotal), ""],
    ["四、经营利润汇总", null, null, null],
    ["", "本期实际收入", formatMoney(totalNetIncome), ""],
    ["", "本期支出合计", formatMoney(totalExpense), "固定成本合计 + 日常费用合计"],
    ["", "本期净利润", formatMoney(netProfit), "本期实际收入 - 本期支出合计"],
    ["", "经营利润率", profitRate, totalNetIncome === 0 ? "本期实际收入为 0" : ""],
    ["", "截至结束月份累计净利润", formatMoney(cumulativeNetProfit), `截至 ${endMonth} 统计`]
  );

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const sectionRows: number[] = [];
  const totalRows: number[] = [];
  rows.forEach((row, index) => {
    const section = String(row[0] ?? "");
    const project = String(row[1] ?? "");
    if (/^[一二三四]、/.test(section)) {
      sectionRows.push(index);
    }
    if (
      project.includes("合计") ||
      project === "本期实际收入" ||
      project === "本期支出合计" ||
      project === "本期净利润" ||
      project === "经营利润率" ||
      project === "截至结束月份累计净利润"
    ) {
      totalRows.push(index);
    }
  });

  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 1, c: 2 }, e: { r: 1, c: 3 } },
    ...sectionRows.map((row) => ({
      s: { r: row, c: 0 },
      e: { r: row, c: 3 }
    }))
  ];
  worksheet["!cols"] = [
    { wch: 8 },
    { wch: 28 },
    { wch: 16 },
    { wch: 42 }
  ];
  worksheet["!rows"] = rows.map((_, index) => ({
    hpt: index === 0 ? 28 : sectionRows.includes(index) ? 22 : 20
  }));
  worksheet["!margins"] = {
    left: 0.5,
    right: 0.5,
    top: 0.6,
    bottom: 0.6,
    header: 0.3,
    footer: 0.3
  };
  (worksheet as XLSX.WorkSheet & {
    "!pageSetup"?: {
      orientation?: string;
      fitToWidth?: number;
      fitToHeight?: number;
    };
    "!printArea"?: string;
  })["!pageSetup"] = {
    orientation: "portrait",
    fitToWidth: 1,
    fitToHeight: 0
  };
  (worksheet as XLSX.WorkSheet & { "!printArea"?: string })["!printArea"] =
    `A1:D${rows.length}`;

  worksheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: rows.length - 1, c: 3 }
  });

  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column <= 3; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      worksheet[address] ??= { t: "s", v: "" };
    }
  }

  const thinBorder = {
    top: { style: "thin", color: { rgb: "D9D9D9" } },
    bottom: { style: "thin", color: { rgb: "D9D9D9" } },
    left: { style: "thin", color: { rgb: "D9D9D9" } },
    right: { style: "thin", color: { rgb: "D9D9D9" } }
  };
  const baseCellStyle: XLSX.CellObject["s"] = {
    font: { name: "Microsoft YaHei", sz: 11 },
    border: thinBorder,
    alignment: { vertical: "center" }
  };

  const setCellStyle = (row: number, column: number, style: XLSX.CellObject["s"]) => {
    const address = XLSX.utils.encode_cell({ r: row, c: column });
    const cell = worksheet[address];
    if (cell) {
      cell.s = { ...(cell.s ?? {}), ...style };
    }
  };

  for (let row = 0; row < rows.length; row += 1) {
    for (let column = 0; column <= 3; column += 1) {
      setCellStyle(row, column, baseCellStyle);
    }
  }

  setCellStyle(0, 0, {
    font: { name: "Microsoft YaHei", bold: true, sz: 16 },
    alignment: { horizontal: "center", vertical: "center" }
  });

  setCellStyle(1, 0, {
    font: { name: "Microsoft YaHei", bold: true, sz: 11 },
    alignment: { horizontal: "center", vertical: "center" }
  });
  setCellStyle(1, 2, {
    font: { name: "Microsoft YaHei", bold: true, sz: 11 },
    alignment: { horizontal: "center", vertical: "center" }
  });

  for (let column = 0; column <= 3; column += 1) {
    setCellStyle(2, column, {
      font: { name: "Microsoft YaHei", bold: true, sz: 11 },
      fill: { fgColor: { rgb: operationReportHeaderFill } },
      alignment: { horizontal: "center", vertical: "center" }
    });
  }

  totalRows.forEach((row) => {
    for (let column = 0; column <= 3; column += 1) {
      setCellStyle(row, column, {
        font: { name: "Microsoft YaHei", bold: true, sz: 11 },
        fill: { fgColor: { rgb: operationReportSectionFill } }
      });
    }
  });

  sectionRows.forEach((row) => {
    for (let column = 0; column <= 3; column += 1) {
      setCellStyle(row, column, {
        font: { name: "Microsoft YaHei", bold: true, sz: 11 },
        fill: { fgColor: { rgb: operationReportSectionFill } },
        alignment: { horizontal: "left", vertical: "center" }
      });
    }
  });

  for (let row = 3; row < rows.length; row += 1) {
    setCellStyle(row, 0, {
      alignment: {
        horizontal: sectionRows.includes(row) ? "left" : "center",
        vertical: "center"
      }
    });
    setCellStyle(row, 1, {
      alignment: { horizontal: "left", vertical: "center" }
    });
  }

  for (let row = 0; row < rows.length; row += 1) {
    const project = rows[row][1];
    const amountCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 2 })];
    if (amountCell && typeof amountCell.v === "number") {
      amountCell.z = project === "经营利润率" ? "0.00%" : "#,##0.##";
    }

    setCellStyle(row, 2, {
      numFmt: project === "经营利润率" ? "0.00%" : "#,##0.##",
      alignment: { horizontal: "right", vertical: "center" }
    });
    setCellStyle(row, 3, {
      alignment: { horizontal: "left", wrapText: true, vertical: "center" }
    });
  }
  setCellStyle(2, 2, {
    alignment: { horizontal: "center", vertical: "center" }
  });
  setCellStyle(2, 3, {
    alignment: { horizontal: "center", vertical: "center" }
  });
  if (worksheet.C3) {
    worksheet.C3.v = "金额";
    worksheet.C3.t = "s";
    worksheet.C3.s = {
      ...(worksheet.C3.s ?? {}),
      alignment: { horizontal: "center", vertical: "center" }
    };
  }
  if (worksheet.D3) {
    worksheet.D3.v = "备注";
    worksheet.D3.t = "s";
    worksheet.D3.s = {
      ...(worksheet.D3.s ?? {}),
      alignment: { horizontal: "center", vertical: "center" }
    };
  }
  XLSX.utils.book_append_sheet(workbook, worksheet, "经营汇总");
}

function appendOperationDetailSheet({
  workbook,
  sheetName,
  rows,
  columnWidths,
  amountColumns,
  wrapColumns
}: {
  workbook: XLSX.WorkBook;
  sheetName: string;
  rows: (string | number | null)[][];
  columnWidths: number[];
  amountColumns: number[];
  wrapColumns: number[];
}) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const lastRow = rows.length - 1;
  const lastColumn = rows[0].length - 1;
  worksheet["!cols"] = columnWidths.map((wch) => ({ wch }));
  worksheet["!rows"] = rows.map((_, index) => ({
    hpt: index === 0 || index === lastRow ? 22 : 20
  }));
  worksheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: lastRow, c: lastColumn }
  });

  for (let row = 0; row <= lastRow; row += 1) {
    for (let column = 0; column <= lastColumn; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      worksheet[address] ??= { t: "s", v: "" };
    }
  }

  const thinBorder = {
    top: { style: "thin", color: { rgb: "D9D9D9" } },
    bottom: { style: "thin", color: { rgb: "D9D9D9" } },
    left: { style: "thin", color: { rgb: "D9D9D9" } },
    right: { style: "thin", color: { rgb: "D9D9D9" } }
  };

  const setCellStyle = (row: number, column: number, style: XLSX.CellObject["s"]) => {
    const address = XLSX.utils.encode_cell({ r: row, c: column });
    const cell = worksheet[address];
    if (cell) {
      cell.s = { ...(cell.s ?? {}), ...style };
    }
  };

  for (let row = 0; row <= lastRow; row += 1) {
    for (let column = 0; column <= lastColumn; column += 1) {
      setCellStyle(row, column, {
        font: { name: "Microsoft YaHei", sz: 11 },
        border: thinBorder,
        alignment: {
          horizontal: amountColumns.includes(column) ? "right" : "left",
          vertical: "center",
          wrapText: wrapColumns.includes(column)
        }
      });
    }
  }

  for (let column = 0; column <= lastColumn; column += 1) {
    setCellStyle(0, column, {
      font: { name: "Microsoft YaHei", bold: true, sz: 11 },
      fill: { fgColor: { rgb: operationReportHeaderFill } },
      alignment: { horizontal: "center", vertical: "center" }
    });
    setCellStyle(lastRow, column, {
      font: { name: "Microsoft YaHei", bold: true, sz: 11 },
      fill: { fgColor: { rgb: operationReportSectionFill } },
      alignment: {
        horizontal: amountColumns.includes(column) ? "right" : "left",
        vertical: "center",
        wrapText: wrapColumns.includes(column)
      }
    });
  }

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

function isReportEligibleInvestor(
  investor: Pick<InvestorRecord, "investment_amount" | "share_ratio">
) {
  return (
    parseAmount(investor.investment_amount) > 0 &&
    parseAmount(investor.share_ratio) > 0
  );
}

function groupInvestorsForExport(records: InvestorRecord[]) {
  const map = new Map<string, ExportInvestor>();

  for (const record of records) {
    if (!isReportEligibleInvestor(record)) {
      continue;
    }

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
    existing.share_ratio =
      parseAmount(existing.share_ratio) + parseAmount(record.share_ratio);
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

        if (!isReportEligibleInvestor(profile)) {
          setViewerInvestor(null);
          setInvestors([]);
          setSelectedInvestorId("");
          setError("当前账号不是投资人账号，暂无分红数据。");
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
              const investorIds = getSelectedInvestors().flatMap(
                (investor) => investor.investor_ids
              );
              let query = supabase
                .from("dividend_records")
                .select("id", { count: "exact", head: true })
                .eq("store_id", effectiveStoreId)
                .gte("settlement_month", range.start)
                .lt("settlement_month", range.end);

              if (investorIds.length > 0) {
                query = query.in("investor_id", investorIds);
              } else {
                query = query.eq(
                  "investor_id",
                  "00000000-0000-0000-0000-000000000000"
                );
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

  async function fetchOperationData(
    startMonth: string,
    endMonth: string,
    options: { includeCumulativeNetProfit?: boolean } = {}
  ) {
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

    let cumulativeNetProfit = 0;

    if (options.includeCumulativeNetProfit) {
      const cumulativeRange = getMonthRange("1900-01", endMonth);
      const [cumulativeIncomeResult, cumulativeExpenseResult] = await Promise.all([
        supabase
          .from("incomes")
          .select("date,source,gross_amount,fee_amount,net_amount,settlement_period,note")
          .eq("store_id", effectiveStoreId)
          .gte("settlement_period", cumulativeRange.start)
          .lt("settlement_period", cumulativeRange.end),
        supabase
          .from("expenses")
          .select("date,category,payee,amount,included_in_monthly_cost,note")
          .eq("store_id", effectiveStoreId)
          .gte("date", cumulativeRange.start)
          .lt("date", cumulativeRange.end)
          .order("date", { ascending: true })
      ]);

      const cumulativeLoadError =
        cumulativeIncomeResult.error ?? cumulativeExpenseResult.error;

      if (cumulativeLoadError) {
        throw cumulativeLoadError;
      }

      const cumulativeIncomes = (cumulativeIncomeResult.data ?? []) as IncomeRecord[];
      const cumulativeExpenses = (cumulativeExpenseResult.data ?? []) as ExpenseRecord[];
      cumulativeNetProfit = roundMoney(
        sumAmounts(cumulativeIncomes, (income) => income.net_amount) -
          sumAmounts(cumulativeExpenses, (expense) => expense.amount)
      );
    }

    return {
      incomes: (incomeResult.data ?? []) as IncomeRecord[],
      expenses: (expenseResult.data ?? []) as ExpenseRecord[],
      cumulativeNetProfit
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
    expenses,
    cumulativeNetProfit
  }: {
    startMonth: string;
    endMonth: string;
    incomes: IncomeRecord[];
    expenses: ExpenseRecord[];
    cumulativeNetProfit: number;
  }) {
    const workbook = XLSX.utils.book_new();
    const incomeGrossTotal = sumAmounts(incomes, (income) => income.gross_amount);
    const incomeFeeTotal = sumAmounts(incomes, (income) => income.fee_amount);
    const incomeNetTotal = sumAmounts(incomes, (income) => income.net_amount);
    const expenseTotal = sumAmounts(expenses, (expense) => expense.amount);

    appendOperationSummarySheet({
      workbook,
      startMonth,
      endMonth,
      incomes,
      expenses,
      cumulativeNetProfit
    });
    appendOperationDetailSheet({
      workbook,
      sheetName: "收入明细",
      rows: [
        ["日期", "来源", "金额", "手续费", "净收入", "备注"],
        ...incomes.map((income) => [
          income.date,
          getIncomeSourceLabel(income.source),
          formatMoney(income.gross_amount),
          formatMoney(income.fee_amount),
          formatMoney(income.net_amount),
          income.note ?? ""
        ]),
        ["", "合计", formatMoney(incomeGrossTotal), formatMoney(incomeFeeTotal), formatMoney(incomeNetTotal), ""]
      ],
      columnWidths: [14, 18, 14, 14, 14, 30],
      amountColumns: [2, 3, 4],
      wrapColumns: [5]
    });
    appendOperationDetailSheet({
      workbook,
      sheetName: "支出明细",
      rows: [
        ["日期", "类别", "金额", "收款方", "备注"],
        ...expenses.map((expense) => [
          expense.date,
          getExpenseCategoryLabel(expense.category),
          formatMoney(expense.amount),
          expense.payee ?? "",
          expense.note ?? ""
        ]),
        ["", "合计", formatMoney(expenseTotal), "", ""]
      ],
      columnWidths: [14, 18, 14, 22, 30],
      amountColumns: [2],
      wrapColumns: [4]
    });

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

      const data = await fetchOperationData(operationStartMonth, operationEndMonth, {
        includeCumulativeNetProfit: true
      });
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
          区间应分红: roundDisplayedMoney(expectedDividend),
          区间已发放分红: roundDisplayedMoney(paidDividend),
          区间待发放分红: roundDisplayedMoney(unpaidDividend),
          累计分红: roundDisplayedMoney(cumulativeDividend),
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
        应分红金额: roundDisplayedMoney(record.expected_amount),
        实发金额: roundDisplayedMoney(record.paid_amount),
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
