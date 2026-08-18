import type { SupabaseClient } from "@supabase/supabase-js";
import {
  expenseCategoryOptions,
  getExpenseCategoryLabel
} from "@/lib/finance-options";

export type ExpenseCategoryRecord = {
  category_key: string;
  display_name: string;
  default_payee: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const fallbackDefaultPayees: Record<string, string> = {
  rent: "房东",
  salary: "员工",
  utilities: "水电费",
  network: "网络服务商",
  game_membership: "腾讯",
  property_management: "物业管理",
  cleaning_supplies: "日常用品供应商",
  repair: "维修人员/维修公司",
  platform_promotion: "平台推广",
  renovation_equipment: "装修/设备供应商",
  other: ""
};

export const fallbackExpenseCategories: ExpenseCategoryRecord[] =
  expenseCategoryOptions.map((option, index) => ({
    category_key: option.value,
    display_name: option.label,
    default_payee: fallbackDefaultPayees[option.value] || null,
    is_active: true,
    sort_order: (index + 1) * 10,
    created_at: "",
    updated_at: ""
  }));

export async function loadExpenseCategories(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("expense_categories")
    .select(
      "category_key,display_name,default_payee,is_active,sort_order,created_at,updated_at"
    )
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ExpenseCategoryRecord[];
}

export function getExpenseCategoryDisplayName(
  categories: ExpenseCategoryRecord[],
  categoryKey: string
) {
  return (
    categories.find((category) => category.category_key === categoryKey)
      ?.display_name ?? getExpenseCategoryLabel(categoryKey)
  );
}
