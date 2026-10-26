"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { readTablePageSize, TABLE_PAGE_SIZE_EVENT } from "@/lib/preferences"

function rowText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(rowText).join(" ")
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return rowText(node.props.children)
  return ""
}

function isEmptyState(row: React.ReactNode) {
  return React.isValidElement<{ children?: React.ReactNode }>(row)
    && React.Children.toArray(row.props.children).some((cell) => React.isValidElement<{ colSpan?: number }>(cell) && cell.props.colSpan !== undefined)
}

function Table({ className, children, managed = true, filterable = managed, ...props }: React.ComponentProps<"table"> & { managed?: boolean; filterable?: boolean }) {
  const [filter, setFilter] = React.useState("")
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(readTablePageSize)
  React.useEffect(() => {
    const handlePageSizeChange = (event: Event) => {
      const nextPageSize = (event as CustomEvent<number>).detail
      if (Number.isInteger(nextPageSize) && nextPageSize > 0) {
        setPageSize(nextPageSize)
        setPage(0)
      }
    }
    window.addEventListener(TABLE_PAGE_SIZE_EVENT, handlePageSizeChange)
    return () => window.removeEventListener(TABLE_PAGE_SIZE_EVENT, handlePageSizeChange)
  }, [])
  const findBody = (node: React.ReactNode): React.ReactElement<{ children?: React.ReactNode }> | undefined => {
    let found: React.ReactElement<{ children?: React.ReactNode }> | undefined
    React.Children.forEach(node, (child) => {
      if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return
      if (child.type === TableBody) found = child
      else found = findBody(child.props.children) ?? found
    })
    return found
  }
  const bodyElement = React.useMemo(() => findBody(children), [children])
  const bodyRows = React.useMemo(() => bodyElement ? React.Children.toArray(bodyElement.props.children) : [], [bodyElement])
  const dataRows = React.useMemo(() => bodyRows.filter((row) => !isEmptyState(row)), [bodyRows])
  const emptyRow = React.useMemo(() => bodyRows.find(isEmptyState), [bodyRows])
  const searchableRows = React.useMemo(() => dataRows.map((row) => ({ row, text: rowText(row).toLowerCase() })), [dataRows])
  const normalizedFilter = filter.trim().toLowerCase()
  const matching = React.useMemo(() => normalizedFilter
    ? searchableRows.filter(({ text }) => text.includes(normalizedFilter)).map(({ row }) => row)
    : dataRows, [dataRows, normalizedFilter, searchableRows])
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const visibleRows = matching.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const transformed = (node: React.ReactNode): React.ReactNode => React.Children.map(node, (child) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return child
    if (child.type === TableBody) return React.cloneElement(child, {}, matching.length ? visibleRows : emptyRow)
    return React.cloneElement(child, {}, transformed(child.props.children))
  })
  const from = matching.length ? currentPage * pageSize + 1 : 0
  const to = Math.min((currentPage + 1) * pageSize, matching.length)
  const content = managed ? transformed(children) : children
  return (
    <div className="flex w-full flex-col gap-3">
      {managed && <div className="flex flex-wrap items-center justify-between gap-2">
        {filterable ? <div className="relative min-w-48 flex-1 sm:max-w-xs"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="Filter table rows" className="h-9 pl-9" placeholder="Filter these records…" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0) }} /></div> : <span />}
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>{from}–{to} of {matching.length}</span><Button type="button" variant="outline" size="icon-sm" aria-label="Previous table page" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft /></Button><span className="tabular-nums">{currentPage + 1} / {pageCount}</span><Button type="button" variant="outline" size="icon-sm" aria-label="Next table page" disabled={currentPage + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}><ChevronRight /></Button></div>
      </div>}
      <div data-slot="table-container" className="relative min-w-0 w-full overflow-x-auto"><table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props}>{content}</table></div>
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
