import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowLeft, ArrowLeftRight, ArrowRight, ArrowUpFromLine, BookOpen, Building2, Database, FileClock, Home, Keyboard, Landmark, LayoutDashboard, LogOut, Moon, Package, RefreshCw, Search, Settings2, Shield, Sun, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Command, CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '@/components/ui/command'
import { Toaster } from '@/components/ui/sonner'
import type { Account, AuditEvent, Bank, Challan, Cheque, CompanyProfile, Dashboard, Item, OfficeConnection, OfficeSession, OfficeUser, OpeningBalance, StockMovement, StockType, Voucher } from '@/types'
import { Menubar, MenubarContent, MenubarItem, MenubarMenu, MenubarSeparator, MenubarShortcut, MenubarSub, MenubarSubContent, MenubarSubTrigger, MenubarTrigger } from '@/components/ui/menubar'
import { REPORT_NAMES } from '@/lib/report-names'
import { matchAppKeybinding } from '@/lib/app-keybindings'
import { ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuLabel, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from '@/components/ui/context-menu'
import { SignInPage } from '@/features/auth/SignInPage'
import { PageLoading } from '@/app/PageLoading'
import { CompanyProfilePage } from '@/features/company/CompanyProfilePage'
import { AuditLogPage, UserRightsPage } from '@/features/access/AdminPages'
import { LocationsPage, OpeningBalancesPage, StockTypesPage, TransferPage } from '@/features/inventory/StockPages'
import { KeybindingsPage, ReferenceManualPage, SettingsPage } from '@/features/settings/SettingsPages'
import { CompanyBusinessCard, DashboardPage } from '@/features/dashboard/DashboardPage'
import { AccountsTable, BanksTable, ItemsTable, MasterPage } from '@/features/masters/MasterPages'
import { ChallanPage } from '@/features/challans/ChallanPage'
import { ChequePage } from '@/features/cheques/ChequePage'
import type { Page } from '@/app/navigation'
import { todayIsoDate as today } from '@/lib/formatters'
import { pageNames, reportGroups } from '@/app/navigation'

const DatabaseToolsPage = lazy(() => import('@/features/database/DatabaseToolsPage').then(({ DatabaseToolsPage: Page }) => ({ default: Page })))

const PaymentSearchPage = lazy(() => import('@/features/payments/PaymentSearchPage').then(({ PaymentSearchPage: Page }) => ({ default: Page })))

const FullReportsPage = lazy(() => import('@/features/reports/ReportsPage').then(({ ReportsPage: Page }) => ({ default: Page })))

const VoucherEntryPage = lazy(() => import('@/features/vouchers/VoucherEntryPage').then(({ VoucherEntryPage: Page }) => ({ default: Page })))

type SearchRecord = { page: Page; title: string; detail: string; kind: string; fields: Record<string, string> }

function searchParts(query: string) {
  const tokens = query.match(/"[^"]+"|\S+/g)?.map((token) => token.replace(/^"|"$/g, '')) ?? []
  const kinds: string[] = []
  const fields: string[] = []
  const terms: string[] = []
  for (const token of tokens) {
    const qualifier = token.match(/^(type|in):(.+)$/i)
    if (!qualifier) { terms.push(token.toLowerCase()); continue }
    if (qualifier[1].toLowerCase() === 'type') kinds.push(qualifier[2].toLowerCase())
    else fields.push(qualifier[2].toLowerCase())
  }
  return { kinds, fields, terms, plain: terms.join(' ') }
}

function matchesRecord(record: SearchRecord, query: string) {
  const parsed = searchParts(query)
  const kindAliases: Record<string, string[]> = {
    account: ['account'], item: ['item'], bank: ['bank'], challan: ['purchase-challan', 'sale-challan'],
    purchase: ['purchase-challan'], sale: ['sale-challan'], cheque: ['cheque'], voucher: ['voucher'],
    journal: ['journal-voucher'], payment: ['payment', 'receipt'], receipt: ['receipt'], opening: ['opening-balance'], transfer: ['transfer'],
  }
  if (parsed.kinds.length && !parsed.kinds.some((kind) => (kindAliases[kind] ?? [kind]).includes(record.kind))) return false
  const fieldEntries = Object.entries(record.fields)
  const scopedEntries = parsed.fields.length
    ? fieldEntries.filter(([field]) => parsed.fields.includes(field.toLowerCase()))
    : fieldEntries
  if (parsed.fields.length && !scopedEntries.length) return false
  const haystack = scopedEntries.map(([, value]) => value.toLowerCase()).join(' ')
  return parsed.terms.every((term) => haystack.includes(term))
}

export function App() {
  const [page, setPage] = useState<Page>('home')
  const [session, setSession] = useState<OfficeSession | null>(null)
  const [hasUsers, setHasUsers] = useState(true)
  const [companySetupNeeded, setCompanySetupNeeded] = useState(false)
  const [adminToolsPasswordConfigured, setAdminToolsPasswordConfigured] = useState(false)
  const [adminToolsUnlockedUntil, setAdminToolsUnlockedUntil] = useState<number | null>(null)
  const [adminToolsPromptOpen, setAdminToolsPromptOpen] = useState(false)
  const [adminToolsPasswordInput, setAdminToolsPasswordInput] = useState('')
  const [adminToolsVerifying, setAdminToolsVerifying] = useState(false)
  const [pendingAdminPage, setPendingAdminPage] = useState<Page | null>(null)
  const [pendingHistoryIndex, setPendingHistoryIndex] = useState<number | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [officeConnection, setOfficeConnection] = useState<OfficeConnection>({ mode: 'local' })
  const [history, setHistory] = useState<Page[]>(['home'])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [darkMode, setDarkMode] = useState(() => window.localStorage.getItem('purchase-sale-theme') === 'dark')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [confirmAction, setConfirmAction] = useState<'logout' | 'quit' | null>(null)
  const lastConfirmAction = useRef<'logout' | 'quit' | null>(null)
  if (confirmAction) lastConfirmAction.current = confirmAction
  const displayedConfirmAction = confirmAction ?? lastConfirmAction.current
  const [aboutOpen, setAboutOpen] = useState(false)
  const [users, setUsers] = useState<OfficeUser[]>([])
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([])
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [challans, setChallans] = useState<Challan[]>([])
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [stockTypes, setStockTypes] = useState<StockType[]>([])
  const [openingBalances, setOpeningBalances] = useState<OpeningBalance[]>([])
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [selectedReport, setSelectedReport] = useState('')
  const [locations, setLocations] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [devToolsAvailable, setDevToolsAvailable] = useState(false)

  useEffect(() => {
    void window.office.app.canOpenDevTools().then(setDevToolsAvailable).catch(() => setDevToolsAvailable(false))
  }, [])

  useEffect(() => window.office.app.onScreenshotDownloadComplete(({ state, path }) => {
    if (state === 'completed') toast.success(`Screenshot saved: ${path}`)
    else toast.error(`Screenshot save ${state}: ${path}`)
  }), [])

  useEffect(() => {
    const subscribe = window.office.auth.onSessionExpired
    if (typeof subscribe !== 'function') return
    return subscribe(() => {
      setSession(null)
    })
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const connection = await window.office.connection.get()
        setOfficeConnection(connection)
        const status = await window.office.auth.status()
        setHasUsers(status.hasUsers)
        setCompanySetupNeeded(!status.hasCompanyProfile)
        setAdminToolsPasswordConfigured(status.hasAdminToolsPassword)
        setAdminToolsUnlockedUntil(status.adminToolsUnlockedUntil)
        setSession(status.session)
        if (status.session) {
          const isAdministrator = status.session.permissions.includes('User Rights')
          setPage(isAdministrator && (!status.hasCompanyProfile || !status.hasAdminToolsPassword) ? 'company' : 'home')
        }
      } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not check office connection') }
      finally { setAuthLoading(false) }
    })()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.documentElement.style.colorScheme = darkMode ? 'dark' : 'light'
    window.localStorage.setItem('purchase-sale-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const refresh = useCallback(async (currentSession = session) => {
    setBusy(true)
    try {
      const can = (name: Page) => Boolean(currentSession?.permissions.includes(pageNames[name]))
      const canPrint = ['company', 'purchase', 'sale', 'voucher', 'journal', 'payment', 'reports'].some((name) => can(name as Page))
      const [summary, profile, logo, accountRows, itemRows, bankRows, challanRows, chequeRows, types, places, openings, movements, voucherRows] = await Promise.all([
        can('home') ? window.office.dashboard() : null,
        canPrint ? window.office.company.get() : null,
        canPrint ? window.office.company.logo() : null,
        can('accounts') || can('purchase') || can('sale') || can('reports') || can('voucher') || can('journal') || can('payment') || can('paymentSearch') ? window.office.accounts.list() : [],
        can('items') || can('purchase') || can('sale') || can('reports') ? window.office.items.list() : [],
        can('banks') || can('cheques') ? window.office.banks.list() : [],
        can('reports') || can('purchase') && can('sale') ? window.office.challans.list() : Promise.all([
          can('purchase') ? window.office.challans.list('PURCHASE') : Promise.resolve([]),
          can('sale') ? window.office.challans.list('SALE') : Promise.resolve([]),
        ]).then((groups) => groups.flat()),
        can('cheques') || can('reports') ? window.office.cheques.list() : [],
        can('items') || can('purchase') || can('sale') || can('stockTypes') ? window.office.stock.types() : [],
        can('items') || can('purchase') || can('sale') || can('opening') || can('transfer') || can('reports') || can('locations') ? window.office.stock.locations() : [],
        can('opening') ? window.office.stock.openings() : [],
        can('reports') || can('transfer') || can('opening') || can('locations') ? window.office.stock.movements() : [],
        can('reports') || can('voucher') || can('journal') || can('payment') || can('paymentSearch') ? window.office.vouchers.list() : [],
      ])
      setDashboard(summary); if (profile) setCompanyProfile(profile); setCompanyLogo(logo); setAccounts(accountRows); setItems(itemRows); setBanks(bankRows); setChallans(challanRows); setCheques(chequeRows); setStockTypes(types); setLocations(places); setOpeningBalances(openings); setStockMovements(movements); setVouchers(voucherRows)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load office data') }
    finally { setBusy(false) }
  }, [session])

  useEffect(() => { if (session) void refresh() }, [refresh, session])

  useEffect(() => {
    if (!session) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = window.office.sync.onDataChanged(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void (async () => {
          try {
            const status = await window.office.auth.status()
            setSession(status.session)
            if (status.session) {
              await refresh(status.session)
              setAdminToolsPasswordConfigured(status.hasAdminToolsPassword)
              setAdminToolsUnlockedUntil(status.adminToolsUnlockedUntil)
              if (page === 'users' && status.adminToolsUnlockedUntil && status.adminToolsUnlockedUntil > Date.now()) setUsers(await window.office.users.list())
              if (page === 'audit') setAuditEvents(await window.office.audit.list())
            }
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Could not refresh shared office data')
          }
        })()
      }, 150)
    })
    return () => { clearTimeout(timer); unsubscribe() }
  }, [page, refresh, session])

  useEffect(() => {
    if (!session) return
    if (page === 'users' && adminToolsUnlockedUntil && adminToolsUnlockedUntil > Date.now()) void window.office.users.list().then(setUsers).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load user rights'))
    if (page === 'audit') void window.office.audit.list().then(setAuditEvents).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load audit log'))
  }, [page, session, adminToolsUnlockedUntil])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = matchAppKeybinding(event)
      if (!action) return
      event.preventDefault()
      switch (action) {
        case 'search': setPaletteQuery(''); setPaletteOpen(true); break
        case 'back': goBack(); break
        case 'forward': goForward(); break
        case 'home': navigate('home'); break
        case 'keybindings': navigate('keybindings'); break
        case 'quit': setConfirmAction('quit'); break
        default: void window.office.app.menuAction(action).catch((error) => toast.error(error instanceof Error ? error.message : 'Keyboard action failed'))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const canOpenAdminTools = () => adminToolsUnlockedUntil !== null && adminToolsUnlockedUntil > Date.now()
  const commitNavigation = (nextPage: Page) => {
    setPage(nextPage); setQuery(''); setPaletteOpen(false)
    setHistory((current) => [...current.slice(0, historyIndex + 1), nextPage])
    setHistoryIndex((current) => current + 1)
  }
  const navigate = (nextPage: Page) => {
    const isAdministrator = session?.permissions.includes('User Rights') === true
    if (nextPage === 'company' && !isAdministrator) { toast.error('Only an administrator can open Company Profile'); return }
    if (companySetupNeeded && nextPage !== 'company') {
      toast.info(isAdministrator ? 'Finish company profile setup before using the office workspace' : 'Company setup is incomplete. Ask an administrator to finish setup.')
      if (isAdministrator) setPage('company')
      return
    }
    if (nextPage !== 'company' && !adminToolsPasswordConfigured && session?.permissions.includes('User Rights')) { setPage('company'); toast.info('Set an administrator password in Company Profile first'); return }
    if ((nextPage === 'users' || nextPage === 'database') && !session?.permissions.includes('User Rights')) { toast.error('Only an administrator can open this page'); return }
    if (nextPage !== 'settings' && nextPage !== 'keybindings' && !session?.permissions.includes(pageNames[nextPage])) { toast.error('Your account does not have access to that page'); return }
    if ((nextPage === 'users' || nextPage === 'database') && !canOpenAdminTools()) { setPendingAdminPage(nextPage); setPendingHistoryIndex(null); setAdminToolsPasswordInput(''); setAdminToolsPromptOpen(true); return }
    commitNavigation(nextPage)
  }
  const visitHistory = (next: number) => {
    const target = history[next]
    if (target === 'company' && !session?.permissions.includes('User Rights')) { setPage('home'); toast.error('Only an administrator can open Company Profile'); return }
    if ((target === 'users' || target === 'database') && !canOpenAdminTools()) { setPendingAdminPage(target); setPendingHistoryIndex(next); setAdminToolsPasswordInput(''); setAdminToolsPromptOpen(true); return }
    setHistoryIndex(next); setPage(target); setQuery('')
  }
  const goBack = () => { if (historyIndex > 0) visitHistory(historyIndex - 1) }
  const goForward = () => { if (historyIndex < history.length - 1) visitHistory(historyIndex + 1) }

  async function unlockAdminTools(event: React.FormEvent) {
    event.preventDefault(); setAdminToolsVerifying(true)
    try {
      const result = await window.office.security.unlockAdminTools(adminToolsPasswordInput)
      setAdminToolsUnlockedUntil(result.expiresAt)
      setAdminToolsPromptOpen(false); setAdminToolsPasswordInput('')
      const target = pendingAdminPage
      if (target) {
        if (pendingHistoryIndex !== null) { setHistoryIndex(pendingHistoryIndex); setPage(target); setQuery('') }
        else commitNavigation(target)
      }
      setPendingAdminPage(null); setPendingHistoryIndex(null)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not unlock admin-only pages') }
    finally { setAdminToolsVerifying(false) }
  }

  function cancelAdminToolsPrompt() {
    if ((page === 'users' || page === 'database') && !canOpenAdminTools()) setPage('home')
    setAdminToolsPromptOpen(false); setAdminToolsPasswordInput(''); setPendingAdminPage(null); setPendingHistoryIndex(null)
  }

  useEffect(() => {
    if (!adminToolsUnlockedUntil) return
    const timer = setTimeout(() => {
      setAdminToolsUnlockedUntil(null)
      setPage((current) => current === 'users' || current === 'database' ? 'home' : current)
      toast.info('Admin-only page access has locked again')
    }, Math.max(0, adminToolsUnlockedUntil - Date.now()))
    return () => clearTimeout(timer)
  }, [adminToolsUnlockedUntil])

  useEffect(() => {
    if (!session || (page !== 'users' && page !== 'database')) return
    if (!session.permissions.includes('User Rights')) { setPage('home'); return }
    if (!adminToolsPasswordConfigured) { setPage('company'); return }
    if (adminToolsUnlockedUntil && adminToolsUnlockedUntil > Date.now()) return
    setPendingAdminPage(page); setPendingHistoryIndex(null); setAdminToolsPasswordInput(''); setAdminToolsPromptOpen(true)
  }, [page, session, adminToolsPasswordConfigured, adminToolsUnlockedUntil])

  useEffect(() => {
    if (!session || page !== 'company' || session.permissions.includes('User Rights')) return
    setPage('home')
    toast.error('Only an administrator can open Company Profile')
  }, [page, session])

  const nav = [
    { id: 'home' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'company' as const, label: 'Company Profile', icon: Building2 },
    { id: 'accounts' as const, label: 'Chart of Accounts', icon: Building2 },
    { id: 'items' as const, label: 'Items', icon: Package },
    { id: 'banks' as const, label: 'Banks', icon: Landmark },
    { id: 'stockTypes' as const, label: 'Stock Types', icon: Package },
    { id: 'locations' as const, label: 'Locations', icon: Package },
    { id: 'opening' as const, label: 'Opening Balances', icon: ArrowDownToLine },
    { id: 'transfer' as const, label: 'Transfer', icon: ArrowLeftRight },
    { id: 'cheques' as const, label: 'Cheque Detail', icon: WalletCards },
    { id: 'voucher' as const, label: 'Voucher', icon: FileClock },
    { id: 'journal' as const, label: 'Journal Voucher', icon: FileClock },
    { id: 'paymentSearch' as const, label: 'Search Payment', icon: Search },
    { id: 'payment' as const, label: 'Payment / Receipt', icon: WalletCards },
    { id: 'purchase' as const, label: 'Purchase Challans', icon: ArrowDownToLine },
    { id: 'sale' as const, label: 'Sale Challans', icon: ArrowUpFromLine },
    { id: 'reports' as const, label: 'Reports', icon: FileClock },
    { id: 'users' as const, label: 'User Rights', icon: Shield },
    { id: 'audit' as const, label: 'Audit Log', icon: FileClock },
    { id: 'database' as const, label: 'Database Tools', icon: Database },
    { id: 'settings' as const, label: 'Settings', icon: Settings2 },
    { id: 'manual' as const, label: 'Manual', icon: BookOpen },
    { id: 'keybindings' as const, label: 'Keybindings', icon: Keyboard },
  ]

  if (authLoading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Checking sign-in…</div>
  if (!session) return <SignInPage setup={!hasUsers} connection={officeConnection} onInstallationAuthorized={(status) => { setHasUsers(status.hasUsers); setCompanySetupNeeded(!status.hasCompanyProfile); setAdminToolsPasswordConfigured(status.hasAdminToolsPassword); setCompanyProfile(status.companyProfile || null) }} onSuccess={(value) => { const isAdministrator = value.permissions.includes('User Rights'); setSession(value); setHasUsers(true); setPage(isAdministrator && (companySetupNeeded || !adminToolsPasswordConfigured) ? 'company' : 'home') }} />

  const isAdministrator = session.permissions.includes('User Rights')
  const adminToolsUnlocked = adminToolsUnlockedUntil !== null && adminToolsUnlockedUntil > Date.now()
  const permittedNav = nav.filter(({ id }) => (id === 'settings' || id === 'keybindings' || session.permissions.includes(pageNames[id])) && (isAdministrator || (id !== 'users' && id !== 'database' && id !== 'company')))
  const searchableRecords: SearchRecord[] = [
    ...accounts.map((row) => ({ page: 'accounts' as const, title: `${row.code} — ${row.description}`, detail: 'Chart of Accounts', kind: 'account', fields: { code: row.code, description: row.description, parent: row.parentCode ?? '' } })),
    ...items.map((row) => ({ page: 'items' as const, title: `${row.code} — ${row.description}`, detail: `Item · ${row.stockType}`, kind: 'item', fields: { code: row.code, description: row.description, unit: row.unit, stockType: row.stockType } })),
    ...banks.map((row) => ({ page: 'banks' as const, title: `${row.code} — ${row.name}`, detail: 'Bank', kind: 'bank', fields: { code: row.code, name: row.name, accountNumber: row.accountNumber ?? '' } })),
    ...challans.map((row) => ({ page: row.type === 'PURCHASE' ? 'purchase' as const : 'sale' as const, title: `${row.number} — ${row.party}`, detail: `${row.type} challan · ${row.date}`, kind: `${row.type.toLowerCase()}-challan`, fields: { number: row.number, date: row.date, party: row.party, location: row.location, total: String(row.total), type: row.type } })),
    ...cheques.map((row) => ({ page: 'cheques' as const, title: `${row.number} — ${row.party}`, detail: `Cheque · ${row.status} · ${row.date}`, kind: 'cheque', fields: { number: row.number, checkNumber: row.checkNumber ?? '', party: row.party, date: row.date, status: row.status, amount: String(row.amount) } })),
    ...vouchers.map((row) => {
      const page: Page = row.type === 'JOURNAL VOUCHER' ? 'journal' : row.type === 'VOUCHER' ? 'voucher' : session.permissions.includes(pageNames.paymentSearch) ? 'paymentSearch' : 'payment'
      return { page, title: `${row.number} — ${row.narration || row.type}`, detail: `${row.type} · ${row.date}`, kind: row.type === 'JOURNAL VOUCHER' ? 'journal-voucher' : row.type.toLowerCase(), fields: { number: row.number, type: row.type, date: row.date, reference: row.reference, narration: row.narration, account: row.lines.map((line) => line.accountCode).join(' '), amount: row.lines.map((line) => line.debit + line.credit).join(' ') } }
    }),
    ...openingBalances.map((row) => ({ page: 'opening' as const, title: `${row.itemCode} — ${row.itemDescription ?? 'Opening balance'}`, detail: `Opening balance · ${row.location} · ${row.date}`, kind: 'opening-balance', fields: { item: row.itemCode, description: row.itemDescription ?? '', location: row.location, date: row.date, quantity: String(row.quantity) } })),
    ...stockMovements.filter((row) => row.type.startsWith('TRANSFER')).map((row) => ({ page: 'transfer' as const, title: `${row.document} — ${row.itemCode}`, detail: `Stock transfer · ${row.location} · ${row.date}`, kind: 'transfer', fields: { number: row.document, item: row.itemCode, location: row.location, date: row.date, type: row.type, quantity: String(row.quantity) } })),
  ].filter((row) => session.permissions.includes(pageNames[row.page]))
  const matchedRecords = paletteQuery.trim().length >= 2 ? searchableRecords.filter((row) => matchesRecord(row, paletteQuery)).slice(0, 30) : []
  const searchText = searchParts(paletteQuery).plain

  const filteredItems = items.filter((row) => `${row.code} ${row.description} ${row.stockType}`.toLowerCase().includes(query.toLowerCase()))
  const filteredBanks = banks.filter((row) => `${row.code} ${row.name}`.toLowerCase().includes(query.toLowerCase()))

  const runMenuAction = (action: Parameters<typeof window.office.app.menuAction>[0]) => { void window.office.app.menuAction(action).catch((error) => toast.error(error instanceof Error ? error.message : 'Menu action failed')) }
  const isAllowed = (target: Page) => permittedNav.some(({ id }) => id === target)

  return <ContextMenu>
    <ContextMenuTrigger className="block min-h-svh select-text">
    <div className="flex h-svh min-h-0 flex-col gap-1.5 overflow-hidden bg-muted/50 p-2 sm:p-2.5">
    <header className="flex h-11 shrink-0 items-center gap-2 rounded-lg border bg-background px-3 shadow-sm">
      <div className="flex shrink-0 items-center gap-2">{companyLogo && <div className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted"><img src={companyLogo} alt="" className="size-7 object-contain" /></div>}<p className="max-w-44 truncate text-sm font-semibold leading-tight">{companyProfile?.name || 'TradeLedger Office'}</p></div>
      <Menubar className="min-w-0 flex-1 overflow-x-auto border-0 bg-transparent p-0">
        <MenubarMenu><MenubarTrigger>File</MenubarTrigger><MenubarContent><MenubarItem disabled={!isAllowed('purchase')} onClick={() => navigate('purchase')}>Purchase Challans…</MenubarItem><MenubarItem disabled={!isAllowed('sale')} onClick={() => navigate('sale')}>Sale Challans…</MenubarItem><MenubarSeparator /><MenubarItem disabled={!isAllowed('database')} onClick={() => navigate('database')}>Database tools…</MenubarItem><MenubarSeparator /><MenubarItem onClick={() => setConfirmAction('quit')}>Quit<MenubarShortcut>Alt+F4</MenubarShortcut></MenubarItem></MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>Edit</MenubarTrigger><MenubarContent><MenubarItem onClick={() => runMenuAction('undo')}>Undo<MenubarShortcut>Ctrl+Z</MenubarShortcut></MenubarItem><MenubarItem onClick={() => runMenuAction('redo')}>Redo<MenubarShortcut>Ctrl+Y</MenubarShortcut></MenubarItem><MenubarSeparator /><MenubarItem onClick={() => runMenuAction('cut')}>Cut<MenubarShortcut>Ctrl+X</MenubarShortcut></MenubarItem><MenubarItem onClick={() => runMenuAction('copy')}>Copy<MenubarShortcut>Ctrl+C</MenubarShortcut></MenubarItem><MenubarItem onClick={() => runMenuAction('paste')}>Paste<MenubarShortcut>Ctrl+V</MenubarShortcut></MenubarItem><MenubarItem onClick={() => runMenuAction('selectAll')}>Select all<MenubarShortcut>Ctrl+A</MenubarShortcut></MenubarItem></MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>View</MenubarTrigger><MenubarContent><MenubarItem onClick={() => setDarkMode((current) => !current)}>{darkMode ? 'Light theme' : 'Dark theme'}</MenubarItem>{devToolsAvailable && <><MenubarSeparator /><MenubarItem onClick={() => runMenuAction('devTools')}>Toggle Developer Tools</MenubarItem></>}<MenubarSeparator /><MenubarItem onClick={() => runMenuAction('reload')}>Reload<MenubarShortcut>Ctrl+R</MenubarShortcut></MenubarItem><MenubarItem onClick={() => runMenuAction('forceReload')}>Force reload</MenubarItem><MenubarSeparator /><MenubarItem onClick={() => runMenuAction('zoomIn')}>Zoom in<MenubarShortcut>Ctrl++</MenubarShortcut></MenubarItem><MenubarItem onClick={() => runMenuAction('zoomOut')}>Zoom out<MenubarShortcut>Ctrl+-</MenubarShortcut></MenubarItem><MenubarItem onClick={() => runMenuAction('resetZoom')}>Reset zoom</MenubarItem><MenubarItem onClick={() => runMenuAction('fullscreen')}>Toggle full screen</MenubarItem></MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>Masters</MenubarTrigger><MenubarContent>{(['accounts', 'items', 'banks', 'stockTypes', 'locations'] as Page[]).map((target) => <MenubarItem key={target} disabled={!isAllowed(target)} onClick={() => navigate(target)}>{pageNames[target]}</MenubarItem>)}</MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>Transactions</MenubarTrigger><MenubarContent>{(['purchase', 'sale', 'voucher', 'journal', 'payment', 'paymentSearch', 'cheques', 'opening', 'transfer'] as Page[]).map((target) => <MenubarItem key={target} disabled={!isAllowed(target)} onClick={() => navigate(target)}>{pageNames[target]}</MenubarItem>)}</MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>Reports</MenubarTrigger><MenubarContent>{reportGroups.map((group) => <MenubarSub key={group.label}><MenubarSubTrigger disabled={!isAllowed('reports')}>{group.label}</MenubarSubTrigger><MenubarSubContent>{group.reports.map((name) => <MenubarItem key={name} disabled={!isAllowed('reports')} onClick={() => { setSelectedReport(name); navigate('reports') }}>{name}</MenubarItem>)}</MenubarSubContent></MenubarSub>)}</MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>Administration</MenubarTrigger><MenubarContent>{(['company', 'users', 'audit', 'database', 'settings'] as Page[]).map((target) => <MenubarItem key={target} disabled={!isAllowed(target)} onClick={() => navigate(target)}>{pageNames[target]}</MenubarItem>)}</MenubarContent></MenubarMenu>
        <MenubarMenu><MenubarTrigger>Help</MenubarTrigger><MenubarContent><MenubarItem disabled={!isAllowed('manual')} onClick={() => navigate('manual')}>User manual</MenubarItem><MenubarItem onClick={() => navigate('keybindings')}>Keybindings <MenubarShortcut>F1</MenubarShortcut></MenubarItem><MenubarSeparator /><MenubarItem onClick={() => setAboutOpen(true)}><Building2 data-icon="inline-start" />About</MenubarItem></MenubarContent></MenubarMenu>
      </Menubar>
      <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">{session.username}</Badge>
    </header>
    <nav aria-label="Application toolbar" className="flex h-9 shrink-0 min-w-0 items-center gap-1 px-0.5">
      <div className="flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" size="icon-sm" aria-label="Back" title="Back (Alt+Left)" disabled={historyIndex === 0} onClick={goBack}><ArrowLeft /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Forward" title="Forward (Alt+Right)" disabled={historyIndex >= history.length - 1} onClick={goForward}><ArrowRight /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Home" title="Home" onClick={() => navigate('home')}><Home /></Button>
      </div>
      <Separator orientation="vertical" className="mx-1 h-5 data-vertical:self-center" />
      <h1 className="min-w-0 flex-1 truncate px-2 text-base font-semibold">{pageNames[page]}</h1>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" size="icon-sm" aria-label="Global search and commands" title="Search / commands (Ctrl+K)" onClick={() => { setPaletteQuery(''); setPaletteOpen(true) }}><Search /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Refresh" title="Refresh data" onClick={() => void refresh()} disabled={busy}><RefreshCw className={busy ? 'animate-spin' : ''} /></Button>
      </div>
      <Separator orientation="vertical" className="mx-1 h-5 data-vertical:self-center" />
      <div className="flex shrink-0 items-center gap-0.5">
        <Button variant="ghost" size="icon-sm" aria-label="Manual" title="Manual" onClick={() => navigate('manual')}><BookOpen /></Button>
        <Button variant="ghost" size="icon-sm" aria-label={darkMode ? 'Light theme' : 'Dark theme'} title={darkMode ? 'Light theme' : 'Dark theme'} onClick={() => setDarkMode((current) => !current)}>{darkMode ? <Sun /> : <Moon />}</Button>
      </div>
      <Separator orientation="vertical" className="mx-1 h-5 data-vertical:self-center" />
      <Button variant="ghost" size="icon-sm" aria-label="Log out" title="Log out" onClick={() => setConfirmAction('logout')}><LogOut /></Button>
    </nav>
    <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col overflow-y-auto rounded-xl border bg-background p-4 shadow-sm md:p-5">
        {page === 'home' && <DashboardPage dashboard={dashboard} onNavigate={navigate} allowedPages={permittedNav.map(({ id }) => id)} username={session.username} company={companyProfile} logo={companyLogo} />}
        {page === 'database' && isAdministrator && adminToolsUnlocked && <Suspense fallback={<PageLoading />}><DatabaseToolsPage connection={officeConnection} isAdministrator={isAdministrator} /></Suspense>}
        {page === 'company' && isAdministrator && <CompanyProfilePage profile={companyProfile} onboarding={companySetupNeeded} isAdministrator={isAdministrator} adminToolsPasswordConfigured={adminToolsPasswordConfigured} onSave={async (value, password) => { const saved = await window.office.company.save(value); if (password) { await window.office.security.configureAdminToolsPassword(password); setAdminToolsPasswordConfigured(true); setAdminToolsUnlockedUntil(null) } setCompanyProfile(saved); setCompanySetupNeeded(false); await refresh(); toast.success(password ? 'Company profile and administrator password saved' : 'Company profile saved'); if (companySetupNeeded || password && !adminToolsPasswordConfigured) { setPage('home'); setHistory(['home']); setHistoryIndex(0) } }} />}
        {page === 'accounts' && <MasterPage title="Chart of Accounts" description="Organize parties and ledger accounts in a parent-child chart." search={query} onSearch={setQuery}>
          <AccountsTable accounts={accounts} query={query} onSave={async (value) => { await window.office.accounts.save(value); await refresh() }} onDelete={async (code) => { await window.office.accounts.remove(code); await refresh() }} />
        </MasterPage>}
        {page === 'items' && <MasterPage title="Items" description="Manage products, rates, and inventory quantities by location." search={query} onSearch={setQuery}>
          <ItemsTable rows={filteredItems} stockTypes={stockTypes} locations={locations} onSave={async (value) => { await window.office.items.save(value); await refresh() }} onDelete={async (code) => { await window.office.items.remove(code); await refresh() }} />
        </MasterPage>}
        {page === 'banks' && <MasterPage title="Banks" description="Bank master records used by cheque and payment workflows." search={query} onSearch={setQuery}>
          <BanksTable rows={filteredBanks} accounts={accounts} onSave={async (value) => { await window.office.banks.save(value); await refresh() }} onDelete={async (code) => { await window.office.banks.remove(code); await refresh() }} />
        </MasterPage>}
        {page === 'stockTypes' && <StockTypesPage rows={stockTypes} onSave={async (value) => { const saved = await window.office.stock.saveType(value); setStockTypes(await window.office.stock.types()); toast.success(`Stock type ${saved.code} saved`) }} onDelete={async (code) => { await window.office.stock.removeType(code); setStockTypes(await window.office.stock.types()) }} />}
        {page === 'locations' && <LocationsPage locations={locations} movements={stockMovements} onSave={async (name) => { await window.office.locations.save(name); await refresh() }} onDelete={async (name) => { await window.office.locations.remove(name); await refresh() }} />}
        {page === 'opening' && <OpeningBalancesPage rows={openingBalances} items={items} locations={locations} onAdd={async (value) => { await window.office.stock.addOpening(value); await refresh(); toast.success('Opening balance added') }} />}
        {page === 'transfer' && <TransferPage items={items} locations={locations} movements={stockMovements} onTransfer={async (value) => { const result = await window.office.stock.transfer(value); await refresh(); toast.success(`Transfer ${result.transferId} saved`) }} />}
        {(page === 'purchase' || page === 'sale') && <ChallanPage type={page === 'purchase' ? 'PURCHASE' : 'SALE'} rows={challans.filter((row) => row.type === (page === 'purchase' ? 'PURCHASE' : 'SALE'))} items={items} accounts={accounts} locations={locations} stockTypes={stockTypes} company={companyProfile} logo={companyLogo} onPost={async (value) => { await window.office.challans.post(value); await refresh() }} onUpdate={async (value) => { await window.office.challans.update(value); await refresh() }} onDelete={async (number) => { await window.office.challans.remove(number); await refresh() }} onCreateItem={async (item) => { const saved = await window.office.items.createForChallan({ type: page === 'purchase' ? 'PURCHASE' : 'SALE', item }); await refresh(); return saved }} />}
        {page === 'cheques' && <ChequePage rows={cheques} banks={banks} accounts={accounts} onSave={async (value) => { await window.office.cheques.save(value); await refresh() }} onDelete={async (number) => { await window.office.cheques.remove(number); await refresh() }} />}
        {(page === 'voucher' || page === 'journal' || page === 'payment') && <Suspense fallback={<PageLoading />}><VoucherEntryPage type={page === 'voucher' ? 'VOUCHER' : page === 'journal' ? 'JOURNAL VOUCHER' : 'PAYMENT'} accounts={accounts} vouchers={vouchers.filter((row) => page === 'voucher' ? row.type === 'VOUCHER' : page === 'journal' ? row.type === 'JOURNAL VOUCHER' : row.type === 'PAYMENT' || row.type === 'RECEIPT')} company={companyProfile} logo={companyLogo} onSave={async (value) => { await window.office.vouchers.save(value); await refresh(); toast.success(`${value.type} saved`) }} onDelete={async (number) => { await window.office.vouchers.remove(number); await refresh(); toast.success('Voucher deleted') }} /></Suspense>}
        {page === 'paymentSearch' && <Suspense fallback={<PageLoading />}><PaymentSearchPage vouchers={vouchers.filter((row) => row.type === 'PAYMENT' || row.type === 'RECEIPT')} accounts={accounts} /></Suspense>}
        {page === 'reports' && <Suspense fallback={<PageLoading />}><FullReportsPage reportName={selectedReport} onReportChange={setSelectedReport} challans={challans} items={items} accounts={accounts} banks={banks} movements={stockMovements} cheques={cheques} vouchers={vouchers} company={companyProfile} logo={companyLogo} onOpenRecord={(target, code) => { setQuery(code); navigate(target) }} canOpenItems={isAllowed('items')} canOpenAccounts={isAllowed('accounts')} canOpenBanks={isAllowed('banks')} /></Suspense>}
        {page === 'users' && isAdministrator && adminToolsUnlocked && <UserRightsPage currentUsername={session.username} isAdministrator={isAdministrator} users={users} onRefresh={() => void window.office.users.list().then(setUsers)} onSave={async (value) => { const updated = await window.office.users.save(value); setUsers(await window.office.users.list()); if (updated.username === session.username) setSession((current) => current ? { ...current, permissions: updated.permissions } : current); toast.success('User rights saved') }} onDelete={async (username) => { await window.office.users.remove(username); setUsers(await window.office.users.list()); toast.success('User deleted') }} />}
        {page === 'audit' && <AuditLogPage events={auditEvents} onRefresh={() => void window.office.audit.list().then(setAuditEvents)} />}
        {page === 'settings' && <SettingsPage darkMode={darkMode} onThemeChange={setDarkMode} />}
        {page === 'manual' && <ReferenceManualPage />}
        {page === 'keybindings' && <KeybindingsPage />}
    </main>
    <footer className="flex shrink-0 items-center justify-between px-2 text-xs text-muted-foreground"><span>Ready · Data stored on this computer</span><span>{dashboard?.today ?? today()}</span></footer>
    <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen} title="Navigation and global search" description="Search permitted office records. Qualifiers: type:challan, type:cheque, in:party, in:date.">
      <Command value={undefined} shouldFilter={false}>
        <CommandInput placeholder="Search records (e.g. type:challan in:party Acme)…" value={paletteQuery} onValueChange={setPaletteQuery} />
        <CommandList>
          {permittedNav.filter(({ label }) => !searchText || label.toLowerCase().includes(searchText.toLowerCase())).length > 0 && <CommandGroup heading="Pages">{permittedNav.filter(({ label }) => !searchText || label.toLowerCase().includes(searchText.toLowerCase())).map(({ id, label, icon: Icon }) => <CommandItem key={id} value={`page ${label}`} onSelect={() => navigate(id)}><Icon />{label}<CommandShortcut>Open</CommandShortcut></CommandItem>)}</CommandGroup>}
          {matchedRecords.length > 0 && <><CommandSeparator /><CommandGroup heading={`Records · ${matchedRecords.length} shown`}>{matchedRecords.map((record) => <CommandItem key={`${record.page}-${record.title}`} value={`${record.title} ${record.detail}`} onSelect={() => navigate(record.page)}><Search />{record.title}<CommandShortcut>{record.detail}</CommandShortcut></CommandItem>)}</CommandGroup></>}
          {isAllowed('reports') && REPORT_NAMES.filter((name) => !searchText || name.toLowerCase().includes(searchText.toLowerCase())).length > 0 && <><CommandSeparator /><CommandGroup heading="Reports">{REPORT_NAMES.filter((name) => !searchText || name.toLowerCase().includes(searchText.toLowerCase())).map((name) => <CommandItem key={`report-${name}`} value={`report ${name}`} onSelect={() => { setSelectedReport(name); navigate('reports') }}><FileClock />{name}<CommandShortcut>Report</CommandShortcut></CommandItem>)}</CommandGroup></>}
          <CommandSeparator /><CommandGroup heading="Common actions">
            <CommandItem value="open purchase challans" disabled={!isAllowed('purchase')} onSelect={() => navigate('purchase')}><ArrowDownToLine />Open purchase challans</CommandItem>
            <CommandItem value="open sale challans" disabled={!isAllowed('sale')} onSelect={() => navigate('sale')}><ArrowUpFromLine />Open sale challans</CommandItem>
            <CommandItem value="database backup export verify tools" disabled={!isAllowed('database')} onSelect={() => navigate('database')}><Database />Database tools</CommandItem>
            <CommandItem value="action refresh" onSelect={() => { setPaletteOpen(false); void refresh() }}><RefreshCw />Refresh data</CommandItem>
            <CommandItem value="action home" onSelect={() => navigate('home')}><Home />Go to overview</CommandItem>
            <CommandItem value="action theme dark light" onSelect={() => { setDarkMode((current) => !current); setPaletteOpen(false) }}>{darkMode ? <Sun /> : <Moon />}{darkMode ? 'Light theme' : 'Dark theme'}</CommandItem>
            <CommandItem value="action logout" onSelect={() => { setPaletteOpen(false); setConfirmAction('logout') }}><LogOut />Log out</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
    <Dialog open={adminToolsPromptOpen} onOpenChange={(open) => { if (adminToolsVerifying) return; if (open) setAdminToolsPromptOpen(true); else cancelAdminToolsPrompt() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Administrator access</DialogTitle><DialogDescription>Enter your administrator password to open User Rights or Database Tools. These pages lock again after 10 minutes.</DialogDescription></DialogHeader>
        <form className="grid gap-4" onSubmit={(event) => void unlockAdminTools(event)}><label className="grid gap-2 text-sm font-medium" htmlFor="admin-tools-unlock-password">Administrator password<Input id="admin-tools-unlock-password" type="password" autoComplete="current-password" required autoFocus value={adminToolsPasswordInput} onChange={(event) => setAdminToolsPasswordInput(event.target.value)} /></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={adminToolsVerifying} onClick={cancelAdminToolsPrompt}>Cancel</Button><Button type="submit" disabled={adminToolsVerifying || !adminToolsPasswordInput}>{adminToolsVerifying ? 'Checking…' : 'Continue'}</Button></div></form>
      </DialogContent>
    </Dialog>
    <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>About</DialogTitle><DialogDescription>Company details saved for this office workspace.</DialogDescription></DialogHeader>
        <CompanyBusinessCard company={companyProfile} logo={companyLogo} />
        <p className="text-center text-xs text-muted-foreground">TradeLedger Office · Local SQLite desktop application</p>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmAction !== null} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{displayedConfirmAction === 'logout' ? 'Log out of this office session?' : 'Quit TradeLedger Office?'}</AlertDialogTitle><AlertDialogDescription>{displayedConfirmAction === 'logout' ? `You will be signed out as ${session.username}. Unsaved form changes may be lost.` : 'The application will close. Any unsaved form changes may be lost.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel onClick={() => setConfirmAction(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { const action = confirmAction; setConfirmAction(null); if (action === 'logout') void window.office.auth.logout().then(() => { setSession(null); setPage('home'); setHistory(['home']); setHistoryIndex(0) }).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not log out')); else if (action === 'quit') void window.office.app.quit() }}>{displayedConfirmAction === 'logout' ? 'Log out' : 'Quit'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
    <Toaster theme={darkMode ? 'dark' : 'light'} richColors position="bottom-right" />
    </div>
    </ContextMenuTrigger>
    <ContextMenuContent className="w-60">
      <ContextMenuGroup>
        <ContextMenuLabel>TradeLedger Office</ContextMenuLabel>
        <ContextMenuItem onClick={() => navigate('home')}><Home />Overview<ContextMenuShortcut>Alt+Home</ContextMenuShortcut></ContextMenuItem>
        <ContextMenuItem onClick={() => { setPaletteQuery(''); setPaletteOpen(true) }}><Search />Global search<ContextMenuShortcut>Ctrl+K</ContextMenuShortcut></ContextMenuItem>
        <ContextMenuItem onClick={() => navigate('keybindings')}><Keyboard />Keybindings<ContextMenuShortcut>F1</ContextMenuShortcut></ContextMenuItem>
      </ContextMenuGroup>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={() => void refresh()} disabled={busy}><RefreshCw />Refresh data</ContextMenuItem>
      <ContextMenuItem onClick={() => runMenuAction('reload')}><RefreshCw />Reload application<ContextMenuShortcut>Ctrl+R</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onClick={goBack} disabled={historyIndex === 0}><ArrowLeft />Back<ContextMenuShortcut>Alt+←</ContextMenuShortcut></ContextMenuItem>
      <ContextMenuItem onClick={goForward} disabled={historyIndex >= history.length - 1}><ArrowRight />Forward<ContextMenuShortcut>Alt+→</ContextMenuShortcut></ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
}
