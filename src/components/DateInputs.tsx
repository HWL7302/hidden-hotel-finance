"use client";

import {
  ChangeEvent,
  InputHTMLAttributes,
  MouseEvent,
  SelectHTMLAttributes,
  useEffect,
  useMemo,
  useRef,
  useState
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
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20";
const monthOptionStart = "2026-05";
const monthOptionEndYear = 2031;
const monthOptionEndMonth = 12;

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

function buildMonthOptions(startMonth = monthOptionStart) {
  const options: string[] = [];
  let offset = 0;

  while (true) {
    const option = addMonths(startMonth, offset);
    const { year, month } = parseMonthValue(option);

    if (
      year > monthOptionEndYear ||
      (year === monthOptionEndYear && month > monthOptionEndMonth)
    ) {
      break;
    }

    options.push(option);
    offset += 1;
  }

  return options;
}

export function MonthInput(props: MonthSelectProps) {
  const {
    className,
    disabled,
    onChange,
    value,
    defaultValue,
    ...selectProps
  } = props;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const options = useMemo(() => buildMonthOptions(), []);
  const initialValue =
    typeof value === "string"
      ? value
      : typeof defaultValue === "string"
        ? defaultValue
        : options[0];
  const [internalValue, setInternalValue] = useState(initialValue);
  const selectedValue = typeof value === "string" ? value : internalValue;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function handleSelect(nextValue: string) {
    setInternalValue(nextValue);
    setIsOpen(false);

    if (onChange) {
      onChange({
        target: { value: nextValue },
        currentTarget: { value: nextValue }
      } as unknown as ChangeEvent<HTMLSelectElement>);
    }
  }

  return (
    <div ref={wrapperRef} className="relative mt-2">
      <select
        className="sr-only"
        disabled={disabled}
        value={selectedValue}
        onChange={(event) => handleSelect(event.target.value)}
        {...selectProps}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={className ?? `block text-left ${defaultClassName}`}
      >
        {selectedValue}
      </button>
      {isOpen ? (
        <div className="absolute z-20 mt-1 max-h-[13.5rem] w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              className={`block w-full px-3 py-2 text-left hover:bg-slate-50 ${
                option === selectedValue ? "bg-pine/10 font-medium text-ink" : ""
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
