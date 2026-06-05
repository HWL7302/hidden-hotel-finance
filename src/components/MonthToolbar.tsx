import { ReactNode } from "react";
import { MonthInput } from "@/components/DateInputs";

export function MonthToolbar({
  month,
  onMonthChange,
  action
}: {
  month: string;
  onMonthChange: (month: string) => void;
  action?: ReactNode;
}) {
  return (
    <div className="flex w-full justify-start lg:w-[calc(50%-0.5rem)] lg:justify-end">
      <div className="flex flex-wrap items-center gap-3">
        <span className="whitespace-nowrap text-sm font-medium text-ink">
          显示月份：
        </span>
        <MonthInput
          value={month}
          onChange={(event) => onMonthChange(event.target.value)}
        />
        {action}
      </div>
    </div>
  );
}
