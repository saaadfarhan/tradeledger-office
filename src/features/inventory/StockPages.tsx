import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { ConfirmActionDialog } from "@/components/feedback/ConfirmActionDialog";
import type { Item, OpeningBalance, StockMovement, StockType } from "@/types";
import { FormSectionHeading } from "@/components/forms/FormSectionHeading";
import { formatMoney as money } from "@/lib/formatters";
import { FormSelect, Field } from "@/components/forms/Fields";

export function LocationsPage({
  locations,
  movements,
  onSave,
  onDelete,
}: {
  locations: string[];
  movements: StockMovement[];
  onSave: (name: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const rows = locations.map((name) => {
    const activity = movements.filter((movement) => movement.location === name);
    return {
      name,
      movements: activity.length,
      items: new Set(activity.map((movement) => movement.itemCode)).size,
      balance: activity.reduce(
        (total, movement) => total + movement.quantity,
        0,
      ),
    };
  });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(name.trim());
      setName("");
      setEditorOpen(false);
      toast.success("Location added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add location",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Locations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add and manage the shared locations used by inventory and challan
            entries.
          </p>
        </div>
        <Button
          onClick={() => {
            setName("");
            setEditorOpen(true);
          }}
        >
          <Plus data-icon="inline-start" />
          Add location
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Locations</CardTitle>
          <CardDescription>
            {locations.length} saved location{locations.length === 1 ? "" : "s"}{" "}
            · locations with recorded activity cannot be deleted
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Movements</TableHead>
                  <TableHead className="text-right">Net quantity</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.items}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.movements}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.balance}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${row.name}`}
                        onClick={() =>
                          void onDelete(row.name)
                            .then(() => toast.success("Location deleted"))
                            .catch((error) =>
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : "Could not delete location",
                              ),
                            )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No locations yet. Add one to use it in office entries.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Sheet
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setName("");
        }}
      >
        <SheetContent
          side="right"
          className="flex data-[side=right]:w-[min(92vw,36rem)] flex-col gap-0 overflow-hidden p-0 data-[side=right]:sm:max-w-none"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Add location</SheetTitle>
            <SheetDescription>
              Saved locations become available in every location selector.
            </SheetDescription>
          </SheetHeader>
          <form
            onSubmit={(event) => void submit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <FieldGroup className="flex-1 content-start gap-4 overflow-y-auto p-6">
              <FormSectionHeading title="Location details" className="w-full" />
              <Field label="Location name" id="location-name">
                <Input
                  id="location-name"
                  required
                  maxLength={100}
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Main warehouse"
                />
              </Field>
            </FieldGroup>
            <SheetFooter className="mt-0 flex-row justify-end border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setName("");
                  setEditorOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !name.trim()}>
                <Plus data-icon="inline-start" />
                {saving ? "Saving…" : "Add location"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}

export function StockTypesPage({
  rows,
  onSave,
  onDelete,
}: {
  rows: StockType[];
  onSave: (value: StockType) => Promise<void>;
  onDelete: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteCode, setDeleteCode] = useState<string | null>(null);
  const reset = () => {
    setCode("");
    setDescription("");
    setEditing(false);
    setOpen(false);
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        code: code.trim().toUpperCase(),
        description: description.trim(),
      });
      reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save stock type",
      );
    } finally {
      setSaving(false);
    }
  }
  function edit(row: StockType) {
    setCode(row.code);
    setDescription(row.description);
    setEditing(true);
    setOpen(true);
  }
  function create() {
    setCode("");
    setDescription("");
    setEditing(false);
    setOpen(true);
  }
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Stock Types</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the classifications available in the Item master.
          </p>
        </div>
        <Button onClick={create}>
          <Plus data-icon="inline-start" />
          Add stock type
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Available stock types</CardTitle>
          <CardDescription>
            {rows.length} type{rows.length === 1 ? "" : "s"} · Built-in REG and
            SER types cannot be deleted.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.code}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => edit(row)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={["REG", "SER"].includes(row.code)}
                      onClick={() => setDeleteCode(row.code)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-20 text-center text-muted-foreground"
                  >
                    No stock types.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Sheet
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) reset();
        }}
      >
        <SheetContent
          side="right"
          className="flex data-[side=right]:w-[min(92vw,36rem)] flex-col gap-0 overflow-hidden p-0 data-[side=right]:sm:max-w-none"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>
              {editing ? `Edit ${code}` : "Add stock type"}
            </SheetTitle>
            <SheetDescription>
              Set the code and description used by item records.
            </SheetDescription>
          </SheetHeader>
          <form
            onSubmit={(event) => void submit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <FieldGroup className="flex-1 content-start overflow-y-auto p-6">
              <FormSectionHeading
                title="Stock type details"
                className="w-full"
              />
              <Field label="Stock type code" id="stock-type-code">
                <Input
                  id="stock-type-code"
                  required
                  maxLength={20}
                  disabled={editing}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                />
              </Field>
              <Field label="Description" id="stock-type-description">
                <Input
                  id="stock-type-description"
                  required
                  maxLength={100}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </Field>
            </FieldGroup>
            <SheetFooter className="mt-0 flex-row justify-end border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={reset}>
                Cancel
              </Button>
              <Button disabled={saving}>
                {saving
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Add stock type"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <ConfirmActionDialog
        open={deleteCode !== null}
        onOpenChange={(value) => {
          if (!value) setDeleteCode(null);
        }}
        title={`Delete stock type ${deleteCode ?? ""}?`}
        description="A type assigned to any item cannot be deleted."
        confirmLabel="Delete type"
        onConfirm={() => {
          const target = deleteCode;
          if (target)
            void onDelete(target)
              .then(() => toast.success("Stock type deleted"))
              .catch((error) =>
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Could not delete stock type",
                ),
              )
              .finally(() => setDeleteCode(null));
        }}
      />
    </section>
  );
}

export function OpeningBalancesPage({
  rows,
  items,
  locations,
  onAdd,
}: {
  rows: OpeningBalance[];
  items: Item[];
  locations: string[];
  onAdd: (value: {
    itemCode: string;
    location: string;
    quantity: number;
  }) => Promise<void>;
}) {
  const [itemCode, setItemCode] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const selectedItem = items.find((item) => item.code === itemCode);
  useEffect(() => {
    if (location && !locations.includes(location)) setLocation("");
  }, [location, locations]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onAdd({ itemCode, location, quantity: Number(quantity) });
      setQuantity("");
      setItemCode("");
      setEditorOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not add opening balance",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Item Opening Balances
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record starting stock as an auditable inventory movement.
          </p>
        </div>
        <Button onClick={() => setEditorOpen(true)} disabled={!items.length}>
          <Plus data-icon="inline-start" />
          Add opening balance
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Recorded opening movements
          </CardTitle>
          <CardDescription>
            {rows.length} entry{rows.length === 1 ? "" : "ies"} · each saved
            entry contributes to location stock
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>
                    {row.itemCode} — {row.itemDescription ?? "Unknown item"}
                  </TableCell>
                  <TableCell>{row.location}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(row.rate)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(row.amount)}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-20 text-center text-muted-foreground"
                  >
                    No opening balances recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent
          side="right"
          className="flex data-[side=right]:w-[min(92vw,38rem)] flex-col gap-0 overflow-hidden p-0 data-[side=right]:sm:max-w-none"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Add opening stock</SheetTitle>
            <SheetDescription>
              Rate is automatically taken from the selected item’s current
              purchase rate. Quantity must be positive.
            </SheetDescription>
          </SheetHeader>
          <form
            onSubmit={(event) => void submit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <FieldGroup className="min-h-0 flex-1 content-start overflow-y-auto p-6">
              <FormSectionHeading
                title="Item and location"
                className="w-full"
              />
              <Field label="Item" id="opening-item" required>
                <FormSelect
                  id="opening-item"
                  value={itemCode}
                  onChange={setItemCode}
                  placeholder="Select an item"
                  emptyHint="Add the product first on the Items page, then return here."
                  options={items.map((item) => ({
                    value: item.code,
                    label: `${item.code} — ${item.description}`,
                  }))}
                />
              </Field>
              <Field label="Location" id="opening-location" required>
                <FormSelect
                  id="opening-location"
                  value={location}
                  onChange={setLocation}
                  placeholder="Select a location"
                  emptyHint="Add a location on the Locations page, then return here."
                  options={locations.map((place) => ({
                    value: place,
                    label: place,
                  }))}
                />
              </Field>
              <FormSectionHeading
                title="Opening quantity and value"
                className="w-full"
              />
              <Field label="Opening quantity" id="opening-quantity">
                <Input
                  id="opening-quantity"
                  type="number"
                  min="0.000001"
                  step="any"
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </Field>
              <Field label="Opening rate" id="opening-rate">
                <Input
                  id="opening-rate"
                  disabled
                  value={selectedItem ? money(selectedItem.purchaseRate) : ""}
                  placeholder="Selected item rate"
                />
              </Field>
            </FieldGroup>
            <SheetFooter className="mt-0 flex-row justify-end border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditorOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !items.length || !itemCode || !location}
              >
                {saving ? "Saving…" : "Save opening balance"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}

export function TransferPage({
  items,
  locations,
  movements,
  onTransfer,
}: {
  items: Item[];
  locations: string[];
  movements: StockMovement[];
  onTransfer: (value: {
    itemCode: string;
    fromLocation: string;
    toLocation: string;
    quantity: number;
  }) => Promise<void>;
}) {
  const [itemCode, setItemCode] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [available, setAvailable] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  useEffect(() => {
    let active = true;
    if (itemCode && fromLocation)
      void window.office.stock
        .quantity(itemCode, fromLocation)
        .then((value) => {
          if (active) setAvailable(value);
        })
        .catch(() => {
          if (active) setAvailable(null);
        });
    else setAvailable(null);
    return () => {
      active = false;
    };
  }, [itemCode, fromLocation]);
  const transferRows = movements.filter((movement) =>
    movement.type.startsWith("TRANSFER"),
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await onTransfer({
        itemCode,
        fromLocation,
        toLocation,
        quantity: Number(quantity),
      });
      setQuantity("");
      setItemCode("");
      setFromLocation("");
      setToLocation("");
      setEditorOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not transfer stock",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Transfer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Move available quantity between locations without changing total
            office stock.
          </p>
        </div>
        <Button
          onClick={() => setEditorOpen(true)}
          disabled={!items.length || locations.length < 2}
        >
          <Plus data-icon="inline-start" />
          Transfer stock
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent transfer movements</CardTitle>
          <CardDescription>
            Each transfer appears as one outbound and one inbound stock
            movement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Transfer ID</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Movement</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transferRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.document}</TableCell>
                    <TableCell>{row.itemCode}</TableCell>
                    <TableCell>{row.location}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.quantity}
                    </TableCell>
                  </TableRow>
                ))}
                {!transferRows.length && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-20 text-center text-muted-foreground"
                    >
                      No transfers have been recorded.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent
          side="right"
          className="flex data-[side=right]:w-[min(92vw,38rem)] flex-col gap-0 overflow-hidden p-0 data-[side=right]:sm:max-w-none"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>Transfer item stock</SheetTitle>
            <SheetDescription>
              Both location movements save together. The destination must differ
              from the source.
            </SheetDescription>
          </SheetHeader>
          <form
            onSubmit={(event) => void submit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <FieldGroup className="min-h-0 flex-1 content-start gap-4 overflow-y-auto p-6">
              <FormSectionHeading title="Item" className="w-full" />
              <Field label="Item" id="transfer-item" required>
                <FormSelect
                  id="transfer-item"
                  value={itemCode}
                  onChange={setItemCode}
                  placeholder="Select an item"
                  emptyHint="Add the product first on the Items page, then return here."
                  options={items.map((item) => ({
                    value: item.code,
                    label: `${item.code} — ${item.description}`,
                  }))}
                />
              </Field>
              <FormSectionHeading title="Transfer route" className="w-full" />
              <Field label="From location" id="transfer-from" required>
                <FormSelect
                  id="transfer-from"
                  value={fromLocation}
                  onChange={setFromLocation}
                  placeholder="Select source"
                  emptyHint="Add locations on the Locations page, then return here."
                  options={locations.map((place) => ({
                    value: place,
                    label: place,
                  }))}
                />
              </Field>
              <Field label="To location" id="transfer-to" required>
                <FormSelect
                  id="transfer-to"
                  value={toLocation}
                  onChange={setToLocation}
                  placeholder="Select destination"
                  options={locations
                    .filter((place) => place !== fromLocation)
                    .map((place) => ({ value: place, label: place }))}
                />
              </Field>
              <FormSectionHeading title="Quantity" className="w-full" />
              <Field label="Quantity" id="transfer-quantity">
                <Input
                  id="transfer-quantity"
                  type="number"
                  min="0.000001"
                  step="any"
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </Field>
              <p className="text-sm text-muted-foreground">
                Available at source:{" "}
                <strong className="text-foreground tabular-nums">
                  {available === null ? "Select item and location" : available}
                </strong>
              </p>
            </FieldGroup>
            <SheetFooter className="mt-0 flex-row justify-end border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditorOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  saving ||
                  !itemCode ||
                  !fromLocation ||
                  !toLocation ||
                  fromLocation === toLocation ||
                  !quantity
                }
              >
                {saving ? "Transferring…" : "Transfer stock"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}
