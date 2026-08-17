export type DisplayAmountValue = string | number | null | undefined;

export function formatDisplayAmount(
  value: DisplayAmountValue,
  fallback = "-"
) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return fallback;
  }

  const roundedAmount = Math.round(amount * 100) / 100;
  const normalizedAmount = Object.is(roundedAmount, -0) ? 0 : roundedAmount;
  const hasDecimalPart = !Number.isInteger(normalizedAmount);

  return normalizedAmount.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimalPart ? 2 : 0,
    maximumFractionDigits: 2
  });
}

export function formatDisplayCents(value: bigint) {
  const isNegative = value < BigInt(0);
  const absoluteValue = isNegative ? -value : value;
  const integerPart = absoluteValue / BigInt(100);
  const decimalPart = absoluteValue % BigInt(100);
  const sign = isNegative ? "-" : "";
  const integerText = integerPart.toLocaleString("en-US");

  if (decimalPart === BigInt(0)) {
    return `${sign}${integerText}`;
  }

  return `${sign}${integerText}.${String(decimalPart).padStart(2, "0")}`;
}
