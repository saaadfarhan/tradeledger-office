import { useEffect, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Building2,
  Package,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CompanyProfile, Dashboard } from "@/types";
import { karachiGreeting } from "@/lib/karachi-time";
import type { Page } from "@/app/navigation";
import { formatMoney as money } from "@/lib/formatters";

export function DashboardPage({
  dashboard,
  onNavigate,
  allowedPages,
  username,
  company,
  logo,
}: {
  dashboard: Dashboard | null;
  onNavigate: (page: Page) => void;
  allowedPages: Page[];
  username: string;
  company: CompanyProfile | null;
  logo: string | null;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const greeting = karachiGreeting(now);
  const karachiDate = new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  const karachiTime = new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  const stats = [
    {
      label: "Purchases today",
      value:
        dashboard?.counts.purchasesToday == null
          ? "—"
          : money(dashboard.counts.purchasesToday),
      icon: ArrowDownToLine,
    },
    {
      label: "Sales today",
      value:
        dashboard?.counts.salesToday == null
          ? "—"
          : money(dashboard.counts.salesToday),
      icon: ArrowUpFromLine,
    },
    {
      label: "Accounts",
      value: dashboard?.counts.accounts ?? "—",
      icon: Building2,
    },
    { label: "Items", value: dashboard?.counts.items ?? "—", icon: Package },
  ];
  return (
    <section className="flex flex-col gap-4">
      <section className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {karachiDate} · {karachiTime} PKT
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">
            {greeting}, {username}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here is the current activity in your office.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-5 gap-y-2">
          <CompanyBusinessCard company={company} logo={logo} />
          <Badge variant="secondary" className="gap-1.5">
            <Activity className="size-3.5" /> Offline-ready
          </Badge>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1.5 text-xl font-semibold tabular-nums">
                  {value}
                </p>
              </div>
              <div className="grid size-8 place-items-center rounded-md border bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
      {dashboard?.canSeeRecent && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Brand performance</CardTitle>
                <CardDescription className="mt-1">
                  Today’s purchase and sale totals grouped by item brand.
                </CardDescription>
              </div>
              <Badge variant="outline">{dashboard.brandTotals?.length ?? 0} brands</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Brand</TableHead><TableHead className="text-right">Purchases</TableHead><TableHead className="text-right">Sales</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(dashboard.brandTotals ?? []).map((row) => <TableRow key={row.brand}><TableCell className="font-medium">{row.brand}</TableCell><TableCell className="text-right tabular-nums">{row.purchases == null ? "—" : money(row.purchases)}</TableCell><TableCell className="text-right tabular-nums">{row.sales == null ? "—" : money(row.sales)}</TableCell></TableRow>)}
                  {!dashboard.brandTotals?.length && <TableRow><TableCell colSpan={3} className="h-20 text-center text-muted-foreground">No purchases or sales recorded today.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      {dashboard?.canSeeRecent && (
        <section className="grid gap-3 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent challans</CardTitle>
              <CardDescription>
                Latest purchase and sale documents recorded here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Party</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dashboard?.recent ?? []).map((row) => (
                      <TableRow key={row.number}>
                        <TableCell>
                          <div className="font-medium">{row.number}</div>
                          <div className="text-xs text-muted-foreground">
                            {row.type}
                          </div>
                        </TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.party}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(row.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!dashboard?.recent.length && (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No challans recorded yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
              <CardDescription>Start a common office task.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {[
                {
                  page: "purchase" as const,
                  label: "New purchase challan",
                  icon: ArrowDownToLine,
                },
                {
                  page: "sale" as const,
                  label: "New sale challan",
                  icon: ArrowUpFromLine,
                },
                {
                  page: "accounts" as const,
                  label: "Manage accounts",
                  icon: Building2,
                },
                {
                  page: "items" as const,
                  label: "Manage items",
                  icon: Package,
                },
              ]
                .filter(({ page }) => allowedPages.includes(page))
                .map(({ page, label, icon: Icon }) => (
                  <Button
                    key={page}
                    variant="outline"
                    className="justify-start"
                    onClick={() => onNavigate(page)}
                  >
                    <Icon className="mr-2 size-4" />
                    {label}
                  </Button>
                ))}
            </CardContent>
          </Card>
        </section>
      )}
      {dashboard?.stockQuantity != null && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium">Stock position</p>
              <p className="text-sm text-muted-foreground">
                Net available units across recorded locations
              </p>
            </div>
            <p className="text-xl font-semibold tabular-nums">
              {money(dashboard.stockQuantity)}
            </p>
          </CardContent>
        </Card>
      )}
      {dashboard &&
        [
          { page: "accounts" as const, label: "Create your account structure", count: dashboard.counts.accounts },
          { page: "items" as const, label: "Add the items you handle", count: dashboard.counts.items },
          { page: "banks" as const, label: "Add a bank (if used)", count: dashboard.counts.banks },
        ].some((task) => task.count === 0 && allowedPages.includes(task.page)) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Getting started</CardTitle>
              <CardDescription>Optional setup for this office database.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {[
                { page: "accounts" as const, label: "Create your account structure", count: dashboard.counts.accounts },
                { page: "items" as const, label: "Add the items you handle", count: dashboard.counts.items },
                { page: "banks" as const, label: "Add a bank (if used)", count: dashboard.counts.banks },
              ].filter((task) => task.count === 0 && allowedPages.includes(task.page)).map((task) => (
                <Button key={task.page} variant="outline" onClick={() => onNavigate(task.page)}>{task.label}</Button>
              ))}
            </CardContent>
          </Card>
        )}
    </section>
  );
}

export function CompanyBusinessCard({
  company,
  logo,
}: {
  company: CompanyProfile | null;
  logo: string | null;
}) {
  const name = company?.name.trim() || "Company profile not set up";
  const details = [
    ["Address", company?.address.trim()],
    ["Phone", company?.phone.trim()],
    ["Fiscal year", company?.fiscalYear.trim()],
  ].filter((detail): detail is [string, string] => Boolean(detail[1]));
  return (
    <div
      className="flex min-w-0 items-center gap-2"
      aria-label="Company information"
    >
      <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
        {logo ? (
          <img src={logo} alt="" className="size-full object-contain p-1" />
        ) : (
          <Building2 className="size-4" />
        )}
      </span>
      <div className="min-w-0">
        <p className="max-w-64 truncate text-sm font-medium">{name}</p>
        <p className="max-w-96 truncate text-xs text-muted-foreground">
          {details.length
            ? details.map(([label, value]) => `${label}: ${value}`).join(" · ")
            : "Company details not set"}
        </p>
      </div>
    </div>
  );
}
