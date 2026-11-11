import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  readTablePageSize,
  saveTablePageSize,
  TABLE_PAGE_SIZE_OPTIONS,
} from "@/lib/preferences";
import { APP_KEYBINDINGS } from "@/lib/app-keybindings";
import { Field } from "@/components/forms/Fields";
import { PageHeader } from "@/components/layout/PageHeader";
import { Kbd } from "@/components/ui/kbd";

export function SettingsPage({
  darkMode,
  onThemeChange,
}: {
  darkMode: boolean;
  onThemeChange: (dark: boolean) => void;
}) {
  const [pageSize, setPageSize] = useState(readTablePageSize);
  const updatePageSize = (value: string) => {
    const next = Number(value);
    if (
      !TABLE_PAGE_SIZE_OPTIONS.includes(
        next as (typeof TABLE_PAGE_SIZE_OPTIONS)[number],
      )
    )
      return;
    setPageSize(next);
    saveTablePageSize(next);
  };
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <PageHeader title="Settings" description="Preferences for this computer and signed-in account. These do not change office records." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance and tables</CardTitle>
          <CardDescription>
            Preferences are saved on this computer and applied throughout the
            app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-6">
            <Field label="Color theme" id="settings-theme">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  id="settings-theme"
                  type="button"
                  variant="outline"
                  aria-pressed={darkMode}
                  onClick={() => onThemeChange(!darkMode)}
                >
                  {darkMode ? (
                    <Sun data-icon="inline-start" />
                  ) : (
                    <Moon data-icon="inline-start" />
                  )}
                  {darkMode ? "Use light theme" : "Use dark theme"}
                </Button>
                <span className="text-sm text-muted-foreground">
                  Current theme: {darkMode ? "Dark" : "Light"}
                </span>
              </div>
            </Field>
            <Field label="Items per table page" id="settings-page-size">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  if (value) updatePageSize(value);
                }}
              >
                <SelectTrigger
                  id="settings-page-size"
                  className="h-9 w-full max-w-xs"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} rows
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Applies to shared table search and pagination. Default: 25 rows.
              </p>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </section>
  );
}

