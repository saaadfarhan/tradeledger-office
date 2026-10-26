import { createPortal } from 'react-dom'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { CompanyProfile } from '@/types'

export function requestPrint() {
  document.body.classList.add('printing-document')
  const cleanup = () => document.body.classList.remove('printing-document')
  window.addEventListener('afterprint', cleanup, { once: true })
  window.setTimeout(async () => {
    const images = Array.from(document.querySelectorAll<HTMLImageElement>('#print-root img'))
    await Promise.all(images.map((image) => image.decode().catch(() => undefined)))
    window.print()
  }, 80)
  window.setTimeout(cleanup, 30_000)
}

export function PrintDocument({ company, logo, title, subtitle, columns, rows, total, challan }: {
  company: CompanyProfile | null
  logo: string | null
  title: string
  subtitle?: string
  columns: string[]
  rows: string[][]
  total?: string
  challan?: { number: string; date: string; party: string; partyLabel?: string; location: string }
}) {
  return createPortal(<div id="print-root" className="print-root" aria-hidden="true"><PrintSheet company={company} logo={logo} title={title} subtitle={subtitle} columns={columns} rows={rows} total={total} challan={challan} /></div>, document.body)
}

export function PrintPreviewDialog({ open, onOpenChange, onPrint, company, logo, title, subtitle, columns, rows, total, challan }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPrint: () => void
  company: CompanyProfile | null
  logo: string | null
  title: string
  subtitle?: string
  columns: string[]
  rows: string[][]
  total?: string
  challan?: { number: string; date: string; party: string; partyLabel?: string; location: string }
}) {
  const print = () => {
    onOpenChange(false)
    window.setTimeout(onPrint, 160)
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex max-h-[94dvh] w-[min(96vw,64rem)] max-w-none sm:max-w-none flex-col gap-0 overflow-hidden p-0">
      <DialogHeader className="shrink-0 border-b px-5 py-4">
        <DialogTitle>Print preview · {title}</DialogTitle>
        <DialogDescription>Review the document details and page layout before printing.</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-auto bg-muted/70 p-3 sm:p-6">
        <PrintSheet preview company={company} logo={logo} title={title} subtitle={subtitle} columns={columns} rows={rows} total={total} challan={challan} />
      </div>
      <DialogFooter className="shrink-0 items-center justify-between border-t px-5 py-3">
        <p className="mr-auto text-xs text-muted-foreground">A4 page · Printed {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}</p>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Close preview</Button>
        <Button onClick={print}><Printer data-icon="inline-start" />Print…</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
}

function PrintSheet({ company, logo, title, subtitle, columns, rows, total, challan, preview = false }: {
  company: CompanyProfile | null
  logo: string | null
  title: string
  subtitle?: string
  columns: string[]
  rows: string[][]
  total?: string
  challan?: { number: string; date: string; party: string; partyLabel?: string; location: string }
  preview?: boolean
}) {
  const companyName = company?.name.trim() || 'TradeLedger Office'
  const companyDetails = [
    company?.address.trim(),
    company?.phone.trim() ? `Phone: ${company.phone.trim()}` : '',
    !challan && company?.fiscalYear.trim() ? `Fiscal year: ${company.fiscalYear.trim()}` : '',
  ].filter((detail): detail is string => Boolean(detail))
  const challanDate = challan ? (() => {
    const [year, month, day] = challan.date.split('-').map(Number)
    const parsed = new Date(Date.UTC(year, month - 1, day, 12))
    return Number.isNaN(parsed.getTime()) ? challan.date : new Intl.DateTimeFormat('en-PK', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(parsed)
  })() : ''

  return <article className={`print-sheet${preview ? ' print-preview-sheet' : ''}${challan ? ' print-challan' : ''}`}>
    <header className="print-company">
      <div className="print-brand">
        {logo && <img className="print-logo" src={logo} alt="" />}
        <div className="print-company-copy"><h1>{companyName}</h1>{companyDetails.length > 0 && <div className="print-company-details">{companyDetails.map((detail) => <span key={detail}>{detail}</span>)}</div>}</div>
      </div>
      {challan
        ? <div className="print-challan-title"><h2>{title}</h2></div>
        : <p className="print-date">Printed {new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }).format(new Date())} PKT</p>}
    </header>
    {challan && <dl className="print-challan-meta"><div><dt>Challan No.</dt><dd>{challan.number}</dd></div><div><dt>Date</dt><dd>{challanDate}</dd></div><div><dt>Location</dt><dd>{challan.location}</dd></div></dl>}
    {challan ? <div className="print-challan-party"><span>{challan.partyLabel || 'Party'}</span><strong>{challan.party}</strong></div> : <div className="print-document-heading"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>}
    <table className="print-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((value, cell) => <td key={cell}>{value || '—'}</td>)}</tr>)}</tbody></table>
    {total && <p className={`print-total${challan ? ' print-challan-total' : ''}`}><span>{challan ? 'Grand total' : 'Total'}</span><strong>{total}</strong></p>}
    {challan
      ? <footer className="print-challan-signatures"><span>Prepared by</span><span>Received by</span><span>Signature</span></footer>
      : <footer className="print-footer">Generated by TradeLedger Office · Verify totals against authorized source documents.</footer>}
  </article>
}
