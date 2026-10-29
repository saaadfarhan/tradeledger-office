import { useState } from "react";
import { X } from "lucide-react";
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
import type { Account, Voucher } from "@/types";
import { Field, FormSelect } from "@/components/forms/Fields";
import { formatMoney as money } from "@/lib/formatters";

export function PaymentSearchPage({
  vouchers,
  accounts,
}: {
  vouchers: Voucher[];
  accounts: Account[];
}) {
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [entryType, setEntryType] = useState<"" | "PAYMENT" | "RECEIPT">("");
  const rows = vouchers.filter(
    (voucher) =>
      (!entryType || voucher.type === entryType) &&
      (!from || voucher.date >= from) &&
      (!to || voucher.date <= to) &&
      (!account ||
        voucher.lines.some((line) => line.accountCode === account)) &&
      (!amount ||
        voucher.lines.some(
          (line) =>
            line.debit === Number(amount) || line.credit === Number(amount),
        )) &&
      `${voucher.number} ${voucher.narration} ${voucher.reference} ${voucher.lines.map((line) => line.accountCode).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const activeFilters = [query, from, to, account, amount, entryType].filter(
    Boolean,
  ).length;
  const clearFilters = () => {
    setQuery("");
    setFrom("");
    setTo("");
    setAccount("");
    setAmount("");
    setEntryType("");
  };
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Search Payment
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Narrow payments and receipts using text, date range, account, type, or
          amount.
        </p>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Filters</CardTitle>
                <CardDescription>
                  All populated filters must match.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!activeFilters}
                onClick={clearFilters}
              >
                <X data-icon="inline-start" />
                Clear{activeFilters ? ` · ${activeFilters}` : ""}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <FieldGroup className="flex flex-col gap-4">
              <FormSectionHeading title="Transaction" className="w-full" />
              <Field label="Search text" id="payment-search">
                <Input
                  id="payment-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Number, reference, narration…"
                />
              </Field>
              <Field label="Entry type" id="payment-type-filter">
                <FormSelect
                  id="payment-type-filter"
                  value={entryType}
                  onChange={(value) => setEntryType(value as typeof entryType)}
                  options={[
                    { value: "PAYMENT", label: "Payment only" },
                    { value: "RECEIPT", label: "Receipt only" },
                  ]}
                  placeholder="Any type"
                />
              </Field>
              <FormSectionHeading
                title="Date range and account"
                className="w-full"
              />
              <Field label="Exact amount" id="payment-amount-filter">
                <Input
                  id="payment-amount-filter"
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Any amount"
                />
              </Field>
              <Field label="From date" id="payment-from">
                <DatePicker
                  id="payment-from"
                  value={from}
                  onChange={setFrom}
                  placeholder="Start date"
                />
              </Field>
              <Field label="To date" id="payment-to">
                <DatePicker
                  id="payment-to"
                  value={to}
                  onChange={setTo}
                  placeholder="End date"
                />
              </Field>
              <Field label="Account" id="payment-account">
                <FormSelect
                  id="payment-account"
                  value={account}
                  onChange={setAccount}
                  options={accounts.map((row) => ({
                    value: row.code,
                    label: `${row.description} — ${row.code}`,
                  }))}
                  placeholder="Any account"
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">Matching entries</CardTitle>
            <CardDescription>
              {rows.length} result{rows.length === 1 ? "" : "s"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table filterable={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Narration</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.number}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.number}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>
                      {row.lines
                        .map(
                          (line) =>
                            accounts.find(
                              (entry) => entry.code === line.accountCode,
                            )?.description ?? line.accountCode,
                        )
                        .join(" · ")}
                    </TableCell>
                    <TableCell>{row.reference || "—"}</TableCell>
                    <TableCell>{row.narration || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(
                        row.lines.reduce((sum, line) => sum + line.debit, 0),
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No matching payments or receipts.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