export function ManualPage() {
  const steps =
    "list-decimal space-y-2 pl-5 marker:font-medium marker:text-foreground";
  const note =
    "rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground";
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <PageHeader title="User Manual" description="Guidance for common office workflows, record entry, and reports." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Set up the office</CardTitle>
          <CardDescription>
            Complete these steps once for your company.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className={steps}>
            <li>
              On first launch, create an administrator account with a unique
              username and a password of at least eight characters.
            </li>
            <li>
              Enter your company name, address, phone, and fiscal year. Set an
              administrator password of at least 12 characters that differs from
              your sign-in password. A logo is optional.
            </li>
            <li>
              Use the administrator password to open{" "}
              <strong>User Rights</strong> or <strong>Database Tools</strong>.
              Access locks again after ten minutes. In{" "}
              <strong>User Rights</strong>, create an account for each operator
              and grant only the pages they need. Keep at least one
              administrator account.
            </li>
            <li>
              Use the toolbar’s Home button to return to the overview. Press{" "}
              <Kbd>Ctrl+K</Kbd> to find
              a page or command.
            </li>
          </ol>
          <p className={note}>
            The app assigns record IDs. Review each ID when saving and edit the
            record if you need to correct it.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            2. Prepare accounts and inventory
          </CardTitle>
          <CardDescription>
            Create the records that selectors and transactions depend on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className={steps}>
            <li>
              In <strong>Chart of Accounts</strong>, create parent accounts
              before child accounts. Add a “Party” account and customer/supplier
              accounts beneath it if you need those parties in transaction
              forms. “Cash in Hand” is offered as a cash account.
            </li>
            <li>
              Open <strong>Items</strong> and add each item with its brand,
              category, purchase rate, and sale rate.
            </li>
            <li>
              To enter starting inventory, choose <strong>Add item</strong> and
              fill in <strong>Quantity to add</strong> and{" "}
              <strong>Location</strong> in the same form. When editing an item,
              enter another quantity to add or leave it at 0 to keep stock
              unchanged. The added quantity appears in the table and inventory
              movement history. You can also use{" "}
              <strong>Item Opening Balances</strong>.
            </li>
            <li>
              Create bank records in <strong>Banks</strong> before entering
              cheques, and link each bank to its Chart of Accounts ledger
              account there.
            </li>
          </ol>
          <p className={note}>
            Opening quantity uses the item’s current purchase rate for
            valuation. Referenced accounts and items may be blocked from
            deletion while dependent records exist.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            3. Record purchases, sales, and transfers
          </CardTitle>
          <CardDescription>
            These workflows change inventory quantities by location.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className={steps}>
            <li>
              Open <strong>Purchase Challans</strong> or{" "}
              <strong>Sale Challans</strong>, then choose{" "}
              <strong>New challan</strong>.
            </li>
            <li>
              Check the generated number, date, party, and location. Add each
              item and enter a positive quantity. The app fills rates from the
              item record.
            </li>
            <li>
              Review the lines and total, then save. Purchases add stock at the
              selected location; sales subtract it. A sale that would exceed
              available stock is rejected.
            </li>
            <li>
              For location-to-location movement, open <strong>Transfer</strong>,
              choose the item and two different locations, enter a positive
              quantity, then save. The source must have enough stock.
            </li>
            <li>
              Use Edit to correct a saved challan and Delete only when you
              intend to remove it permanently. The app may refuse an edit or
              deletion if the resulting stock would be negative.
            </li>
          </ol>
          <p className={note}>
            Changing an item’s purchase or sale rate can affect rates when an
            old challan is edited. Check the recalculated total before saving.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            4. Record money and cheques
          </CardTitle>
          <CardDescription>
            These records do not automatically settle a specific challan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className={steps}>
            <li>
              Use <strong>Journal Voucher</strong> for a double-entry record. Add at least two account lines; each
              line has a debit or credit, and total debits must equal total
              credits.
            </li>
            <li>
              Use <strong>Payment / Receipt</strong> for a cash or bank movement
              between an account and a party. Choose the party and cash/bank
              account, enter the date and amount, review, then save.
            </li>
            <li>
              Use the search and filters on <strong>Payment / Receipt</strong> to find saved entries. Use global search when looking across different record types.
            </li>
            <li>
              In <strong>Cheque Detail</strong>, choose a bank and party, then
              enter the cheque date, amount, status, and optional check number.
              For a cleared cheque, also choose its payment/receipt direction,
              cleared date, and bank ledger account. The cleared cheque posts a
              balanced entry to financial reports; editing or deleting it
              updates those reports.
            </li>
          </ol>
          <p className={note}>
            Payments are not allocated to individual invoices, and challans do
            not automatically create vouchers. Account balances and some
            financial reports therefore need office reconciliation before they
            can be treated as official.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            5. Review, print, and correct records
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className={steps}>
            <li>
              Open <strong>Reports</strong> and select a report. Apply its date
              or text filters; use CSV export or print when available.
            </li>
            <li>
              Use the print action on a challan or voucher to review the
              document layout before printing.
            </li>
            <li>
              Open <strong>Audit Log</strong> to review recent sign-ins and
              saves, updates, deletions, and postings. It records activity but
              does not restore old values.
            </li>
            <li>
              If an edit says another user changed the record, close or cancel
              the editor, reopen the latest record, and reapply your intended
              change.
            </li>
          </ol>
          <p className={note}>
            Receivable, Payable, Aging, Balance Sheet, Profit &amp; Loss, and
            profitability reports have known limits: invoice allocations, due
            dates, account classifications, or automatic challan accounting
            entries are not fully captured. Verify report meaning and totals
            against authorized office records.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            6. Work with another computer and protect data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className={steps}>
            <li>
              For shared use, choose one trusted office PC as host. Sign in as
              administrator, open <strong>Database Tools</strong>, and start the
              shared office server.
            </li>
            <li>
              In User Rights, issue a device credential for each operator
              device. Share its JSON file and one-time passphrase separately.
              Import the credential on the client, then configure the HTTPS
              address and SHA-256 server fingerprint. Each operator signs in
              with their own account.
            </li>
            <li>
              Keep the host powered on, signed in, and connected. A host
              shutdown, quit, crash, or network loss disconnects clients. Do not
              keep separate editable database copies; there is no offline merge.
            </li>
            <li>
              In Database Tools, create a backup regularly and copy it to
              separate protected storage. Export office data creates readable
              JSON, not a restorable backup. Verify checks database integrity
              but does not repair problems.
            </li>
          </ol>
          <p className={note}>
            Keep the server on a trusted private network or approved VPN. Do not
            expose it to the public internet. The app does not encrypt the live
            database file; protect the host account and enable device
            encryption. This is a pilot and is not validated for official
            accounting.
          </p>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Navigation: Back/Forward follows pages visited this session;{" "}
        <Kbd>Alt+←</Kbd> and <Kbd>Alt+→</Kbd> do the same.
        Theme and table-size settings are local to this computer.
      </p>
    </section>
  );
}

export function KeybindingsPage() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <PageHeader title="Keyboard shortcuts" description="Use keyboard commands to move around and complete common tasks. On macOS, Ctrl means Command." />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Application and editing shortcuts
          </CardTitle>
          <CardDescription>
            Shortcuts for navigation, search, record entry, display, and common
            text editing. Search, new, and save controls also show their
            shortcuts in tooltips.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {APP_KEYBINDINGS.map(({ keys, action, description }) => (
            <div
              key={action}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <span className="text-sm">{description}</span>
              <Kbd className="h-6 px-2 font-mono text-foreground">
                {keys}
              </Kbd>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="text-sm">Add a line in challan, voucher, or journal voucher editors</span>
            <Kbd className="h-6 px-2 font-mono text-foreground">Alt+Enter</Kbd>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Ctrl+K opens navigation commands. Ctrl+Shift+F opens global record
        search; Ctrl+F focuses the current page’s search. Ctrl+N and Ctrl+S
        activate marked create and save controls. Esc closes the active dialog
        or panel when allowed. F5 refreshes office data, while Ctrl+R reloads
        the application. Right-click for additional navigation actions.
      </p>
    </section>
  );
}
