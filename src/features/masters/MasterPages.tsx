import { Fragment, useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
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
import type { Account, Bank, Item, ItemAttributes } from "@/types";
import { ConfirmActionDialog } from "@/components/feedback/ConfirmActionDialog";
import { FormSectionHeading } from "@/components/forms/FormSectionHeading";
import { formatMoney as money } from "@/lib/formatters";
import { PersistentSelectField } from "@/components/forms/Fields";
import { FormSelect } from "@/components/forms/Fields";
import { PageHeader } from "@/components/layout/PageHeader";

export function MasterPage({
  title,
  description,
  search,
  onSearch,
  children,
}: {
  title: string;
  description: string;
  search: string;
  onSearch: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <PageHeader title={title} description={description} actions={<div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            data-operator-search
            className="pl-9"
            placeholder="Search records"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>} />
      {children}
    </section>
  );
}

type AccountTreeRow = { account: Account; depth: number; hasChildren: boolean };

function buildAccountTree(
  accounts: Account[],
  query: string,
): AccountTreeRow[] {
  const matches = new Set(
    accounts
      .filter((account) =>
        `${account.code} ${account.description}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
      .map((account) => account.code),
  );
  const included = new Set(matches);
  for (const account of accounts) {
    if (!matches.has(account.code)) continue;
    let parentCode = account.parentCode;
    while (parentCode && !included.has(parentCode)) {
      included.add(parentCode);
      parentCode =
        accounts.find((candidate) => candidate.code === parentCode)
          ?.parentCode ?? null;
    }
  }
  const children = new Map<string, Account[]>();
  for (const account of accounts) {
    if (
      !included.has(account.code) ||
      !account.parentCode ||
      !accounts.some((candidate) => candidate.code === account.parentCode)
    )
      continue;
    children.set(account.parentCode, [
      ...(children.get(account.parentCode) ?? []),
      account,
    ]);
  }
  const visible: AccountTreeRow[] = [];
  const visited = new Set<string>();
  const visit = (account: Account, depth: number) => {
    if (visited.has(account.code)) return;
    visited.add(account.code);
    const descendants = children.get(account.code) ?? [];
    visible.push({ account, depth, hasChildren: descendants.length > 0 });
    for (const child of descendants) visit(child, depth + 1);
  };
  for (const account of accounts) {
    if (
      included.has(account.code) &&
      (!account.parentCode ||
        !accounts.some((candidate) => candidate.code === account.parentCode))
    )
      visit(account, 0);
  }
  for (const account of accounts)
    if (included.has(account.code) && !visited.has(account.code))
      visit(account, 0);
  return visible;
}

export function AccountsTable({
  accounts,
  query,
  onSave,
  onDelete,
}: {
  accounts: Account[];
  query: string;
  onSave: (value: Account & { __baseline?: Partial<Account> }) => Promise<void>;
  onDelete: (code: string) => Promise<void>;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setCollapsed(new Set());
  }, [query]);
  const treeRows = buildAccountTree(accounts, query);
  const shownRows: AccountTreeRow[] = [];
  const hiddenByCollapsedParent = new Set<string>();
  for (const row of treeRows) {
    if (
      row.account.parentCode &&
      hiddenByCollapsedParent.has(row.account.parentCode)
    )
      hiddenByCollapsedParent.add(row.account.code);
    else shownRows.push(row);
    if (row.hasChildren && collapsed.has(row.account.code))
      hiddenByCollapsedParent.add(row.account.code);
  }
  const rows = shownRows.map(({ account }) => [
    account.code,
    account.description,
    accounts.find((parent) => parent.code === account.parentCode)
      ?.description ?? "—",
    account.accountType,
    `${money(account.openingBalance)} ${account.openingBalanceSide === "CREDIT" ? "Cr" : "Dr"}`,
  ]);
  const records = shownRows.map(({ account }) => ({
    code: account.code,
    description: account.description,
    parentCode: account.parentCode ?? "",
    openingBalance: String(account.openingBalance),
    openingBalanceSide: account.openingBalanceSide,
    accountType: account.accountType,
    phoneNo: account.phoneNo ?? "",
    ntnNumber: account.ntnNumber ?? "",
    mobileNo: account.mobileNo ?? "",
    gstNo: account.gstNo ?? "",
    address: account.address ?? "",
    partyType: account.partyType ?? "",
    cashBank: account.cashBank ?? "",
  }));
  return (
    <MasterTable
      idKind="account"
      title="Accounts"
      createLabel="Add account"
      columns={[
        "Code",
        "Description",
        "Parent account",
        "Statement type",
        "Opening balance",
        "",
      ]}
      rows={rows}
      records={records}
      accountCodeRecords={accounts.map((account) => ({
        code: account.code,
        parentCode: account.parentCode ?? "",
      }))}
      baselineRecords={shownRows.map(({ account }) => account)}
      treeRows={shownRows.map(({ account, depth, hasChildren }) => ({
        code: account.code,
        depth,
        hasChildren,
        collapsed: collapsed.has(account.code),
        onToggle: () =>
          setCollapsed((current) => {
            const next = new Set(current);
            if (next.has(account.code)) next.delete(account.code);
            else next.add(account.code);
            return next;
          }),
      }))}
      fields={[
        {
          key: "code",
          label: "Account code",
          section: "Account details",
          auto: true,
        },
        { key: "description", label: "Description", required: true },
        { key: "phoneNo", label: "Phone no" },
        { key: "ntnNumber", label: "NTN Number" },
        { key: "mobileNo", label: "Mobile No" },
        { key: "gstNo", label: "G.S.T. no" },
        { key: "address", label: "Address" },
        {
          key: "partyType",
          label: "Account Type",
          type: "select",
          defaultValue: "",
          options: [
            { value: "", label: "Select account type" },
            { value: "SUPPLIER", label: "Supplier" },
            { value: "BANK ACCOUNT", label: "Bank Account" },
          ],
        },
        {
          key: "cashBank",
          label: "Cash / Bank",
          type: "select",
          defaultValue: "",
          options: [
            { value: "", label: "Select" },
            { value: "CASH", label: "Cash" },
            { value: "BANK", label: "Bank" },
          ],
        },
        {
          key: "parentCode",
          label: "Parent account",
          type: "select",
          emptyHint:
            "No parent accounts yet. Leave this blank to create a top-level account.",
          options: [
            { value: "", label: "Top-level account" },
            ...accounts.map((account) => ({
              value: account.code,
              label: `${account.description} — ${account.code}`,
            })),
          ],
        },
        {
          key: "accountType",
          label: "Statement type",
          section: "Statement classification",
          type: "select",
          defaultValue: "UNCLASSIFIED",
          options: [
            { value: "UNCLASSIFIED", label: "Unclassified" },
            { value: "ASSET", label: "Asset" },
            { value: "LIABILITY", label: "Liability" },
            { value: "EQUITY", label: "Equity" },
            { value: "INCOME", label: "Income" },
            { value: "EXPENSE", label: "Expense" },
          ],
        },
        {
          key: "openingBalance",
          label: "Opening balance",
          section: "Opening balance",
          type: "number",
        },
        {
          key: "openingBalanceSide",
          label: "Balance side",
          type: "select",
          defaultValue: "DEBIT",
          options: [
            { value: "DEBIT", label: "Debit" },
            { value: "CREDIT", label: "Credit" },
          ],
        },
      ]}
      onSave={async (value, baseline) =>
        onSave({
          code: value.code,
          description: value.description,
          parentCode: value.parentCode || null,
          openingBalance: Number(value.openingBalance),
          openingBalanceSide:
            value.openingBalanceSide as Account["openingBalanceSide"],
          accountType: value.accountType as Account["accountType"],
          phoneNo: value.phoneNo || "",
          ntnNumber: value.ntnNumber || "",
          mobileNo: value.mobileNo || "",
          gstNo: value.gstNo || "",
          address: value.address || "",
          partyType: (value.partyType || "") as Account["partyType"],
          cashBank: (value.cashBank || "") as Account["cashBank"],
          ...(baseline ? { __baseline: baseline as Partial<Account> } : {}),
        })
      }
      onDelete={(index) => onDelete(shownRows[index].account.code)}
    />
  );
}

export function ItemsTable({
  rows,
  locations,
  onSave,
  onDelete,
}: {
  rows: Item[];
  locations: string[];
  onSave: (
    value: Item & {
      quantityToAdd?: number;
      location?: string;
      __baseline?: Partial<Item>;
    },
  ) => Promise<void>;
  onDelete: (code: string) => Promise<void>;
}) {
  const [attributes, setAttributes] = useState<ItemAttributes>({
    brands: [],
    categories: [],
  });
  const loadAttributes = useCallback(async () => {
    try {
      setAttributes(await window.office.items.attributes());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not load saved brands and categories",
      );
    }
  }, []);
  useEffect(() => {
    void loadAttributes();
    return window.office.sync.onDataChanged(() => {
      void loadAttributes();
    });
  }, [loadAttributes]);
  const addAttribute = async (kind: "brand" | "category", value: string) => {
    setAttributes(await window.office.items.addAttribute({ kind, value }));
  };
  return (
    <MasterTable
      idKind="item"
      title="Items"
      createLabel="Add item"
      columns={[
        "Code",
        "Name",
        "Brand",
        "Category",
        "Quantity",
        "Item rate",
        "Purchase rate",
        "Sale rate",
        "",
      ]}
      rows={rows.map((row) => [
        row.code,
        row.description,
        row.brand || "—",
        row.category || "—",
        String(row.stockQuantity ?? 0),
        money(row.itemRate),
        money(row.purchaseRate),
        money(row.saleRate),
      ])}
      records={rows.map((row) => ({
        ...row,
        stockQuantity: String(row.stockQuantity ?? 0),
        saleRate: String(row.saleRate),
        itemRate: String(row.itemRate),
        purchaseRate: String(row.purchaseRate),
      }))}
      baselineRecords={rows}
      fields={[
        {
          key: "code",
          label: "Item code",
          section: "Item details",
          auto: true,
        },
        { key: "description", label: "Name", required: true },
        {
          key: "brand",
          label: "Brand name",
          type: "persisted-select",
          optionKind: "brand",
          options: attributes.brands,
          required: true,
        },
        {
          key: "category",
          label: "Category",
          type: "persisted-select",
          optionKind: "category",
          options: attributes.categories,
          required: true,
        },
        {
          key: "purchaseRate",
          label: "Purchase rate",
          section: "Pricing",
          type: "number",
          required: true,
        },
        {
          key: "itemRate",
          label: "Item rate",
          section: "Rate list",
          type: "number",
          required: true,
        },
        { key: "saleRate", label: "Sale rate", type: "number", required: true },
        {
          key: "quantityToAdd",
          label: "Quantity to add",
          section: "Inventory",
          type: "number",
          placeholder: "0",
          helpText:
            "Enter starting stock or another quantity to add. Leave at 0 to keep stock unchanged.",
        },
        {
          key: "location",
          label: "Warehouse",
          type: "select",
          options: locations.map((place) => ({ value: place, label: place })),
          emptyHint: "Add a warehouse on the Locations page, then return here.",
        },
      ]}
      onSave={async (value, baseline) => {
        await onSave({
          code: value.code,
          description: value.description,
          brand: value.brand || "",
          category: value.category || "",
          unit: value.unit || "Unit",
          purchaseRate: Number(value.purchaseRate),
          itemRate: Number(value.itemRate),
          saleRate: Number(value.saleRate),
          stockQuantity: Number(value.stockQuantity) || 0,
          quantityToAdd: Number(value.quantityToAdd) || 0,
          location: value.location || "",
          ...(baseline ? { __baseline: baseline as Partial<Item> } : {}),
        });
        await loadAttributes();
      }}
      onCreateOption={addAttribute}
      onDelete={(index) => onDelete(rows[index].code)}
    />
  );
}

export function BanksTable({
  rows,
  accounts,
  onSave,
  onDelete,
}: {
  rows: Bank[];
  accounts: Account[];
  onSave: (value: Bank & { __baseline?: Partial<Bank> }) => Promise<void>;
  onDelete: (code: string) => Promise<void>;
}) {
  return (
    <MasterTable
      idKind="bank"
      title="Banks"
      createLabel="Add bank"
      columns={[
        "Code",
        "Bank name",
        "Account number",
        "Opening balance",
        "Ledger account",
        "",
      ]}
      rows={rows.map((row) => [
        row.code,
        row.name,
        row.accountNumber || "—",
        money(row.openingBalance),
        accounts.find((account) => account.code === row.ledgerAccountCode)
          ?.description ?? "Not linked",
      ])}
      records={rows.map((row) => ({
        ...row,
        openingBalance: String(row.openingBalance),
      }))}
      baselineRecords={rows}
      fields={[
        {
          key: "code",
          label: "Bank code",
          section: "Bank details",
          auto: true,
        },
        { key: "name", label: "Bank name", required: true },
        { key: "accountNumber", label: "Account number" },
        {
          key: "ledgerAccountCode",
          label: "Chart of Accounts ledger account",
          section: "Accounting link",
          type: "select",
          emptyHint:
            "Create the bank ledger account in Chart of Accounts, then return here.",
          options: [
            { value: "", label: "Not linked" },
            ...accounts.map((account) => ({
              value: account.code,
              label: `${account.description} — ${account.code}`,
            })),
          ],
        },
        {
          key: "openingBalance",
          label: "Opening balance",
          section: "Opening balance",
          type: "number",
        },
        { key: "address", label: "Address", section: "Contact details" },
        { key: "phone", label: "Phone" },
      ]}
      onSave={async (value, baseline) =>
        onSave({
          code: value.code,
          name: value.name,
          accountNumber: value.accountNumber,
          openingBalance: Number(value.openingBalance),
          address: value.address,
          phone: value.phone,
          ledgerAccountCode: value.ledgerAccountCode || "",
          ...(baseline ? { __baseline: baseline as Partial<Bank> } : {}),
        })
      }
      onDelete={(index) => onDelete(rows[index].code)}
    />
  );
}

type EditorField = {
  key: string;
  label: string;
  section?: string;
  type?: "text" | "number" | "select" | "location" | "persisted-select";
  optionKind?: "brand" | "category";
  auto?: boolean;
  required?: boolean;
  emptyHint?: string;
  helpText?: string;
  placeholder?: string;
  defaultValue?: string;
  locationOptions?: string[];
  options?: Array<{ value: string; label: string }> | string[];
};

type TreeRowControl = {
  code: string;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
  onToggle: () => void;
};

function nextAccountCode(parentCode: string, records: Array<Record<string, string>>) {
  const segmentLength = parentCode.length === 0 ? 1 : parentCode.length === 1 ? 1 : parentCode.length === 2 ? 2 : parentCode.length === 4 ? 4 : 2;
  const nextLength = parentCode.length + segmentLength;
  const siblings = records
    .filter((record) => (record.parentCode || "") === parentCode)
    .map((record) => record.code || "")
    .filter((code) => code.startsWith(parentCode) && code.length === nextLength)
    .map((code) => Number(code.slice(parentCode.length)))
    .filter(Number.isFinite);
  const next = Math.max(0, ...siblings) + 1;
  const suffix = String(next).padStart(segmentLength, "0");
  if (suffix.length > segmentLength || (parentCode.length === 0 && next > 9)) {
    throw new Error("No account codes remain at this level.");
  }
  return `${parentCode}${suffix}`;
}

export function MasterTable({
  idKind,
  title,
  createLabel,
  columns,
  rows,
  records,
  accountCodeRecords = records,
  baselineRecords,
  fields,
  onSave,
  onDelete,
  onCreateOption,
  treeRows,
  rowAction,
}: {
  idKind: "account" | "item" | "bank";
  title: string;
  createLabel: string;
  columns: string[];
  rows: string[][];
  records: Array<Record<string, string>>;
  accountCodeRecords?: Array<Record<string, string>>;
  baselineRecords: Array<Record<string, unknown>>;
  fields: EditorField[];
  onSave: (
    value: Record<string, string>,
    baseline?: Record<string, unknown>,
  ) => Promise<void>;
  onDelete: (index: number) => Promise<void>;
  onCreateOption?: (kind: "brand" | "category", value: string) => Promise<void>;
  treeRows?: TreeRowControl[];
  rowAction?: { label: string; onSelect: (index: number) => void };
}) {
  const [open, setOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState<
    Record<string, unknown> | undefined
  >();
  const [saving, setSaving] = useState(false);
  const [lastSelections, setLastSelections] = useState<Record<string, string>>({});
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const startCreate = async () => {
    try {
      setEditIndex(null);
      setBaseline(undefined);
      const initial = Object.fromEntries(
        fields.map((field) => [field.key, lastSelections[field.key] ?? field.defaultValue ?? ""]),
      );
      const idField = fields.find((field) => field.auto);
      if (idField) {
        initial[idField.key] = idKind === "account"
          ? nextAccountCode("", accountCodeRecords)
          : await window.office.ids.next(idKind);
      }
      setValues(initial);
      setOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not prepare a new record",
      );
    }
  };
  const startEdit = (index: number) => {
    setEditIndex(index);
    setBaseline(baselineRecords[index]);
    setValues({
      ...Object.fromEntries(
        fields.map((field) => [field.key, field.defaultValue ?? ""]),
      ),
      ...records[index],
    });
    setOpen(true);
  };
  const recordName = title.toLowerCase().replace(/s$/, "");
  const submit = async () => {
    setSaving(true);
    try {
      await onSave(values, baseline);
      if (editIndex === null) {
        const reusable = Object.fromEntries(fields.filter((field) => ["select", "persisted-select", "location"].includes(field.type ?? "")).map((field) => [field.key, values[field.key] ?? ""]));
        setLastSelections((current) => ({ ...current, ...reusable }));
      }
      toast.success(
        `${recordName[0].toUpperCase()}${recordName.slice(1)} ${editIndex === null ? "added" : "updated"}`,
      );
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Could not save ${recordName}`,
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>
              {rows.length} record{rows.length === 1 ? "" : "s"}
            </CardDescription>
          </div>
          <Button data-operator-new onClick={() => void startCreate()}>
            <Plus data-icon="inline-start" />
            {createLabel}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column, index) => (
                    <TableHead key={`${column}-${index}`}>{column}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={treeRows?.[index]?.code ?? row[0]}>
                    {row.map((cell, cellIndex) => (
                      <TableCell
                        key={cellIndex}
                        className={
                          cellIndex > 2 && cellIndex < row.length - 1
                            ? "tabular-nums"
                            : ""
                        }
                      >
                        {cellIndex === 1 && treeRows ? (
                          <div
                            className="flex items-center gap-1"
                            style={{
                              paddingLeft: `${treeRows[index].depth * 22}px`,
                            }}
                          >
                            {treeRows[index].depth > 0 && (
                              <CornerDownRight
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                            )}
                            {treeRows[index].hasChildren && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="size-7 shrink-0"
                                aria-label={`${treeRows[index].collapsed ? "Expand" : "Collapse"} ${cell}`}
                                aria-expanded={!treeRows[index].collapsed}
                                onClick={treeRows[index].onToggle}
                              >
                                {treeRows[index].collapsed ? (
                                  <ChevronRight />
                                ) : (
                                  <ChevronDown />
                                )}
                              </Button>
                            )}
                            {!treeRows[index].hasChildren &&
                              treeRows[index].depth === 0 && (
                                <span className="w-7 shrink-0" />
                              )}
                            {cell}
                          </div>
                        ) : (
                          cell
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="w-28 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        {rowAction && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => rowAction.onSelect(index)}
                          >
                            {rowAction.label}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(index)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${row[0]}`}
                          onClick={() => setDeleteIndex(index)}
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
                      colSpan={columns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No records yet. Use “{createLabel}” to add the first.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] w-[min(92vw,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle>
              {editIndex === null
                ? createLabel
                : `Edit ${title.toLowerCase().replace(/s$/, "")}`}
            </DialogTitle>
            <DialogDescription>
              Complete the fields below. Changes save to this computer’s office
              database.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="grid min-h-0 flex-1 content-start grid-cols-1 gap-x-5 gap-y-5 overflow-y-auto p-6 sm:grid-cols-2">
            {fields.map((field) => (
              <Fragment key={field.key}>
                {field.section && <FormSectionHeading title={field.section} />}
                {field.type === "persisted-select" ? (
                  <PersistentSelectField
                    label={field.label}
                    id={`editor-${field.key}`}
                    required={field.required}
                    value={values[field.key] ?? ""}
                    onChange={(value) =>
                      setValues((current) => ({
                        ...current,
                        [field.key]: value,
                      }))
                    }
                    options={(field.options as string[]) ?? []}
                    onAdd={async (value) => {
                      if (!field.optionKind || !onCreateOption) return;
                      await onCreateOption(field.optionKind, value);
                      toast.success(`${field.label} saved`);
                    }}
                  />
                ) : (
                  <UiField>
                    <FieldLabel
                      htmlFor={`editor-${field.key}`}
                      className={field.required ? "gap-0" : undefined}
                    >
                      {field.label}
                      {field.required && (
                        <span
                          aria-hidden="true"
                          className="ml-px text-destructive"
                        >
                          *
                        </span>
                      )}
                    </FieldLabel>
                    {field.type === "select" ? (
                      <FormSelect
                        id={`editor-${field.key}`}
                        value={values[field.key] ?? ""}
                        onChange={(value) => {
                          if (idKind === "account" && field.key === "parentCode" && editIndex === null) {
                            try {
                              setValues((current) => ({
                                ...current,
                                parentCode: value,
                                code: nextAccountCode(value, accountCodeRecords),
                              }));
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Could not generate account code");
                            }
                          } else {
                            setValues((current) => ({ ...current, [field.key]: value }));
                          }
                        }}
                        options={
                          (field.options as Array<{
                            value: string;
                            label: string;
                          }>) ?? []
                        }
                        emptyHint={field.emptyHint}
                        placeholder={
                          (
                            field.options as
                              | Array<{ value: string; label: string }>
                              | undefined
                          )?.find((option) => !option.value)?.label ??
                          `Select ${field.label.toLowerCase()}`
                        }
                      />
                    ) : field.type === "location" ? (
                      <div className="grid gap-1.5">
                        <Input
                          id={`editor-${field.key}`}
                          list={`editor-${field.key}-options`}
                          value={values[field.key] ?? ""}
                          placeholder={field.placeholder}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                        />
                        <datalist id={`editor-${field.key}-options`}>
                          {(field.locationOptions ?? []).map((place) => (
                            <option key={place} value={place} />
                          ))}
                        </datalist>
                        {field.helpText && (
                          <FieldDescription>{field.helpText}</FieldDescription>
                        )}
                      </div>
                    ) : (
                      <div className="grid gap-1.5">
                        <Input
                          id={`editor-${field.key}`}
                          type={field.type ?? "text"}
                          disabled={field.auto}
                          step={field.type === "number" ? "any" : undefined}
                          min={field.key === "quantityToAdd" ? "0" : undefined}
                          placeholder={field.placeholder}
                          value={values[field.key] ?? ""}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                        />
                        {field.helpText && (
                          <FieldDescription>{field.helpText}</FieldDescription>
                        )}
                      </div>
                    )}
                  </UiField>
                )}
              </Fragment>
            ))}
          </FieldGroup>
          <DialogFooter className="mt-0 border-t px-6 py-5 pb-6">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button data-operator-save onClick={() => void submit()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmActionDialog
        open={deleteIndex !== null}
        onOpenChange={(value) => {
          if (!value) setDeleteIndex(null);
        }}
        title={`Delete ${rows[deleteIndex ?? -1]?.[0] ?? "record"}?`}
        description="This action cannot be undone."
        onConfirm={() => {
          const target = deleteIndex;
          setDeleteIndex(null);
          if (target !== null)
            void onDelete(target).catch((error) =>
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not delete record",
              ),
            );
        }}
      />
    </>
  );
}
