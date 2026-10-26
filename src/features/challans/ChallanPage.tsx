import { useMemo, useState } from 'react'
import { Plus, Printer, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field as UiField, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmActionDialog } from '@/components/feedback/ConfirmActionDialog'
import type { Account, Challan, ChallanInputLine, CompanyProfile, Item, StockType } from '@/types'
import { PrintDocument, PrintPreviewDialog, requestPrint } from '@/features/printing/PrintDocument'
import { DatePicker } from '@/components/forms/DatePicker'
import { FormSectionHeading } from '@/components/forms/FormSectionHeading'
import { formatMoney as money } from '@/lib/formatters'
import { todayIsoDate as today } from '@/lib/formatters'
import { FormSelect, Field } from '@/components/forms/Fields'

function PrinterIcon() { return <Printer className="mr-2 size-4" /> }

export function ChallanPage({ type, rows, items, accounts, locations, stockTypes, company, logo, onPost, onUpdate, onDelete, onCreateItem }: { type: 'PURCHASE' | 'SALE'; rows: Challan[]; items: Item[]; accounts: Account[]; locations: string[]; stockTypes: StockType[]; company: CompanyProfile | null; logo: string | null; onPost: (value: { number: string; type: string; date: string; party: string; location: string; lines: ChallanInputLine[] }) => Promise<void>; onUpdate: (value: { number: string; type: string; date: string; party: string; location: string; lines: ChallanInputLine[]; __baseline?: Partial<Challan> }) => Promise<void>; onDelete: (number: string) => Promise<void>; onCreateItem: (value: Omit<Item, 'code' | 'stockQuantity'>) => Promise<Item> }) {
  type DraftLine = { itemCode: string; itemLabel: string; labelOnly: boolean; quantity: number; rate: number }
  const [number, setNumber] = useState(''); const [date, setDate] = useState(today()); const [party, setParty] = useState(''); const [location, setLocation] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ itemCode: '', itemLabel: '', labelOnly: false, quantity: 1, rate: 0 }]); const [posting, setPosting] = useState(false); const [reservingNumber, setReservingNumber] = useState(false); const [editorOpen, setEditorOpen] = useState(false); const [editingNumber, setEditingNumber] = useState<string | null>(null); const [baseline, setBaseline] = useState<Challan | null>(null); const [deleteNumber, setDeleteNumber] = useState<string | null>(null); const [printChallan, setPrintChallan] = useState<Challan | null>(null); const [printPreviewOpen, setPrintPreviewOpen] = useState(false)
  const [createItemOpen, setCreateItemOpen] = useState(false); const [createItemTarget, setCreateItemTarget] = useState<number | null>(null); const [itemDescription, setItemDescription] = useState(''); const [itemUnit, setItemUnit] = useState('Unit'); const [itemStockType, setItemStockType] = useState(stockTypes[0]?.code ?? ''); const [itemPurchaseRate, setItemPurchaseRate] = useState('0'); const [itemSaleRate, setItemSaleRate] = useState('0'); const [creatingItem, setCreatingItem] = useState(false)
  const idKind = type === 'PURCHASE' ? 'purchaseChallan' : 'saleChallan'
  async function beginCreate() {
    if (!locations.length) { toast.info('Add a location on the Locations page before creating a challan'); return }
    setReservingNumber(true)
    try {
      setEditingNumber(null); setBaseline(null); setNumber(await window.office.ids.next(idKind)); setDate(today()); setParty(''); setLocation(''); setLines([{ itemCode: '', itemLabel: '', labelOnly: false, quantity: 1, rate: 0 }]); setEditorOpen(true)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not prepare a new challan') }
    finally { setReservingNumber(false) }
  }
  const accountChoices = useMemo(() => {
    const partyRoot = accounts.find((account) => account.description.trim().toLowerCase() === 'party')
    if (!partyRoot) return accounts.filter((account) => account.description.trim().toLowerCase() === 'cash in hand')
    const descendants = new Set([partyRoot.code]); let changed = true
    while (changed) { changed = false; for (const account of accounts) if (account.parentCode && descendants.has(account.parentCode) && !descendants.has(account.code)) { descendants.add(account.code); changed = true } }
    return accounts.filter((account) => account.code !== partyRoot.code && descendants.has(account.code) || account.description.trim().toLowerCase() === 'cash in hand')
  }, [accounts])
  const printParty = printChallan ? accounts.find((account) => account.code === printChallan.party)?.description ?? printChallan.party : ''
  const printRows = printChallan?.lines.map((line, index) => {
    const item = items.find((candidate) => candidate.code === line.itemCode)
    return [String(index + 1), line.itemCode || '—', item?.description ?? line.itemLabel ?? '', `${line.quantity}${item?.unit ? ` ${item.unit}` : ''}`, money(line.rate), money(line.amount)]
  }) ?? []
  const setLine = (index: number, updates: Partial<DraftLine>) => setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...updates } : line))
  const lineRate = (line: DraftLine) => { const item = items.find((row) => row.code === line.itemCode); return line.labelOnly ? line.rate : type === 'PURCHASE' ? item?.purchaseRate ?? 0 : item?.saleRate ?? 0 }
  const total = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * lineRate(line), 0)
  function beginEdit(row: Challan) { setEditingNumber(row.number); setBaseline(row); setNumber(row.number); setDate(row.date); setParty(row.party); setLocation(row.location); setLines(row.lines.map((line) => ({ itemCode: line.itemCode, itemLabel: line.itemLabel ?? '', labelOnly: !line.itemCode, quantity: line.quantity, rate: line.rate }))); setEditorOpen(true) }
  async function beginCreateItem(index: number) {
    if (!stockTypes.length) { toast.error('No stock types are available. Add a stock type first.'); return }
    setCreateItemTarget(index); setItemDescription(''); setItemUnit('Unit'); setItemStockType(stockTypes[0].code); setItemPurchaseRate('0'); setItemSaleRate('0'); setCreateItemOpen(true)
  }
  async function submitCreateItem(event: React.FormEvent) {
    event.preventDefault()
    if (createItemTarget === null) return
    setCreatingItem(true)
    try {
      const saved = await onCreateItem({ description: itemDescription.trim(), unit: itemUnit.trim() || 'Unit', stockType: itemStockType, purchaseRate: Number(itemPurchaseRate), saleRate: Number(itemSaleRate) })
      setLines((current) => current.map((line, index) => index === createItemTarget ? { ...line, itemCode: saved.code, itemLabel: '', labelOnly: false } : line))
      setCreateItemOpen(false); setCreateItemTarget(null); toast.success(`Item ${saved.code} added to the Items list`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create item') }
    finally { setCreatingItem(false) }
  }
  async function submit() {
    if (!location) { toast.error('Select a location'); return }
    setPosting(true)
    try { const submittedLines = lines.map((line): ChallanInputLine => line.labelOnly ? { itemLabel: line.itemLabel.trim(), quantity: line.quantity, rate: line.rate } : { itemCode: line.itemCode, quantity: line.quantity }); const value = { number, type, date, party, location, lines: submittedLines }; if (editingNumber) { await onUpdate({ ...value, ...(baseline ? { __baseline: baseline } : {}) }); toast.success('Challan updated') } else { await onPost(value); toast.success(`${type === 'PURCHASE' ? 'Purchase' : 'Sale'} challan posted`) }; setEditingNumber(null); setBaseline(null); setNumber(''); setParty(''); setDate(today()); setLocation(''); setLines([{ itemCode: '', itemLabel: '', labelOnly: false, quantity: 1, rate: 0 }]); setEditorOpen(false) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not post challan') }
    finally { setPosting(false) }
  }
  return <section className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">{type === 'PURCHASE' ? 'Purchase Challans' : 'Sale Challans'}</h1><p className="mt-1 text-sm text-muted-foreground">Select or create catalog items, or use one-off labels that do not change inventory.</p></div><Button disabled={reservingNumber || posting} onClick={() => void beginCreate()}><Plus data-icon="inline-start" />{reservingNumber ? 'Preparing…' : 'New challan'}</Button></div>
    <Sheet open={editorOpen} onOpenChange={(open) => { setEditorOpen(open); if (!open) { setEditingNumber(null); setBaseline(null) } }}><SheetContent side="right" className="flex data-[side=right]:w-[min(96vw,58rem)] flex-col gap-0 overflow-hidden p-0 data-[side=right]:sm:max-w-none"><SheetHeader className="border-b px-6 py-5"><SheetTitle>{editingNumber ? `Edit ${type.toLowerCase()} challan` : `New ${type.toLowerCase()} challan`}</SheetTitle><SheetDescription>Choose the party and location, then add catalog items or one-off labeled lines. Catalog items affect stock; labeled lines do not.</SheetDescription></SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
        <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormSectionHeading title="Document details" />
          <Field label="Challan number" id="challan-number"><Input id="challan-number" value={number} disabled /></Field>
          <Field label="Date" id="challan-date"><DatePicker id="challan-date" value={date} onChange={setDate} /></Field>
          <Field label="Party account" id="challan-party"><FormSelect id="challan-party" value={party} onChange={setParty} placeholder="Select a party" emptyHint="Add the party account in Chart of Accounts, then return here." options={accountChoices.map((account) => ({ value: account.code, label: `${account.description} — ${account.code}` }))} /></Field>
          <Field label="Location" id="challan-location"><FormSelect id="challan-location" value={location} onChange={setLocation} placeholder="Select a location" emptyHint="Add a location on the Locations page, then return here." options={locations.map((place) => ({ value: place, label: place }))} /></Field>
        </FieldGroup>
        <section className="flex flex-col gap-3" aria-label="Challan item lines">
          <FormSectionHeading title="Items" className="w-full" description="Create a catalog item here, select an existing one, or enter a one-off line label that will not be added to Items or inventory." />
          {lines.map((line, index) => {
            const rate = lineRate(line)
            return <div key={index} className="rounded-xl border bg-card p-4">
              <div className="mb-4 flex items-center justify-between"><p className="text-sm font-medium">Line {String(index + 1).padStart(2, '0')}</p><Button variant="ghost" size="icon-sm" aria-label={`Remove line ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}><Trash2 /></Button></div>
              <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)]">
                <div className="flex flex-col gap-2">
                  {line.labelOnly ? <Field label="One-off item label" id={`challan-label-${index}`}><Input id={`challan-label-${index}`} required maxLength={200} value={line.itemLabel} onChange={(event) => setLine(index, { itemLabel: event.target.value })} placeholder="Enter item or service description" /></Field> : <Field label="Catalog item" id={`challan-item-${index}`}><FormSelect id={`challan-item-${index}`} value={line.itemCode} onChange={(value) => setLine(index, { itemCode: value })} placeholder="Select an item" emptyHint="Create a catalog item here or use a one-off label." options={items.map((candidate) => ({ value: candidate.code, label: `${candidate.code} — ${candidate.description}` }))} /></Field>}
                  <div className="flex flex-wrap gap-2">
                    {!line.labelOnly && <Button type="button" variant="outline" size="sm" onClick={() => void beginCreateItem(index)}><Plus data-icon="inline-start" />Create catalog item</Button>}
                    <Button type="button" variant="ghost" size="sm" onClick={() => setLine(index, line.labelOnly ? { labelOnly: false, itemLabel: '', rate: 0 } : { labelOnly: true, itemCode: '', itemLabel: '', rate: 0 })}>{line.labelOnly ? 'Choose catalog item' : 'Use one-off label'}</Button>
                  </div>
                </div>
                <Field label="Quantity" id={`challan-quantity-${index}`}><Input id={`challan-quantity-${index}`} type="number" min="0.01" step="any" value={line.quantity} onChange={(event) => setLine(index, { quantity: Number(event.target.value) })} /></Field>
                {line.labelOnly ? <Field label="Rate" id={`challan-rate-${index}`}><Input id={`challan-rate-${index}`} type="number" min="0" step="any" value={line.rate} onChange={(event) => setLine(index, { rate: Number(event.target.value) })} /></Field> : <UiField><FieldLabel>Rate</FieldLabel><div className="flex h-9 items-center rounded-lg border bg-muted/40 px-3 font-medium tabular-nums">{money(rate)}</div></UiField>}
                <UiField><FieldLabel>Amount</FieldLabel><div className="flex h-9 items-center rounded-lg border bg-muted/40 px-3 font-semibold tabular-nums">{money(rate * line.quantity)}</div></UiField>
              </FieldGroup>
            </div>
          })}
        </section>
      </div>
      <SheetFooter className="mt-0 flex-row flex-wrap items-center justify-between gap-3 border-t px-6 py-4 sm:flex-row"><Button type="button" variant="outline" onClick={() => setLines((current) => [...current, { itemCode: '', itemLabel: '', labelOnly: false, quantity: 1, rate: 0 }])}><Plus data-icon="inline-start" />Add line</Button><div className="flex flex-wrap items-center justify-end gap-4"><span className="text-sm text-muted-foreground">Total <strong className="ml-2 text-base text-foreground tabular-nums">{money(total)}</strong></span><Button onClick={() => void submit()} disabled={posting || lines.some((line) => line.labelOnly ? !line.itemLabel.trim() : !line.itemCode) || lines.some((line) => !Number.isFinite(line.quantity) || line.quantity <= 0 || (line.labelOnly && (!Number.isFinite(line.rate) || line.rate < 0)))}>{posting ? 'Saving…' : editingNumber ? 'Save changes' : `Post ${type === 'PURCHASE' ? 'purchase' : 'sale'}`}</Button></div></SheetFooter>
    </SheetContent></Sheet>
    <Dialog open={createItemOpen} onOpenChange={setCreateItemOpen}><DialogContent><form onSubmit={(event) => void submitCreateItem(event)}><DialogHeader><DialogTitle>Create catalog item</DialogTitle><DialogDescription>This item will be saved in Items and selected on line {createItemTarget === null ? '' : createItemTarget + 1}. Stock will change only when you post the challan.</DialogDescription></DialogHeader><FieldGroup className="my-5 grid gap-4"><Field label="Description" id="new-challan-item-description"><Input id="new-challan-item-description" required maxLength={200} autoFocus value={itemDescription} onChange={(event) => setItemDescription(event.target.value)} placeholder="Item description" /></Field><Field label="Unit" id="new-challan-item-unit"><Input id="new-challan-item-unit" maxLength={40} value={itemUnit} onChange={(event) => setItemUnit(event.target.value)} placeholder="Unit" /></Field><Field label="Stock type" id="new-challan-item-stock-type"><FormSelect id="new-challan-item-stock-type" value={itemStockType} onChange={setItemStockType} options={stockTypes.map((stockType) => ({ value: stockType.code, label: `${stockType.code} — ${stockType.description}` }))} placeholder="Select stock type" /></Field><div className="grid grid-cols-2 gap-4"><Field label="Purchase rate" id="new-challan-item-purchase-rate"><Input id="new-challan-item-purchase-rate" type="number" min="0" step="any" value={itemPurchaseRate} onChange={(event) => setItemPurchaseRate(event.target.value)} /></Field><Field label="Sale rate" id="new-challan-item-sale-rate"><Input id="new-challan-item-sale-rate" type="number" min="0" step="any" value={itemSaleRate} onChange={(event) => setItemSaleRate(event.target.value)} /></Field></div><p className="text-xs text-muted-foreground">An item code will be generated automatically. Existing inventory is unchanged.</p></FieldGroup><DialogFooter><Button type="button" variant="outline" onClick={() => setCreateItemOpen(false)}>Cancel</Button><Button type="submit" disabled={creatingItem || !itemDescription.trim() || !itemStockType}>{creatingItem ? 'Creating…' : 'Create and select item'}</Button></DialogFooter></form></DialogContent></Dialog>
    <Card><CardHeader><CardTitle className="text-base">Recorded documents</CardTitle><CardDescription>{rows.length} challan{rows.length === 1 ? '' : 's'}</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table className="w-full min-w-[52rem] table-fixed"><TableHeader><TableRow><TableHead className="w-[14%]">Number</TableHead><TableHead className="w-[14%]">Date</TableHead><TableHead className="w-[21%]">Party</TableHead><TableHead className="w-[16%]">Location</TableHead><TableHead className="w-[15%] text-right">Total</TableHead><TableHead className="w-[20%]">Actions</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.number}><TableCell className="truncate font-medium">{row.number}</TableCell><TableCell className="whitespace-nowrap">{row.date}</TableCell><TableCell className="truncate" title={row.party}>{row.party}</TableCell><TableCell className="truncate" title={row.location}>{row.location}</TableCell><TableCell className="whitespace-nowrap text-right tabular-nums">{money(row.total)}</TableCell><TableCell className="whitespace-nowrap"><div className="flex items-center gap-1"><Button variant="outline" size="sm" onClick={() => { setPrintChallan(row); setPrintPreviewOpen(true) }}><PrinterIcon />Print</Button><Button variant="ghost" size="sm" onClick={() => beginEdit(row)}>Edit</Button><Button variant="ghost" size="sm" onClick={() => setDeleteNumber(row.number)}>Delete</Button></div></TableCell></TableRow>)}{rows.length === 0 && <TableRow><TableCell colSpan={6} className="h-20 text-center text-muted-foreground">No documents posted yet.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
    {printChallan && <>
      <PrintDocument company={company} logo={logo} title={`${type === 'PURCHASE' ? 'Purchase' : 'Sale'} Challan`} columns={['#', 'Item code', 'Description', 'Qty / unit', 'Rate', 'Amount']} rows={printRows} total={money(printChallan.total)} challan={{ number: printChallan.number, date: printChallan.date, party: printParty, partyLabel: type === 'SALE' ? 'Customer' : 'Supplier', location: printChallan.location }} />
      <PrintPreviewDialog open={printPreviewOpen} onOpenChange={setPrintPreviewOpen} onPrint={requestPrint} company={company} logo={logo} title={`${type === 'PURCHASE' ? 'Purchase' : 'Sale'} Challan`} columns={['#', 'Item code', 'Description', 'Qty / unit', 'Rate', 'Amount']} rows={printRows} total={money(printChallan.total)} challan={{ number: printChallan.number, date: printChallan.date, party: printParty, partyLabel: type === 'SALE' ? 'Customer' : 'Supplier', location: printChallan.location }} />
    </>}
    <ConfirmActionDialog open={deleteNumber !== null} onOpenChange={(open) => { if (!open) setDeleteNumber(null) }} title={`Delete challan ${deleteNumber ?? ''}?`} description="This permanently removes the document and its stock movements. A purchase deletion is blocked if it would leave negative stock." confirmLabel="Delete challan" onConfirm={() => { const target = deleteNumber; if (target) void onDelete(target).then(() => toast.success('Challan deleted')).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not delete challan')).finally(() => setDeleteNumber(null)) }} />
  </section>
}
