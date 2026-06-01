export const incomeSourceOptions = [
  { value: "meituan", label: "美团" },
  { value: "douyin", label: "抖音" },
  { value: "wechat_offline", label: "微信/线下" },
  { value: "long_stay", label: "长住/月租" },
  { value: "other", label: "其他收入" }
];

export const expenseCategoryOptions = [
  { value: "rent", label: "房租" },
  { value: "salary", label: "工资" },
  { value: "utilities", label: "水电" },
  { value: "network", label: "网络" },
  { value: "game_membership", label: "游戏会员" },
  { value: "cleaning_supplies", label: "清洁耗材" },
  { value: "repair", label: "维修" },
  { value: "platform_promotion", label: "平台推广" },
  { value: "renovation_equipment", label: "装修设备" },
  { value: "other", label: "其他支出" }
];

export const paymentMethodOptions = [
  "微信",
  "支付宝",
  "现金",
  "银行转账",
  "其他"
];

function findLabel(
  options: { value: string; label: string }[],
  value: string
) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function getIncomeSourceLabel(value: string) {
  return findLabel(incomeSourceOptions, value);
}

export function getExpenseCategoryLabel(value: string) {
  return findLabel(expenseCategoryOptions, value);
}
