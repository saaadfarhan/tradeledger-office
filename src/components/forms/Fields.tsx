import * as React from "react";
import {
  Field as UiField,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Item } from "@/types";
import { ChevronDownIcon } from "lucide-react";
import { focusNextFormControlAfterSelection } from "@/lib/form-navigation";

export function SearchableItemSelect({
  id,
  value,
  onChange,
  items,
  placeholder = "Search catalog items",
  emptyHint,
  disabled = false,
  clearable = false,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  items: Item[];
  placeholder?: string;
  emptyHint?: string;
  disabled?: boolean;
  clearable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = items.find((item) => item.code === value);
  const hasItems = items.length > 0;
  return (
    <div className="grid gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={disabled || !hasItems}
              className="h-9 w-full justify-between px-3 font-normal"
            />
          }
        >
          <span
            className={
              selected
                ? "truncate text-left"
                : "truncate text-left text-muted-foreground"
            }
          >
            {selected
              ? `${selected.code} — ${selected.description}`
              : hasItems
                ? placeholder
                : "No catalog items available"}
          </span>
          <ChevronDownIcon data-icon="inline-end" />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(28rem,calc(100vw-2rem))] p-0"
        >
          <Command>
            <CommandInput placeholder="Search by code, name, brand, or category…" />
            <CommandList>
              <CommandEmpty>
                {emptyHint ?? "No matching catalog items."}
              </CommandEmpty>
              <CommandGroup>
                {clearable && value && (
                  <CommandItem
                    value="clear selection"
                    onSelect={() => {
                      onChange("");
                      setOpen(false);
                      focusNextFormControlAfterSelection(id);
                    }}
                  >
                    Clear selection
                  </CommandItem>
                )}
                {items.map((item) => (
                  <CommandItem
                    key={item.code}
                    value={`${item.code} ${item.description} ${item.brand ?? ""} ${item.category ?? ""}`}
                    onSelect={() => {
                      onChange(item.code);
                      setOpen(false);
                      focusNextFormControlAfterSelection(id);
                    }}
                  >
                    <span className="truncate">
                      {item.code} — {item.description}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {!hasItems && (
        <FieldDescription>
          {emptyHint ?? "Add a catalog item first, then return here."}
        </FieldDescription>
      )}
    </div>
  );
}

export function FormSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  emptyHint,
  clearable = true,
  ariaLabel,
  triggerClassName,
  emptyLabel,
  showEmptyHint = true,
  disableWhenEmpty = true,
  searchable = false,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
  emptyHint?: string;
  clearable?: boolean;
  ariaLabel?: string;
  triggerClassName?: string;
  emptyLabel?: string;
  showEmptyHint?: boolean;
  disableWhenEmpty?: boolean;
  searchable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selectableOptions = options.filter((option) => option.value !== "");
  const hasChoices = selectableOptions.length > 0;
  const isDisabled = disabled || (disableWhenEmpty && !hasChoices);
  const hasClearOption = clearable && Boolean(value) && !isDisabled;
  let clearValue = "__clear_selection__";
  while (selectableOptions.some((option) => option.value === clearValue))
    clearValue += "_";
  const selectItems = hasClearOption
    ? [{ value: clearValue, label: "Clear selection" }, ...selectableOptions]
    : selectableOptions;
  const selectedOption = selectableOptions.find(
    (option) => option.value === value,
  );
  const searchLabel = placeholder.replace(/^select /i, "").toLowerCase();
  const selectControl = searchable ? (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={ariaLabel ?? placeholder}
            disabled={isDisabled}
            className={`h-9 w-full min-w-0 justify-between px-3 font-normal ${triggerClassName ?? ""}`}
          />
        }
      >
        <span
          className={
            selectedOption
              ? "truncate text-left"
              : "truncate text-left text-muted-foreground"
          }
        >
          {selectedOption?.label ?? (hasChoices ? placeholder : (emptyLabel ?? "No options available"))}
        </span>
        <ChevronDown data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(28rem,calc(100vw-2rem))] p-0"
      >
        <Command>
          <CommandInput placeholder={`Search ${searchLabel}…`} />
          <CommandList>
            <CommandEmpty>
              {emptyHint ?? `No matching ${searchLabel}.`}
            </CommandEmpty>
            <CommandGroup>
              {hasClearOption && (
                <CommandItem
                  value="clear selection"
                  onSelect={() => {
                    onChange("");
                    setOpen(false);
                    focusNextFormControlAfterSelection(id);
                  }}
                >
                  Clear selection
                </CommandItem>
              )}
              {selectableOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                    focusNextFormControlAfterSelection(id);
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {value === option.value && (
                    <Check
                      data-slot="select-item-indicator"
                      className="ml-auto"
                    />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  ) : (
    <Select
      items={selectItems}
      value={value || null}
      onValueChange={(next) => {
        onChange(next === clearValue ? "" : (next ?? ""));
        focusNextFormControlAfterSelection(id);
      }}
      disabled={isDisabled}
    >
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={`${hasClearOption ? "h-9 w-full pr-9" : "h-9 w-full"} ${triggerClassName ?? ""}`}
      >
        <SelectValue
          placeholder={
            hasChoices ? placeholder : (emptyLabel ?? "No options available")
          }
        />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {hasClearOption && (
            <SelectItem key="clear-selection" value={clearValue}>
              Clear selection
            </SelectItem>
          )}
          {selectableOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="relative min-w-0">
        {selectControl}
        {hasClearOption && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Clear ${placeholder.toLowerCase()}`}
            title="Clear selection"
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onChange("");
            }}
          >
            <X />
          </Button>
        )}
      </div>
      {!hasChoices && showEmptyHint && (
        <FieldDescription>
          {emptyHint ??
            "No choices have been added yet. Add one in the relevant setup page, then come back here."}
        </FieldDescription>
      )}
    </div>
  );
}

function containsRequiredControl(node: React.ReactNode): boolean {
  return React.Children.toArray(node).some((child) => {
    if (!React.isValidElement(child)) return false;
    const props = child.props as {
      required?: boolean;
      children?: React.ReactNode;
    };
    return props.required === true || containsRequiredControl(props.children);
  });
}

export function Field({
  label,
  id,
  children,
  required = false,
  className,
}: {
  label?: string;
  id: string;
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  const isRequired = required || containsRequiredControl(children);
  return (
    <UiField className={className}>
      {label !== undefined && (
        <FieldLabel htmlFor={id} className={isRequired ? "gap-0" : undefined}>
          {label}
          {isRequired && (
            <span aria-hidden="true" className="ml-px text-destructive">
              *
            </span>
          )}
        </FieldLabel>
      )}
      {children}
    </UiField>
  );
}

export function PersistentSelectField({
  label,
  id,
  value,
  onChange,
  options,
  onAdd,
  required = true,
  emptyHint,
  triggerClassName,
  emptyLabel,
  showEmptyHint = true,
  disableWhenEmpty = true,
  searchable = false,
}: {
  label?: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onAdd?: (value: string) => Promise<void>;
  required?: boolean;
  emptyHint?: string;
  triggerClassName?: string;
  emptyLabel?: string;
  showEmptyHint?: boolean;
  disableWhenEmpty?: boolean;
  searchable?: boolean;
}) {
  const [saving, setSaving] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const selectedIsSaved = options.some(
    (option) => option.toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
  );
  async function addOption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = draft.trim();
    if (!next || saving || !onAdd) return;
    if (
      options.some(
        (option) => option.toLocaleLowerCase() === next.toLocaleLowerCase(),
      )
    ) {
      const existing = options.find(
        (option) => option.toLocaleLowerCase() === next.toLocaleLowerCase(),
      )!;
      onChange(existing);
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onAdd(next);
      onChange(next);
      setDraft("");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Could not save ${label?.toLowerCase() || "option"}`,
      );
    } finally {
      setSaving(false);
    }
  }
  const selectControl = searchable ? (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={pickerOpen}
            className={`h-9 w-full min-w-0 justify-between px-3 font-normal ${triggerClassName ?? ""}`}
          />
        }
      >
        <span className={value ? "truncate text-left" : "truncate text-left text-muted-foreground"}>
          {value || `Select ${label?.toLowerCase() || "option"}`}
        </span>
        <ChevronDown data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <Command>
          <CommandInput placeholder={`Search ${label?.toLowerCase() || "options"}…`} />
          <CommandList>
            <CommandEmpty>{emptyHint ?? `No ${label?.toLowerCase() || "options"} found.`}</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem value="clear selection" onSelect={() => {
                  onChange("");
                  setPickerOpen(false);
                  focusNextFormControlAfterSelection(id);
                }}>
                  Clear selection
                </CommandItem>
              )}
              {options.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => {
                  onChange(option);
                  setPickerOpen(false);
                  focusNextFormControlAfterSelection(id);
                }}>
                  <span className="truncate">{option}</span>
                  {value === option && <Check data-slot="select-item-indicator" className="ml-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  ) : (
    <FormSelect
      id={id}
      value={value}
      onChange={onChange}
      options={options.map((option) => ({ value: option, label: option }))}
      placeholder={`Select ${label?.toLowerCase() || "option"}`}
      clearable={false}
      triggerClassName={triggerClassName}
      emptyLabel={emptyLabel}
      showEmptyHint={showEmptyHint}
      disableWhenEmpty={disableWhenEmpty}
      emptyHint={emptyHint ?? `Add a ${label?.toLowerCase() || "option"} to begin.`}
    />
  );
  return (
    <Field label={label!} id={id} required={required} className="min-w-0">
      <div className="flex min-w-0 gap-2">
        <div className="min-w-0 flex-1">
          {selectControl}
        </div>
        {onAdd && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Add ${label?.toLowerCase() || "option"}`}
            title={`Add ${label?.toLowerCase() || "option"}`}
            onClick={() => {
              setDraft("");
              setOpen(true);
            }}
          >
            <Plus />
          </Button>
        )}
      </div>
      {onAdd && value && !selectedIsSaved && (
        <p className="text-xs text-muted-foreground">
          This value will be saved with the record.
        </p>
      )}
      {onAdd && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <form
              onSubmit={(event) => void addOption(event)}
              className="contents"
            >
              <DialogHeader>
                <DialogTitle>
                  Add {label?.toLowerCase() || "option"}
                </DialogTitle>
                <DialogDescription>
                  Save a reusable {label?.toLowerCase() || "option"} for future
                  items.
                </DialogDescription>
              </DialogHeader>
              <Field label={label!} id={`${id}-new`} required>
                <Input
                  id={`${id}-new`}
                  autoFocus
                  maxLength={100}
                  required
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={`Enter ${label?.toLowerCase() || "option"}`}
                />
              </Field>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  data-operator-save
                  title="Save (Ctrl+S)"
                  type="submit"
                  disabled={!draft.trim() || saving}
                >
                  {saving
                    ? "Saving…"
                    : `Save ${label?.toLowerCase() || "option"}`}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </Field>
  );
}
