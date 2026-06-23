"use client";

type Props = {
  defaultValue: number;
  name: string;
  disabled?: boolean;
  min?: number;
  placeholder?: string;
};

export default function DeudaInicialInput({
  defaultValue,
  name,
  disabled = false,
  min = 0,
  placeholder = "0",
}: Props) {
  return (
    <input
      type="number"
      name={name}
      min={min}
      step={1}
      defaultValue={defaultValue}
      disabled={disabled}
      placeholder={placeholder}
      className="w-24 rounded-xl border border-white/20 bg-slate-900 px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-slate-400 focus:border-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

