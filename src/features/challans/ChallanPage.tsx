import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field as UiField,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
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
import { ConfirmActionDialog } from "@/components/feedback/ConfirmActionDialog";
import type {
  Account,
  Challan,
  ChallanInputLine,
  CompanyProfile,
  Item,
  ItemAttributes,
} from "@/types";
import {
  PrintDocument,
  PrintPreviewDialog,
  requestPrint,
} from "@/features/printing/PrintDocument";
import { DatePicker } from "@/components/forms/DatePicker";
import { FormSectionHeading } from "@/components/forms/FormSectionHeading";
import { formatMoney as money } from "@/lib/formatters";
import { todayIsoDate as today } from "@/lib/formatters";
import {
  FormSelect,
  Field,
  PersistentSelectField,
  SearchableItemSelect,
} from "@/components/forms/Fields";
import { PageHeader } from "@/components/layout/PageHeader";

function PrinterIcon() {
  return <Printer className="mr-2 size-4" />;
}

export function ChallanPage({
  type,
  rows,
  items,
  accounts,
  locations,
  company,
  logo,
  onPost,
  onUpdate,
  onDelete,
}: {
  type: "PURCHASE" | "SALE";
  rows: Challan[];
  items: Item[];
  accounts: Account[];
  locations: string[];
  company: CompanyProfile | null;
  logo: string | null;
  onPost: (value: {
    number: string;
    type: string;
    date: string;
    description: string;
    party: string;
    location: string;
    lines: ChallanInputLine[];
  }) => Promise<void>;
  onUpdate: (value: {
    number: string;
    type: string;
    date: string;
    description: string;
    party: string;
    location: string;
    lines: ChallanInputLine[];
    __baseline?: Partial<Challan>;
  }) => Promise<void>;
  onDelete: (number: string) => Promise<void>;
}) {
  type DraftLine = {
    itemCode: string;
    itemLabel: string;
    labelOnly: boolean;
    quantity: number | "";
    rate: number;
    discountPercent: string;
    discountAmount: number | "";
    netAmount: number | "";
    brand: string;
    category: string;
  };
  const emptyLine = (): DraftLine => ({
    itemCode: "",
    itemLabel: "",
    labelOnly: false,
    quantity: 1,
    rate: 0,
    discountPercent: "0",
    discountAmount: "",
    netAmount: "",
    brand: "",
    category: "",
  });
  const [number, setNumber] = useState("");
  const [date, setDate] = useState(today());
  const [challanDescription, setChallanDescription] = useState("");
  const [party, setParty] = useState("");
  const [location, setLocation] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [posting, setPosting] = useState(false);
  const [reservingNumber, setReservingNumber] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNumber, setEditingNumber] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<Challan | null>(null);
  const [deleteNumber, setDeleteNumber] = useState<string | null>(null);
  const [printChallan, setPrintChallan] = useState<Challan | null>(null);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);
  const [itemAttributes, setItemAttributes] = useState<ItemAttributes>({
    brands: [],
    categories: [],
  });
  useEffect(() => {
    const load = () => {
      void window.office.items
        .attributes()
        .then(setItemAttributes)
        .catch(() => {});
    };
    load();
    return window.office.sync.onDataChanged(load);
  }, []);
  async function addItemAttribute(kind: "brand" | "category", value: string) {
    setItemAttributes(await window.office.items.addAttribute({ kind, value }));
    toast.success(`${kind === "brand" ? "Brand" : "Category"} saved`);
  }
  const idKind = type === "PURCHASE" ? "purchaseChallan" : "saleChallan";
  async function beginCreate() {
    if (!locations.length) {
      toast.info(
        "Add a location on the Locations page before creating a challan",
      );
      return;
    }
    setReservingNumber(true);
    try {
      setEditingNumber(null);
      setBaseline(null);
      setNumber(await window.office.ids.next(idKind));
      setDate(today());
      setChallanDescription("");
      setLines([emptyLine()]);
      setEditorOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not prepare a new challan",
      );
    } finally {
      setReservingNumber(false);
    }
  }
  const accountChoices = useMemo(() => {
    const partyRoot = accounts.find(
      (account) => account.description.trim().toLowerCase() === "party",
    );
    if (!partyRoot)
      return accounts.filter(
        (account) =>
          account.description.trim().toLowerCase() === "cash in hand",
      );
    const descendants = new Set([partyRoot.code]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const account of accounts)
        if (
          account.parentCode &&
          descendants.has(account.parentCode) &&
          !descendants.has(account.code)
        ) {
          descendants.add(account.code);
          changed = true;
        }
    }
    return accounts.filter(
      (account) =>
        (account.code !== partyRoot.code && descendants.has(account.code)) ||
        account.description.trim().toLowerCase() === "cash in hand",
    );
  }, [accounts]);
  const printParty = printChallan
    ? (accounts.find((account) => account.code === printChallan.party)
        ?.description ?? printChallan.party)
    : "";
  const printRows =
    printChallan?.lines.map((line, index) => {
      const item = items.find((candidate) => candidate.code === line.itemCode);
      const discountPercent =
        line.discountPercent > 0
          ? line.discountPercent
          : Math.max(0, -line.additionalRatePercent);
      const discountAmount =
        line.discountAmount ||
        Math.round((line.rate * line.quantity * discountPercent) / 100);
      return [
        String(index + 1),
        line.itemCode || "—",
        item?.description || line.itemLabel || "",
        line.brand || "—",
        line.category || "—",
        `${line.quantity}${item?.unit ? ` ${item.unit}` : ""}`,
        Math.round(line.rate).toLocaleString(),
        discountAmount.toLocaleString(),
        `${discountPercent}%`,
        money(line.amount),
      ];
    }) ?? [];
  const lineRate = (line: DraftLine) => Math.round(line.rate);
  const lineDiscount = (line: DraftLine) =>
    Math.round(Number(line.discountAmount) || 0);
  const setLine = (index: number, updates: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;
        const next = { ...line, ...updates };
        const baseAmount = lineRate(next) * (Number(next.quantity) || 0);
        if (Object.hasOwn(updates, "itemCode")) {
          const selectedItem = items.find(
            (item) => item.code === next.itemCode,
          );
          next.brand = "";
          next.category = "";
          next.rate = selectedItem
            ? Math.round(
                type === "PURCHASE"
                  ? selectedItem.purchaseRate
                  : (selectedItem.saleRate ?? selectedItem.itemRate ?? 0),
              )
            : 0;
          next.discountPercent = "0";
          next.discountAmount = "";
          next.netAmount = next.rate * (Number(next.quantity) || 0);
        } else if (Object.hasOwn(updates, "netAmount")) {
          const netAmount = next.netAmount === "" ? 0 : Math.round(Number(next.netAmount) || 0);
          next.netAmount = netAmount;
          next.discountAmount = Math.max(0, Math.min(baseAmount, baseAmount - netAmount));
          next.discountPercent = baseAmount > 0
            ? String((next.discountAmount / baseAmount) * 100)
            : "0";
        } else if (Object.hasOwn(updates, "discountAmount")) {
          if (next.discountAmount === "") {
            next.discountPercent = "0";
            next.netAmount = baseAmount;
          } else {
            next.discountAmount = Math.round(Number(next.discountAmount) || 0);
            next.discountPercent =
              baseAmount > 0
                ? String((next.discountAmount / baseAmount) * 100)
                : "0";
            next.netAmount = Math.max(0, baseAmount - next.discountAmount);
          }
        } else {
          if (Object.hasOwn(updates, "discountPercent")) {
            const percent = Number(next.discountPercent) || 0;
            next.discountAmount = Math.round((baseAmount * percent) / 100);
            next.netAmount = Math.max(0, baseAmount - next.discountAmount);
          } else if (
            (Object.hasOwn(updates, "quantity") ||
              Object.hasOwn(updates, "rate")) &&
            (next.discountAmount !== "" || Number(next.discountPercent) > 0)
          ) {
            next.discountAmount = Math.round(
              (baseAmount * (Number(next.discountPercent) || 0)) / 100,
            );
            next.netAmount = Math.max(0, baseAmount - next.discountAmount);
          }
        }
        return next;
      }),
    );
  const lineAmount = (line: DraftLine) => {
    const quantity = Number(line.quantity) || 0;
    if (line.netAmount !== "") return Math.max(0, Number(line.netAmount) || 0);
    return Math.max(0, quantity * lineRate(line) - lineDiscount(line));
  };
  const hasInvalidLineValues = (line: DraftLine) => {
    const discountPercent = Number(line.discountPercent);
    const baseAmount = Math.round(lineRate(line) * (Number(line.quantity) || 0));
    const netAmount = line.netAmount === "" ? lineAmount(line) : Number(line.netAmount);
    return (
      line.quantity === "" ||
      !Number.isFinite(line.quantity) ||
      line.quantity <= 0 ||
      !Number.isFinite(discountPercent) ||
      discountPercent < 0 ||
      discountPercent > 100 ||
      line.discountAmount === "" ||
      !Number.isFinite(line.discountAmount) ||
      line.discountAmount < 0 ||
      line.discountAmount >
        Math.round(lineRate(line) * (Number(line.quantity) || 0)) ||
      !Number.isFinite(netAmount) ||
      netAmount < 0 ||
      netAmount > baseAmount ||
      (line.labelOnly && (!Number.isFinite(line.rate) || line.rate < 0))
    );
  };
  const total = lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const totalQuantity = lines.reduce(
    (sum, line) => sum + (Number(line.quantity) || 0),
    0,
  );
  const itemQuantityAfterDraftLine = (
    itemCode: string,
    index: number,
    lineQuantity: number,
  ) => {
    let quantity =
      items.find((item) => item.code === itemCode)?.stockQuantity ?? 0;
    if (baseline) {
      const originalQuantity = baseline.lines
        .filter((line) => line.itemCode === itemCode)
        .reduce((sum, line) => sum + line.quantity, 0);
      quantity += type === "SALE" ? originalQuantity : -originalQuantity;
    }
    const earlierDraftQuantity = lines
      .slice(0, index)
      .filter((line) => line.itemCode === itemCode)
      .reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
    const currentQuantity = Number(lineQuantity) || 0;
    return (
      quantity +
      (type === "SALE"
        ? -(earlierDraftQuantity + currentQuantity)
        : earlierDraftQuantity + currentQuantity)
    );
  };
  const addLine = (focus = false) => {
    const newIndex = lines.length;
    setLines((current) => [...current, emptyLine()]);
    if (focus)
      window.setTimeout(
        () => document.getElementById(`challan-item-${newIndex}`)?.focus(),
        50,
      );
  };
  useEffect(() => {
    if (!editorOpen) return;
    const frame = window.requestAnimationFrame(() =>
      document.getElementById("challan-party")?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [editorOpen]);
  function beginEdit(row: Challan) {
    setEditingNumber(row.number);
    setBaseline(row);
    setNumber(row.number);
    setDate(row.date);
    setChallanDescription(row.description ?? "");
    setParty(row.party);
    setLocation(row.location);
    setLines(
      row.lines.map((line) => ({
        itemCode: line.itemCode,
        itemLabel: line.itemLabel ?? "",
        labelOnly: !line.itemCode,
        quantity: line.quantity,
        rate: Math.round(line.rate),
        discountPercent: String(
          line.discountPercent > 0
            ? line.discountPercent
            : Math.max(0, -(line.additionalRatePercent ?? 0)),
        ),
        discountAmount: Math.round(
          line.discountAmount ||
            (line.rate *
              line.quantity *
              (line.discountPercent > 0
                ? line.discountPercent
                : Math.max(0, -(line.additionalRatePercent ?? 0)))) /
              100,
        ),
        netAmount: Math.round(line.amount || 0),
        brand:
          line.brand ?? "",
        category:
          line.category ?? "",
      })),
    );
    setEditorOpen(true);
  }
  async function submit() {
    if (!location) {
      toast.error("Select a location");
      return;
    }
    if (lines.some(hasInvalidLineValues)) {
      toast.error(
        "Enter a valid quantity, discount amount, and discount percent (0–100) for every line",
      );
      return;
    }
    setPosting(true);
    try {
      const submittedLines = lines.map((line): ChallanInputLine => {
        const rate = lineRate(line);
        const quantity = Number(line.quantity);
        const discountPercent = Number(line.discountPercent) || 0;
        const discountAmount = lineDiscount(line);
        const discountedRate =
          quantity > 0 ? rate - discountAmount / quantity : rate;
        const item = items.find(
          (candidate) => candidate.code === line.itemCode,
        );
        const common = {
          quantity,
          rate,
          purchaseRate:
            type === "PURCHASE" ? discountedRate : (item?.purchaseRate ?? rate),
          additionalRatePercent:
            rate > 0 ? (discountedRate * 100) / rate - 100 : 0,
          saleRate: type === "SALE" ? discountedRate : (item?.saleRate ?? rate),
          amount: lineAmount(line),
          discountPercent,
          discountAmount,
          brand: line.brand,
          category: line.category,
        };
        return line.labelOnly
          ? { itemLabel: line.itemLabel.trim(), ...common }
          : { itemCode: line.itemCode, ...common };
      });
      const value = {
        number,
        type,
        date,
        description: challanDescription,
        party,
        location,
        lines: submittedLines,
      };
      if (editingNumber) {
        await onUpdate({
          ...value,
          ...(baseline ? { __baseline: baseline } : {}),
        });
        toast.success("Challan updated");
      } else {
        await onPost(value);
        toast.success(
          `${type === "PURCHASE" ? "Purchase" : "Sale"} challan posted`,
        );
      }
      setEditingNumber(null);
      setBaseline(null);
      setNumber("");
      setDate(today());
      setChallanDescription("");
      setLines([emptyLine()]);
      setEditorOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not post challan",
      );
    } finally {
      setPosting(false);
    }
  }
  return (
    <section className="space-y-5">
      <PageHeader
        title={type === "PURCHASE" ? "Purchase Challans" : "Sale Challans"}
        description="Select or create catalog items, or use one-off labels that do not change inventory."
        actions={
          <Button
            data-operator-new
            title="New challan (Ctrl+N)"
            disabled={reservingNumber || posting}
            onClick={() => void beginCreate()}
          >
            <Plus data-icon="inline-start" />
            {reservingNumber ? "Preparing…" : "New challan"}
          </Button>
        }
      />
      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setEditingNumber(null);
            setBaseline(null);
          }
        }}
      >
        <DialogContent className="flex max-h-[92vh] w-[min(98vw,84rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle>
              {editingNumber
                ? `Edit ${type.toLowerCase()} challan`
                : `New ${type.toLowerCase()} challan`}
            </DialogTitle>
            <DialogDescription>
              Choose the party and location, then add catalog items or one-off
              labeled lines. Catalog items affect stock; labeled lines do not.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6 pb-10">
            <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <FormSectionHeading title="Document details" />
              <Field label="Challan number" id="challan-number">
                <Input id="challan-number" value={number} disabled />
              </Field>
              <Field label="Date" id="challan-date" required>
                <DatePicker
                  id="challan-date"
                  value={date}
                  onChange={setDate}
                  required
                />
              </Field>
              <Field label="Party account" id="challan-party" required>
                <FormSelect
                  id="challan-party"
                  value={party}
                  onChange={setParty}
                  searchable
                  placeholder="Select a party"
                  emptyHint="Add the party account in Chart of Accounts, then return here."
                  options={accountChoices.map((account) => ({
                    value: account.code,
                    label: `${account.description} — ${account.code}`,
                  }))}
                />
              </Field>
              <Field label="Location" id="challan-location" required>
                <FormSelect
                  id="challan-location"
                  value={location}
                  onChange={setLocation}
                  searchable
                  placeholder="Select a location"
                  emptyHint="Add a location on the Locations page, then return here."
                  options={locations.map((place) => ({
                    value: place,
                    label: place,
                  }))}
                />
              </Field>
              <Field
                label="Description"
                id="challan-description"
                className="sm:col-span-3"
              >
                <Textarea
                  id="challan-description"
                  maxLength={300}
                  rows={3}
                  value={challanDescription}
                  onChange={(event) =>
                    setChallanDescription(event.target.value)
                  }
                  placeholder="Optional note for this challan"
                />
              </Field>
            </FieldGroup>
            <section
              className="flex flex-col gap-3"
              aria-label="Challan item lines"
            >
              <FormSectionHeading
                title="Items"
                className="w-full"
                description="Create a catalog item here, select an existing one, or enter a one-off line label that will not be added to Items or inventory."
              />
              {lines.map((line, index) => {
                const rate = lineRate(line);
                const selectedItem = items.find(
                  (candidate) => candidate.code === line.itemCode,
                );
                return (
                  <div key={index} className="rounded-xl border bg-card p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-medium">
                        Line {String(index + 1).padStart(2, "0")}
                      </p>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove line ${index + 1}`}
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((current) =>
                            current.filter(
                              (_, lineIndex) => lineIndex !== index,
                            ),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </div>
                    <div className="overflow-x-auto pb-1">
                      <FieldGroup
                        className={
                          line.labelOnly
                            ? "grid min-w-196 grid-cols-[minmax(10rem,1fr)_5rem_6rem_6rem_4rem_6.5rem] gap-3 **:data-[slot=field-label]:whitespace-nowrap"
                            : "grid min-w-264 grid-cols-[minmax(10rem,1fr)_minmax(7rem,1fr)_minmax(7rem,1fr)_5rem_6rem_6rem_4rem_6.5rem] gap-3 **:data-[slot=field-label]:whitespace-nowrap"
                        }
                      >
                        <div className="order-3 flex flex-col gap-2">
                          {line.labelOnly ? (
                            <Field
                              label="One-off item label"
                              id={`challan-label-${index}`}
                            >
                              <Input
                                id={`challan-label-${index}`}
                                required
                                maxLength={200}
                                value={line.itemLabel}
                                onChange={(event) =>
                                  setLine(index, {
                                    itemLabel: event.target.value,
                                  })
                                }
                                placeholder="Enter item or service label"
                              />
                            </Field>
                          ) : (
                            <Field
                              label="Catalog item"
                              id={`challan-item-${index}`}
                              required
                            >
                              <SearchableItemSelect
                                id={`challan-item-${index}`}
                                value={line.itemCode}
                                onChange={(value) =>
                                  setLine(index, { itemCode: value })
                                }
                                items={items}
                                placeholder="Select an item"
                                clearable
                                emptyHint="Add catalog items on the Items page, then select one here."
                              />
                            </Field>
                          )}
                        </div>
                        {!line.labelOnly && (
                          <div className="order-1">
                            <PersistentSelectField
                              label="Brand"
                              id={`challan-brand-${index}`}
                              value={line.brand}
                              onChange={(brand) => setLine(index, { brand })}
                              options={itemAttributes.brands}
                              onAdd={(value) => addItemAttribute("brand", value)}
                              required={false}
                              searchable
                            />
                          </div>
                        )}
                        {!line.labelOnly && (
                          <div className="order-2">
                            <PersistentSelectField
                              label="Category"
                              id={`challan-category-${index}`}
                              value={line.category}
                              onChange={(category) =>
                                setLine(index, { category })
                              }
                              options={itemAttributes.categories}
                              onAdd={(value) =>
                                addItemAttribute("category", value)
                              }
                              required={false}
                              searchable
                            />
                          </div>
                        )}
                        <Field
                          label="Quantity"
                          id={`challan-quantity-${index}`}
                          className="order-5"
                        >
                          <Input
                            id={`challan-quantity-${index}`}
                            type="number"
                            min="0.01"
                            step="any"
                            required
                            value={line.quantity}
                            onChange={(event) => {
                              const value = event.target.value;
                              setLine(index, {
                                quantity: value === "" ? "" : Number(value),
                              });
                            }}
                          />
                          {line.itemCode && (
                            <p className="text-xs text-muted-foreground">
                              Item quantity after this line:{" "}
                              {itemQuantityAfterDraftLine(
                                line.itemCode,
                                index,
                                Number(line.quantity) || 0,
                              )}{" "}
                              {selectedItem?.unit ?? "units"}
                            </p>
                          )}
                        </Field>
                        {line.labelOnly ? (
                          <Field label="Rate" id={`challan-rate-${index}`} className="order-4">
                            <Input
                              id={`challan-rate-${index}`}
                              type="number"
                              min="0"
                              step="1"
                              required
                              value={line.rate}
                              onChange={(event) =>
                                setLine(index, {
                                  rate: Number(event.target.value),
                                })
                              }
                              onBlur={() =>
                                setLine(index, {
                                  rate: Math.round(line.rate),
                                })
                              }
                            />
                          </Field>
                        ) : (
                          <UiField className="order-4">
                            <FieldLabel>Rate list</FieldLabel>
                            <div className="flex h-9 items-center rounded-lg border bg-muted/40 px-3 font-medium tabular-nums">
                              {rate.toLocaleString()}
                            </div>
                          </UiField>
                        )}
                        <Field
                          label="Discount"
                          id={`challan-discount-${index}`}
                          required
                          className="order-6"
                        >
                          <Input
                            id={`challan-discount-${index}`}
                            type="number"
                            min="0"
                            max={Math.round(
                              rate * (Number(line.quantity) || 0),
                            )}
                            step="1"
                            required
                            readOnly
                            className="bg-muted/40"
                            value={
                              line.discountAmount === ""
                                ? ""
                                : String(line.discountAmount)
                            }
                          />
                        </Field>
                        <Field
                          label="Disc. %"
                          id={`challan-discount-percent-${index}`}
                          className="order-7"
                        >
                          <InputGroup className="h-9">
                            <InputGroupInput
                              id={`challan-discount-percent-${index}`}
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              required
                              value={line.discountPercent}
                              onChange={(event) =>
                                setLine(index, {
                                  discountPercent: event.target.value,
                                })
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  addLine(true);
                                }
                              }}
                            />
                            <InputGroupAddon align="inline-end">
                              %
                            </InputGroupAddon>
                          </InputGroup>
                        </Field>
                        <Field
                          label="Net amount"
                          id={`challan-line-total-${index}`}
                          className="order-8 **:data-[slot=field-label]:ml-0 **:data-[slot=field-label]:w-full **:data-[slot=field-label]:justify-end **:data-[slot=field-label]:text-right"
                        >
                          <Input
                            id={`challan-line-total-${index}`}
                            aria-label={`Net amount ${index + 1}`}
                            type="number"
                            min="0"
                            step="1"
                            className="text-right font-medium tabular-nums"
                            value={line.netAmount === "" ? "" : String(line.netAmount)}
                            onChange={(event) =>
                              setLine(index, {
                                netAmount:
                                  event.target.value === ""
                                    ? ""
                                    : Number(event.target.value),
                              })
                            }
                          />
                        </Field>
                      </FieldGroup>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
          <DialogFooter className="mt-0 flex-row flex-wrap items-center justify-between gap-3 border-t px-6 py-5 pb-6 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              title="Add line (Enter on Disc. %)"
              onClick={() => addLine(true)}
            >
              <Plus data-icon="inline-start" />
              Add line
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-4">
              <span className="text-sm text-muted-foreground">
                Quantity{" "}
                <strong className="ml-2 text-base text-foreground tabular-nums">
                  {totalQuantity}
                </strong>
              </span>
              <span className="text-sm text-muted-foreground">
                Total{" "}
                <strong className="ml-2 text-base text-foreground tabular-nums">
                  {money(total)}
                </strong>
              </span>
              <Button
                data-operator-save
                title="Save challan (Ctrl+S)"
                onClick={() => void submit()}
                disabled={
                  posting ||
                  lines.some((line) =>
                    line.labelOnly ? !line.itemLabel.trim() : !line.itemCode,
                  ) ||
                  lines.some(hasInvalidLineValues)
                }
              >
                {posting
                  ? "Saving…"
                  : editingNumber
                    ? "Save changes"
                    : `Post ${type === "PURCHASE" ? "purchase" : "sale"}`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recorded documents</CardTitle>
          <CardDescription>
            {rows.length} challan{rows.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="w-full min-w-208 table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[14%]">Number</TableHead>
                  <TableHead className="w-[14%]">Date</TableHead>
                  <TableHead className="w-[21%]">Party</TableHead>
                  <TableHead className="w-[16%]">Location</TableHead>
                  <TableHead className="w-[15%] text-right">Total</TableHead>
                  <TableHead className="w-[20%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.number}>
                    <TableCell className="truncate font-medium">
                      {row.number}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.date}
                    </TableCell>
                    <TableCell className="truncate" title={row.party}>
                      {row.party}
                    </TableCell>
                    <TableCell className="truncate" title={row.location}>
                      {row.location}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {money(row.total)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={`Print challan ${row.number}`}
                          aria-label={`Print challan ${row.number}`}
                          onClick={() => {
                            setPrintChallan(row);
                            setPrintPreviewOpen(true);
                          }}
                        >
                          <PrinterIcon />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={`Edit challan ${row.number}`}
                          aria-label={`Edit challan ${row.number}`}
                          onClick={() => beginEdit(row)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title={`Delete challan ${row.number}`}
                          aria-label={`Delete challan ${row.number}`}
                          onClick={() => setDeleteNumber(row.number)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No documents posted yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {printChallan && (
        <>
          <PrintDocument
            company={company}
            logo={logo}
            title={`${type === "PURCHASE" ? "Purchase" : "Sale"} Challan`}
            subtitle={printChallan.description || undefined}
            columns={[
              "#",
              "Item code",
              "Description",
              "Brand",
              "Category",
              "Qty / unit",
              "Rate list",
              "Discount",
              "Disc. %",
              "Amount",
            ]}
            rows={printRows}
            total={money(printChallan.total)}
            challan={{
              number: printChallan.number,
              date: printChallan.date,
              party: printParty,
              partyLabel: type === "SALE" ? "Customer" : "Supplier",
              location: printChallan.location,
            }}
          />
          <PrintPreviewDialog
            open={printPreviewOpen}
            onOpenChange={setPrintPreviewOpen}
            onPrint={requestPrint}
            company={company}
            logo={logo}
            title={`${type === "PURCHASE" ? "Purchase" : "Sale"} Challan`}
            subtitle={printChallan.description || undefined}
            columns={[
              "#",
              "Item code",
              "Description",
              "Brand",
              "Category",
              "Qty / unit",
              "Rate list",
              "Discount",
              "Disc. %",
              "Amount",
            ]}
            rows={printRows}
            total={money(printChallan.total)}
            challan={{
              number: printChallan.number,
              date: printChallan.date,
              party: printParty,
              partyLabel: type === "SALE" ? "Customer" : "Supplier",
              location: printChallan.location,
            }}
          />
        </>
      )}
      <ConfirmActionDialog
        open={deleteNumber !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteNumber(null);
        }}
        title={`Delete challan ${deleteNumber ?? ""}?`}
        description="This permanently removes the document and its stock movements. A purchase deletion is blocked if it would leave negative stock."
        confirmLabel="Delete challan"
        onConfirm={() => {
          const target = deleteNumber;
          if (target)
            void onDelete(target)
              .then(() => toast.success("Challan deleted"))
              .catch((error) =>
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not delete challan",
                ),
              )
              .finally(() => setDeleteNumber(null));
        }}
      />
    </section>
  );
}
