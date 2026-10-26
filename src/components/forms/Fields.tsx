import { Field as UiField, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export function FormSelect({ id, value, onChange, options, placeholder, disabled = false, emptyHint, clearable = true }: { id?: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; placeholder: string; disabled?: boolean; emptyHint?: string; clearable?: boolean }) {
  const selectableOptions = options.filter((option) => option.value !== '')
  const hasChoices = selectableOptions.length > 0
  const isDisabled = disabled || !hasChoices
  const hasClearOption = clearable && Boolean(value) && !isDisabled
  let clearValue = '__clear_selection__'
  while (selectableOptions.some((option) => option.value === clearValue)) clearValue += '_'
  const selectItems = hasClearOption ? [{ value: clearValue, label: 'Clear selection' }, ...selectableOptions] : selectableOptions
  return (
    <div className="grid gap-1.5">
      <div className="relative">
        <Select items={selectItems} value={value || null} onValueChange={(next) => onChange(next === clearValue ? '' : next ?? '')} disabled={isDisabled}>
          <SelectTrigger id={id} className={hasClearOption ? 'h-9 w-full pr-9' : 'h-9 w-full'}>
            <SelectValue placeholder={hasChoices ? placeholder : 'No options available'} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {hasClearOption && <SelectItem key="clear-selection" value={clearValue}>Clear selection</SelectItem>}
              {selectableOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {hasClearOption && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={`Clear ${placeholder.toLowerCase()}`}
            title="Clear selection"
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
            onPointerDown={(event) => { event.preventDefault(); event.stopPropagation() }}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onChange('') }}
          >
            <X />
          </Button>
        )}
      </div>
      {!hasChoices && <FieldDescription>{emptyHint ?? 'No choices have been added yet. Add one in the relevant setup page, then come back here.'}</FieldDescription>}
    </div>
  )
}

export function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <UiField><FieldLabel htmlFor={id}>{label}</FieldLabel>{children}</UiField> }
