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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/forms/DatePicker";
import { FormSectionHeading } from "@/components/forms/FormSectionHeading";
import type { Account, Bank, Cheque, CompanyProfile, Voucher } from "@/types";
import {
  PrintDocument,
  PrintPreviewDialog,
  requestPrint,
} from "@/features/printing/PrintDocument";
import { ConfirmActionDialog } from "@/components/feedback/ConfirmActionDialog";
import {
  Field,
  FormSelect,
  PersistentSelectField,
} from "@/components/forms/Fields";
import { formatMoney as money, todayIsoDate as today } from "@/lib/formatters";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type EntryLine = {
  accountCode: string;
  debit: string;
  credit: string;
  paymentMethod: "" | "CASH" | "CHEQUE";
  chequeNumber: string;
};

type EntryType = "VOUCHER" | "JOURNAL VOUCHER";

export function VoucherEntryPage({
  type,
  accounts,
  banks,
  cheques,
  vouchers,
  company,
  logo,
  onSave,
  onCreateCheque,
  onDelete,
}: {
  type: EntryType;
  accounts: Account[];
  banks: Bank[];
  cheques: Cheque[];
  vouchers: Voucher[];
  company: CompanyProfile | null;
  logo: string | null;
  onSave: (
    value: Voucher & { update?: boolean; __baseline?: Partial<Voucher> },
  ) => Promise<void>;
  onCreateCheque: (value: Cheque) => Promise<Cheque>;
  onDelete: (number: string) => Promise<void>;
}) {
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(today());
  const [narration, setNarration] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<EntryLine[]>([
    {
      accountCode: "",
      debit: "",
      credit: "",
      paymentMethod: "CASH",
      chequeNumber: "",
    },
    {
      accountCode: "",
      debit: "",
      credit: "",
      paymentMethod: "CASH",
      chequeNumber: "",
    },
  ]);
  const [activeLineTab, setActiveLineTab] = useState<"CASH" | "CHEQUE">("CASH");
  const [entryQuery, setEntryQuery] = useState("");
  const [entryChequeFilter, setEntryChequeFilter] = useState("");
  const addEntryLine = (focus = false) => {
    const index = lines.length;
    setLines((current) => [
      ...current,
      {
        accountCode: "",
        debit: "",
        credit: "",
        paymentMethod: showJournalLineFields ? activeLineTab : "",
        chequeNumber: "",
      },
    ]);
    if (focus)
      window.setTimeout(
        () => document.getElementById(`voucher-account-${index}`)?.focus(),
        50,
      );
  };
  const [editing, setEditing] = useState(false);
  const [baseline, setBaseline] = useState<Voucher | null>(null);
  const showJournalLineFields =
    type === "JOURNAL VOUCHER" && (!editing || baseline?.type !== "VOUCHER");
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printVoucher, setPrintVoucher] = useState<Voucher | null>(null);
  const [deleteVoucher, setDeleteVoucher] = useState<Voucher | null>(null);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [newChequeOpen, setNewChequeOpen] = useState(false);
  const [newChequeSaving, setNewChequeSaving] = useState(false);
  const [newChequeNumber, setNewChequeNumber] = useState("");
  const [newChequeCheckNumber, setNewChequeCheckNumber] = useState("");
  const [newChequeBank, setNewChequeBank] = useState("");
  const [newChequeDate, setNewChequeDate] = useState(today());
  const [newChequeParty, setNewChequeParty] = useState("");
  const [newChequeAmount, setNewChequeAmount] = useState("");
  const [newChequeLine, setNewChequeLine] = useState<number | null>(null);
  const visible = vouchers.filter(
    (voucher) =>
      ["VOUCHER", "JOURNAL VOUCHER"].includes(voucher.type) &&
      (!entryChequeFilter ||
        voucher.chequeNumber === entryChequeFilter ||
        voucher.lines.some(
          (line) => line.chequeNumber === entryChequeFilter,
        )) &&
      (!entryQuery ||
        `${voucher.number} ${voucher.reference} ${voucher.narration} ${voucher.lines.map((line) => `${line.accountCode} ${line.paymentMethod ?? ""} ${line.chequeNumber ?? ""}`).join(" ")}`
          .toLowerCase()
          .includes(entryQuery.toLowerCase())),
  );
  const clear = async () => {
    setEditing(false);
    setBaseline(null);
    setNumber("");
    setDate(today());
    setNarration("");
    setReference("");
    setLines([
      {
        accountCode: "",
        debit: "",
        credit: "",
        paymentMethod: "CASH",
        chequeNumber: "",
      },
      {
        accountCode: "",
        debit: "",
        credit: "",
        paymentMethod: "CASH",
        chequeNumber: "",
      },
    ]);
    setActiveLineTab("CASH");
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
  const beginCreateCheque = async (lineIndex: number) => {
    try {
      const targetLineIndex = lineIndex < 0 ? lines.length : lineIndex;
      if (lineIndex < 0) {
        setLines((current) => [
          ...current,
          {
            accountCode: "",
            debit: "",
            credit: "",
            paymentMethod: "CHEQUE",
            chequeNumber: "",
          },
        ]);
      }
      setNewChequeNumber(await window.office.ids.next("cheque"));
      setNewChequeCheckNumber("");
      setNewChequeBank(banks[0]?.code ?? "");
      setNewChequeDate(date || today());
      setNewChequeParty(lines[targetLineIndex]?.accountCode ?? "");
      const line = lines[targetLineIndex];
      const lineAmount = Math.max(
        Number(line?.debit) || 0,
        Number(line?.credit) || 0,
      );
      setNewChequeAmount(lineAmount > 0 ? String(lineAmount) : "");
      setNewChequeLine(targetLineIndex);
      setNewChequeOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not prepare a new cheque",
      );
    }
  };
  const saveNewCheque = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      newChequeLine === null ||
      !newChequeBank ||
      !newChequeParty ||
      Number(newChequeAmount) <= 0
    )
      return;
    setNewChequeSaving(true);
    try {
      const created = await onCreateCheque({
        number: newChequeNumber,
        bankCode: newChequeBank,
        date: newChequeDate,
        party: newChequeParty,
        amount: Number(newChequeAmount),
        status: "PENDING",
        checkNumber: newChequeCheckNumber,
        direction: "",
        bankAccountCode: "",
        clearedDate: "",
      });
      setLines((current) =>
        current.map((line, index) =>
          index === newChequeLine
            ? { ...line, chequeNumber: created.number }
            : line,
        ),
      );
      setNewChequeOpen(false);
      toast.success(`Cheque ${created.number} added`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save cheque",
      );
    } finally {
      setNewChequeSaving(false);
    }
  };
  useEffect(() => {
    void clear();
  }, [type]);
  useEffect(() => {
    if (!editorOpen) return;
    const frame = window.requestAnimationFrame(() =>
      document.getElementById("voucher-date")?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [editorOpen]);
  const edit = (voucher: Voucher) => {
    setEditorOpen(true);
    setEditing(true);
    setBaseline(voucher);
    setNumber(voucher.number);
    setDate(voucher.date);
    setNarration(voucher.narration);
    setReference(voucher.reference);
    const hasLinePaymentDetails = voucher.lines.some(
      (line) => line.paymentMethod || line.chequeNumber,
    );
    setLines(
      voucher.lines.map((line, index) => ({
        accountCode: line.accountCode,
        debit: String(line.debit),
        credit: String(line.credit),
        paymentMethod:
          line.paymentMethod ||
          (!hasLinePaymentDetails && index === 0
            ? (voucher.paymentMethod ?? "")
            : "CASH"),
        chequeNumber:
          line.chequeNumber ||
          (!hasLinePaymentDetails && index === 0
            ? (voucher.chequeNumber ?? "")
            : ""            ),
      })),
    );
    setActiveLineTab(
      voucher.lines.some((line) => line.paymentMethod === "CHEQUE") ||
        (!hasLinePaymentDetails && voucher.paymentMethod === "CHEQUE")
        ? "CHEQUE"
        : "CASH",
    );
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      showJournalLineFields &&
      lines.some(
        (line) => line.paymentMethod === "CHEQUE" && !line.chequeNumber,
      )
    ) {
      toast.error("Select a cheque ID for every entry marked Cheque");
      return;
    }
    setSaving(true);
    try {
      const voucherLines: Voucher["lines"] = lines.map((line) => ({
        accountCode: line.accountCode,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
        paymentMethod: showJournalLineFields ? line.paymentMethod : "",
        chequeNumber:
          showJournalLineFields && line.paymentMethod === "CHEQUE"
            ? line.chequeNumber
            : "",
      }));
      await onSave({
        number,
        date,
        narration,
        reference,
        type: editing && baseline?.type === "VOUCHER" ? "VOUCHER" : type,
        paymentMethod: "",
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
  const printColumns =
    printVoucher?.type === "JOURNAL VOUCHER"
      ? ["Account", "Cash / Cheque", "Debit", "Credit"]
      : ["Account", "Debit", "Credit"];
  const printRows =
    printVoucher?.lines.map((line) => [
      `${line.accountCode} — ${accounts.find((account) => account.code === line.accountCode)?.description ?? ""}`,
      ...(printVoucher.type === "JOURNAL VOUCHER"
        ? [
            line.paymentMethod === "CASH"
              ? "Cash"
              : line.paymentMethod === "CHEQUE"
                ? `Cheque${line.chequeNumber ? ` · ${line.chequeNumber}` : ""}`
                : "—",
          ]
        : []),
      money(line.debit),
      money(line.credit),
    ]) ?? [];
  const updateEntryLine = (
    index: number,
    method: "CASH" | "CHEQUE" | undefined,
    updates: Partial<EntryLine>,
  ) => setLines((current) => index < 0
    ? [...current, {
        accountCode: "",
        debit: "",
        credit: "",
        paymentMethod: method ?? "",
        chequeNumber: "",
        ...updates,
      }]
    : current.map((entry, row) => row === index ? { ...entry, ...updates } : entry));
  const renderLineTable = (method?: "CASH" | "CHEQUE") => {
    const matchingLines = lines.map((line, index) => ({ line, index }))
      .filter(({ line }) => !method || line.paymentMethod === method);
    const displayLines = matchingLines.length > 0
      ? matchingLines
      : method
        ? [{
            line: { accountCode: "", debit: "", credit: "", paymentMethod: method, chequeNumber: "" } satisfies EntryLine,
            index: -1,
          }]
        : [];
    return (
    <div className="overflow-x-auto rounded-md border">
      <Table managed={false} className="min-w-[48rem] table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-64">Account <span aria-hidden="true" className="text-destructive">*</span></TableHead>
            {method === "CHEQUE" && <TableHead className="w-72">Cheque ID</TableHead>}
            <TableHead className="w-36">Debit</TableHead>
            <TableHead className="w-36">Credit</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayLines.map(({ line, index }) => (
              <TableRow key={index < 0 ? `empty-${method}` : index}>
                <TableCell className="w-64 min-w-0 align-top">
                  <FormSelect
                    id={`voucher-account-${index < 0 ? `empty-${method}` : index}`}
                    value={line.accountCode}
                    onChange={(accountCode) => updateEntryLine(index, method, { accountCode })}
                    options={accounts.map((account) => ({ value: account.code, label: `${account.description} — ${account.code}` }))}
                    placeholder="Select account"
                    emptyHint="Add accounts in Chart of Accounts, then return here."
                  />
                </TableCell>
                {method === "CHEQUE" && (
                  <TableCell className="w-72 min-w-0 align-top">
                    <div className="flex min-w-0 items-start gap-1.5">
                      <div className="min-w-0 flex-1">
                        {cheques.length ? (
                          <PersistentSelectField
                            id={`voucher-cheque-${index < 0 ? "empty" : index}`}
                            value={line.chequeNumber}
                            onChange={(chequeNumber) => updateEntryLine(index, method, { chequeNumber })}
                            options={cheques.map((cheque) => cheque.number)}
                            searchable
                            triggerClassName="[&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:overflow-hidden [&_[data-slot=select-value]]:text-ellipsis"
                          />
                        ) : (
                          <Button type="button" variant="outline" className="h-9 w-full justify-start text-muted-foreground" onClick={() => void beginCreateCheque(index)}>
                            Add a new cheque
                          </Button>
                        )}
                      </div>
                      <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label="Add cheque" title="Add cheque without leaving this voucher" onClick={() => void beginCreateCheque(index)}>
                        <Plus />
                      </Button>
                    </div>
                  </TableCell>
                )}
                <TableCell className="min-w-0 align-top">
                  <Input aria-label={`Debit line ${index < 0 ? "new" : index + 1}`} className="min-w-0" type="number" min="0" step="any" value={line.debit} onChange={(event) => updateEntryLine(index, method, { debit: event.target.value, credit: event.target.value ? "" : line.credit })} />
                </TableCell>
                <TableCell className="min-w-0 align-top">
                  <Input aria-label={`Credit line ${index < 0 ? "new" : index + 1}`} className="min-w-0" type="number" min="0" step="any" value={line.credit} onChange={(event) => updateEntryLine(index, method, { credit: event.target.value, debit: event.target.value ? "" : line.debit })} />
                </TableCell>
                <TableCell className="align-top">
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove line" disabled={index < 0 || lines.length <= 2} onClick={() => setLines((current) => current.filter((_, row) => row !== index))}>
                    <Trash2 />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
    );
  };
  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        title="Payment / Receipt"
        description="Record balanced entries."
        actions={
          <Button
            data-operator-new
            title="New voucher (Ctrl+N)"
            onClick={() => {
              void clear().then((reserved) => {
                if (reserved) setEditorOpen(true);
              });
            }}
          >
            <Plus data-icon="inline-start" />
            New entry
          </Button>
        }
      />
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          onKeyDown={(event) => {
            if (event.altKey && event.key === "Enter") {
              event.preventDefault();
              addEntryLine(true);
            }
          }}
          className="flex max-h-[92vh] w-[min(96vw,64rem)] flex-col gap-0 overflow-y-auto p-0 sm:max-w-none"
        >
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle>
              {editing
                ? `Edit ${number}`
                : "New payment / receipt entry"}
            </DialogTitle>
            <DialogDescription>
              Every posting must have equal debit and credit totals. Posting
              does not automatically account for purchase or sale challans.
            </DialogDescription>
          </DialogHeader>
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
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <FormSectionHeading
                        title="Voucher lines"
                        description="Choose accounts and enter balanced debit and credit amounts."
                        className="flex-1"
                      />
                      <Button
                        title="Add line (Alt+Enter)"
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addEntryLine(true)}
                      >
                        <Plus data-icon="inline-start" />
                        Add line
                      </Button>
                    </div>
                    {showJournalLineFields ? (
                      <Tabs
                        value={activeLineTab}
                        onValueChange={(value) => {
                          if (value === "CASH" || value === "CHEQUE")
                            setActiveLineTab(value);
                        }}
                        className="gap-3"
                      >
                        <TabsList className="grid w-full max-w-sm grid-cols-2">
                          <TabsTrigger value="CASH">
                            Cash ({lines.filter((line) => line.paymentMethod === "CASH").length})
                          </TabsTrigger>
                          <TabsTrigger value="CHEQUE">
                            Cheque ({lines.filter((line) => line.paymentMethod === "CHEQUE").length})
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value={activeLineTab} className="mt-0">
                          {renderLineTable(activeLineTab)}
                        </TabsContent>
                      </Tabs>
                    ) : renderLineTable()}
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
                <DialogFooter className="flex-row justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void clear()}
                  >
                    Clear form
                  </Button>
                  <Button
                    data-operator-save
                    title="Save voucher (Ctrl+S)"
                    type="submit"
                    disabled={
                      saving ||
                      accounts.length < 2
                    }
                  >
                    {saving
                      ? "Saving…"
                      : editing
                        ? "Update voucher"
                        : "Post voucher"}
                  </Button>
                </DialogFooter>
              </form>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
      <Dialog open={newChequeOpen} onOpenChange={setNewChequeOpen}>
        <DialogContent className="w-[min(92vw,38rem)] sm:max-w-none">
          <form
            onSubmit={(event) => void saveNewCheque(event)}
            className="space-y-5"
          >
            <DialogHeader>
              <DialogTitle>Add cheque to this voucher</DialogTitle>
              <DialogDescription>
                Save a pending cheque record and link it to the selected journal
                line.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Cheque ID" id="journal-new-cheque-id">
                <Input
                  id="journal-new-cheque-id"
                  value={newChequeNumber}
                  disabled
                />
              </Field>
              <Field label="Check number" id="journal-new-cheque-check-number">
                <Input
                  id="journal-new-cheque-check-number"
                  value={newChequeCheckNumber}
                  onChange={(event) =>
                    setNewChequeCheckNumber(event.target.value)
                  }
                  placeholder="Optional bank check number"
                />
              </Field>
              <Field label="Bank" id="journal-new-cheque-bank" required>
                <FormSelect
                  id="journal-new-cheque-bank"
                  value={newChequeBank}
                  onChange={setNewChequeBank}
                  options={banks.map((bank) => ({
                    value: bank.code,
                    label: `${bank.name} — ${bank.code}`,
                  }))}
                  placeholder="Select bank"
                  emptyHint="Add a bank in Banks first."
                />
              </Field>
              <Field label="Cheque date" id="journal-new-cheque-date" required>
                <DatePicker
                  id="journal-new-cheque-date"
                  value={newChequeDate}
                  onChange={setNewChequeDate}
                />
              </Field>
              <Field
                label="Party account"
                id="journal-new-cheque-party"
                required
              >
                <FormSelect
                  id="journal-new-cheque-party"
                  value={newChequeParty}
                  onChange={setNewChequeParty}
                  options={accounts.map((account) => ({
                    value: account.code,
                    label: `${account.description} — ${account.code}`,
                  }))}
                  placeholder="Select party account"
                />
              </Field>
              <Field label="Amount" id="journal-new-cheque-amount" required>
                <Input
                  id="journal-new-cheque-amount"
                  type="number"
                  min="0.01"
                  step="any"
                  value={newChequeAmount}
                  onChange={(event) => setNewChequeAmount(event.target.value)}
                  required
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNewChequeOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={newChequeSaving || !banks.length || !accounts.length}
              >
                {newChequeSaving ? "Saving…" : "Save and select cheque"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base">Saved entries</CardTitle>
              <CardDescription className="mt-1">
                {visible.length} {visible.length === 1 ? "entry" : "entries"}
              </CardDescription>
            </div>
            <div
              className={`grid min-w-0 gap-2 ${cheques.length > 0 ? "sm:grid-cols-[minmax(14rem,1fr)_10rem]" : "sm:grid-cols-[minmax(14rem,1fr)]"} lg:w-[32rem] lg:shrink-0`}
            >
              <Input
                data-operator-search
                title="Focus search (Ctrl+F)"
                id="saved-voucher-search"
                aria-label="Search saved entries"
                value={entryQuery}
                onChange={(event) => setEntryQuery(event.target.value)}
                placeholder="Search entries"
                className="min-w-0"
              />
              {cheques.length > 0 && (
                <FormSelect
                  id="saved-voucher-cheque-filter"
                  ariaLabel="Filter saved entries by cheque ID"
                  value={entryChequeFilter}
                  onChange={setEntryChequeFilter}
                  options={cheques.map((cheque) => ({
                    value: cheque.number,
                    label: cheque.number,
                  }))}
                  placeholder="Any cheque ID"
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table filterable={false}>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Cash / Cheque by line</TableHead>
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
                      <TableCell>
                        {voucher.lines
                          .map((line, index) =>
                            line.paymentMethod
                              ? `Line ${index + 1}: ${line.paymentMethod === "CASH" ? "Cash" : `Cheque${line.chequeNumber ? ` · ${line.chequeNumber}` : ""}`}`
                              : "",
                          )
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </TableCell>
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
                      colSpan={9}
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
            subtitle={`Voucher ${printVoucher.number} · ${printVoucher.date}${printVoucher.type !== "JOURNAL VOUCHER" && printVoucher.chequeNumber ? ` · Cheque ID ${printVoucher.chequeNumber}` : ""}${printVoucher.reference ? ` · Reference ${printVoucher.reference}` : ""}${printVoucher.narration ? ` · ${printVoucher.narration}` : ""}`}
            columns={printColumns}
            rows={printRows}
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
            subtitle={`Voucher ${printVoucher.number} · ${printVoucher.date}${printVoucher.type !== "JOURNAL VOUCHER" && printVoucher.chequeNumber ? ` · Cheque ID ${printVoucher.chequeNumber}` : ""}${printVoucher.reference ? ` · Reference ${printVoucher.reference}` : ""}${printVoucher.narration ? ` · ${printVoucher.narration}` : ""}`}
            columns={printColumns}
            rows={printRows}
            total={money(
              printVoucher.lines.reduce((sum, line) => sum + line.debit, 0),
            )}
          />
        </>
      )}
    </section>
  );
}
