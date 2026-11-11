import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpFromLine,
  BookOpen,
  Building2,
  Database,
  FileClock,
  Home,
  Keyboard,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  Sun,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/PageHeader";
import { Field } from "@/components/forms/Fields";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Toaster } from "@/components/ui/sonner";
import type {
  Account,
  AuditEvent,
  Bank,
  Challan,
  Cheque,
  CompanyProfile,
  Dashboard,
  Item,
  OfficeConnection,
  OfficeSession,
  OfficeUser,
  OpeningBalance,
  StockMovement,
  Voucher,
} from "@/types";
import { REPORT_NAMES } from "@/lib/report-names";
import { matchAppKeybinding } from "@/lib/app-keybindings";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { SignInPage } from "@/features/auth/SignInPage";
import { PageLoading } from "@/app/PageLoading";
import { CompanyProfilePage } from "@/features/company/CompanyProfilePage";
import { AuditLogPage, UserRightsPage } from "@/features/access/AdminPages";
import {
  LocationsPage,
  OpeningBalancesPage,
  TransferPage,
} from "@/features/inventory/StockPages";
import {
  KeybindingsPage,
  ManualPage,
  SettingsPage,
} from "@/features/settings/SettingsPages";
import {
  CompanyBusinessCard,
  DashboardPage,
} from "@/features/dashboard/DashboardPage";
import {
  AccountsTable,
  BanksTable,
  ItemsTable,
  MasterPage,
} from "@/features/masters/MasterPages";
import { CategoriesPage } from "@/features/masters/CategoriesPage";
import { ChallanPage } from "@/features/challans/ChallanPage";
import { ChequePage } from "@/features/cheques/ChequePage";
import type { Page } from "@/app/navigation";
import { todayIsoDate as today } from "@/lib/formatters";
import { pageNames } from "@/app/navigation";

const DatabaseToolsPage = lazy(() =>
  import("@/features/database/DatabaseToolsPage").then(
    ({ DatabaseToolsPage: Page }) => ({ default: Page }),
  ),
);

const FullReportsPage = lazy(() =>
  import("@/features/reports/ReportsPage").then(({ ReportsPage: Page }) => ({
    default: Page,
  })),
);

const VoucherEntryPage = lazy(() =>
  import("@/features/vouchers/VoucherEntryPage").then(
    ({ VoucherEntryPage: Page }) => ({ default: Page }),
  ),
);

type SearchRecord = {
  page: Page;
  title: string;
  detail: string;
  kind: string;
  fields: Record<string, string>;
};

const navigationGroups: Array<{
  title: string;
  icon: typeof Home;
  pages: Page[];
}> = [
  {
    title: "Masters",
    icon: Building2,
    pages: ["accounts", "items", "categories", "banks"],
  },
  {
    title: "Stockroom",
    icon: Package,
    pages: ["locations", "opening", "transfer"],
  },
  {
    title: "Daily Work",
    icon: FileClock,
    pages: [
      "purchase",
      "sale",
      "journal",
      "cheques",
    ],
  },
  { title: "Reports", icon: Search, pages: ["reports"] },
  {
    title: "Office Admin",
    icon: Settings2,
    pages: [
      "company",
      "users",
      "audit",
      "database",
      "settings",
      "manual",
      "keybindings",
    ],
  },
];
const reportNavigationIndex = navigationGroups.findIndex((group) => group.title === "Reports");
const navigationGroupsBeforeReports = navigationGroups.slice(0, reportNavigationIndex);
const navigationGroupsAfterReports = navigationGroups.slice(reportNavigationIndex + 1);

