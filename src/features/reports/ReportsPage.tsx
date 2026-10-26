import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { REPORT_NAMES } from "@/lib/report-names";
import { Field, FormSelect } from "@/components/forms/Fields";
import { formatMoney as money } from "@/lib/formatters";

type ReportRow = Record<string, string | number>;

type ReportDestination = "items" | "accounts" | "banks";

const AS_OF_REPORTS = [
  "Stock Summary",
  "Type Wise Item Report",
  "Balance Sheet",
  "Receivables",
  "Payables",
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
const REPORT_COLUMNS: Record<string, string[]> = {
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
    "Party",
    "Activity",
    "Reference",
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
  "Type Wise Item Report": [
    "Stock type",
    "Item",
    "Description",
    "Current quantity",
    "Purchase rate",
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
  onReportChange,
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
  onReportChange: (name: string) => void;
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [filter, setFilter] = useState("");
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const isAsOfReport = AS_OF_REPORTS.includes(reportName);
  const fromDate = AS_OF_REPORTS.includes(reportName) ? "" : from;
  const toDate = isAsOfReport ? to || karachiToday() : to;
  const invalidDateRange = Boolean(fromDate && to && fromDate > to);
  const rows = useMemo(
    () =>
      invalidDateRange
        ? []
        : buildReport(
            reportName,
            { challans, items, accounts, banks, movements, cheques, vouchers },
            fromDate,
            toDate,
            filter,
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
      filter,
      invalidDateRange,
    ],
  );
  const columns = rows.length
    ? Object.keys(rows[0])
    : (REPORT_COLUMNS[reportName] ?? ["Result"]);
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
  const printSubtitle = [
    isAsOfReport
      ? `As of: ${toDate}`
      : fromDate || to
        ? `Period: ${fromDate || "no start date"} to ${to || "no end date"}`
        : "Period: all dates",
    filter ? `Text filter: “${filter}”` : "",
    `Records: ${rows.length}`,
  ]
    .filter(Boolean)
    .join("  |  ");
  const caution = ["Balance Sheet", "Profit & Loss"].includes(reportName)
    ? "Classified using account types from the chart of accounts. Unclassified accounts are omitted. Challans create simple accrual entries; check the account setup before relying on these statements."
    : [
          "Trial Balance",
          "Trial Balance Date Wise",
          "General Ledger",
          "Ledger",
          "Party Ledger",
          "Receivables",
          "Payables",
        ].includes(reportName)
      ? "Includes simple accrual entries derived from purchase and sale challans. Payment vouchers affect balances only when posted to the same party account; payments are not allocated to individual invoices."
      : [
            "Company Profitability Report",
            "Item Profitability Report",
            "PC Profit Report",
          ].includes(reportName)
        ? "This is a simple sales-minus-purchase comparison, not cost-of-goods-sold accounting or validated gross profit."
        : reportName === "Stock Summary"
          ? "Quantity on hand is calculated from recorded stock movements through the selected date. Values are not shown because movement rates mix purchase and sale prices."
          : reportName === "Bank Book"
            ? "Includes cleared cheque entries posted to each bank’s linked ledger account, plus other entries on accounts whose descriptions contain “bank”. Bank master opening balances remain separate from chart-of-account balances."
            : "Calculated from records currently stored in this application only. It does not include external legacy transactions.";
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
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    link.download = `${reportName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };
  return (
    <section className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {reportName || "Reports"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reports from the menu bar are available from the Reports menu or
          selector.
        </p>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Report filters</CardTitle>
            <CardDescription>
              Choose a report and narrow its results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="flex flex-col gap-4">
              <FormSectionHeading
                title="Report and period"
                className="w-full"
              />
              <Field label="Report" id="report-name">
                <FormSelect
                  id="report-name"
                  value={reportName}
                  onChange={onReportChange}
                  options={REPORT_NAMES.map((name) => ({
                    value: name,
                    label: name,
                  }))}
                  placeholder="Select report"
                />
              </Field>
              {!isAsOfReport && (
                <Field label="From date" id="report-from">
                  <DatePicker
                    id="report-from"
                    value={from}
                    onChange={setFrom}
                    placeholder="Start date"
                  />
                </Field>
              )}
              <Field
                label={isAsOfReport ? "As of date" : "To date"}
                id="report-to"
              >
                <DatePicker
                  id="report-to"
                  value={to}
                  onChange={setTo}
                  placeholder={isAsOfReport ? "Defaults to today" : "End date"}
                />
              </Field>
              <FormSectionHeading
                title="Optional text filter"
                className="w-full"
              />
              <Field label="Text filter" id="report-filter">
                <Input
                  id="report-filter"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Item, account, party, document…"
                />
              </Field>
              {invalidDateRange && (
                <p className="text-sm text-destructive">
                  Start date must be on or before the end date.
                </p>
              )}
            </FieldGroup>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="outline"
                disabled={!reportName || invalidDateRange}
                onClick={exportCsv}
              >
                <Download data-icon="inline-start" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                disabled={!reportName || invalidDateRange}
                onClick={() => setPrintPreviewOpen(true)}
              >
                <Printer data-icon="inline-start" />
                Print report
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">
              {rows.length} result{rows.length === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>{caution}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table className="min-w-3xl" filterable={false}>
                <TableHeader>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHead className="px-4 py-3" key={column}>
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
                                  (item) => item.code === value,
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
                            className="px-4 py-3 align-top"
                            key={column}
                          >
                            {reference ? (
                              <div className="flex min-w-32 flex-col items-start gap-0.5">
                                {reference.enabled ? (
                                  <Button
                                    variant="link"
                                    className="h-auto p-0 font-mono font-medium"
                                    onClick={() =>
                                      onOpenRecord(
                                        reference.destination,
                                        reference.code,
                                      )
                                    }
                                  >
                                    {reference.code}
                                  </Button>
                                ) : (
                                  <span className="font-mono font-medium">
                                    {reference.code}
                                  </span>
                                )}
                                <span className="text-xs leading-relaxed text-muted-foreground">
                                  {reference.description}
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
      <PrintDocument
        company={company}
        logo={logo}
        title={reportName}
        subtitle={printSubtitle}
        columns={columns}
        rows={printRows}
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
    [
      "Transit",
      "Stock Ledger",
      "Item Ledger",
      "Stock Report Date Wise",
      "Stock Report Item Wise",
    ].includes(name)
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
      const key = `${movement.itemCode}\u0000${movement.location}`;
      const current = (balance.get(key) ?? 0) + movement.quantity;
      balance.set(key, current);
      const itemDescription =
        items.find((item) => item.code === movement.itemCode)?.description ??
        "";
      if (
        !dated(movement.date) ||
        !has(
          `${movement.document} ${movement.itemCode} ${itemDescription} ${movement.location} ${movement.type}`,
        )
      )
        return rows;
      if (name === "Transit")
        rows.push({
          Date: movement.date,
          Document: movement.document,
          Item: movement.itemCode,
          Location: movement.location,
          Quantity: movement.quantity,
          Movement: movement.type,
        });
      else if (name === "Stock Report Item Wise")
        rows.push({
          Item: movement.itemCode,
          Date: movement.date,
          Location: movement.location,
          "Quantity In": Math.max(0, movement.quantity),
          "Quantity Out": Math.max(0, -movement.quantity),
          Balance: current,
        });
      else if (name === "Stock Report Date Wise")
        rows.push({
          Date: movement.date,
          Item: movement.itemCode,
          Location: movement.location,
          "Quantity In": Math.max(0, movement.quantity),
          "Quantity Out": Math.max(0, -movement.quantity),
          Balance: current,
        });
      else
        rows.push({
          Date: movement.date,
          Document: movement.document,
          Item: movement.itemCode,
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
    const partyLines = [...financialLines]
      .filter((line) => partyCodes.has(line.accountCode))
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.voucher.localeCompare(b.voucher),
      );
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
    return partyLines.flatMap((line) => {
      const balance =
        (running.get(line.accountCode) ?? 0) + line.debit - line.credit;
      running.set(line.accountCode, balance);
      if (
        !dated(line.date) ||
        !has(
          `${line.accountCode} ${accountDescription(line.accountCode)} ${line.voucher} ${line.narration} ${line.reference}`,
        )
      )
        return [];
      return [
        {
          Date: line.date,
          Party: accountDescription(line.accountCode),
          Activity: line.type,
          Reference: line.voucher,
          Debit: line.debit,
          Credit: line.credit,
          Balance: balance,
        },
      ];
    });
  }
  if (name === "Type Wise Item Report")
    return items
      .filter((item) =>
        has(`${item.code} ${item.description} ${item.stockType}`),
      )
      .map((item) => ({
        "Stock type": item.stockType,
        Item: item.code,
        Description: item.description,
        "Current quantity": movements
          .filter(
            (movement) =>
              movement.itemCode === item.code && throughTo(movement.date),
          )
          .reduce((sum, movement) => sum + movement.quantity, 0),
        "Purchase rate": item.purchaseRate,
      }));
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
