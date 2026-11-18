import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DatePicker } from "@/components/forms/DatePicker";
import { FormSectionHeading } from "@/components/forms/FormSectionHeading";
import type {
  Account,
  Challan,
  Cheque,
  CompanyProfile,
  Item,
  StockMovement,
  Voucher,
} from "@/types";
import {
  PrintDocument,
  PrintPreviewDialog,
  requestPrint,
} from "@/features/printing/PrintDocument";
import { PageHeader } from "@/components/layout/PageHeader";
import { Field, FormSelect } from "@/components/forms/Fields";
import { formatMoney as money } from "@/lib/formatters";
import { createXlsx } from "@/lib/xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ReportRow = Record<string, string | number>;
type ReportCriteria = {
  from: string;
  to: string;
  filter: string;
  party: string;
  item: string;
  location: string;
  brand: string;
  category: string;
};

type ReportDestination = "items" | "accounts" | "banks";

const AS_OF_REPORTS = [
  "Aging Report",
];
function karachiToday() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((value) => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function partyCodesForFilter(accounts: Account[], account: Account) {
  if (/^(party|parties)$/i.test(account.description.trim())) return true;
  let parentCode = account.parentCode;
  while (parentCode) {
    const parent = accounts.find((candidate) => candidate.code === parentCode);
    if (!parent) return false;
    if (/^(party|parties)$/i.test(parent.description.trim())) return true;
    parentCode = parent.parentCode;
  }
  return account.partyType !== "";
}
const REPORT_COLUMNS: Record<string, string[]> = {
  "Stock Report": ["Date", "Document", "Item", "Location", "Quantity In", "Quantity Out", "Balance"],
  "Aging Report": ["Bill #", "Date", "Cheque ID", "Cheque #", "Cheque date", "Particulars", "Debit", "Credit", "Balance"],
  Transit: ["Date", "Document", "Item", "Location", "Quantity", "Movement"],
  "Company Profitability Report": [
    "Date",
    "Purchase",
    "Sale",
    "Sales less purchases",
  ],
  "Item Profitability Report": [
    "Item",
    "Purchase",
    "Sale",
    "Sales less purchases",
  ],
  "Trial Balance": [
    "Account",
    "Description",
    "Opening Debit",
    "Opening Credit",
    "Period Debit",
    "Period Credit",
    "Closing Debit",
    "Closing Credit",
  ],
  "General Ledger": [
    "Date",
    "Voucher",
    "Account",
    "Description",
    "Debit",
    "Credit",
    "Balance",
  ],
  "Balance Sheet": ["Account", "Description", "Type", "Amount"],
  "Profit & Loss": ["Account", "Description", "Type", "Amount"],
  "Stock Ledger": [
    "Date",
    "Document",
    "Item",
    "Location",
    "Quantity In",
    "Quantity Out",
    "Balance",
  ],
  "Stock Summary": ["Item", "Location", "Quantity on hand"],
  "Party Ledger": [
    "Date",
    "Document",
    "Description",
    "Reference / Date",
    "Debit",
    "Credit",
    "Balance",
  ],
  "Purchase Register": [
    "Date",
    "Document",
    "Party",
    "Location",
    "Lines",
    "Total",
  ],
  "Sales Register": ["Date", "Document", "Party", "Location", "Lines", "Total"],
  Receivables: ["Account", "Party", "Balance"],
  Payables: ["Account", "Party", "Balance"],
  "Cash Book": [
    "Date",
    "Voucher",
    "Account",
    "Particulars",
    "Receipt",
    "Payment",
    "Balance",
  ],
  "Bank Book": [
    "Date",
    "Voucher",
    "Account",
    "Particulars",
    "Receipt",
    "Payment",
    "Balance",
  ],
  Ledger: [
    "Date",
    "Voucher",
    "Account",
    "Description",
    "Debit",
    "Credit",
    "Balance",
  ],
  "Purchase Report Date Wise": [
    "Date",
    "Document",
    "Party",
    "Item",
    "Quantity",
    "Amount",
  ],
  "Trial Balance Date Wise": [
    "Date",
    "Voucher",
    "Account",
    "Description",
    "Debit",
    "Credit",
    "Balance",
  ],
  "Stock Report Date Wise": [
    "Date",
    "Item",
    "Location",
    "Quantity In",
    "Quantity Out",
    "Balance",
  ],
  "Stock Report Item Wise": [
    "Item",
    "Date",
    "Location",
    "Quantity In",
    "Quantity Out",
    "Balance",
  ],
  "Post Dated Cheques": ["Number", "Date", "Party", "Bank", "Amount", "Status"],
  "Returned Cheques": ["Number", "Date", "Party", "Bank", "Amount", "Status"],
  "Item Ledger": [
    "Date",
    "Document",
    "Item",
    "Location",
    "Quantity In",
    "Quantity Out",
    "Balance",
  ],
  "Party Item Detail": [
    "Party",
    "Item",
    "Date",
    "Document",
    "Quantity",
    "Rate",
    "Amount",
  ],
  "PC Profit Report": [
    "Date · Party",
    "Purchase",
    "Sale",
    "Sales less purchases",
  ],
  "OS Cheques": [
    "Number",
    "Date",
    "Party",
    "Bank",
    "Amount",
    "Status",
    "Days outstanding",
  ],
  "Party Activity Report": [
    "Date",
    "Party",
    "Activity",
    "Reference",
    "Debit",
    "Credit",
    "Balance",
  ],
};

export function ReportsPage({
  reportName,
  challans,
  items,
  accounts,
  banks,
  movements,
  cheques,
  vouchers,
  company,
  logo,
  onOpenRecord,
  canOpenItems,
  canOpenAccounts,
  canOpenBanks,
}: {
  reportName: string;
  challans: Challan[];
  items: Item[];
  accounts: Account[];
  banks: Array<{ code: string; name: string }>;
  movements: StockMovement[];
  cheques: Cheque[];
  vouchers: Voucher[];
  company: CompanyProfile | null;
  logo: string | null;
  onOpenRecord: (page: ReportDestination, code: string) => void;
  canOpenItems: boolean;
  canOpenAccounts: boolean;
  canOpenBanks: boolean;
}) {
  const [filterDialogOpen, setFilterDialogOpen] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filter, setFilter] = useState("");
  const [partyFilter, setPartyFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [appliedCriteria, setAppliedCriteria] = useState<ReportCriteria | null>(
    null,
  );
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const isAsOfReport = AS_OF_REPORTS.includes(reportName);
  const fromDate = appliedCriteria?.from ?? "";
  const toDate = isAsOfReport
    ? appliedCriteria?.to || karachiToday()
    : appliedCriteria?.to ?? "";
  const invalidDateRange = Boolean(!isAsOfReport && from && to && from > to);
  const rows = useMemo(
    () =>
      !appliedCriteria
        ? []
        : buildReport(
            reportName,
            { challans, items, accounts, banks, movements, cheques, vouchers },
            fromDate,
            toDate,
            appliedCriteria.filter,
            appliedCriteria.party,
            appliedCriteria.item,
            appliedCriteria.location,
            appliedCriteria.brand,
            appliedCriteria.category,
          ),
    [
      reportName,
      challans,
      items,
      accounts,
      banks,
      movements,
      cheques,
      vouchers,
      fromDate,
      toDate,
      appliedCriteria,
      invalidDateRange,
    ],
  );
  const columns = rows.length
    ? Object.keys(rows[0])
    : (REPORT_COLUMNS[reportName] ?? ["Result"]);
  const isNumericColumn = (column: string) =>
    rows.some((row) => typeof row[column] === "number") ||
    /amount|balance|debit|credit|quantity|rate|purchase|sale|total|receipt|payment|days outstanding|current|days|^lines$/i.test(column);
  const formatValue = (column: string, value: number) => {
    const stockBalance =
      [
        "Stock Ledger",
        "Item Ledger",
        "Stock Report Date Wise",
        "Stock Report Item Wise",
      ].includes(reportName) && column === "Balance";
    if (/quantity|\blines\b|days outstanding/i.test(column) || stockBalance)
      return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: /quantity|balance/i.test(column) ? 4 : 0,
      }).format(value);
    return money(value);
  };
  const printRows = rows.length
    ? rows.map((row) =>
        columns.map((column) => {
          const value = row[column];
          return typeof value === "number"
            ? formatValue(column, value)
            : String(value ?? "");
        }),
      )
    : [
        columns.map((_, index) =>
          index === 0 ? "No records match the selected report filters." : "",
        ),
      ];
  const selectedParty = accounts.find(
    (account) => account.code === appliedCriteria?.party,
  );
  const selectedItem = items.find(
    (item) => item.code === appliedCriteria?.item,
  );
  const selectedBrand = appliedCriteria?.brand ?? "";
  const selectedCategory = appliedCriteria?.category ?? "";
  const appliedFilters = [
    isAsOfReport
      ? `As of ${toDate}`
      : fromDate || appliedCriteria?.to
        ? `${fromDate || "Any start"} to ${appliedCriteria?.to || "Any end"}`
        : "All dates",
    appliedCriteria?.party
      ? `Party: ${selectedParty?.description ?? appliedCriteria?.party}`
      : reportName === "Party Ledger" || reportName === "Aging Report"
        ? "All parties"
        : "",
    appliedCriteria?.item
      ? `Item: ${selectedItem ? `${selectedItem.description} (${selectedItem.code})` : appliedCriteria.item}`
      : reportName === "Stock Report"
        ? "All items"
        : "",
    appliedCriteria?.location
      ? `Location: ${appliedCriteria.location}`
      : reportName === "Stock Report"
        ? "All locations"
        : "",
    reportName === "Stock Report"
      ? `Brand: ${selectedBrand || "All brands"}`
      : "",
    reportName === "Stock Report"
      ? `Category: ${selectedCategory || "All categories"}`
      : "",
    appliedCriteria?.filter.trim()
      ? `Text contains “${appliedCriteria.filter.trim()}”`
      : "",
  ].filter(Boolean);
  const visibleFilters = appliedFilters.filter(
    (value) =>
      ![
        "All dates",
        "All parties",
        "All items",
        "All locations",
        "Brand: All brands",
        "Category: All categories",
      ].includes(value),
  );
  const defaultScope = [
    isAsOfReport
      ? !appliedCriteria?.to
        ? `As of ${toDate}`
        : ""
      : !fromDate && !appliedCriteria?.to
        ? "All dates"
        : "",
    (reportName === "Party Ledger" || reportName === "Aging Report") &&
    !appliedCriteria?.party
      ? "All parties"
      : "",
    reportName === "Stock Report" && !appliedCriteria?.item
      ? "All items"
      : "",
    reportName === "Stock Report" && !appliedCriteria?.location
      ? "All locations"
      : "",
    reportName === "Stock Report" && !appliedCriteria?.brand
      ? "All brands"
      : "",
    reportName === "Stock Report" && !appliedCriteria?.category
      ? "All categories"
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const printSubtitle = [...appliedFilters, `Records: ${rows.length}`].join("  |  ");
  const caution =
    reportName === "Party Ledger"
      ? "Transactions include readable party and item details, references, and a running balance."
      : reportName === "Stock Report"
        ? "Calculates running quantity from stock movements matching the selected item, brand, category, location, and period."
        : "Shows party transactions through the selected date. Payments are not allocated to individual bills.";
  const exportCsv = () => {
    const safeCell = (value: string | number) => {
      const text = String(value);
      const safe =
        typeof value === "string" && /^[\s]*[=+@-]/.test(text)
          ? `'${text}`
          : text;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const csv = [
      columns,
      ...rows.map((row) => columns.map((column) => row[column] ?? "")),
    ]
      .map((cells) => cells.map(safeCell).join(","))
      .join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
    );
    link.download = `${reportName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };
  const exportExcel = () => {
    const blob = createXlsx(reportName, printSubtitle, columns, rows);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.xlsx`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportPdf = async () => {
    if (typeof window.office?.reports?.exportPdf !== "function") {
      toast.info("PDF export is unavailable in this app session. Use Print preview, then choose Save as PDF.");
      setPrintPreviewOpen(true);
      return;
    }
    setPdfExporting(true);
    document.body.classList.add("printing-document");
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const result = await window.office.reports.exportPdf(`${reportName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}${columns.length > 5 ? "-landscape" : ""}`, columns.length > 5);
      if (!result.canceled && result.path) toast.success(`PDF saved · ${result.path}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export report as PDF");
    } finally {
      document.body.classList.remove("printing-document");
      setPdfExporting(false);
    }
  };
  const restoreDraftFilters = (criteria: ReportCriteria | null = appliedCriteria) => {
    setFrom(criteria?.from ?? "");
    setTo(criteria?.to ?? "");
    setFilter(criteria?.filter ?? "");
    setPartyFilter(criteria?.party ?? "");
    setItemFilter(criteria?.item ?? "");
    setLocationFilter(criteria?.location ?? "");
    setBrandFilter(criteria?.brand ?? "");
    setCategoryFilter(criteria?.category ?? "");
  };
  const openFilters = () => {
    restoreDraftFilters();
    setFilterDialogOpen(true);
  };
  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        title={reportName || "Reports"}
        description="Set report filters to preview the data, then refine or export results."
      />
      <Dialog
        open={filterDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setFilterDialogOpen(true);
          } else if (appliedCriteria) {
            restoreDraftFilters();
            setFilterDialogOpen(false);
          }
        }}
      >
        <DialogContent
          className="w-[min(94vw,36rem)] max-w-none sm:max-w-none"
          showCloseButton={Boolean(appliedCriteria)}
        >
          <DialogHeader>
            <DialogTitle>Filter {reportName}</DialogTitle>
            <DialogDescription>
              Choose criteria for this report. Your results appear after you apply them.
            </DialogDescription>
          </DialogHeader>
          <FormSectionHeading
            title={reportName === "Stock Report" ? "Stock criteria" : "Report criteria"}
            className="w-full"
          />
          <FieldGroup className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto py-1 sm:grid-cols-2">
            {reportName === "Party Ledger" || reportName === "Aging Report" ? (
              <Field label="Party" id="dialog-report-party">
                <FormSelect
                  id="dialog-report-party"
                  value={partyFilter}
                  onChange={setPartyFilter}
                  options={[
                    { value: "", label: "All parties" },
                    ...accounts
                      .filter((account) =>
                        partyCodesForFilter(accounts, account) ||
                        challans.some((challan) => challan.party === account.code),
                      )
                      .map((account) => ({
                        value: account.code,
                        label: `${account.description} — ${account.code}`,
                      })),
                  ]}
                  placeholder="All parties"
                  clearable
                  searchable
                />
              </Field>
            ) : null}
            {reportName === "Stock Report" ? (
              <>
                <Field label="Item" id="dialog-report-item">
                  <FormSelect
                    id="dialog-report-item"
                    value={itemFilter}
                    onChange={setItemFilter}
                    options={[
                      { value: "", label: "All items" },
                      ...items.map((item) => ({
                        value: item.code,
                        label: `${item.code} — ${item.description}`,
                      })),
                    ]}
                    placeholder="All items"
                    clearable
                    searchable
                  />
                </Field>
                <Field label="Location" id="dialog-report-location">
                  <FormSelect
                    id="dialog-report-location"
                    value={locationFilter}
                    onChange={setLocationFilter}
                    options={[
                      { value: "", label: "All locations" },
                      ...[...new Set(movements.map((movement) => movement.location))]
                        .sort((a, b) => a.localeCompare(b))
                        .map((location) => ({ value: location, label: location })),
                    ]}
                    placeholder="All locations"
                    clearable
                    searchable
                  />
                </Field>
                <Field label="Brand" id="dialog-report-brand">
                  <FormSelect
                    id="dialog-report-brand"
                    value={brandFilter}
                    onChange={setBrandFilter}
                    options={[
                      { value: "", label: "All brands" },
                      ...[
                        ...new Set(
                          [
                            ...items.map((item) => item.brand?.trim() ?? ""),
                            ...challans.flatMap((challan) =>
                              challan.lines.map((line) => line.brand.trim()),
                            ),
                          ].filter(Boolean),
                        ),
                      ]
                        .sort((a, b) => a.localeCompare(b))
                        .map((brand) => ({ value: brand, label: brand })),
                    ]}
                    placeholder="All brands"
                    clearable
                    searchable
                  />
                </Field>
                <Field label="Category" id="dialog-report-category">
                  <FormSelect
                    id="dialog-report-category"
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    options={[
                      { value: "", label: "All categories" },
                      ...[
                        ...new Set(
                          [
                            ...items.map((item) => item.category?.trim() ?? ""),
                            ...challans.flatMap((challan) =>
                              challan.lines.map((line) => line.category.trim()),
                            ),
                          ].filter(Boolean),
                        ),
                      ]
                        .sort((a, b) => a.localeCompare(b))
                        .map((category) => ({
                          value: category,
                          label: category,
                        })),
                    ]}
                    placeholder="All categories"
                    clearable
                    searchable
                  />
                </Field>
              </>
            ) : null}
            {!isAsOfReport ? (
              <Field label="From date" id="dialog-report-from">
                <DatePicker id="dialog-report-from" value={from} onChange={setFrom} placeholder="Start date" />
              </Field>
            ) : null}
            <Field label={isAsOfReport ? "As of date" : "To date"} id="dialog-report-to">
              <DatePicker
                id="dialog-report-to"
                value={to}
                onChange={setTo}
                placeholder={isAsOfReport ? "Defaults to today" : "End date"}
              />
            </Field>
            {invalidDateRange ? (
              <p className="text-sm text-destructive sm:col-span-2">
                Start date must be on or before the end date.
              </p>
            ) : null}
          </FieldGroup>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPartyFilter("");
                setItemFilter("");
                setLocationFilter("");
                setBrandFilter("");
                setCategoryFilter("");
                setFrom("");
                setTo("");
                setFilter("");
              }}
            >
              Clear filters
            </Button>
            <Button
              disabled={invalidDateRange}
              onClick={() => {
                setAppliedCriteria({
                  from: isAsOfReport ? "" : from,
                  to,
                  filter,
                  party: partyFilter,
                  item: itemFilter,
                  location: locationFilter,
                  brand: brandFilter,
                  category: categoryFilter,
                });
                setFilterDialogOpen(false);
              }}
            >
              Apply filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {appliedCriteria ? (
        <div className="flex flex-col gap-4">
        <Card className="min-w-0">
          <CardHeader className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">
                {rows.length} result{rows.length === 1 ? "" : "s"}
              </CardTitle>
              <CardDescription className="mt-1">{caution}</CardDescription>
              <div
                className="mt-2 flex flex-wrap items-center gap-1.5"
                aria-label="Applied report filters"
              >
                {defaultScope && (
                  <span className="text-xs text-muted-foreground">
                    {defaultScope}
                  </span>
                )}
                {visibleFilters.length ? (
                  <>
                    <span className="ml-1 text-xs text-muted-foreground">
                      Filters applied
                    </span>
                    {visibleFilters.map((appliedFilter) => (
                      <Badge key={appliedFilter} variant="secondary">
                        {appliedFilter}
                      </Badge>
                    ))}
                  </>
                ) : null}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-fit shrink-0 self-start"
              onClick={openFilters}
            >
              <SlidersHorizontal data-icon="inline-start" />
              Edit filters
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-4 pb-4 pt-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <Field label="Search results" id="report-preview-filter" className="w-full lg:max-w-sm lg:flex-1">
                  <Input
                    id="report-preview-filter"
                    value={filter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFilter(value);
                      setAppliedCriteria((current) =>
                        current ? { ...current, filter: value } : current,
                      );
                    }}
                    placeholder="Search names or document numbers"
                  />
                </Field>
                <div
                  className="flex flex-wrap items-center gap-2"
                  role="group"
                  aria-label="Export and print report"
                >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!appliedCriteria}
                  onClick={exportCsv}
                >
                  <Download data-icon="inline-start" />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!appliedCriteria}
                  onClick={exportExcel}
                >
                  <FileSpreadsheet data-icon="inline-start" />
                  Export Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!appliedCriteria || pdfExporting}
                  onClick={() => void exportPdf()}
                >
                  <FileText data-icon="inline-start" />
                  {pdfExporting ? "Preparing PDF…" : "Export PDF"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!appliedCriteria}
                  onClick={() => setPrintPreviewOpen(true)}
                >
                  <Printer data-icon="inline-start" />
                  Print
                </Button>
                </div>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-3xl" filterable={false}>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead className={`px-4 py-3 ${isNumericColumn(column) ? "text-right" : ""}`} key={column}>
                        {column}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={index}>
                      {columns.map((column) => {
                        const value = row[column];
                        const reference =
                          typeof value === "string" && column === "Item"
                            ? (() => {
                                const record = items.find(
                                  (item) =>
                                    value === item.code ||
                                    value.endsWith(`(${item.code})`),
                                );
                                return record
                                  ? {
                                      code: record.code,
                                      description: `${record.description} · ${record.unit}`,
                                      destination: "items" as const,
                                      enabled: canOpenItems,
                                    }
                                  : null;
                              })()
                            : typeof value === "string" && column === "Account"
                              ? (() => {
                                  const record = accounts.find(
                                    (account) => account.code === value,
                                  );
                                  return record
                                    ? {
                                        code: record.code,
                                        description: record.description,
                                        destination: "accounts" as const,
                                        enabled: canOpenAccounts,
                                      }
                                    : null;
                                })()
                              : typeof value === "string" && column === "Bank"
                                ? (() => {
                                    const record = banks.find(
                                      (bank) => bank.code === value,
                                    );
                                    return record
                                      ? {
                                          code: record.code,
                                          description: record.name,
                                          destination: "banks" as const,
                                          enabled: canOpenBanks,
                                        }
                                      : null;
                                  })()
                                : null;
                        return (
                          <TableCell
                            className={`px-4 py-3 align-top ${isNumericColumn(column) ? "text-right tabular-nums" : ""}`}
                            key={column}
                          >
                            {reference ? (
                              <div className="flex min-w-32 flex-col items-start gap-0.5">
                                {reference.enabled ? (
                                  <Button
                                    variant="link"
                                    className="h-auto p-0 text-left font-medium"
                                    onClick={() =>
                                      onOpenRecord(
                                        reference.destination,
                                        reference.code,
                                      )
                                    }
                                  >
                                    {reference.description}
                                  </Button>
                                ) : (
                                  <span className="font-medium">{reference.description}</span>
                                )}
                                <span className="text-xs leading-relaxed text-muted-foreground">
                                  Code: {reference.code}
                                </span>
                              </div>
                            ) : typeof value === "number" ? (
                              <span className="tabular-nums">
                                {formatValue(column, value)}
                              </span>
                            ) : (
                              value
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  {!rows.length && (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-20 text-center text-muted-foreground"
                      >
                        No records match this report and filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </div>
      ) : null}
      <PrintDocument
        company={company}
        logo={logo}
        title={reportName}
        subtitle={printSubtitle}
        columns={columns}
        rows={printRows}
        numericColumns={columns.filter(isNumericColumn)}
      />
      <PrintPreviewDialog
        open={printPreviewOpen}
        onOpenChange={setPrintPreviewOpen}
        onPrint={requestPrint}
        company={company}
        logo={logo}
        title={reportName}
        subtitle={printSubtitle}
        columns={columns}
        rows={printRows}
        numericColumns={columns.filter(isNumericColumn)}
      />
    </section>
  );
}

function buildReport(
  name: string,
  data: {
    challans: Challan[];
    items: Item[];
    accounts: Account[];
    banks: Array<{ code: string; name: string }>;
    movements: StockMovement[];
    cheques: Cheque[];
    vouchers: Voucher[];
  },
  from: string,
  to: string,
  filter: string,
  partyFilter = "",
  itemFilter = "",
  locationFilter = "",
  brandFilter = "",
  categoryFilter = "",
): ReportRow[] {
  const { challans, items, accounts, banks, movements, cheques, vouchers } =
    data;
  const dated = (date: string) =>
    (!from || date >= from) && (!to || date <= to);
  const beforeFrom = (date: string) => Boolean(from) && date < from;
  const throughTo = (date: string) => !to || date <= to;
  const filterTerm = filter.trim().toLocaleLowerCase();
  const has = (value: unknown) =>
    String(value ?? "")
      .toLocaleLowerCase()
      .includes(filterTerm);
  const accountDescription = (code: string) =>
    accounts.find((account) => account.code === code)?.description ??
    code.replace(/^Party: /, "");
  const docs = challans.filter(
    (row) =>
      dated(row.date) &&
      has(
        `${row.number} ${row.party} ${accountDescription(row.party)} ${row.location} ${row.lines.map((line) => `${line.itemCode} ${line.itemLabel ?? ""} ${items.find((item) => item.code === line.itemCode)?.description ?? ""}`).join(" ")}`,
      ),
  );
  const allMoves = movements;
  const allVoucherLines = vouchers.flatMap((voucher) =>
    voucher.lines.map((line) => ({
      date: voucher.date,
      voucher: voucher.number,
      reference: voucher.reference,
      narration: voucher.narration,
      type: voucher.type,
      ...line,
    })),
  );
  const clearedChequeLines = cheques
    .filter(
      (cheque) =>
        cheque.status === "CLEARED" &&
        ["PAYMENT", "RECEIPT"].includes(cheque.direction) &&
        cheque.clearedDate &&
        cheque.bankAccountCode &&
        accounts.some((account) => account.code === cheque.party) &&
        accounts.some((account) => account.code === cheque.bankAccountCode),
    )
    .flatMap((cheque) => {
      const common = {
        date: cheque.clearedDate,
        voucher: cheque.number,
        reference: cheque.checkNumber,
        narration: `${cheque.direction === "PAYMENT" ? "Cheque payment to" : "Cheque receipt from"} ${accountDescription(cheque.party)}`,
        type: `CHEQUE ${cheque.direction}`,
      };
      return cheque.direction === "PAYMENT"
        ? [
            {
              ...common,
              accountCode: cheque.party,
              debit: cheque.amount,
              credit: 0,
            },
            {
              ...common,
              accountCode: cheque.bankAccountCode,
              debit: 0,
              credit: cheque.amount,
            },
          ]
        : [
            {
              ...common,
              accountCode: cheque.bankAccountCode,
              debit: cheque.amount,
              credit: 0,
            },
            {
              ...common,
              accountCode: cheque.party,
              debit: 0,
              credit: cheque.amount,
            },
          ];
    });
  const purchaseAccount =
    accounts.find((account) => /purchases?/i.test(account.description))?.code ??
    "Purchases";
  const salesAccount =
    accounts.find((account) =>
      /sales? revenue|\bsales?\b/i.test(account.description),
    )?.code ?? "Sales Revenue";
  const challanLines = challans.flatMap((challan) => {
    const partyAccount = accounts.some(
      (account) => account.code === challan.party,
    )
      ? challan.party
      : `Party: ${challan.party}`;
    const total = challan.total;
    const common = {
      date: challan.date,
      voucher: challan.number,
      reference: challan.number,
      narration: `${challan.type === "PURCHASE" ? "Purchase from" : "Sale to"} ${challan.party}`,
      type: challan.type,
    };
    return challan.type === "PURCHASE"
      ? [
          { ...common, accountCode: purchaseAccount, debit: total, credit: 0 },
          { ...common, accountCode: partyAccount, debit: 0, credit: total },
        ]
      : [
          { ...common, accountCode: partyAccount, debit: total, credit: 0 },
          { ...common, accountCode: salesAccount, debit: 0, credit: total },
        ];
  });
  const financialLines = [
    ...allVoucherLines,
    ...challanLines,
    ...clearedChequeLines,
  ];
  const periodLines = financialLines.filter((line) => dated(line.date));
  const accountType = (code: string) => {
    let account = accounts.find((candidate) => candidate.code === code);
    while (account) {
      if (account.accountType !== "UNCLASSIFIED") return account.accountType;
      account = account.parentCode
        ? accounts.find((candidate) => candidate.code === account?.parentCode)
        : undefined;
    }
    return "UNCLASSIFIED";
  };
  const accountCodes = new Set([
    ...accounts.map((account) => account.code),
    ...financialLines.map((line) => line.accountCode),
  ]);
  const partyCodes = new Set(
    accounts
      .filter((account) =>
        /^(parties|party)$/i.test(account.description.trim()),
      )
      .map((account) => account.code),
  );
  let addedPartyChild = true;
  while (addedPartyChild) {
    addedPartyChild = false;
    for (const account of accounts) {
      if (
        account.parentCode &&
        partyCodes.has(account.parentCode) &&
        !partyCodes.has(account.code)
      ) {
        partyCodes.add(account.code);
        addedPartyChild = true;
      }
    }
  }
  for (const document of challans) {
    if (!/cash|bank/i.test(accountDescription(document.party))) {
      partyCodes.add(
        accounts.some((account) => account.code === document.party)
          ? document.party
          : `Party: ${document.party}`,
      );
    }
  }
  const selectedPartyCodes = new Set<string>();
  if (partyFilter) {
    selectedPartyCodes.add(partyFilter);
    let addedPartyDescendant = true;
    while (addedPartyDescendant) {
      addedPartyDescendant = false;
      for (const account of accounts) {
        if (
          account.parentCode &&
          selectedPartyCodes.has(account.parentCode) &&
          partyCodes.has(account.code) &&
          !selectedPartyCodes.has(account.code)
        ) {
          selectedPartyCodes.add(account.code);
          addedPartyDescendant = true;
        }
      }
    }
  }
  const openingBalance = (code: string) => {
    const account = accounts.find((candidate) => candidate.code === code);
    const initial = account
      ? account.openingBalanceSide === "CREDIT"
        ? -account.openingBalance
        : account.openingBalance
      : 0;
    return (
      initial +
      financialLines
        .filter((line) => line.accountCode === code && beforeFrom(line.date))
        .reduce((balance, line) => balance + line.debit - line.credit, 0)
    );
  };
  const closingBalance = (code: string) => {
    const account = accounts.find((candidate) => candidate.code === code);
    const initial = account
      ? account.openingBalanceSide === "CREDIT"
        ? -account.openingBalance
        : account.openingBalance
      : 0;
    return (
      initial +
      financialLines
        .filter((line) => line.accountCode === code && throughTo(line.date))
        .reduce((balance, line) => balance + line.debit - line.credit, 0)
    );
  };
  const partyStatementRows = (asOfOnly: boolean): ReportRow[] => {
    const running = new Map(
      [...partyCodes].map((code) => {
        const account = accounts.find((candidate) => candidate.code === code);
        return [
          code,
          account
            ? account.openingBalanceSide === "CREDIT"
              ? -account.openingBalance
              : account.openingBalance
            : 0,
        ] as const;
      }),
    );
    const partyLines = [...financialLines]
      .filter((line) => partyCodes.has(line.accountCode))
      .filter(
        (line) => !partyFilter || selectedPartyCodes.has(line.accountCode),
      )
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.voucher.localeCompare(b.voucher),
      );
    const rows: ReportRow[] = [];
    if (!asOfOnly && from) {
      for (const code of partyCodes) {
        if (partyFilter && !selectedPartyCodes.has(code)) continue;
        const balance = openingBalance(code);
        if (!balance || !has(`${accountDescription(code)} opening balance`)) continue;
        rows.push({
          Date: from,
          Document: "",
          Description: `${accountDescription(code)} · opening balance`,
          "Reference / Date": "",
          Debit: 0,
          Credit: 0,
          Balance: balance,
        });
      }
    }
    for (const line of partyLines) {
      const balance =
        (running.get(line.accountCode) ?? 0) + line.debit - line.credit;
      running.set(line.accountCode, balance);
      if (asOfOnly ? !throughTo(line.date) : !dated(line.date)) continue;
      const challan = challans.find(
        (record) =>
          record.number === line.voucher &&
          (record.party === line.accountCode ||
            `Party: ${record.party}` === line.accountCode),
      );
      const cheque = cheques.find(
        (record) =>
          record.number === line.voucher ||
          Boolean(record.checkNumber && record.checkNumber === line.reference),
      );
      const party = accountDescription(line.accountCode);
      const itemDetails = challan?.lines
        .map((itemLine) => {
          const item = items.find((record) => record.code === itemLine.itemCode);
          const label = item
            ? `${item.description} (${item.code})`
            : itemLine.itemLabel || itemLine.itemCode;
          return `${label} × ${itemLine.quantity}`;
        })
        .join(", ");
      const kind = challan
        ? challan.type === "PURCHASE"
          ? "Purchase bill"
          : "Sales invoice"
        : line.type.replace("JOURNAL VOUCHER", "Journal voucher");
      const particulars = [
        kind,
        party,
        challan?.description,
        itemDetails ? `Items: ${itemDetails}` : "",
        challan?.location ? `Location: ${challan.location}` : "",
        !challan && line.narration !== party ? line.narration : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const reference =
        cheque
          ? `${cheque.checkNumber} · ${cheque.date}`
          : line.reference && line.reference !== line.voucher
            ? line.reference
            : "";
      if (
        !has(
          `${line.accountCode} ${party} ${line.voucher} ${particulars} ${reference} ${cheque?.number ?? ""} ${cheque?.checkNumber ?? ""}`,
        )
      )
        continue;
      if (asOfOnly) {
        rows.push({
          "Bill #": challan?.number ?? "",
          Date: line.date,
          "Cheque ID": cheque?.number ?? "",
          "Cheque #": cheque?.checkNumber ?? "",
          "Cheque date": cheque?.date ?? "",
          Particulars: particulars,
          Debit: line.debit,
          Credit: line.credit,
          Balance: balance,
        });
      } else {
        rows.push({
          Date: line.date,
          Document: line.voucher,
          Description: particulars,
          "Reference / Date": reference,
          Debit: line.debit,
          Credit: line.credit,
          Balance: balance,
        });
      }
    }
    return rows;
  };
  const periodTotals = (code: string) =>
    periodLines
      .filter((line) => line.accountCode === code)
      .reduce(
        (total, line) => ({
          debit: total.debit + line.debit,
          credit: total.credit + line.credit,
        }),
        { debit: 0, credit: 0 },
      );
  const accountBalances = () =>
    [...accountCodes].map((code) => {
      const opening = openingBalance(code);
      const movement = periodTotals(code);
      const closing = opening + movement.debit - movement.credit;
      return {
        code,
        description: accountDescription(code),
        type: accountType(code),
        opening,
        debit: movement.debit,
        credit: movement.credit,
        closing,
      };
    });
  if (
    ["Stock Report", "Transit", "Stock Ledger", "Item Ledger", "Stock Report Date Wise", "Stock Report Item Wise"].includes(name)
  ) {
    const sorted = [...allMoves].sort((a, b) =>
      name === "Stock Report Item Wise"
        ? a.itemCode.localeCompare(b.itemCode) ||
          a.location.localeCompare(b.location) ||
          a.date.localeCompare(b.date) ||
          a.id - b.id
        : a.date.localeCompare(b.date) || a.id - b.id,
    );
    const balance = new Map<string, number>();
    return sorted.reduce<ReportRow[]>((rows, movement) => {
      if (itemFilter && movement.itemCode !== itemFilter) return rows;
      if (locationFilter && movement.location !== locationFilter) return rows;
      const sourceChallan = challans.find(
        (challan) => challan.number === movement.document,
      );
      const sourceLine = sourceChallan?.lines.find(
        (line) => line.itemCode === movement.itemCode,
      );
      const item = items.find((record) => record.code === movement.itemCode);
      const brand = sourceLine
        ? sourceLine.brand.trim()
        : item?.brand?.trim() ?? "";
      const category = sourceLine
        ? sourceLine.category.trim()
        : item?.category?.trim() ?? "";
      if (
        (brandFilter && brand !== brandFilter) ||
        (categoryFilter && category !== categoryFilter)
      )
        return rows;
      const key = `${movement.itemCode}\u0000${movement.location}`;
      const current = (balance.get(key) ?? 0) + movement.quantity;
      balance.set(key, current);
      const itemDescription = item?.description ?? "";
      const documentDescription = sourceChallan
        ? `${sourceChallan.type === "PURCHASE" ? "Purchase" : "Sale"} challan · ${sourceChallan.number} · ${accountDescription(sourceChallan.party)}`
        : `${movement.type.replaceAll("_", " ")} · ${movement.document}`;
      if (
        !dated(movement.date) ||
        !has(
          `${documentDescription} ${movement.itemCode} ${itemDescription} ${movement.location} ${movement.type}`,
        )
      )
        return rows;
      if (name === "Transit")
        rows.push({
          Date: movement.date,
          Document: documentDescription,
          Item: `${itemDescription || movement.itemCode} (${movement.itemCode})`,
          Location: movement.location,
          Quantity: movement.quantity,
          Movement: movement.type,
        });
      else if (name === "Stock Report Item Wise")
        rows.push({
          Item: `${itemDescription || movement.itemCode} (${movement.itemCode})`,
          Date: movement.date,
          Location: movement.location,
          "Quantity In": Math.max(0, movement.quantity),
          "Quantity Out": Math.max(0, -movement.quantity),
          Balance: current,
        });
      else if (name === "Stock Report Date Wise")
        rows.push({
          Date: movement.date,
          Item: `${itemDescription || movement.itemCode} (${movement.itemCode})`,
          Location: movement.location,
          "Quantity In": Math.max(0, movement.quantity),
          "Quantity Out": Math.max(0, -movement.quantity),
          Balance: current,
        });
      else
        rows.push({
          Date: movement.date,
          Document: documentDescription,
          Item: `${itemDescription || movement.itemCode} (${movement.itemCode})`,
          Location: movement.location,
          "Quantity In": Math.max(0, movement.quantity),
          "Quantity Out": Math.max(0, -movement.quantity),
          Balance: current,
        });
      return rows;
    }, []);
  }
  if (name === "Stock Summary") {
    const totals = new Map<
      string,
      { Item: string; Location: string; "Quantity on hand": number }
    >();
    allMoves
      .filter(
        (row) =>
          throughTo(row.date) &&
          has(
            `${row.itemCode} ${items.find((item) => item.code === row.itemCode)?.description} ${row.location}`,
          ),
      )
      .forEach((row) => {
        const key = `${row.itemCode}|${row.location}`;
        const total = totals.get(key) ?? {
          Item: row.itemCode,
          Location: row.location,
          "Quantity on hand": 0,
        };
        total["Quantity on hand"] += row.quantity;
        totals.set(key, total);
      });
    return [...totals.values()].filter(
      (row) => Math.abs(row["Quantity on hand"]) > 1e-9,
    );
  }
  if (
    [
      "Purchase Register",
      "Sales Register",
      "Purchase Report Date Wise",
    ].includes(name)
  ) {
    const expected = name === "Sales Register" ? "SALE" : "PURCHASE";
    return docs
      .filter((row) => row.type === expected)
      .flatMap<ReportRow>((row): ReportRow[] =>
        name === "Purchase Report Date Wise"
          ? row.lines.map(
              (line): ReportRow => ({
                Date: row.date,
                Document: row.number,
                Party: accountDescription(row.party),
                Item: line.itemCode || line.itemLabel || "",
                Quantity: line.quantity,
                Amount: line.amount,
              }),
            )
          : [
              {
                Date: row.date,
                Document: row.number,
                Party: accountDescription(row.party),
                Location: row.location,
                Lines: row.lines.length,
                Total: row.total,
              },
            ],
      );
  }
  if (["Post Dated Cheques", "Returned Cheques", "OS Cheques"].includes(name)) {
    const now = karachiToday();
    return cheques
      .filter(
        (row) =>
          dated(row.date) &&
          (name === "Returned Cheques"
            ? row.status === "RETURNED"
            : name === "Post Dated Cheques"
              ? row.status === "PENDING" && row.date > now
              : row.status === "PENDING" && row.date <= now) &&
          has(
            `${row.number} ${row.checkNumber} ${row.party} ${row.bankCode} ${banks.find((bank) => bank.code === row.bankCode)?.name} ${row.status}`,
          ),
      )
      .map((row) => ({
        Number: row.number,
        Date: row.date,
        Party: row.party,
        Bank: row.bankCode,
        Amount: row.amount,
        Status: row.status,
        ...(name === "OS Cheques"
          ? {
              "Days outstanding": Math.max(
                0,
                Math.floor(
                  (Date.parse(`${now}T00:00:00Z`) -
                    Date.parse(`${row.date}T00:00:00Z`)) /
                    86400000,
                ),
              ),
            }
          : {}),
      }));
  }
  if (
    [
      "Company Profitability Report",
      "Item Profitability Report",
      "PC Profit Report",
    ].includes(name)
  ) {
    const totals = new Map<string, { Purchase: number; Sale: number }>();
    docs.forEach((document) =>
      document.lines.forEach((line) => {
        const key =
          name === "Item Profitability Report"
            ? line.itemCode || line.itemLabel || ""
            : name === "PC Profit Report"
              ? `${document.date} · ${accountDescription(document.party)}`
              : document.date;
        const row = totals.get(key) ?? { Purchase: 0, Sale: 0 };
        row[document.type === "PURCHASE" ? "Purchase" : "Sale"] += line.amount;
        totals.set(key, row);
      }),
    );
    return [...totals].map(([group, total]) => ({
      [name === "Item Profitability Report"
        ? "Item"
        : name === "PC Profit Report"
          ? "Date · Party"
          : "Date"]: group,
      ...total,
      "Sales less purchases": total.Sale - total.Purchase,
    }));
  }
  if (name === "Cash Book" || name === "Bank Book") {
    const marker = name === "Cash Book" ? "cash" : "bank";
    const selected = [...accountCodes].filter(
      (code) =>
        accountDescription(code).toLowerCase().includes(marker) ||
        (name === "Bank Book" &&
          cheques.some(
            (cheque) =>
              cheque.status === "CLEARED" &&
              cheque.bankAccountCode === code &&
              ["PAYMENT", "RECEIPT"].includes(cheque.direction),
          )),
    );
    const balances = new Map(
      selected.map((code) => [
        code,
        (accounts.find((account) => account.code === code)
          ?.openingBalanceSide === "CREDIT"
          ? -1
          : 1) *
          (accounts.find((account) => account.code === code)?.openingBalance ??
            0),
      ]),
    );
    const sortedLines = financialLines
      .filter((line) => selected.includes(line.accountCode))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.voucher.localeCompare(b.voucher),
      );
    return sortedLines.flatMap((line) => {
      const balance =
        (balances.get(line.accountCode) ?? 0) + line.debit - line.credit;
      balances.set(line.accountCode, balance);
      return dated(line.date) &&
        has(
          `${line.voucher} ${line.accountCode} ${accountDescription(line.accountCode)} ${line.narration} ${line.reference}`,
        )
        ? [
            {
              Date: line.date,
              Voucher: line.voucher,
              Account: line.accountCode,
              Particulars: line.narration || line.reference || line.type,
              Receipt: line.debit,
              Payment: line.credit,
              Balance: balance,
            },
          ]
        : [];
    });
  }
  if (
    [
      "Trial Balance",
      "Trial Balance Date Wise",
      "General Ledger",
      "Ledger",
      "Cash Book",
      "Bank Book",
      "Balance Sheet",
      "Profit & Loss",
    ].includes(name)
  ) {
    const sorted = [...financialLines].sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.voucher.localeCompare(b.voucher) ||
        a.accountCode.localeCompare(b.accountCode),
    );
    if (
      name === "General Ledger" ||
      name === "Ledger" ||
      name === "Trial Balance Date Wise"
    ) {
      const balances = new Map(
        accounts.map((account) => [
          account.code,
          (account.openingBalanceSide === "CREDIT" ? -1 : 1) *
            account.openingBalance,
        ]),
      );
      return sorted.flatMap((line) => {
        const balance =
          (balances.get(line.accountCode) ?? 0) + line.debit - line.credit;
        balances.set(line.accountCode, balance);
        if (
          !throughTo(line.date) ||
          beforeFrom(line.date) ||
          !dated(line.date) ||
          !has(
            `${line.voucher} ${line.accountCode} ${accountDescription(line.accountCode)} ${line.narration} ${line.reference}`,
          )
        )
          return [];
        return [
          {
            Date: line.date,
            Voucher: line.voucher,
            Account: line.accountCode,
            Description: line.narration || line.reference || line.type,
            Debit: line.debit,
            Credit: line.credit,
            Balance: balance,
          },
        ];
      });
    }
    if (name === "Profit & Loss") {
      const rows = accountBalances()
        .filter(
          (row) =>
            ["INCOME", "EXPENSE"].includes(row.type) &&
            has(`${row.code} ${row.description}`),
        )
        .map((row) => {
          const periodNet = row.debit - row.credit;
          return {
            Account: row.code,
            Description: row.description,
            Type: row.type,
            Amount: row.type === "INCOME" ? -periodNet : periodNet,
          };
        });
      const income = rows
        .filter((row) => row.Type === "INCOME")
        .reduce((sum, row) => sum + row.Amount, 0);
      const expense = rows
        .filter((row) => row.Type === "EXPENSE")
        .reduce((sum, row) => sum + row.Amount, 0);
      return [
        ...rows,
        { Account: "", Description: "Total income", Type: "", Amount: income },
        {
          Account: "",
          Description: "Total expenses",
          Type: "",
          Amount: expense,
        },
        {
          Account: "",
          Description: "Net profit",
          Type: "",
          Amount: income - expense,
        },
      ];
    }
    if (name === "Balance Sheet") {
      const balances = accountBalances()
        .filter(
          (row) =>
            ["ASSET", "LIABILITY", "EQUITY"].includes(row.type) &&
            has(`${row.code} ${row.description}`),
        )
        .map((row) => ({
          Account: row.code,
          Description: row.description,
          Type: row.type,
          Amount: row.type === "ASSET" ? row.closing : -row.closing,
        }));
      const earnings = accountBalances()
        .filter((row) => ["INCOME", "EXPENSE"].includes(row.type))
        .reduce(
          (sum, row) =>
            sum + (row.type === "INCOME" ? -row.closing : row.closing),
          0,
        );
      balances.push({
        Account: "",
        Description: "Current earnings",
        Type: "EQUITY",
        Amount: earnings,
      });
      const assets = balances
        .filter((row) => row.Type === "ASSET")
        .reduce((sum, row) => sum + row.Amount, 0);
      const liabilities = balances
        .filter((row) => row.Type === "LIABILITY")
        .reduce((sum, row) => sum + row.Amount, 0);
      const equity = balances
        .filter((row) => row.Type === "EQUITY")
        .reduce((sum, row) => sum + row.Amount, 0);
      return [
        ...balances,
        { Account: "", Description: "Total assets", Type: "", Amount: assets },
        {
          Account: "",
          Description: "Total liabilities and equity",
          Type: "",
          Amount: liabilities + equity,
        },
      ];
    }
    const balances = accountBalances().filter(
      (row) =>
        has(`${row.code} ${row.description}`) &&
        (row.opening !== 0 ||
          row.debit !== 0 ||
          row.credit !== 0 ||
          row.closing !== 0),
    );
    const result = balances.map((row) => ({
      Account: row.code,
      Description: row.description,
      "Opening Debit": Math.max(0, row.opening),
      "Opening Credit": Math.max(0, -row.opening),
      "Period Debit": row.debit,
      "Period Credit": row.credit,
      "Closing Debit": Math.max(0, row.closing),
      "Closing Credit": Math.max(0, -row.closing),
    }));
    result.push({
      Account: "",
      Description: "Total",
      "Opening Debit": result.reduce(
        (sum, row) => sum + row["Opening Debit"],
        0,
      ),
      "Opening Credit": result.reduce(
        (sum, row) => sum + row["Opening Credit"],
        0,
      ),
      "Period Debit": result.reduce((sum, row) => sum + row["Period Debit"], 0),
      "Period Credit": result.reduce(
        (sum, row) => sum + row["Period Credit"],
        0,
      ),
      "Closing Debit": result.reduce(
        (sum, row) => sum + row["Closing Debit"],
        0,
      ),
      "Closing Credit": result.reduce(
        (sum, row) => sum + row["Closing Credit"],
        0,
      ),
    });
    return result;
  }
  if (
    name === "Party Activity Report" ||
    name === "Party Ledger" ||
    name === "Party Item Detail"
  ) {
    if (name === "Party Item Detail")
      return docs.flatMap((document) =>
        document.lines.map((line) => ({
          Party: accountDescription(document.party),
          Item: line.itemCode || line.itemLabel || "",
          Date: document.date,
          Document: document.number,
          Quantity: line.quantity,
          Rate: line.rate,
          Amount: line.amount,
        })),
      );
    return partyStatementRows(false);
  }
  if (name === "Aging Report") {
    return partyStatementRows(true);
  }
  if (name === "Receivables" || name === "Payables") {
    return [...partyCodes]
      .map((code) => ({
        Account: code,
        Party: accountDescription(code),
        Balance:
          name === "Receivables"
            ? Math.max(0, closingBalance(code))
            : Math.max(0, -closingBalance(code)),
      }))
      .filter((row) => row.Balance > 0 && has(`${row.Account} ${row.Party}`));
  }
  return [];
}
