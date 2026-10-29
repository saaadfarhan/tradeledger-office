import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ConfirmActionDialog } from '@/components/feedback/ConfirmActionDialog'
import type { Account, Bank, Cheque } from '@/types'
import { DatePicker } from '@/components/forms/DatePicker'
import { FormSectionHeading } from '@/components/forms/FormSectionHeading'
import { formatMoney as money } from '@/lib/formatters'
import { todayIsoDate as today } from '@/lib/formatters'
import { FormSelect, Field } from '@/components/forms/Fields'

export function ChequePage({ rows, banks, accounts, onSave, onDelete }: { rows: Cheque[]; banks: Bank[]; accounts: Account[]; onSave: (value: Cheque & { __baseline?: Partial<Cheque> }) => Promise<void>; onDelete: (number: string) => Promise<void> }) {
  const [number, setNumber] = useState(''); const [bankCode, setBankCode] = useState(''); const [date, setDate] = useState(today()); const [party, setParty] = useState(''); const [amount, setAmount] = useState(''); const [status, setStatus] = useState(''); const [checkNumber, setCheckNumber] = useState(''); const [direction, setDirection] = useState<'' | 'PAYMENT' | 'RECEIPT'>(''); const [bankAccountCode, setBankAccountCode] = useState(''); const [clearedDate, setClearedDate] = useState(today()); const [saving, setSaving] = useState(false); const [reservingNumber, setReservingNumber] = useState(false); const [editorOpen, setEditorOpen] = useState(false); const [editing, setEditing] = useState(false); const [baseline, setBaseline] = useState<Cheque | null>(null); const [deleteNumber, setDeleteNumber] = useState<string | null>(null)
  const partyRoot = accounts.find((account) => account.description.trim().toLowerCase() === 'party')
  async function beginCreate() {
    setReservingNumber(true)
    try { setNumber(await window.office.ids.next('cheque')); setBankCode(''); setDate(today()); setParty(''); setAmount(''); setStatus(''); setCheckNumber(''); setDirection(''); setBankAccountCode(''); setClearedDate(today()); setEditing(false); setBaseline(null); setEditorOpen(true) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not prepare a new cheque') }
    finally { setReservingNumber(false) }
  }
  const partyCodes = new Set<string>()
  if (partyRoot) { partyCodes.add(partyRoot.code); let changed = true; while (changed) { changed = false; for (const account of accounts) if (account.parentCode && partyCodes.has(account.parentCode) && !partyCodes.has(account.code)) { partyCodes.add(account.code); changed = true } } }
  const partyChoices = accounts.filter((account) => (partyRoot ? account.code !== partyRoot.code && partyCodes.has(account.code) : false) || account.description.trim().toLowerCase() === 'cash in hand')
  function beginEdit(row: Cheque) { setNumber(row.number); setBankCode(row.bankCode); setDate(row.date); setParty(row.party); setAmount(String(row.amount)); setStatus(row.status); setCheckNumber(row.checkNumber); setDirection(row.direction || ''); setBankAccountCode(banks.find((bank) => bank.code === row.bankCode)?.ledgerAccountCode || row.bankAccountCode || ''); setClearedDate(row.clearedDate || ''); setEditing(true); setBaseline(row); setEditorOpen(true) }
  async function submit() {
    setSaving(true)
    if (!status) { toast.error('Select a status'); return }
    try { await onSave({ number, bankCode, date, party, amount: Number(amount), status: status as Cheque['status'], checkNumber, direction, bankAccountCode, clearedDate, ...(editing && baseline ? { __baseline: baseline } : {}) }); toast.success(editing ? 'Cheque updated' : 'Cheque saved'); setEditing(false); setBaseline(null); setNumber(''); setParty(''); setAmount(''); setCheckNumber(''); setDate(today()); setStatus(''); setDirection(''); setBankAccountCode(''); setClearedDate(today()); setEditorOpen(false) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save cheque') }
    finally { setSaving(false) }
  }
  return <section className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold tracking-tight">Cheque Detail</h1><p className="mt-1 text-sm text-muted-foreground">Record cheque information, bank, party, and status.</p></div><Button disabled={reservingNumber || saving} onClick={() => void beginCreate()}><Plus data-icon="inline-start" />{reservingNumber ? 'Preparing…' : 'New cheque'}</Button></div>
    <Sheet open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) { setEditing(false); setBaseline(null) } }}><SheetContent side="right" className="flex data-[side=right]:w-[min(92vw,38rem)] flex-col gap-0 overflow-hidden p-0 data-[side=right]:sm:max-w-none"><SheetHeader className="border-b px-6 py-5"><SheetTitle>{editing ? 'Edit cheque' : 'New cheque record'}</SheetTitle><SheetDescription>Record the check number, bank, party, amount, and current status.</SheetDescription></SheetHeader>
      <FieldGroup className="grid min-h-0 flex-1 content-start grid-cols-1 gap-x-5 gap-y-5 overflow-y-auto p-6 sm:grid-cols-2">
        <FormSectionHeading title="Cheque details" />
        <Field label="Cheque ID" id="cheque-id"><Input id="cheque-id" value={number} disabled /></Field>
        <Field label="Check Number" id="check-number"><Input id="check-number" value={checkNumber} onChange={(event) => setCheckNumber(event.target.value)} /></Field>
        <Field label="Bank" id="cheque-bank" required><FormSelect id="cheque-bank" value={bankCode} onChange={(value) => { setBankCode(value); setBankAccountCode(banks.find((bank) => bank.code === value)?.ledgerAccountCode || '') }} placeholder="Select a bank" emptyHint="Add the bank in Banks, link its ledger account, then return here." options={banks.map((bank) => ({ value: bank.code, label: `${bank.code} — ${bank.name}` }))} /></Field>
        <Field label="Cheque date" id="cheque-date" required><DatePicker id="cheque-date" value={date} onChange={setDate} /></Field>
        <FormSectionHeading title="Payment details" />
        <Field label="Party" id="cheque-party" required><FormSelect id="cheque-party" value={party} onChange={setParty} placeholder="Select a party" emptyHint="Add the party account in Chart of Accounts, then return here." options={partyChoices.map((account) => ({ value: account.code, label: `${account.description} — ${account.code}` }))} /></Field>
        <Field label="Amount" id="cheque-amount"><Input id="cheque-amount" type="number" min="0" step="any" required value={amount} onChange={(event) => setAmount(event.target.value)} /></Field>
        <Field label="Status" id="cheque-status" required><FormSelect id="cheque-status" value={status} onChange={setStatus} placeholder="Select status" options={[['PENDING', 'Waiting to clear'], ['CLEARED', 'Cleared'], ['RETURNED', 'Returned'], ['CANCELLED', 'Cancelled']].map(([value, label]) => ({ value, label }))} /></Field>
        {status === 'CLEARED' && <>
          <Field label="Cleared date" id="cheque-cleared-date" required={status === 'CLEARED'}><DatePicker id="cheque-cleared-date" value={clearedDate} onChange={setClearedDate} /></Field>
          <Field label="Transaction direction" id="cheque-direction" required={status === 'CLEARED'}><FormSelect id="cheque-direction" value={direction} onChange={(value) => setDirection(value as typeof direction)} placeholder="Select direction" options={[{ value: 'PAYMENT', label: 'Payment to party' }, { value: 'RECEIPT', label: 'Receipt from party' }]} /></Field>
          <p className="text-sm text-muted-foreground">Bank ledger account: {accounts.find((account) => account.code === bankAccountCode)?.description ?? (bankAccountCode ? bankAccountCode : 'Not linked. Edit this bank in Banks to assign its ledger account.')}</p>
          <p className="text-sm text-muted-foreground sm:col-span-2">Clearing posts a balanced entry on the cleared date. Payment debits the party; receipt debits the bank account.</p>
        </>}
      </FieldGroup>
      <SheetFooter className="mt-0 border-t px-6 py-4"><Button onClick={() => void submit()} disabled={saving || !banks.length || !status}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Save cheque'}</Button></SheetFooter>
    </SheetContent></Sheet>
    <Card><CardHeader><CardTitle className="text-base">Saved cheques</CardTitle><CardDescription>{rows.length} record{rows.length === 1 ? '' : 's'}</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cheque ID</TableHead><TableHead>Check Number</TableHead><TableHead>Date</TableHead><TableHead>Bank</TableHead><TableHead>Party</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.number}><TableCell className="font-medium">{row.number}</TableCell><TableCell>{row.checkNumber || '—'}</TableCell><TableCell>{row.date}</TableCell><TableCell>{banks.find((bank) => bank.code === row.bankCode)?.name ?? row.bankCode}</TableCell><TableCell>{row.party}</TableCell><TableCell><Badge variant="secondary">{{ PENDING: "Waiting to clear", CLEARED: "Cleared", RETURNED: "Returned", CANCELLED: "Cancelled" }[row.status] ?? row.status}</Badge></TableCell><TableCell className="text-right tabular-nums">{money(row.amount)}</TableCell><TableCell className="whitespace-nowrap"><Button variant="ghost" size="sm" onClick={() => beginEdit(row)}>Edit</Button><Button variant="ghost" size="sm" onClick={() => setDeleteNumber(row.number)}>Delete</Button></TableCell></TableRow>)}{rows.length === 0 && <TableRow><TableCell colSpan={8} className="h-20 text-center text-muted-foreground">No cheques recorded yet.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
    <ConfirmActionDialog open={deleteNumber !== null} onOpenChange={(open) => { if (!open) setDeleteNumber(null) }} title={`Delete cheque ${deleteNumber ?? ''}?`} description="This permanently deletes the cheque and its status history. The deletion remains in the audit log." confirmLabel="Delete cheque" onConfirm={() => { const target = deleteNumber; if (target) void onDelete(target).then(() => toast.success('Cheque deleted')).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not delete cheque')).finally(() => setDeleteNumber(null)) }} />
  </section>
}
