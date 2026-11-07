import { useEffect, useState } from "react";
import {
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
import type { Challan, CompanyProfile, Dashboard, Item } from "@/types";
import type { Page } from "@/app/navigation";
import { formatMoney as money } from "@/lib/formatters";

export function DashboardPage({
  dashboard,
  onNavigate,
  allowedPages,
  username,
  company,
  logo,
  items,
  challans,
}: {
  dashboard: Dashboard | null;
  onNavigate: (page: Page) => void;
  allowedPages: Page[];
  username: string;
  company: CompanyProfile | null;
  logo: string | null;
  items: Item[];
  challans: Challan[];
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const localHour = now.getHours();
  const greeting = localHour >= 5 && localHour < 12
    ? "Good morning"
    : localHour >= 12 && localHour < 17
      ? "Good afternoon"
      : localHour >= 17 && localHour < 22
        ? "Good evening"
        : "Welcome back";
  const localDate = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(now);
  const localTime = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
  const stats = [
    ...(allowedPages.includes("items") ? [{
      label: "Total Items",
      value: dashboard?.counts.items ?? "—",
      icon: Package,
      note: "In the item list",
    }, { label: "Stock Value", value: money(items.reduce((sum, item) => sum + item.stockQuantity * item.purchaseRate, 0)), icon: Building2, note: "At purchase rates" }] : []),
    ...(allowedPages.includes("sale") ? [{
      label: "Today's Sales",
      value:
        dashboard?.counts.salesToday == null
          ? "—"
          : money(dashboard.counts.salesToday),
      icon: ArrowUpFromLine,
    }] : []),
    ...(allowedPages.includes("purchase") ? [{
      label: "Today's Purchases",
      value:
        dashboard?.counts.purchasesToday == null
          ? "—"
          : money(dashboard.counts.purchasesToday),
      icon: ArrowDownToLine,
    }] : []),
  ];
  const week = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (6 - index));
    const iso = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
    const values = challans.filter((row) => row.date === iso).reduce((sum, row) => { if (row.type === 'SALE' && allowedPages.includes("sale")) sum.sales += row.total; else if (row.type === 'PURCHASE' && allowedPages.includes("purchase")) sum.purchases += row.total; return sum; }, { sales: 0, purchases: 0 });
    return { iso, label: new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(day), ...values };
  });
  const chartMax = Math.max(0, ...week.flatMap((day) => [day.sales, day.purchases]));
  const hasWeekActivity = chartMax > 0;
  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col justify-between gap-4 border-b border-border/70 pb-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{localDate} · {localTime}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{greeting}, {username}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your office activity at a glance.</p>
          </div>
          <div className="min-w-0 max-w-full">
            <CompanyBusinessCard company={company} logo={logo} />
          </div>
      </header>
      <section aria-label="Office summary" className={`grid gap-3 sm:grid-cols-2 ${stats.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        {stats.map(({ label, value, icon: Icon, note }, index) => (
          <Card key={label} className="transition-colors hover:border-primary/25">
            <CardContent className="flex items-center justify-between gap-3 p-4 sm:p-5">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 truncate text-xl font-semibold tracking-tight tabular-nums">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{note ?? "Today"}</p>
              </div>
              <div className={`grid size-9 shrink-0 place-items-center rounded-xl ${index === 1 ? "bg-accent text-accent-foreground" : index === 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                <Icon className="size-4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
      {(allowedPages.includes("sale") || allowedPages.includes("purchase")) && <Card size="sm">
        <CardHeader><CardTitle className="text-base">{allowedPages.includes("sale") && allowedPages.includes("purchase") ? "Sales and purchases" : allowedPages.includes("sale") ? "Sales activity" : "Purchase activity"} · last 7 days</CardTitle><CardDescription>Daily totals from posted challans.</CardDescription></CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">{allowedPages.includes("sale") && <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-primary"/>Sales</span>}{allowedPages.includes("purchase") && <span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-muted-foreground/40"/>Purchases</span>}</div>
          {hasWeekActivity ? (
            <div aria-label="Daily transaction bar chart" className="grid h-40 grid-cols-7 items-end gap-2 sm:h-48 sm:gap-5">
              {week.map((day) => (
                <div key={day.iso} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
                  <div className="flex h-[calc(100%-1.5rem)] w-full items-end justify-center gap-1">
                    {allowedPages.includes("sale") && <div aria-label={`Sales ${money(day.sales)}`} title={`Sales ${money(day.sales)}`} className="w-2/5 rounded-t-sm bg-primary" style={{ height: day.sales ? `${Math.max(4, day.sales / chartMax * 100)}%` : "0%" }} />}
                    {allowedPages.includes("purchase") && <div aria-label={`Purchases ${money(day.purchases)}`} title={`Purchases ${money(day.purchases)}`} className="w-2/5 rounded-t-sm bg-muted-foreground/40" style={{ height: day.purchases ? `${Math.max(4, day.purchases / chartMax * 100)}%` : "0%" }} />}
                  </div>
                  <span className="text-xs text-muted-foreground">{day.label}</span>
                  <span className="sr-only">{allowedPages.includes("sale") ? `Sales ${money(day.sales)}; ` : ""}{allowedPages.includes("purchase") ? `purchases ${money(day.purchases)}` : ""}</span>
                </div>
              ))}
            </div>
          ) : <p className="rounded-lg bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">No sales or purchases recorded in the last seven days.</p>}
        </CardContent>
      </Card>}
      {dashboard?.canSeeRecent && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Today by brand</CardTitle>
                <CardDescription className="mt-1">
                  Purchase and sale amounts for each brand, based on today’s challans.
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
                    variant={page === "purchase" ? "default" : page === "sale" ? "secondary" : "outline"}
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
      {dashboard?.stockedItems != null && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="font-medium">Items with stock</p>
                <p className="text-sm text-muted-foreground">
                Distinct items with a positive recorded balance
              </p>
            </div>
            <p className="text-2xl font-semibold tabular-nums">
              {dashboard.stockedItems}
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
          {details.length ? details.map(([label, value]) => `${label}: ${value}`).join(" · ") : "Company details not set"}
        </p>
      </div>
    </div>
  );
}
