"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronDown, ChevronUp, Search } from "lucide-react"
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

type TableSort = { key: string; direction: "asc" | "desc" }
const TableSortContext = React.createContext<{
  sort: TableSort | null
  onSort: (key: string) => void
}>({ sort: null, onSort: () => {} })

function Table({
  className,
  children,
  managed = true,
  filterable = managed,
  tableContainerClassName,
  sortScope,
  defaultSort,
  sorting = true,
  ...props
}: React.ComponentProps<"table"> & {
  managed?: boolean;
  filterable?: boolean;
  tableContainerClassName?: string;
  sortScope?: string;
  defaultSort?: TableSort;
  sorting?: boolean;
}) {
  const [filter, setFilter] = React.useState("")
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(readTablePageSize)
  const storageKey = sortScope ? `purchase-sale-table-sort:${sortScope}` : null
  const [sort, setSort] = React.useState<TableSort | null>(() => {
    if (!sorting) return null
    if (!storageKey) return defaultSort ?? null
    try {
      const saved = window.sessionStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved) as TableSort
    } catch {}
    return defaultSort ?? null
  })
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
  const rowKey = (row: React.ReactNode) => {
    if (React.isValidElement(row) && row.key != null) return String(row.key)
    return rowText(row)
  }
  const findHeaders = (): Array<{ key: string; index: number; sortable: boolean }> => {
    const headers: Array<{ key: string; index: number; sortable: boolean }> = []
    const visit = (node: React.ReactNode) => {
      React.Children.forEach(node, (child) => {
        if (!React.isValidElement<Record<string, unknown>>(child)) return
        if (child.type === TableHeader) {
          React.Children.forEach(child.props.children, (headerRow) => {
            if (!React.isValidElement<Record<string, unknown>>(headerRow)) return
            let index = 0
            React.Children.forEach(headerRow.props.children, (head) => {
              if (React.isValidElement<Record<string, unknown>>(head) && head.type === TableHead) {
                const key = rowText(head.props.children as React.ReactNode).trim()
                headers.push({
                  key,
                  index,
                  sortable: sorting && head.props.sortable !== false && !/^actions?$|^controls?$|^movement$/i.test(key),
                })
              }
              index++
            })
          })
        }
        visit(child.props.children as React.ReactNode)
      })
    }
    visit(children)
    return headers
  }
  const sortableHeaders = React.useMemo(findHeaders, [children])
  React.useEffect(() => {
    if (sort || !sortableHeaders.length) return
    const dateHeader = sortableHeaders.find(({ key, sortable }) => sortable && /date|issued|created/i.test(key))
    if (dateHeader) setSort({ key: dateHeader.key, direction: "desc" })
  }, [sortableHeaders, sort])
  const [rowOrder, setRowOrder] = React.useState<string[]>([])
  React.useEffect(() => {
    const nextKeys = dataRows.map(rowKey)
    setRowOrder((previous) => {
      const previousSet = new Set(previous)
      const existing = previous.filter((key) => nextKeys.includes(key))
      const added = nextKeys.filter((key) => !previousSet.has(key))
      return [...added, ...existing]
    })
  }, [dataRows])
  const orderedRows = React.useMemo(() => {
    const byKey = new Map(dataRows.map((row) => [rowKey(row), row]))
    const ordered = rowOrder.map((key) => byKey.get(key)).filter((row) => row !== undefined) as React.ReactNode[]
    for (const row of dataRows) if (!ordered.includes(row)) ordered.push(row)
    return ordered
  }, [dataRows, rowOrder])
  const compareCell = (a: React.ReactNode, b: React.ReactNode, direction: "asc" | "desc") => {
    const av = rowText(a).trim()
    const bv = rowText(b).trim()
    const numericValue = (value: string) => {
      const cleaned = value.replace(/[,\s_%]/g, "").replace(/[^0-9.-]/g, "")
      return cleaned && Number.isFinite(Number(cleaned)) ? Number(cleaned) : null
    }
    const an = numericValue(av)
    const bn = numericValue(bv)
    let result = 0
    if (an !== null && bn !== null) result = an - bn
    else {
      const dateValue = (value: string) => /^\d{4}-\d{2}-\d{2}/.test(value) ? Date.parse(value) : Number.NaN
      const ad = dateValue(av)
      const bd = dateValue(bv)
      result = Number.isFinite(ad) && Number.isFinite(bd)
        ? ad - bd
        : av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" })
    }
    return direction === "asc" ? result : -result
  }
  const initialSortApplied = React.useRef(false)
  React.useEffect(() => {
    if (initialSortApplied.current || !sort || !sortableHeaders.length) return
    const header = sortableHeaders.find((candidate) => candidate.key === sort.key && candidate.sortable)
    if (!header) return
    initialSortApplied.current = true
    setRowOrder((previous) => {
      const byKey = new Map(dataRows.map((row) => [rowKey(row), row]))
      return [...previous].sort((ak, bk) => {
        const a = byKey.get(ak)
        const b = byKey.get(bk)
        if (!a || !b) return 0
        const acells = React.Children.toArray(React.isValidElement<{ children?: React.ReactNode }>(a) ? a.props.children as React.ReactNode : [])
        const bcells = React.Children.toArray(React.isValidElement<{ children?: React.ReactNode }>(b) ? b.props.children as React.ReactNode : [])
        return compareCell(acells[header.index], bcells[header.index], sort.direction)
      })
    })
  }, [sort, sortableHeaders])
  const onSort = (key: string) => {
    const header = sortableHeaders.find((candidate) => candidate.key === key)
    if (!header?.sortable) return
    const next: TableSort = {
      key,
      direction: sort?.key === key && sort.direction === "asc" ? "desc" : "asc",
    }
    setSort(next)
    if (storageKey) {
      try { window.sessionStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
    }
    setRowOrder((previous) => {
      const byKey = new Map(dataRows.map((row) => [rowKey(row), row]))
      return [...previous].sort((ak, bk) => {
        const a = byKey.get(ak)
        const b = byKey.get(bk)
        if (!a || !b) return 0
        const acells = React.Children.toArray(React.isValidElement<{ children?: React.ReactNode }>(a) ? a.props.children as React.ReactNode : [])
        const bcells = React.Children.toArray(React.isValidElement<{ children?: React.ReactNode }>(b) ? b.props.children as React.ReactNode : [])
        return compareCell(acells[header.index], bcells[header.index], next.direction)
      })
    })
  }
  const searchableRows = React.useMemo(() => orderedRows.map((row) => ({ row, text: rowText(row).toLowerCase() })), [orderedRows])
  const normalizedFilter = filter.trim().toLowerCase()
  const matching = React.useMemo(() => normalizedFilter
    ? searchableRows.filter(({ text }) => text.includes(normalizedFilter)).map(({ row }) => row)
    : orderedRows, [orderedRows, normalizedFilter, searchableRows])
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const visibleRows = matching.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const transformed = (node: React.ReactNode): React.ReactNode => React.Children.map(node, (child) => {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return child
    if (child.type === TableBody) return React.cloneElement(child, {}, matching.length ? visibleRows : emptyRow)
    if (child.type === TableHeader) {
      const headerRows = React.Children.map(child.props.children, (headerRow) => {
        if (!React.isValidElement<{ children?: React.ReactNode }>(headerRow) || headerRow.type !== TableRow) return headerRow
        let index = 0
        const heads = React.Children.map(headerRow.props.children, (head) => {
          if (!React.isValidElement<Record<string, unknown>>(head) || head.type !== TableHead) return head
          const key = rowText(head.props.children as React.ReactNode).trim()
          const sortable = sorting && head.props.sortable !== false && !/^actions?$|^controls?$|^movement$/i.test(key)
          const cloned = React.cloneElement(head, { _sortKey: key, _sortIndex: index, _sortable: sortable })
          index++
          return cloned
        })
        return React.cloneElement(headerRow, {}, heads)
      })
      return React.cloneElement(child, {}, headerRows)
    }
    return React.cloneElement(child, {}, transformed(child.props.children))
  })
  const from = matching.length ? currentPage * pageSize + 1 : 0
  const to = Math.min((currentPage + 1) * pageSize, matching.length)
  const content = managed ? transformed(children) : children
  return (
    <TableSortContext.Provider value={{ sort, onSort }}>
    <div className="flex w-full flex-col gap-3">
      {managed && <div className="flex flex-wrap items-center justify-between gap-2">
        {filterable ? <div className="relative min-w-48 flex-1 sm:max-w-xs"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" /><Input data-operator-search title="Focus search (Ctrl+F)" aria-label="Filter table rows" className="h-9 pl-9" placeholder="Filter these records…" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(0) }} /></div> : <span />}
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><span>{from}–{to} of {matching.length}</span><Button type="button" variant="outline" size="icon-sm" aria-label="Previous table page" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft /></Button><span className="tabular-nums">{currentPage + 1} / {pageCount}</span><Button type="button" variant="outline" size="icon-sm" aria-label="Next table page" disabled={currentPage + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}><ChevronRight /></Button></div>
      </div>}
      <div data-slot="table-container" className={cn("relative min-w-0 w-full overflow-x-auto", tableContainerClassName)}><table data-slot="table" className={cn("w-full caption-bottom text-sm", className)} {...props}>{content}</table></div>
    </div>
    </TableSortContext.Provider>
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

function TableHead({
  className,
  sortable: sortableProp,
  _sortKey,
  _sortIndex,
  _sortable,
  ...props
}: React.ComponentProps<"th"> & {
  sortable?: boolean
  _sortKey?: string
  _sortIndex?: number
  _sortable?: boolean
}) {
  const { sort, onSort } = React.useContext(TableSortContext)
  const sortable = _sortable ?? sortableProp !== false
  const sortKey = _sortKey
  const active = Boolean(sortKey && sort?.key === sortKey)
  const ariaSort = active
    ? sort?.direction === "asc" ? "ascending" as const : "descending" as const
    : "none" as const
  const content = (
    <span className="inline-flex items-center gap-1">
      {props.children}
      {sortable && sortKey && (
        <span className="inline-flex opacity-0 transition-opacity group-hover:opacity-100 aria-[sort=ascending]:opacity-100 aria-[sort=descending]:opacity-100" aria-hidden="true">
          {active
            ? sort?.direction === "asc" ? <ChevronUp /> : <ChevronDown />
            : <ChevronsUpDown />}
        </span>
      )}
    </span>
  )
  return (
    <th
      data-slot="table-head"
      aria-sort={sortKey ? ariaSort : undefined}
      className={cn(
        "group h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        sortable && sortKey && "cursor-pointer select-none",
        className
      )}
      onClick={sortable && sortKey ? () => onSort(sortKey) : undefined}
      {...props}
    >
      {sortKey ? content : props.children}
    </th>
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
