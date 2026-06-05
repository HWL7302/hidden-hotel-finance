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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-40 text-sm font-medium text-ink">
          选择月份
          <MonthInput
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
          />
        </label>
        {action}
      </div>
    </div>
  );
}
