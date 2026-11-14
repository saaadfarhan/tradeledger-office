import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
  FieldGroup,
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
import type {
  Item,
  ItemAttributes,
  OpeningBalance,
  StockMovement,
} from "@/types";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  formatMoney as money,
  todayIsoDate as today,
} from "@/lib/formatters";
import { ConfirmActionDialog } from "@/components/feedback/ConfirmActionDialog";
import { FormSectionHeading } from "@/components/forms/FormSectionHeading";
import { DatePicker } from "@/components/forms/DatePicker";
import {
  FormSelect,
  Field,
  PersistentSelectField,
  SearchableItemSelect,
} from "@/components/forms/Fields";

export function LocationsPage({
  locations,
  movements,
  onSave,
  onDelete,
}: {
  locations: string[];
  movements: StockMovement[];
  onSave: (name: string, originalName?: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
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
      await onSave(name.trim(), editingName ?? undefined);
      setName("");
      setEditingName(null);
      setEditorOpen(false);
      toast.success(editingName ? "Location updated" : "Location added");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Could not ${editingName ? "update" : "add"} location`,
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="flex flex-col gap-4">
      <PageHeader title="Locations" description="Add and manage the locations used by inventory and challan entries." actions={<Button data-operator-new title="Add location (Ctrl+N)"
          onClick={() => {
            setName("");
            setEditingName(null);
            setEditorOpen(true);
          }}
        >
          <Plus data-icon="inline-start" />
          Add location
        </Button>} />
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
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${row.name}`}
                          onClick={() => {
                            setName(row.name);
                            setEditingName(row.name);
                            setEditorOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
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
                      </div>
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
      <Dialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setName("");
            setEditingName(null);
          }
        }}
      >
        <DialogContent
          className="flex max-h-[90vh] w-[min(92vw,56rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        >
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle>
              {editingName ? "Edit location" : "Add location"}
            </DialogTitle>
            <DialogDescription>
              Saved locations become available in every location selector.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => void submit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <FieldGroup className="flex-1 content-start gap-4 overflow-y-auto p-6">
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
            <DialogFooter className="mt-0 flex-row justify-end border-t px-6 py-5 pb-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setName("");
                  setEditingName(null);
                  setEditorOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button data-operator-save title={`${editingName ? "Save location" : "Add location"} (Ctrl+S)`} type="submit" disabled={saving || !name.trim()}>
                {editingName ? <Pencil data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
                {saving ? "Saving…" : editingName ? "Save changes" : "Add location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function OpeningBalancesPage({
  rows,
  items,
  locations,
  onAdd,
  onUpdate,
  onDelete,
}: {
  rows: OpeningBalance[];
  items: Item[];
  locations: string[];
  onAdd: (value: {
    itemCode: string;
    location: string;
    quantity: number;
    date: string;
    rate: number;
    brand: string;
    category: string;
  }) => Promise<void>;
  onUpdate: (value: {
    id: number;
    itemCode: string;
    location: string;
    quantity: number;
    date: string;
    rate: number;
    brand: string;
    category: string;
  }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [itemCode, setItemCode] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [date, setDate] = useState(today());
  const [rate, setRate] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [editingOpeningId, setEditingOpeningId] = useState<number | null>(null);
  const [deleteOpeningId, setDeleteOpeningId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [itemAttributes, setItemAttributes] = useState<ItemAttributes>({
    brands: [],
    categories: [],
  });
  useEffect(() => { if (!editorOpen) return; const frame = window.requestAnimationFrame(() => document.getElementById("opening-item")?.focus()); return () => window.cancelAnimationFrame(frame); }, [editorOpen]);
  useEffect(() => {
    let active = true;
    const loadAttributes = () => {
      void window.office.items
        .attributes()
        .then((attributes) => {
          if (active) setItemAttributes(attributes);
        })
        .catch((error) => {
          if (active) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not load item attributes",
            );
          }
        });
    };
    loadAttributes();
    const unsubscribe = window.office.sync.onDataChanged(loadAttributes);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  async function addItemAttribute(kind: "brand" | "category", value: string) {
    setItemAttributes(await window.office.items.addAttribute({ kind, value }));
    toast.success(`${kind === "brand" ? "Brand" : "Category"} saved`);
  }
  useEffect(() => {
    if (location && !locations.includes(location)) setLocation("");
  }, [location, locations]);
  function resetEditor() {
    setEditingOpeningId(null);
    setItemCode("");
    setLocation("");
    setQuantity("");
    setDate(today());
    setRate("");
    setBrand("");
    setCategory("");
  }
  function beginEdit(row: OpeningBalance) {
    setEditingOpeningId(row.id);
    setItemCode(row.itemCode);
    setLocation(row.location);
    setQuantity(String(row.quantity));
    setDate(row.date);
    setRate(String(Math.round(row.rate)));
    const item = items.find((candidate) => candidate.code === row.itemCode);
    setBrand(item?.brand ?? "");
    setCategory(item?.category ?? "");
    setEditorOpen(true);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const value = {
        itemCode,
        location,
        quantity: Number(quantity),
        date,
        rate: Number(rate),
        brand,
        category,
      };
      if (editingOpeningId !== null) {
        await onUpdate({ ...value, id: editingOpeningId });
        toast.success("Opening balance updated");
      } else {
        await onAdd(value);
      }
      resetEditor();
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
      <PageHeader title="Item Opening Balances" description="Record starting stock as an auditable inventory movement." actions={      <Button data-operator-new title="Add opening balance (Ctrl+N)" onClick={() => {
        resetEditor();
        setEditorOpen(true);
      }} disabled={!items.length}>
          <Plus data-icon="inline-start" />
          Add opening balance
        </Button>} />
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
                <TableHead className="w-24" />
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
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit opening balance ${row.id}`}
                        onClick={() => beginEdit(row)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete opening balance ${row.id}`}
                        onClick={() => setDeleteOpeningId(row.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
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
      <Dialog open={editorOpen} onOpenChange={(open) => {
        setEditorOpen(open);
        if (!open) resetEditor();
      }}>
        <DialogContent
          className="flex max-h-[90vh] w-[min(92vw,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        >
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle>
              {editingOpeningId === null
                ? "Add opening stock"
                : "Edit opening stock"}
            </DialogTitle>
            <DialogDescription>
              {editingOpeningId === null
                ? "Rate is automatically taken from the selected item’s current purchase rate. Quantity must be positive."
                : "Update the opening movement. Changes cannot reduce stock below zero."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => void submit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <FieldGroup className="grid min-h-0 flex-1 content-start grid-cols-1 gap-4 overflow-y-auto p-6 sm:grid-cols-2">
                <FormSectionHeading title="Item details" />
                <Field label="Item" id="opening-item" required>
                  <SearchableItemSelect
                    id="opening-item"
                    value={itemCode}
                    onChange={(value) => {
                      const item = items.find(
                        (candidate) => candidate.code === value,
                      );
                      setItemCode(value);
                      setBrand(item?.brand ?? "");
                      setCategory(item?.category ?? "");
                      setRate(
                        item ? String(Math.round(item.purchaseRate)) : "",
                      );
                    }}
                    items={items}
                    placeholder="Select an item"
                    emptyHint="Add the product first on the Items page, then return here."
                  />
                </Field>
                <Field label="Location" id="opening-location" required>
                  <FormSelect
                    id="opening-location"
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
                <PersistentSelectField
                  label="Brand"
                  id="opening-brand"
                  value={brand}
                  onChange={setBrand}
                  options={itemAttributes.brands}
                  onAdd={(value) => addItemAttribute("brand", value)}
                  required={false}
                  searchable
                />
                <PersistentSelectField
                  label="Category"
                  id="opening-category"
                  value={category}
                  onChange={setCategory}
                  options={itemAttributes.categories}
                  onAdd={(value) => addItemAttribute("category", value)}
                  required={false}
                  searchable
                />
                <FormSectionHeading title="Opening balance details" />
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
                <Field label="Date" id="opening-date">
                  <DatePicker
                    id="opening-date"
                    value={date}
                    onChange={setDate}
                    required
                  />
                </Field>
                <Field label="Opening rate" id="opening-rate">
                  <Input
                    id="opening-rate"
                    type="number"
                    min="0"
                    step="1"
                    disabled={editingOpeningId === null}
                    required
                    value={rate}
                    onChange={(event) => setRate(event.target.value)}
                    placeholder="Selected item rate"
                  />
                </Field>
            </FieldGroup>
            <DialogFooter className="mt-0 flex-row justify-end border-t px-6 py-5 pb-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetEditor();
                  setEditorOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button data-operator-save title="Save opening balance (Ctrl+S)"
                type="submit"
                disabled={saving || !items.length || !itemCode || !location || !date || rate === ""}
              >
                {saving
                  ? "Saving…"
                  : editingOpeningId === null
                    ? "Save opening balance"
                    : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmActionDialog
        open={deleteOpeningId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteOpeningId(null);
        }}
        title="Delete opening balance?"
        description="This removes the opening stock movement. The deletion is blocked if later stock activity would make the balance negative."
        confirmLabel="Delete opening balance"
        onConfirm={() => {
          const target = deleteOpeningId;
          if (target === null) return;
          void onDelete(target)
            .then(() => toast.success("Opening balance deleted"))
            .catch((error) =>
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Could not delete opening balance",
              ),
            )
            .finally(() => setDeleteOpeningId(null));
        }}
      />
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
  const [destinationAvailable, setDestinationAvailable] = useState<
    number | null
  >(null);
  const [destinationLoading, setDestinationLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  useEffect(() => { if (!editorOpen) return; const frame = window.requestAnimationFrame(() => document.getElementById("transfer-item")?.focus()); return () => window.cancelAnimationFrame(frame); }, [editorOpen]);
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
  useEffect(() => {
    let active = true;
    if (itemCode && toLocation) {
      setDestinationLoading(true);
      void window.office.stock
        .quantity(itemCode, toLocation)
        .then((value) => {
          if (active) setDestinationAvailable(value);
        })
        .catch((error) => {
          if (active) {
            setDestinationAvailable(null);
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not load destination stock",
            );
          }
        })
        .finally(() => {
          if (active) setDestinationLoading(false);
        });
    } else {
      setDestinationAvailable(null);
      setDestinationLoading(false);
    }
    return () => {
      active = false;
    };
  }, [itemCode, toLocation]);
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
      <PageHeader title="Stock Transfer" description="Move available quantity between locations without changing total office stock." actions={<Button data-operator-new title="Transfer stock (Ctrl+N)"
          onClick={() => setEditorOpen(true)}
          disabled={!items.length || locations.length < 2}
        >
          <Plus data-icon="inline-start" />
          Transfer stock
        </Button>} />
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
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent
          className="flex max-h-[90vh] w-[min(92vw,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        >
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle>Transfer item stock</DialogTitle>
            <DialogDescription>
              Both location movements save together. The destination must differ
              from the source.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => void submit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <FieldGroup className="min-h-0 flex-1 content-start gap-4 overflow-y-auto p-6">
              <Field label="Item" id="transfer-item" required>
                <SearchableItemSelect
                  id="transfer-item"
                  value={itemCode}
                  onChange={setItemCode}
                  items={items}
                  placeholder="Select an item"
                  emptyHint="Add the product first on the Items page, then return here."
                />
              </Field>
              <Field label="From location" id="transfer-from" required>
                <FormSelect
                  id="transfer-from"
                  value={fromLocation}
                  onChange={(value) => {
                    setFromLocation(value);
                    if (toLocation === value) setToLocation("");
                  }}
                  searchable
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
                  searchable
                  placeholder="Select destination"
                  options={locations
                    .filter((place) => place !== fromLocation)
                    .map((place) => ({ value: place, label: place }))}
                />
              </Field>
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
              <p className="text-sm text-muted-foreground">
                Available at destination:{" "}
                <strong className="text-foreground tabular-nums">
                  {destinationLoading
                    ? "Loading…"
                    : destinationAvailable === null
                      ? "Select item and destination"
                      : destinationAvailable}
                </strong>
              </p>
            </FieldGroup>
            <DialogFooter className="mt-0 flex-row justify-end border-t px-6 py-5 pb-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditorOpen(false)}
              >
                Cancel
              </Button>
              <Button data-operator-save title="Transfer stock (Ctrl+S)"
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
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
