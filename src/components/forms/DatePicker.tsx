import { Input } from "@/components/ui/input";

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Choose a date",
  disabled,
  required = false,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return (
    <Input
      id={id}
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      required={required}
      aria-label={placeholder}
    />
  );
}