const sidebarHeadingClassName =
  "h-12 rounded-xl border border-transparent px-3 py-3 text-sm font-semibold tracking-normal text-foreground transition-colors hover:bg-muted dark:hover:bg-muted/50 hover:no-underline focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, "$1")
    .replace(/\.00\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchParts(query: string) {
  const tokens =
    query.match(/"[^"]+"|\S+/g)?.map((token) => token.replace(/^"|"$/g, "")) ??
    [];
  const kinds: string[] = [];
  const fields: string[] = [];
  const terms: string[] = [];
  for (const token of tokens) {
    const qualifier = token.match(/^(type|in):(.+)$/i);
    if (!qualifier) {
      terms.push(normalizeSearchText(token));
      continue;
    }
    if (qualifier[1].toLowerCase() === "type")
      kinds.push(qualifier[2].toLowerCase());
    else fields.push(qualifier[2].toLowerCase());
  }
  return { kinds, fields, terms };
}

function recordSearchScore(record: SearchRecord, query: string) {
  const parsed = searchParts(query);
  const kindAliases: Record<string, string[]> = {
    account: ["account"],
    item: ["item"],
    bank: ["bank"],
    challan: ["purchase-challan", "sale-challan"],
    purchase: ["purchase-challan"],
    sale: ["sale-challan"],
    cheque: ["cheque"],
    journal: ["voucher", "journal-voucher"],
    payment: ["journal-voucher"],
    receipt: ["journal-voucher"],
    opening: ["opening-balance"],
    transfer: ["transfer"],
    "purchase-challan": ["purchase-challan"],
    "sale-challan": ["sale-challan"],
    "journal-voucher": ["journal-voucher"],
    "opening-balance": ["opening-balance"],
  };
  if (
    parsed.kinds.length &&
    !parsed.kinds.some((kind) =>
      (kindAliases[kind] ?? [kind]).includes(record.kind),
    )
  ) return null;
  const fieldAliases: Record<string, string[]> = {
    party: ["party"],
    date: ["date"],
    number: ["number", "checknumber", "reference"],
    account: ["account", "accountcode", "parent"],
    bank: ["name", "code", "accountnumber"],
    item: ["item", "itemcode", "description", "code"],
    status: ["status"],
    location: ["location"],
    amount: ["amount", "total", "quantity"],
  };
  const fieldEntries = Object.entries(record.fields);
  const scopedEntries = parsed.fields.length
    ? fieldEntries.filter(([field]) => parsed.fields.some((requested) =>
        (fieldAliases[requested] ?? [requested]).includes(field.toLowerCase().replaceAll(/[^a-z0-9]/g, "")),
      ))
    : fieldEntries;
  if (parsed.fields.length && !scopedEntries.length) return null;
  const haystack = [
    ...scopedEntries.map(([, value]) => value),
    ...(!parsed.fields.length ? [record.title, record.detail] : []),
  ]
    .map(normalizeSearchText)
    .join(" ");
  if (!parsed.terms.every((term) => haystack.includes(term))) return null;

  const title = normalizeSearchText(record.title);
  const detail = normalizeSearchText(record.detail);
  if (!parsed.terms.length) return 3;
  if (parsed.terms.every((term) => title === term)) return 0;
  if (parsed.terms.every((term) => title.startsWith(term))) return 1;
  if (parsed.terms.every((term) => title.includes(term))) return 2;
  if (parsed.terms.every((term) => detail.includes(term))) return 3;
  return 4;
}

export function App() {
  const [page, setPage] = useState<Page>("home");
  const [session, setSession] = useState<OfficeSession | null>(null);
  const [hasUsers, setHasUsers] = useState(true);
  const [companySetupNeeded, setCompanySetupNeeded] = useState(false);
  const [adminToolsPasswordConfigured, setAdminToolsPasswordConfigured] =
    useState(false);
  const [adminToolsUnlockedUntil, setAdminToolsUnlockedUntil] = useState<
    number | null
  >(null);
  const [adminToolsPromptOpen, setAdminToolsPromptOpen] = useState(false);
  const [adminToolsPasswordInput, setAdminToolsPasswordInput] = useState("");
  const [adminToolsVerifying, setAdminToolsVerifying] = useState(false);
  const [pendingAdminPage, setPendingAdminPage] = useState<Page | null>(null);
  const [pendingHistoryIndex, setPendingHistoryIndex] = useState<number | null>(
    null,
  );
  const [authLoading, setAuthLoading] = useState(true);
  const [officeConnection, setOfficeConnection] = useState<OfficeConnection>({
    mode: "local",
  });
  const [history, setHistory] = useState<Page[]>(["home"]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [openNavGroup, setOpenNavGroup] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => window.localStorage.getItem("purchase-sale-theme") === "dark",
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [searchResultsQuery, setSearchResultsQuery] = useState("");
  const [searchResultKind, setSearchResultKind] = useState("all");
  const [confirmAction, setConfirmAction] = useState<"logout" | "quit" | null>(
    null,
  );
  const lastConfirmAction = useRef<"logout" | "quit" | null>(null);
  if (confirmAction) lastConfirmAction.current = confirmAction;
  const displayedConfirmAction = confirmAction ?? lastConfirmAction.current;
  const [aboutOpen, setAboutOpen] = useState(false);
  const [users, setUsers] = useState<OfficeUser[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(
    null,
  );
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [challans, setChallans] = useState<Challan[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [openingBalances, setOpeningBalances] = useState<OpeningBalance[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [selectedReport, setSelectedReport] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(
    () =>
      window.office.app.onScreenshotDownloadComplete(({ state, path }) => {
        if (state === "completed") toast.success(`Screenshot saved: ${path}`);
        else toast.error(`Screenshot save ${state}: ${path}`);
      }),
    [],
  );

  useEffect(() => {
    const subscribe = window.office.auth.onSessionExpired;
    if (typeof subscribe !== "function") return;
    return subscribe(() => {
      setSession(null);
    });
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const connection = await window.office.connection.get();
        setOfficeConnection(connection);
        const status = await window.office.auth.status();
        setHasUsers(status.hasUsers);
        setCompanySetupNeeded(!status.hasCompanyProfile);
        setAdminToolsPasswordConfigured(status.hasAdminToolsPassword);
        setAdminToolsUnlockedUntil(status.adminToolsUnlockedUntil);
        setSession(status.session);
        if (status.session) {
          const isAdministrator = status.session.isAdministrator;
          setPage(
            isAdministrator &&
              (!status.hasCompanyProfile || !status.hasAdminToolsPassword)
              ? "company"
              : "home",
          );
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not check office connection",
        );
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
    window.localStorage.setItem(
      "purchase-sale-theme",
      darkMode ? "dark" : "light",
    );
  }, [darkMode]);

  useEffect(() => {
    const currentGroup = navigationGroups.find((group) =>
      group.title !== "Reports" && group.pages.includes(page),
    );
    if (currentGroup) setOpenNavGroup(currentGroup.title);
  }, [page]);

  const refresh = useCallback(
    async (currentSession = session) => {
      setBusy(true);
      try {
        const can = (name: Page) => Boolean(currentSession && (
          currentSession.permissions.includes(pageNames[name])
        ));
        const canPrint = [
          "company",
          "purchase",
          "sale",
          "journal",
          "reports",
        ].some((name) => can(name as Page));
        const [
          summary,
          profile,
          logo,
          accountRows,
          itemRows,
          bankRows,
          challanRows,
          chequeRows,
          places,
          openings,
          movements,
          voucherRows,
        ] = await Promise.all([
          can("home") ? window.office.dashboard() : null,
          canPrint ? window.office.company.get() : null,
          canPrint ? window.office.company.logo() : null,
          can("accounts") ||
          can("purchase") ||
          can("sale") ||
          can("reports") ||
          can("journal")
            ? window.office.accounts.list()
            : [],
          can("items") || can("purchase") || can("sale") || can("reports")
            ? window.office.items.list()
            : [],
          can("banks") || can("cheques") || can("journal") ? window.office.banks.list() : [],
          can("reports") || (can("purchase") && can("sale"))
            ? window.office.challans.list()
            : Promise.all([
                can("purchase")
                  ? window.office.challans.list("PURCHASE")
                  : Promise.resolve([]),
                can("sale")
                  ? window.office.challans.list("SALE")
                  : Promise.resolve([]),
              ]).then((groups) => groups.flat()),
          can("cheques") || can("journal") || can("reports") ? window.office.cheques.list() : [],
          can("items") ||
          can("purchase") ||
          can("sale") ||
          can("opening") ||
          can("transfer") ||
          can("reports") ||
          can("locations")
            ? window.office.stock.locations()
            : [],
          can("opening") ? window.office.stock.openings() : [],
          can("reports") ||
          can("purchase") ||
          can("sale") ||
          can("transfer") ||
          can("opening") ||
          can("locations")
            ? window.office.stock.movements()
            : [],
          can("reports") ||
          can("journal")
            ? window.office.vouchers.list()
            : [],
        ]);
        setDashboard(summary);
        if (profile) setCompanyProfile(profile);
        setCompanyLogo(logo);
        setAccounts(accountRows);
        setItems(itemRows);
        setBanks(bankRows);
        setChallans(challanRows);
        setCheques(chequeRows);
        setLocations(places);
        setOpeningBalances(openings);
        setStockMovements(movements);
        setVouchers(voucherRows);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not load office data",
        );
      } finally {
        setBusy(false);
      }
    },
    [session],
  );

  useEffect(() => {
    if (session) void refresh();
  }, [refresh, session]);

  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = window.office.sync.onDataChanged(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void (async () => {
          try {
            const status = await window.office.auth.status();
            setSession(status.session);
            if (status.session) {
              await refresh(status.session);
              setAdminToolsPasswordConfigured(status.hasAdminToolsPassword);
              setAdminToolsUnlockedUntil(status.adminToolsUnlockedUntil);
              if (
                page === "users" &&
                status.adminToolsUnlockedUntil &&
                status.adminToolsUnlockedUntil > Date.now()
              )
                setUsers(await window.office.users.list());
              if (page === "audit")
                setAuditEvents(await window.office.audit.list());
            }
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Could not refresh shared office data",
            );
          }
        })();
      }, 150);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [page, refresh, session]);

  useEffect(() => {
    if (!session) return;
    if (
      page === "users" &&
      adminToolsUnlockedUntil &&
      adminToolsUnlockedUntil > Date.now()
    )
      void window.office.users
        .list()
        .then(setUsers)
        .catch((error) =>
          toast.error(
            error instanceof Error
              ? error.message
              : "Could not load user rights",
          ),
        );
    if (page === "audit")
      void window.office.audit
        .list()
        .then(setAuditEvents)
        .catch((error) =>
          toast.error(
            error instanceof Error ? error.message : "Could not load audit log",
          ),
        );
  }, [page, session, adminToolsUnlockedUntil]);

  useEffect(() => {
    const overlaySelector = '[aria-modal="true"], [data-slot="dialog-content"], [data-slot="sheet-content"]';
    const openOverlays = () => [...document.querySelectorAll<HTMLElement>(overlaySelector)].filter((element) => element.getClientRects().length > 0);
    const onKeyDown = (event: KeyboardEvent) => {
      const action = matchAppKeybinding(event);
      if (!action) return;
      if (action === "closeDialog") return;
      if (action === "focusSearch") {
        if (openOverlays().length) return;
        const searchInput = [...document.querySelectorAll<HTMLInputElement>("input[data-operator-search]")]
          .find((input) => input.getClientRects().length > 0 && !input.disabled);
        if (!searchInput) return;
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
        return;
      }
      event.preventDefault();
      switch (action) {
        case "search":
          setPaletteQuery("");
          setPaletteOpen(true);
          break;
        case "globalSearch":
          openGlobalSearch();
          break;
        case "newRecord": {
          if (openOverlays().length) break;
          const createButton = [...document.querySelectorAll<HTMLButtonElement>("button[data-operator-new]")].find((button) => button.getClientRects().length > 0 && !button.disabled);
          createButton?.click();
          break;
        }
        case "saveRecord": {
          const dialog = document.activeElement?.closest<HTMLElement>(overlaySelector) ?? openOverlays().at(-1);
          const saveButton = [...document.querySelectorAll<HTMLButtonElement>("button[data-operator-save]")].find((button) => button.getClientRects().length > 0 && !button.disabled && (!dialog || dialog.contains(button)));
          saveButton?.click();
          break;
        }
        case "back":
          goBack();
          break;
        case "forward":
          goForward();
          break;
        case "home":
          navigate("home");
          break;
        case "keybindings":
          navigate("keybindings");
          break;
        case "refresh":
          if (session && !openOverlays().length) void refresh();
          break;
        case "quit":
          setConfirmAction("quit");
          break;
        default:
          void window.office.app
            .menuAction(action)
            .catch((error) =>
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Keyboard action failed",
              ),
            );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const canOpenAdminTools = () =>
    adminToolsUnlockedUntil !== null && adminToolsUnlockedUntil > Date.now();
  const commitNavigation = (nextPage: Page) => {
    setPage(nextPage);
    setQuery("");
    setPaletteOpen(false);
    setHistory((current) => [...current.slice(0, historyIndex + 1), nextPage]);
    setHistoryIndex((current) => current + 1);
  };
  const navigate = (nextPage: Page) => {
    const isAdministrator = session?.isAdministrator === true;
    if (nextPage === "company" && !isAdministrator) {
      toast.error("Only an administrator can open Company Profile");
      return;
    }
    if (companySetupNeeded && nextPage !== "company") {
      toast.info(
        isAdministrator
          ? "Finish company profile setup before using the office workspace"
          : "Company setup is incomplete. Ask an administrator to finish setup.",
      );
      if (isAdministrator) setPage("company");
      return;
    }
    if (
      nextPage !== "company" &&
      !adminToolsPasswordConfigured &&
      session?.isAdministrator
    ) {
      setPage("company");
      toast.info("Set an administrator password in Company Profile first");
      return;
    }
    if (
      (nextPage === "users" || nextPage === "database") &&
      !session?.isAdministrator
    ) {
      toast.error("Only an administrator can open this page");
      return;
    }
    if (
      !["settings", "keybindings"].includes(nextPage) &&
      nextPage !== "search" &&
      !(nextPage === "users" ||
      nextPage === "database" ||
      nextPage === "company"
        ? isAdministrator
        : session?.permissions.includes(pageNames[nextPage]))
    ) {
      toast.error("Your account does not have access to that page");
      return;
    }
    if (
      (nextPage === "users" || nextPage === "database") &&
      !canOpenAdminTools()
    ) {
      setPendingAdminPage(nextPage);
      setPendingHistoryIndex(null);
      setAdminToolsPasswordInput("");
      setAdminToolsPromptOpen(true);
      return;
    }
    commitNavigation(nextPage);
  };
  const openGlobalSearch = () => {
    navigate("search");
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(
        "input[data-global-search]",
      );
      if (!input || !input.getClientRects().length || input.disabled) return;
      input.focus();
      input.select();
    });
  };
  const visitHistory = (next: number) => {
    const target = history[next];
    if (target === "company" && !session?.isAdministrator) {
      setPage("home");
      toast.error("Only an administrator can open Company Profile");
      return;
    }
    if ((target === "users" || target === "database") && !canOpenAdminTools()) {
      setPendingAdminPage(target);
      setPendingHistoryIndex(next);
      setAdminToolsPasswordInput("");
      setAdminToolsPromptOpen(true);
      return;
    }
    setHistoryIndex(next);
    setPage(target);
    setQuery("");
  };
  const goBack = () => {
    if (historyIndex > 0) visitHistory(historyIndex - 1);
  };
  const goForward = () => {
    if (historyIndex < history.length - 1) visitHistory(historyIndex + 1);
  };

  async function unlockAdminTools(event: React.FormEvent) {
    event.preventDefault();
    setAdminToolsVerifying(true);
    try {
      const result = await window.office.security.unlockAdminTools(
        adminToolsPasswordInput,
      );
      setAdminToolsUnlockedUntil(result.expiresAt);
      setAdminToolsPromptOpen(false);
      setAdminToolsPasswordInput("");
      const target = pendingAdminPage;
      if (target) {
        if (pendingHistoryIndex !== null) {
          setHistoryIndex(pendingHistoryIndex);
          setPage(target);
          setQuery("");
        } else commitNavigation(target);
      }
      setPendingAdminPage(null);
      setPendingHistoryIndex(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not unlock admin-only pages",
      );
    } finally {
      setAdminToolsVerifying(false);
    }
  }

  function cancelAdminToolsPrompt() {
    if ((page === "users" || page === "database") && !canOpenAdminTools())
      setPage("home");
    setAdminToolsPromptOpen(false);
    setAdminToolsPasswordInput("");
    setPendingAdminPage(null);
    setPendingHistoryIndex(null);
  }

  useEffect(() => {
    if (!adminToolsUnlockedUntil) return;
    const timer = setTimeout(
      () => {
        setAdminToolsUnlockedUntil(null);
        setPage((current) =>
          current === "users" || current === "database" ? "home" : current,
        );
        toast.info("Admin-only page access has locked again");
      },
      Math.max(0, adminToolsUnlockedUntil - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [adminToolsUnlockedUntil]);

  useEffect(() => {
    if (!session || (page !== "users" && page !== "database")) return;
    if (!session.isAdministrator) {
      setPage("home");
      return;
    }
    if (!adminToolsPasswordConfigured) {
      setPage("company");
      return;
    }
    if (adminToolsUnlockedUntil && adminToolsUnlockedUntil > Date.now()) return;
    setPendingAdminPage(page);
    setPendingHistoryIndex(null);
    setAdminToolsPasswordInput("");
    setAdminToolsPromptOpen(true);
  }, [page, session, adminToolsPasswordConfigured, adminToolsUnlockedUntil]);

  useEffect(() => {
    if (!session || page !== "company" || session.isAdministrator) return;
    setPage("home");
    toast.error("Only an administrator can open Company Profile");
  }, [page, session]);

  const nav = [
    { id: "home" as const, label: "Home", icon: LayoutDashboard },
    { id: "company" as const, label: "Company Profile", icon: Building2 },
    { id: "accounts" as const, label: "Chart of Accounts", icon: Building2 },
    { id: "items" as const, label: "Items", icon: Package },
    { id: "categories" as const, label: "Categories", icon: Package },
    { id: "banks" as const, label: "Banks", icon: Landmark },
    { id: "locations" as const, label: "Locations", icon: Package },
    {
      id: "opening" as const,
      label: "Opening Balances",
      icon: ArrowDownToLine,
    },
    { id: "transfer" as const, label: "Transfer", icon: ArrowLeftRight },
    { id: "cheques" as const, label: "Cheque Detail", icon: WalletCards },
    { id: "journal" as const, label: "Payment / Receipt", icon: WalletCards },
    {
      id: "purchase" as const,
      label: "Purchase Challans",
      icon: ArrowDownToLine,
    },
    { id: "sale" as const, label: "Sale Challans", icon: ArrowUpFromLine },
    { id: "reports" as const, label: "Reports", icon: FileClock },
    { id: "users" as const, label: "User Rights", icon: Shield },
    { id: "audit" as const, label: "Audit Log", icon: FileClock },
    { id: "database" as const, label: "Database Tools", icon: Database },
    { id: "settings" as const, label: "Settings", icon: Settings2 },
    { id: "manual" as const, label: "Manual", icon: BookOpen },
    { id: "keybindings" as const, label: "Keybindings", icon: Keyboard },
  ];

  if (authLoading)
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Checking sign-in…
      </div>
    );
  if (!session)
    return (
      <SignInPage
        setup={!hasUsers}
        connection={officeConnection}
        onInstallationAuthorized={(status) => {
          setHasUsers(status.hasUsers);
          setCompanySetupNeeded(!status.hasCompanyProfile);
          setAdminToolsPasswordConfigured(status.hasAdminToolsPassword);
          setCompanyProfile(status.companyProfile || null);
        }}
        onSuccess={(value) => {
          setSession(value);
          setHasUsers(true);
          setPage(
            value.isAdministrator &&
              (companySetupNeeded || !adminToolsPasswordConfigured)
              ? "company"
              : "home",
          );
        }}
      />
    );

  const isAdministrator = session.isAdministrator;
  const adminToolsUnlocked =
    adminToolsUnlockedUntil !== null && adminToolsUnlockedUntil > Date.now();
  const permittedNav = nav.filter(({ id }) =>
    id === "users" || id === "database" || id === "company"
      ? isAdministrator
      : id === "settings" ||
        id === "keybindings" ||
        session.permissions.includes(pageNames[id]),
  );
  const searchableRecords: SearchRecord[] = [
    ...accounts.map((row) => ({
      page: "accounts" as const,
      title: `${row.code} — ${row.description}`,
      detail: "Chart of Accounts",
      kind: "account",
      fields: {
        code: row.code,
        description: row.description,
        parent: row.parentCode ?? "",
      },
    })),
    ...items.map((row) => ({
      page: "items" as const,
      title: `${row.code} — ${row.description}`,
      detail: `Item`,
      kind: "item",
      fields: {
        code: row.code,
        description: row.description,
        unit: row.unit,
      },
    })),
    ...banks.map((row) => ({
      page: "banks" as const,
      title: `${row.code} — ${row.name}`,
      detail: "Bank",
      kind: "bank",
      fields: {
        code: row.code,
        name: row.name,
        accountNumber: row.accountNumber ?? "",
      },
    })),
    ...challans.map((row) => ({
      page: row.type === "PURCHASE" ? ("purchase" as const) : ("sale" as const),
      title: `${row.number} — ${row.party}`,
      detail: `${row.type} challan · ${row.date}`,
      kind: `${row.type.toLowerCase()}-challan`,
      fields: {
        number: row.number,
        date: row.date,
        party: row.party,
        location: row.location,
        total: String(row.total),
        type: row.type,
      },
    })),
    ...cheques.map((row) => ({
      page: "cheques" as const,
      title: `${row.number} — ${row.party}`,
      detail: `Cheque · ${row.status} · ${row.date}`,
      kind: "cheque",
      fields: {
        number: row.number,
        checkNumber: row.checkNumber ?? "",
        party: row.party,
        date: row.date,
        status: row.status,
        amount: String(row.amount),
      },
    })),
    ...vouchers
      .filter((row) => row.type === "JOURNAL VOUCHER" || row.type === "VOUCHER")
      .map((row) => {
        return {
          page: "journal" as const,
          title: `${row.number} — ${row.narration || row.type}`,
          detail: `${row.type} · ${row.date}`,
          kind: "journal-voucher",
          fields: {
            number: row.number,
            type: row.type,
            date: row.date,
            reference: row.reference,
            narration: row.narration,
            account: row.lines.map((line) => line.accountCode).join(" "),
            amount: row.lines.map((line) => line.debit + line.credit).join(" "),
            chequeNumber: [row.chequeNumber ?? "", ...row.lines.map((line) => line.chequeNumber ?? "")].join(" "),
            paymentMethod: row.lines.map((line) => line.paymentMethod ?? "").join(" "),
          },
        };
      }),
    ...openingBalances.map((row) => ({
      page: "opening" as const,
      title: `${row.itemCode} — ${row.itemDescription ?? "Opening balance"}`,
      detail: `Opening balance · ${row.location} · ${row.date}`,
      kind: "opening-balance",
      fields: {
        item: row.itemCode,
        description: row.itemDescription ?? "",
        location: row.location,
        date: row.date,
        quantity: String(row.quantity),
      },
    })),
    ...stockMovements
      .filter((row) => row.type.startsWith("TRANSFER"))
      .map((row) => ({
        page: "transfer" as const,
        title: `${row.document} — ${row.itemCode}`,
        detail: `Stock transfer · ${row.location} · ${row.date}`,
        kind: "transfer",
        fields: {
          number: row.document,
          item: row.itemCode,
          location: row.location,
          date: row.date,
          type: row.type,
          quantity: String(row.quantity),
        },
      })),
  ].filter((row) => session.permissions.includes(pageNames[row.page]));
  const searchPageRecords = searchResultsQuery.trim()
    ? searchableRecords
        .map((row, index) => ({ row, index, score: recordSearchScore(row, searchResultsQuery) }))
        .filter((match): match is { row: SearchRecord; index: number; score: number } => match.score !== null)
        .sort((a, b) => a.score - b.score || a.index - b.index)
        .map(({ row }) => row)
    : [];
  const searchResultGroups = [
    { key: "accounts", label: "Accounts & banks", kinds: ["account", "bank"] },
    { key: "items", label: "Items", kinds: ["item"] },
    { key: "challans", label: "Challans", kinds: ["purchase-challan", "sale-challan"] },
    { key: "vouchers", label: "Vouchers", kinds: ["voucher", "journal-voucher"] },
    { key: "cheques", label: "Cheques", kinds: ["cheque"] },
    { key: "stock", label: "Stock activity", kinds: ["opening-balance", "transfer"] },
  ].map((group) => ({
    ...group,
    records: searchPageRecords.filter((record) => group.kinds.includes(record.kind)),
  }));
  const visibleSearchGroups = searchResultKind === "all"
    ? searchResultGroups.filter((group) => group.records.length > 0)
    : searchResultGroups.filter((group) => group.key === searchResultKind && group.records.length > 0);
  const renderSearchResult = (record: SearchRecord) => (
    <Button key={`${record.page}-${record.title}`} variant="ghost" className="h-auto w-full justify-start rounded-none px-4 py-3 text-left hover:bg-muted/60" onClick={() => navigate(record.page)}>
      <Search className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{record.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{record.detail}</span></span>
      <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">{record.kind.replaceAll("-", " ")}</Badge>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Button>
  );
  const paletteTerms = normalizeSearchText(paletteQuery).split(/\s+/).filter(Boolean);
  const matchesPaletteText = (value: string) => {
    const normalized = normalizeSearchText(value);
    return paletteTerms.length > 0 && paletteTerms.every((term) => normalized.includes(term));
  };

  const filteredItems = items.filter((row) =>
    `${row.code} ${row.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  const filteredBanks = banks.filter((row) =>
    `${row.code} ${row.name}`.toLowerCase().includes(query.toLowerCase()),
  );

  const runMenuAction = (
    action: Parameters<typeof window.office.app.menuAction>[0],
  ) => {
    void window.office.app
      .menuAction(action)
      .catch((error) =>
        toast.error(
          error instanceof Error ? error.message : "Menu action failed",
        ),
      );
  };
  const isAllowed = (target: Page) =>
    permittedNav.some(({ id }) => id === target);

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block min-h-svh select-text">
        <div className="flex h-svh min-h-0 flex-col overflow-hidden bg-background">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 sm:gap-3 sm:px-5">
            <Button className="md:hidden" variant="ghost" size="icon-sm" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu /></Button>
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              {companyLogo && (
                <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                  <img
                    src={companyLogo}
                    alt=""
                    className="size-7 object-contain"
                  />
                </div>
              )}
              <p className="max-w-24 truncate text-xs font-semibold leading-tight sm:max-w-48 sm:text-sm">
                {companyProfile?.name || "TradeLedger Office"}
              </p>
            </div>
            <Separator
              orientation="vertical"
              className="mx-1 h-5 data-vertical:self-center"
            />
            <div className="hidden shrink-0 items-center gap-0.5 sm:flex">
              <Button
                className="hidden sm:inline-flex"
                variant="ghost"
                size="icon-sm"
                aria-label="Back"
                title="Back (Alt+Left)"
                disabled={historyIndex === 0}
                onClick={goBack}
              >
                <ArrowLeft />
              </Button>
              <Button
                className="hidden sm:inline-flex"
                variant="ghost"
                size="icon-sm"
                aria-label="Forward"
                title="Forward (Alt+Right)"
                disabled={historyIndex >= history.length - 1}
                onClick={goForward}
              >
                <ArrowRight />
              </Button>
            </div>
            <h1 className="min-w-0 flex-1 truncate px-1 text-sm font-semibold tracking-tight sm:px-2">
              {pageNames[page]}
            </h1>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Global search"
                title="Global search (Ctrl+Shift+F)"
                onClick={openGlobalSearch}
              >
                <Search />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Refresh"
                title="Refresh data (F5)"
                onClick={() => void refresh()}
                disabled={busy}
              >
                <RefreshCw className={busy ? "animate-spin" : ""} />
              </Button>
              <Button
                className="hidden sm:inline-flex"
                variant="ghost"
                size="icon-sm"
                aria-label="Manual"
                title="Manual"
                onClick={() => navigate("manual")}
              >
                <BookOpen />
              </Button>
              <Button
                className="hidden sm:inline-flex"
                variant="ghost"
                size="icon-sm"
                aria-label="Keybindings"
                title="Keybindings (F1)"
                onClick={() => navigate("keybindings")}
              >
                <Keyboard />
              </Button>
              <Button
                className="hidden sm:inline-flex"
                variant="ghost"
                size="icon-sm"
                aria-label="About"
                title="About"
                onClick={() => setAboutOpen(true)}
              >
                <Building2 />
              </Button>
              <Button
                className="hidden sm:inline-flex"
                variant="ghost"
                size="icon-sm"
                aria-label={darkMode ? "Light theme" : "Dark theme"}
                title={darkMode ? "Light theme" : "Dark theme"}
                onClick={() => setDarkMode((current) => !current)}
              >
                {darkMode ? <Sun /> : <Moon />}
              </Button>
            </div>
            <Badge
              variant="secondary"
              className="hidden shrink-0 sm:inline-flex"
            >
              {session.username}
            </Badge>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Log out"
              title="Log out"
              onClick={() => setConfirmAction("logout")}
            >
              <LogOut />
            </Button>
          </header>
          <div className="flex min-h-0 flex-1">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetContent side="left" className="w-[min(19rem,88vw)] gap-0 p-0 md:hidden">
                <SheetHeader className="border-b pr-12">
                  <SheetTitle>{companyProfile?.name || "TradeLedger Office"}</SheetTitle>
                  <SheetDescription>Navigate to a workspace</SheetDescription>
                </SheetHeader>
                <nav aria-label="Main navigation" className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
                  <Button variant={page === "home" ? "secondary" : "ghost"} aria-current={page === "home" ? "page" : undefined} className="mb-2 h-11 justify-start gap-3 rounded-lg px-3" onClick={() => { navigate("home"); setMobileNavOpen(false); }}><LayoutDashboard />Home</Button>
                  <Accordion value={openNavGroup ? [openNavGroup] : []} onValueChange={(value) => setOpenNavGroup(value[0] ?? "")}>
                    {navigationGroupsBeforeReports.map((group) => {
                      const entries = permittedNav.filter(({ id }) => group.pages.includes(id));
                      if (!entries.length) return null;
                      return <AccordionItem key={group.title} value={group.title} className="border-border">
                        <AccordionTrigger className={`${sidebarHeadingClassName} flex items-center gap-3`}><group.icon data-icon="inline-start" />{group.title}</AccordionTrigger>
                        <AccordionContent className="pb-2 pt-1"><div className="flex flex-col gap-1 px-1">
                          {entries.map(({ id, label, icon: Icon }) => <Button key={id} variant={page === id ? "secondary" : "ghost"} aria-current={page === id ? "page" : undefined} className="h-11 justify-start gap-3 rounded-lg px-3" onClick={() => { setOpenNavGroup(group.title); navigate(id); setMobileNavOpen(false); }}><Icon />{label}</Button>)}
                        </div></AccordionContent>
                      </AccordionItem>;
                    })}
                  </Accordion>
                  {permittedNav.some(({ id }) => id === "reports") && <Button variant={page === "reports" ? "secondary" : "ghost"} aria-current={page === "reports" ? "page" : undefined} className="h-11 justify-start gap-3 rounded-lg px-3" onClick={() => { navigate("reports"); setMobileNavOpen(false); }}><FileClock />Reports</Button>}
                  <Accordion value={openNavGroup ? [openNavGroup] : []} onValueChange={(value) => setOpenNavGroup(value[0] ?? "")}>
                    {navigationGroupsAfterReports.map((group) => {
                      const entries = permittedNav.filter(({ id }) => group.pages.includes(id));
                      if (!entries.length) return null;
                      return <AccordionItem key={group.title} value={group.title} className="border-border">
                        <AccordionTrigger className={`${sidebarHeadingClassName} flex items-center gap-3`}><group.icon data-icon="inline-start" />{group.title}</AccordionTrigger>
                        <AccordionContent className="pb-2 pt-1"><div className="flex flex-col gap-1 px-1">
                          {entries.map(({ id, label, icon: Icon }) => <Button key={id} variant={page === id ? "secondary" : "ghost"} aria-current={page === id ? "page" : undefined} className="h-11 justify-start gap-3 rounded-lg px-3" onClick={() => { setOpenNavGroup(group.title); navigate(id); setMobileNavOpen(false); }}><Icon />{label}</Button>)}
                        </div></AccordionContent>
                      </AccordionItem>;
                    })}
                  </Accordion>
                </nav>
              </SheetContent>
            </Sheet>
            <aside
              aria-label="Main navigation"
              className={`hidden shrink-0 flex-col overflow-y-auto border-r bg-muted/20 p-3 transition-[width] duration-200 md:flex ${sidebarCollapsed ? "w-16 gap-2" : "w-60 p-4"}`}
            >
              {sidebarCollapsed ? (
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant={page === "home" ? "secondary" : "ghost"}
                    size="icon"
                    aria-label="Home"
                    title="Home"
                    onClick={() => navigate("home")}
                  >
                    <LayoutDashboard />
                  </Button>
                  {navigationGroups.map((group) => {
                    if (group.title === "Reports") {
                      return permittedNav.some(({ id }) => id === "reports") ? <Button
                        key={group.title}
                        variant={page === "reports" ? "secondary" : "ghost"}
                        size="icon"
                        aria-label="Reports"
                        title="Reports"
                        onClick={() => navigate("reports")}
                      ><FileClock /></Button> : null;
                    }
                    const hasVisiblePages = permittedNav.some(({ id }) =>
                      group.pages.includes(id),
                    );
                    if (!hasVisiblePages) return null;
                    return (
                      <Button
                        key={group.title}
                        variant={
                          group.pages.includes(page) ? "secondary" : "ghost"
                        }
                        size="icon"
                        aria-label={group.title}
                        title={group.title}
                        onClick={() => {
                          setOpenNavGroup(group.title);
                          setSidebarCollapsed(false);
                        }}
                      >
                        <group.icon />
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div className="border-b border-border">
                    <Button
                      variant="ghost"
                      aria-current={page === "home" ? "page" : undefined}
                      className={`${sidebarHeadingClassName} flex w-full items-center justify-start gap-3`}
                      onClick={() => navigate("home")}
                    >
                      <LayoutDashboard />
                      Home
                    </Button>
                  </div>
                  <Accordion
                    value={openNavGroup ? [openNavGroup] : []}
                    onValueChange={(value) => setOpenNavGroup(value[0] ?? "")}
                  >
                    {navigationGroupsBeforeReports.map((group) => {
                      const entries = permittedNav.filter(({ id }) =>
                        group.pages.includes(id),
                      );
                      if (!entries.length) return null;
                      return (
                        <AccordionItem
                          key={group.title}
                          value={group.title}
                          className="border-border"
                        >
                          <AccordionTrigger
                            className={`${sidebarHeadingClassName} flex items-center gap-3`}
                          >
                            <group.icon data-icon="inline-start" />
                            {group.title}
                          </AccordionTrigger>
                          <AccordionContent className="pb-3 pt-2">
                            <div className="flex flex-col gap-1 px-1">
                              {entries.map(({ id, label, icon: Icon }) => (
                                <Button
                                  key={id}
                                  variant={page === id ? "secondary" : "ghost"}
                                  aria-current={page === id ? "page" : undefined}
                                  className="h-11 justify-start gap-3 rounded-lg px-3 text-sm"
                                  onClick={() => {
                                    setOpenNavGroup(group.title);
                                    navigate(id);
                                  }}
                                >
                                  <Icon />
                                  {label}
                                </Button>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                  {permittedNav.some(({ id }) => id === "reports") && <div className="border-b border-border">
                    <Button
                      variant="ghost"
                      aria-current={page === "reports" ? "page" : undefined}
                      className={`${sidebarHeadingClassName} flex w-full items-center justify-start gap-3`}
                      onClick={() => navigate("reports")}
                    ><FileClock />Reports</Button>
                  </div>}
                  <Accordion
                    value={openNavGroup ? [openNavGroup] : []}
                    onValueChange={(value) => setOpenNavGroup(value[0] ?? "")}
                  >
                    {navigationGroupsAfterReports.map((group) => {
                      const entries = permittedNav.filter(({ id }) => group.pages.includes(id));
                      if (!entries.length) return null;
                      return <AccordionItem key={group.title} value={group.title} className="border-border">
                        <AccordionTrigger className={`${sidebarHeadingClassName} flex items-center gap-3`}><group.icon data-icon="inline-start" />{group.title}</AccordionTrigger>
                        <AccordionContent className="pb-3 pt-2"><div className="flex flex-col gap-1 px-1">
                          {entries.map(({ id, label, icon: Icon }) => <Button key={id} variant={page === id ? "secondary" : "ghost"} aria-current={page === id ? "page" : undefined} className="h-11 justify-start gap-3 rounded-lg px-3 text-sm" onClick={() => { setOpenNavGroup(group.title); navigate(id); }}><Icon />{label}</Button>)}
                        </div></AccordionContent>
                      </AccordionItem>;
                    })}
                  </Accordion>
                </>
              )}
              <div
                className={`mt-auto flex border-t border-border pt-3 ${sidebarCollapsed ? "justify-center" : "justify-end"}`}
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={
                    sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
                  title={
                    sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                  }
                  onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                >
                  {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
                </Button>
              </div>
            </aside>
            <main className="app-workspace mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-y-auto p-3 sm:p-5 lg:p-7">
              {page === "home" && (
                <DashboardPage
                  dashboard={dashboard}
                  onNavigate={navigate}
                  allowedPages={permittedNav.map(({ id }) => id)}
                  username={session.username}
                  company={companyProfile}
                  logo={companyLogo}
                  items={items}
                  challans={challans}
                />
              )}
              {page === "search" && (
                <section className="flex flex-col gap-4">
                  <PageHeader
                    title="Global search"
                    description={searchResultsQuery ? `Matches for “${searchResultsQuery}”. Select a result to open its section.` : "Search across the records your account can access."}
                    actions={<div className="relative w-full sm:w-80"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input data-operator-search data-global-search title="Focus search (Ctrl+F)" className="pl-9" aria-label="Search all records" placeholder="Name, number, party, or filter" value={searchResultsQuery} onChange={(event) => { setSearchResultsQuery(event.target.value); setSearchResultKind("all"); }} /></div>}
                  />
                  {searchResultsQuery.trim() ? (
                    <>
                      <p className="text-sm text-muted-foreground">{searchPageRecords.length} {searchPageRecords.length === 1 ? "result" : "results"}</p>
                      {searchPageRecords.length ? (
                        <>
                          <div className="flex flex-wrap gap-2 border-b border-border/70 pb-3" role="toolbar" aria-label="Filter results by type">
                            <Button size="sm" variant={searchResultKind === "all" ? "secondary" : "outline"} aria-pressed={searchResultKind === "all"} onClick={() => setSearchResultKind("all")}>All <span className="ml-1 tabular-nums text-muted-foreground">{searchPageRecords.length}</span></Button>
                            {searchResultGroups.map((group) => <Button key={group.key} size="sm" variant={searchResultKind === group.key ? "secondary" : "outline"} aria-pressed={searchResultKind === group.key} disabled={!group.records.length} onClick={() => setSearchResultKind(group.key)}>{group.label}<span className="ml-1 tabular-nums text-muted-foreground">{group.records.length}</span></Button>)}
                          </div>
                          <div className="flex flex-col gap-4">
                            {visibleSearchGroups.map((group) => <section key={group.key} aria-labelledby={`search-group-${group.key}`} className="overflow-hidden rounded-xl border bg-card">
                              <header className="flex items-center justify-between gap-3 border-b bg-muted/35 px-4 py-3"><h2 id={`search-group-${group.key}`} className="text-sm font-semibold">{group.label}</h2><Badge variant="secondary">{group.records.length}</Badge></header>
                              <div className="divide-y">{group.records.map(renderSearchResult)}</div>
                            </section>)}
                          </div>
                        </>
                      ) : (
                        <div className="rounded-xl border bg-card px-5 py-10 text-center">
                          <p className="font-medium">No matching records</p>
                          <p className="mt-1 text-sm text-muted-foreground">Try a shorter phrase, record number, or a field such as <code>in:party</code>.</p>
                        </div>
                      )}
                    </>
                  ) : <div className="rounded-xl border bg-card px-5 py-10 text-center text-sm text-muted-foreground">Enter a term above to search permitted records.</div>}
                </section>
              )}
              {page === "database" && isAdministrator && adminToolsUnlocked && (
                <Suspense fallback={<PageLoading />}>
                  <DatabaseToolsPage
                    connection={officeConnection}
                    isAdministrator={isAdministrator}
                  />
                </Suspense>
              )}
              {page === "company" && isAdministrator && (
                <CompanyProfilePage
                  profile={companyProfile}
                  onboarding={companySetupNeeded}
                  isAdministrator={isAdministrator}
                  adminToolsPasswordConfigured={adminToolsPasswordConfigured}
                  onSave={async (value, password) => {
                    const saved = await window.office.company.save(value);
                    if (password) {
                      await window.office.security.configureAdminToolsPassword(
                        password,
                      );
                      setAdminToolsPasswordConfigured(true);
                      setAdminToolsUnlockedUntil(null);
                    }
                    setCompanyProfile(saved);
                    setCompanySetupNeeded(false);
                    await refresh();
                    toast.success(
                      password
                        ? "Company profile and administrator password saved"
                        : "Company profile saved",
                    );
                    if (
                      companySetupNeeded ||
                      (password && !adminToolsPasswordConfigured)
                    ) {
                      setPage("home");
                      setHistory(["home"]);
                      setHistoryIndex(0);
                    }
                  }}
                />
              )}
              {page === "accounts" && (
                <MasterPage
                  title="Chart of Accounts"
                  description="Organize parties and ledger accounts in a parent-child chart."
                  search={query}
                  onSearch={setQuery}
                >
                  <AccountsTable
                    accounts={accounts}
                    query={query}
                    onSave={async (value) => {
                      await window.office.accounts.save(value);
                      await refresh();
                    }}
                    onDelete={async (code) => {
                      await window.office.accounts.remove(code);
                      await refresh();
                    }}
                  />
                </MasterPage>
              )}
              {page === "items" && (
                <MasterPage
                  title="Items"
                  description="Manage products, rates, and inventory quantities by location."
                  search={query}
                  onSearch={setQuery}
                >
                  <ItemsTable
                    rows={filteredItems}
                    locations={locations}
                    onSave={async (value) => {
                      await window.office.items.save(value);
                      await refresh();
                    }}
                    onDelete={async (code) => {
                      await window.office.items.remove(code);
                      await refresh();
                    }}
                  />
                </MasterPage>
              )}
              {page === "categories" && <CategoriesPage />}
              {page === "banks" && (
                <MasterPage
                  title="Banks"
                  description="Bank master records used by cheque and payment workflows."
                  search={query}
                  onSearch={setQuery}
                >
                  <BanksTable
                    rows={filteredBanks}
                    accounts={accounts}
                    onSave={async (value) => {
                      await window.office.banks.save(value);
                      await refresh();
                    }}
                    onDelete={async (code) => {
                      await window.office.banks.remove(code);
                      await refresh();
                    }}
                  />
                </MasterPage>
              )}
              {page === "locations" && (
                <LocationsPage
                  locations={locations}
                  movements={stockMovements}
                  onSave={async (name) => {
                    await window.office.locations.save(name);
                    await refresh();
                  }}
                  onDelete={async (name) => {
                    await window.office.locations.remove(name);
                    await refresh();
                  }}
                />
              )}
              {page === "opening" && (
                <OpeningBalancesPage
                  rows={openingBalances}
                  items={items}
                  locations={locations}
                  onAdd={async (value) => {
                    await window.office.stock.addOpening(value);
                    await refresh();
                    toast.success("Opening balance added");
                  }}
                />
              )}
              {page === "transfer" && (
                <TransferPage
                  items={items}
                  locations={locations}
                  movements={stockMovements}
                  onTransfer={async (value) => {
                    const result = await window.office.stock.transfer(value);
                    await refresh();
                    toast.success(`Transfer ${result.transferId} saved`);
                  }}
                />
              )}
              {(page === "purchase" || page === "sale") && (
                <ChallanPage
                  type={page === "purchase" ? "PURCHASE" : "SALE"}
                  rows={challans.filter(
                    (row) =>
                      row.type === (page === "purchase" ? "PURCHASE" : "SALE"),
                  )}
                  items={items}
                  movements={stockMovements}
                  accounts={accounts}
                  locations={locations}
                  company={companyProfile}
                  logo={companyLogo}
                  onPost={async (value) => {
                    await window.office.challans.post(value);
                    await refresh();
                  }}
                  onUpdate={async (value) => {
                    await window.office.challans.update(value);
                    await refresh();
                  }}
                  onDelete={async (number) => {
                    await window.office.challans.remove(number);
                    await refresh();
                  }}
                />
              )}
              {page === "cheques" && (
                <ChequePage
                  rows={cheques}
                  banks={banks}
                  accounts={accounts}
                  onSave={async (value) => {
                    await window.office.cheques.save(value);
                    await refresh();
                  }}
                  onDelete={async (number) => {
                    await window.office.cheques.remove(number);
                    await refresh();
                  }}
                />
              )}
              {page === "journal" && (
                <Suspense fallback={<PageLoading />}>
                  <VoucherEntryPage
                    type="JOURNAL VOUCHER"
                    accounts={accounts}
                    banks={banks}
                    cheques={cheques}
                    vouchers={vouchers.filter((row) =>
                      row.type === "VOUCHER" || row.type === "JOURNAL VOUCHER",
                    )}
                    company={companyProfile}
                    logo={companyLogo}
                    onSave={async (value) => {
                      await window.office.vouchers.save(value);
                      await refresh();
                      toast.success(`${value.type} saved`);
                    }}
                    onCreateCheque={async (value) => {
                      const saved = await window.office.cheques.save(value);
                      await refresh();
                      return saved;
                    }}
                    onDelete={async (number) => {
                      await window.office.vouchers.remove(number);
                      await refresh();
                      toast.success("Voucher deleted");
                    }}
                  />
                </Suspense>
              )}
              {page === "reports" && (
                <Suspense fallback={<PageLoading />}>
                  <FullReportsPage
                    reportName={selectedReport}
                    onReportChange={setSelectedReport}
                    challans={challans}
                    items={items}
                    accounts={accounts}
                    banks={banks}
                    movements={stockMovements}
                    cheques={cheques}
                    vouchers={vouchers}
                    company={companyProfile}
                    logo={companyLogo}
                    onOpenRecord={(target, code) => {
                      setQuery(code);
                      navigate(target);
                    }}
                    canOpenItems={isAllowed("items")}
                    canOpenAccounts={isAllowed("accounts")}
                    canOpenBanks={isAllowed("banks")}
                  />
                </Suspense>
              )}
              {page === "users" && isAdministrator && adminToolsUnlocked && (
                <UserRightsPage
                  currentUsername={session.username}
                  isAdministrator={isAdministrator}
                  users={users}
                  onRefresh={() =>
                    void window.office.users.list().then(setUsers)
                  }
                  onSave={async (value) => {
                    const updated = await window.office.users.save(value);
                    setUsers(await window.office.users.list());
                    if (updated.username === session.username)
                      setSession((current) =>
                        current
                          ? { ...current, permissions: updated.permissions }
                          : current,
                      );
                    toast.success("User rights saved");
                  }}
                  onDelete={async (username) => {
                    await window.office.users.remove(username);
                    setUsers(await window.office.users.list());
                    toast.success("User deleted");
                  }}
                />
              )}
              {page === "audit" && (
                <AuditLogPage
                  events={auditEvents}
                  onRefresh={() =>
                    void window.office.audit.list().then(setAuditEvents)
                  }
                />
              )}
              {page === "settings" && (
                <SettingsPage darkMode={darkMode} onThemeChange={setDarkMode} />
              )}
              {page === "manual" && <ManualPage />}
              {page === "keybindings" && <KeybindingsPage />}
            </main>
          </div>
          <footer className="flex shrink-0 items-center justify-between px-2 text-xs text-muted-foreground">
            <span>Ready · Data stored on this computer</span>
            <span className="hidden sm:inline">{dashboard?.today ?? today()}</span>
          </footer>
          <CommandDialog
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            title="Navigation"
            description="Search permitted pages and reports."
          >
            <Command value={undefined} shouldFilter={false}>
              <CommandInput
                placeholder="Search pages and reports..."
                value={paletteQuery}
                onValueChange={setPaletteQuery}
              />
              <CommandList>
                <CommandEmpty>No matching pages or reports.</CommandEmpty>
                {permittedNav.filter(
                  ({ label }) =>
                    !paletteQuery.trim() || matchesPaletteText(label),
                ).length > 0 && (
                  <CommandGroup heading="Pages">
                    {permittedNav
                      .filter(
                        ({ label }) =>
                          !paletteQuery.trim() || matchesPaletteText(label),
                      )
                      .map(({ id, label, icon: Icon }) => (
                        <CommandItem
                          key={id}
                          value={`page ${label}`}
                          onSelect={() => navigate(id)}
                        >
                          <Icon />
                          {label}
                          <CommandShortcut>Open</CommandShortcut>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                )}
                {isAllowed("reports") &&
                  REPORT_NAMES.filter(
                    (name) =>
                      !paletteQuery.trim() || matchesPaletteText(name),
                  ).length > 0 && (
                    <>
                      <CommandSeparator />
                      <CommandGroup heading="Reports">
                        {REPORT_NAMES.filter(
                          (name) =>
                            !paletteQuery.trim() || matchesPaletteText(name),
                        ).map((name) => (
                          <CommandItem
                            key={`report-${name}`}
                            value={`report ${name}`}
                            onSelect={() => {
                              setSelectedReport(name);
                              navigate("reports");
                            }}
                          >
                            <FileClock />
                            {name}
                            <CommandShortcut>Report</CommandShortcut>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
              </CommandList>
            </Command>
          </CommandDialog>
          <Dialog
            open={adminToolsPromptOpen}
            onOpenChange={(open) => {
              if (adminToolsVerifying) return;
              if (open) setAdminToolsPromptOpen(true);
              else cancelAdminToolsPrompt();
            }}
          >
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Administrator access</DialogTitle>
                <DialogDescription>
                  Enter your administrator password to open User Rights or
                  Database Tools. These pages lock again after 10 minutes.
                </DialogDescription>
              </DialogHeader>
              <form
                className="grid gap-4"
                onSubmit={(event) => void unlockAdminTools(event)}
              >
                <Field
                  label="Administrator password"
                  id="admin-tools-unlock-password"
                >
                  <Input
                    id="admin-tools-unlock-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    autoFocus
                    value={adminToolsPasswordInput}
                    onChange={(event) =>
                      setAdminToolsPasswordInput(event.target.value)
                    }
                  />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={adminToolsVerifying}
                    onClick={cancelAdminToolsPrompt}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={adminToolsVerifying || !adminToolsPasswordInput}
                  >
                    {adminToolsVerifying ? "Checking…" : "Continue"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader className="sr-only">
                <DialogTitle>About</DialogTitle>
              </DialogHeader>
              <CompanyBusinessCard
                company={companyProfile}
                logo={companyLogo}
                variant="card"
              />
            </DialogContent>
          </Dialog>
          <AlertDialog
            open={confirmAction !== null}
            onOpenChange={(open) => {
              if (!open) setConfirmAction(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {displayedConfirmAction === "logout"
                    ? "Log out of this office session?"
                    : "Quit TradeLedger Office?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {displayedConfirmAction === "logout"
                    ? `You will be signed out as ${session.username}. Unsaved form changes may be lost.`
                    : "The application will close. Any unsaved form changes may be lost."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfirmAction(null)}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    const action = confirmAction;
                    setConfirmAction(null);
                    if (action === "logout")
                      void window.office.auth
                        .logout()
                        .then(() => {
                          setSession(null);
                          setPage("home");
                          setHistory(["home"]);
                          setHistoryIndex(0);
                        })
                        .catch((error) =>
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Could not log out",
                          ),
                        );
                    else if (action === "quit") void window.office.app.quit();
                  }}
                >
                  {displayedConfirmAction === "logout" ? "Log out" : "Quit"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Toaster
            theme={darkMode ? "dark" : "light"}
            richColors
            position="bottom-right"
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuGroup>
          <ContextMenuLabel>TradeLedger Office</ContextMenuLabel>
          <ContextMenuItem onClick={() => navigate("home")}>
            <Home />
            Home<ContextMenuShortcut>Alt+Home</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={openGlobalSearch}>
            <Search />
            Global search<ContextMenuShortcut>Ctrl+Shift+F</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              setPaletteQuery("");
              setPaletteOpen(true);
            }}
          >
            <Menu />
            Navigation<ContextMenuShortcut>Ctrl+K</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={() => navigate("keybindings")}>
            <Keyboard />
            Keybindings<ContextMenuShortcut>F1</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => void refresh()} disabled={busy}>
          <RefreshCw />
          Refresh data<ContextMenuShortcut>F5</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => runMenuAction("reload")}>
          <RefreshCw />
          Reload application<ContextMenuShortcut>Ctrl+R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={goBack} disabled={historyIndex === 0}>
          <ArrowLeft />
          Back<ContextMenuShortcut>Alt+←</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={goForward}
          disabled={historyIndex >= history.length - 1}
        >
          <ArrowRight />
          Forward<ContextMenuShortcut>Alt+→</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
