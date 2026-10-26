import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function parseLocalDate(value: string): Date | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatLocalDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function DatePicker({ id, value, onChange, placeholder = 'Choose a date', disabled }: { id?: string; value: string; onChange: (value: string) => void; placeholder?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const selected = parseLocalDate(value)
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button id={id} type="button" variant="outline" disabled={disabled} aria-label={placeholder} className="h-9 w-full justify-between px-3 font-normal" />}>
      <span className={selected ? '' : 'text-muted-foreground'}>{selected ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(selected) : placeholder}</span>
      <CalendarDays data-icon="inline-end" />
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto p-0">
      <Calendar mode="single" selected={selected} onSelect={(date) => { if (date) onChange(formatLocalDate(date)); setOpen(false) }} />
    </PopoverContent>
  </Popover>
}
