import { useEffect, useState } from "react";
import { Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DatePicker } from "@/components/forms/DatePicker";
import { FormSectionHeading } from "@/components/forms/FormSectionHeading";
import type { Account, CompanyProfile, Voucher } from "@/types";
import {
  PrintDocument,
  PrintPreviewDialog,
  requestPrint,
} from "@/features/printing/PrintDocument";
import { ConfirmActionDialog } from "@/components/feedback/ConfirmActionDialog";
import { Field, FormSelect } from "@/components/forms/Fields";
import { formatMoney as money, todayIsoDate as today } from "@/lib/formatters";

type EntryLine = { accountCode: string; debit: string; credit: string };

type EntryType = "VOUCHER" | "JOURNAL VOUCHER" | "PAYMENT";
type PaymentType = "" | "PAYMENT" | "RECEIPT";

export function VoucherEntryPage({
  type,
  accounts,
  vouchers,
  company,
  logo,
  onSave,
  onDelete,
}: {
  type: EntryType;
  accounts: Account[];
  vouchers: Voucher[];
  company: CompanyProfile | null;
  logo: string | null;
  onSave: (
    value: Voucher & { update?: boolean; __baseline?: Partial<Voucher> },
  ) => Promise<void>;
  onDelete: (number: string) => Promise<void>;
}) {
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(today());
  const [narration, setNarration] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<EntryLine[]>([
    { accountCode: "", debit: "", credit: "" },
    { accountCode: "", debit: "", credit: "" },
  ]);
  const [paymentType, setPaymentType] = useState<PaymentType>("");
  const [cashAccount, setCashAccount] = useState("");
  const [partyAccount, setPartyAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [editing, setEditing] = useState(false);
  const [baseline, setBaseline] = useState<Voucher | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printVoucher, setPrintVoucher] = useState<Voucher | null>(null);
  const [deleteVoucher, setDeleteVoucher] = useState<Voucher | null>(null);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const visible = vouchers.filter((voucher) =>
    type === "PAYMENT"
      ? ["PAYMENT", "RECEIPT"].includes(voucher.type)
      : voucher.type === type,
  );
  const clear = async () => {
    setEditing(false);
    setBaseline(null);
    setNumber("");
    setDate(today());
    setNarration("");
    setReference("");
    setLines([
      { accountCode: "", debit: "", credit: "" },
      { accountCode: "", debit: "", credit: "" },
    ]);
    setPaymentType("");
    setCashAccount("");
    setPartyAccount("");
    setAmount("");
    try {
      setNumber(await window.office.ids.next("voucher"));
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not generate voucher number",
      );
      return false;
    }
  };
  useEffect(() => {
    void clear();
  }, [type]);
  const edit = (voucher: Voucher) => {
    setEditorOpen(true);
    setEditing(true);
    setBaseline(voucher);
    setNumber(voucher.number);
    setDate(voucher.date);
    setNarration(voucher.narration);
    setReference(voucher.reference);
    setLines(
      voucher.lines.map((line) => ({
        accountCode: line.accountCode,
        debit: String(line.debit),
        credit: String(line.credit),
      })),
    );
    if (voucher.type === "PAYMENT" || voucher.type === "RECEIPT") {
      setPaymentType(voucher.type);
      const cash = voucher.lines.find((line) =>
        voucher.type === "PAYMENT" ? line.credit > 0 : line.debit > 0,
      );
      const other = voucher.lines.find(
        (line) => line.accountCode !== cash?.accountCode,
      );
      setCashAccount(cash?.accountCode ?? "");
      setPartyAccount(other?.accountCode ?? "");
      setAmount(
        String(
          Math.max(...voucher.lines.map((line) => line.debit + line.credit)),
        ),
      );
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (type === "PAYMENT" && !paymentType) {
      toast.error("Choose payment or receipt");
      return;
    }
    setSaving(true);
    try {
      let voucherLines = lines.map((line) => ({
        accountCode: line.accountCode,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
      }));
      const savedType: Voucher["type"] =
        type === "PAYMENT" ? (paymentType as "PAYMENT" | "RECEIPT") : type;
      if (type === "PAYMENT") {
        const value = Number(amount);
        if (!partyAccount || !cashAccount || partyAccount === cashAccount)
          throw new Error("Choose two different party and cash/bank accounts");
        voucherLines =
          paymentType === "PAYMENT"
            ? [
                { accountCode: partyAccount, debit: value, credit: 0 },
                { accountCode: cashAccount, debit: 0, credit: value },
              ]
            : [
                { accountCode: cashAccount, debit: value, credit: 0 },
                { accountCode: partyAccount, debit: 0, credit: value },
              ];
      }
      await onSave({
        number,
        date,
        narration,
        reference,
        type: savedType,
        lines: voucherLines,
        update: editing,
        ...(editing && baseline ? { __baseline: baseline } : {}),
      });
      await clear();
      setEditorOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save voucher",
      );
    } finally {
      setSaving(false);
    }
  };
  const debitTotal = lines.reduce(
    (total, line) => total + Number(line.debit || 0),
    0,
  );
  const creditTotal = lines.reduce(
    (total, line) => total + Number(line.credit || 0),
    0,
  );
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {type === "PAYMENT"
              ? "Payment / Receipt"
              : type === "VOUCHER"
                ? "Voucher"
                : "Journal Voucher"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Post balanced double-entry transactions. Saved records are audited
            and can be edited or deleted.
          </p>
        </div>
        <Button
          onClick={() => {
            void clear().then((reserved) => {
              if (reserved) setEditorOpen(true);
            });
          }}
        >
          <Plus data-icon="inline-start" />
          New {type === "PAYMENT" ? "entry" : "voucher"}
        </Button>
      </div>
      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent
          side="right"
          className="flex data-[side=right]:w-[min(96vw,54rem)] flex-col gap-0 overflow-y-auto p-0 data-[side=right]:sm:max-w-none"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>
              {editing
                ? `Edit ${number}`
                : `New ${type === "PAYMENT" ? (paymentType ? paymentType.toLowerCase() : "payment / receipt entry") : type.toLowerCase()}`}
            </SheetTitle>
            <SheetDescription>
              Every posting must have equal debit and credit totals. Posting
              does not automatically account for purchase or sale challans.
            </SheetDescription>
          </SheetHeader>
          <Card className="m-4 border-0 shadow-none">
            <CardContent className="pt-5">
              <form
                onSubmit={(event) => void submit(event)}
                className="flex flex-col gap-4"
              >
                <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <FormSectionHeading title="Entry details" />
                  <Field label="Voucher number" id="voucher-number">
                    <Input id="voucher-number" value={number} disabled />
                  </Field>
                  <Field label="Date" id="voucher-date" required>
                    <DatePicker
                      id="voucher-date"
                      value={date}
                      onChange={setDate}
                    />
                  </Field>
                  {type === "PAYMENT" && (
                    <Field label="Entry type" id="payment-type" required>
                      <FormSelect
                        id="payment-type"
                        value={paymentType}
                        onChange={(value) =>
                          setPaymentType(value as "PAYMENT" | "RECEIPT")
                        }
                        options={[
                          { value: "PAYMENT", label: "Payment" },
                          { value: "RECEIPT", label: "Receipt" },
                        ]}
                        placeholder="Choose type"
                        disabled={editing}
                      />
                    </Field>
                  )}
                  <Field label="Reference" id="voucher-reference">
                    <Input
                      id="voucher-reference"
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                    />
                  </Field>
                  <Field label="Narration" id="voucher-narration">
                    <Input
                      id="voucher-narration"
                      value={narration}
                      onChange={(event) => setNarration(event.target.value)}
                    />
                  </Field>
                </FieldGroup>
                {type === "PAYMENT" ? (
                  <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <FormSectionHeading title="Accounts and amount" />
                    <Field
                      label="Cash / Bank account"
                      id="payment-cash"
                      required
                    >
                      <FormSelect
                        id="payment-cash"
                        value={cashAccount}
                        onChange={setCashAccount}
                        options={accounts.map((account) => ({
                          value: account.code,
                          label: `${account.description} — ${account.code}`,
                        }))}
                        placeholder="Select account"
                        emptyHint="Add an account in Chart of Accounts, then return here."
                      />
                    </Field>
                    <Field label="Party account" id="payment-party" required>
                      <FormSelect
                        id="payment-party"
                        value={partyAccount}
                        onChange={setPartyAccount}
                        options={accounts.map((account) => ({
                          value: account.code,
                          label: `${account.description} — ${account.code}`,
                        }))}
                        placeholder="Select account"
                        emptyHint="Add a party account in Chart of Accounts, then return here."
                      />
                    </Field>
                    <Field label="Amount" id="payment-amount">
                      <Input
                        id="payment-amount"
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                      />
                    </Field>
                  </FieldGroup>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <FormSectionHeading
                        title="Voucher lines"
                        description="Choose accounts and enter balanced debit and credit amounts."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setLines((current) => [
                            ...current,
                            { accountCode: "", debit: "", credit: "" },
                          ])
                        }
                      >
                        <Plus data-icon="inline-start" />
                        Add line
                      </Button>
                    </div>
                    <div className="overflow-x-auto rounded-md border">
                      <Table managed={false}>
                        <TableHeader>
                          <TableRow>
                            <TableHead>
                              Account{" "}
                              <span
                                aria-hidden="true"
                                className="text-destructive"
                              >
                                *
                              </span>
                            </TableHead>
                            <TableHead>Debit</TableHead>
                            <TableHead>Credit</TableHead>
                            <TableHead />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((line, index) => (
                            <TableRow key={index}>
                              <TableCell className="min-w-56 align-top">
                                <FormSelect
                                  value={line.accountCode}
                                  onChange={(accountCode) =>
                                    setLines((current) =>
                                      current.map((entry, row) =>
                                        row === index
                                          ? { ...entry, accountCode }
                                          : entry,
                                      ),
                                    )
                                  }
                                  options={accounts.map((account) => ({
                                    value: account.code,
                                    label: `${account.description} — ${account.code}`,
                                  }))}
                                  placeholder="Select account"
                                  emptyHint="Add accounts in Chart of Accounts, then return here."
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Input
                                  aria-label={`Debit line ${index + 1}`}
                                  className="min-w-28"
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={line.debit}
                                  onChange={(event) =>
                                    setLines((current) =>
                                      current.map((entry, row) =>
                                        row === index
                                          ? {
                                              ...entry,
                                              debit: event.target.value,
                                              credit: event.target.value
                                                ? ""
                                                : entry.credit,
                                            }
                                          : entry,
                                      ),
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Input
                                  aria-label={`Credit line ${index + 1}`}
                                  className="min-w-28"
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={line.credit}
                                  onChange={(event) =>
                                    setLines((current) =>
                                      current.map((entry, row) =>
                                        row === index
                                          ? {
                                              ...entry,
                                              credit: event.target.value,
                                              debit: event.target.value
                                                ? ""
                                                : entry.debit,
                                            }
                                          : entry,
                                      ),
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="align-top">
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="ghost"
                                  aria-label="Remove line"
                                  disabled={lines.length <= 2}
                                  onClick={() =>
                                    setLines((current) =>
                                      current.filter((_, row) => row !== index),
                                    )
                                  }
                                >
                                  <Trash2 />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex justify-end gap-6 text-sm">
                      <span>
                        Debit <strong>{money(debitTotal)}</strong>
                      </span>
                      <span>
                        Credit <strong>{money(creditTotal)}</strong>
                      </span>
                      <Badge
                        variant={
                          Math.abs(debitTotal - creditTotal) < 1e-8 &&
                          debitTotal > 0
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {Math.abs(debitTotal - creditTotal) < 1e-8 &&
                        debitTotal > 0
                          ? "Balanced"
                          : "Unbalanced"}
                      </Badge>
                    </div>
                  </div>
                )}
                <SheetFooter className="flex-row justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void clear()}
                  >
                    Clear form
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      saving ||
                      accounts.length < 2 ||
                      (type === "PAYMENT" && !paymentType)
                    }
                  >
                    {saving
                      ? "Saving…"
                      : editing
                        ? "Update voucher"
                        : "Post voucher"}
                  </Button>
                </SheetFooter>
              </form>
            </CardContent>
          </Card>
        </SheetContent>
      </Sheet>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saved entries</CardTitle>
          <CardDescription>
            {visible.length} {visible.length === 1 ? "entry" : "entries"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Narration</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((voucher) => {
                  const total = voucher.lines.reduce(
                    (sum, line) => sum + line.debit,
                    0,
                  );
                  return (
                    <TableRow key={voucher.number}>
                      <TableCell>{voucher.date}</TableCell>
                      <TableCell className="font-medium">
                        {voucher.number}
                      </TableCell>
                      <TableCell>{voucher.type}</TableCell>
                      <TableCell>{voucher.narration || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(total)}
                      </TableCell>
                      <TableCell className="min-w-32">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Print voucher"
                            aria-label="Print voucher"
                            onClick={() => {
                              setPrintVoucher(voucher);
                              setPrintPreviewOpen(true);
                            }}
                          >
                            <Printer />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Edit voucher"
                            aria-label="Edit voucher"
                            onClick={() => edit(voucher)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            title="Delete voucher"
                            aria-label="Delete voucher"
                            onClick={() => setDeleteVoucher(voucher)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!visible.length && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No entries have been posted.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <ConfirmActionDialog
        open={deleteVoucher !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteVoucher(null);
        }}
        title={`Delete voucher ${deleteVoucher?.number ?? ""}?`}
        description="This permanently removes the voucher from the saved entries."
        confirmLabel="Delete voucher"
        onConfirm={() => {
          const target = deleteVoucher;
          setDeleteVoucher(null);
          if (target)
            void onDelete(target.number).catch((error) =>
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not delete voucher",
              ),
            );
        }}
      />
      {printVoucher && (
        <>
          <PrintDocument
            company={company}
            logo={logo}
            title={printVoucher.type}
            subtitle={`Voucher ${printVoucher.number} · ${printVoucher.date}${printVoucher.reference ? ` · Reference ${printVoucher.reference}` : ""}${printVoucher.narration ? ` · ${printVoucher.narration}` : ""}`}
            columns={["Account", "Debit", "Credit"]}
            rows={printVoucher.lines.map((line) => [
              `${line.accountCode} — ${accounts.find((account) => account.code === line.accountCode)?.description ?? ""}`,
              money(line.debit),
              money(line.credit),
            ])}
            total={money(
              printVoucher.lines.reduce((sum, line) => sum + line.debit, 0),
            )}
          />
          <PrintPreviewDialog
            open={printPreviewOpen}
            onOpenChange={setPrintPreviewOpen}
            onPrint={requestPrint}
            company={company}
            logo={logo}
            title={printVoucher.type}
            subtitle={`Voucher ${printVoucher.number} · ${printVoucher.date}${printVoucher.reference ? ` · Reference ${printVoucher.reference}` : ""}${printVoucher.narration ? ` · ${printVoucher.narration}` : ""}`}
            columns={["Account", "Debit", "Credit"]}
            rows={printVoucher.lines.map((line) => [
              `${line.accountCode} — ${accounts.find((account) => account.code === line.accountCode)?.description ?? ""}`,
              money(line.debit),
              money(line.credit),
            ])}
            total={money(
              printVoucher.lines.reduce((sum, line) => sum + line.debit, 0),
            )}
          />
        </>
      )}
    </section>
  );
}
