"use client";

import {
  InputHTMLAttributes,
  MouseEvent,
  SelectHTMLAttributes,
  useMemo,
  useRef
} from "react";

type PickerInputElement = HTMLInputElement & {
  showPicker?: () => void;
};

type PickerInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "className"
> & {
  className?: string;
};

type MonthSelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className"
> & {
  className?: string;
};

const defaultClassName =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";

function openPicker(input: PickerInputElement | null) {
  if (!input) {
    return;
  }

  input.focus();
  input.showPicker?.();
}

function handleMouseDown(
  event: MouseEvent<HTMLInputElement>,
  input: PickerInputElement | null
) {
  const target = event.currentTarget;
  const clickOffset = event.clientX - target.getBoundingClientRect().left;

  if (clickOffset < target.clientWidth * 0.55) {
    return;
  }

  event.preventDefault();
  openPicker(input);
}

function PickerInput({
  type,
  className,
  ...props
}: PickerInputProps & { type: "date" | "month" }) {
  const inputRef = useRef<PickerInputElement>(null);

  return (
    <div
      className="mt-2 w-full cursor-text"
      onClick={() => openPicker(inputRef.current)}
    >
      <input
        ref={inputRef}
        type={type}
        className={className ?? defaultClassName}
        onMouseDown={(event) => handleMouseDown(event, inputRef.current)}
        {...props}
      />
    </div>
  );
}

export function DateInput(props: PickerInputProps) {
  return <PickerInput type="date" {...props} />;
}

function formatMonthOption(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseMonthValue(value: string) {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
}

function addMonths(value: string, offset: number) {
  const { year, month } = parseMonthValue(value);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return formatMonthOption(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

function buildMonthOptions(startMonth = "2026-05", optionCount = 6) {
  const options: string[] = [];

  for (let index = 0; index < optionCount; index += 1) {
    options.push(addMonths(startMonth, index));
  }

  return options;
}

export function MonthInput(props: MonthSelectProps) {
  const { className, ...selectProps } = props;
  const options = useMemo(() => buildMonthOptions(), []);

  return (
    <select
      className={className ?? `mt-2 block ${defaultClassName}`}
      {...selectProps}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
