import { useEffect, useState } from 'react'
import { Archive, CheckCircle2, Download, FolderOpen, RefreshCw, Server, ShieldCheck, Square, Wifi } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DatabaseVerification, OfficeConnection, OfficeServerInfo } from '@/types'

const readableSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function DatabaseToolsPage({ connection, isAdministrator }: { connection: OfficeConnection; isAdministrator: boolean }) {
  const [working, setWorking] = useState<'backup' | 'export' | 'verify' | null>(null)
  const [verification, setVerification] = useState<DatabaseVerification | null>(null)
  const [server, setServer] = useState<OfficeServerInfo | null>(null)
  const [serverWorking, setServerWorking] = useState(false)
  const [autoStart, setAutoStart] = useState(false)

  if (!isAdministrator) return <section className="rounded-lg border bg-card p-6"><h1 className="text-xl font-semibold">Administrator access required</h1><p className="mt-1 text-sm text-muted-foreground">Only an administrator can use database tools.</p></section>

  useEffect(() => {
    if (connection.mode === 'local') {
      void window.office.server.status().then(setServer).catch(() => setServer(null))
      void window.office.server.getAutostart().then(setAutoStart).catch(() => setAutoStart(false))
    }
    else setServer(null)
  }, [connection.mode])

  async function changeAutoStart(enabled: boolean) {
    setServerWorking(true)
    try {
      setAutoStart(await window.office.server.setAutostart(enabled))
      if (enabled) setServer(await window.office.server.status())
      toast.success(enabled ? 'Host will start when this Windows user signs in' : 'Automatic host startup disabled; current sharing remains active')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update host startup setting')
    } finally { setServerWorking(false) }
  }

  async function run<T>(action: 'backup' | 'export' | 'verify', task: () => Promise<T>, done: (result: T) => void) {
    setWorking(action)
    try { done(await task()) }
    catch (error) { toast.error(error instanceof Error ? error.message : `Could not ${action} database`) }
    finally { setWorking(null) }
  }

  return <section className="flex flex-col gap-5">
    <div><h1 className="text-2xl font-semibold tracking-tight">Database Tools</h1><p className="mt-1 text-sm text-muted-foreground">Protect and inspect this computer’s local office database.</p></div>
    {connection.mode === 'remote' ? <Card><CardHeader><Wifi className="mb-1 size-5 text-primary" /><CardTitle className="text-base">Connected to shared office</CardTitle><CardDescription>Records and permissions are served by the office host.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p>Server: <code className="rounded bg-muted px-1">{connection.url}</code></p><p className="text-muted-foreground">Backups and verification run on the host computer. Do not use local database copies for shared work.</p></CardContent></Card> : <Card><CardHeader><Server className="mb-1 size-5 text-primary" /><CardTitle className="text-base">Share this office database</CardTitle><CardDescription>This computer remains the one authoritative database host.</CardDescription></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Keep this PC running while other operators use the app. Closing its window now minimizes it to the notification area while sharing is active. Start the server only on a trusted office network; outside-office access needs a private VPN.</p>{server ? <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm"><div><p className="font-medium">Give one HTTPS address to each client</p>{server.urls.length ? server.urls.map((url) => <p key={url}><code className="break-all">{url}</code></p>) : <p className="text-muted-foreground">No LAN address was detected. Check this PC’s network connection.</p>}</div><div><p className="font-medium">Trusted certificate fingerprint (SHA-256)</p><code className="break-all text-xs">{server.fingerprint}</code><p className="mt-1 text-xs text-muted-foreground">Share this fingerprint through a separate trusted channel so clients can verify they reached this PC.</p></div><p className="text-xs text-muted-foreground">For each operator device, first issue a credential from User Rights and share the JSON file and one-time passphrase separately. On the client, import the credential before entering this address and fingerprint. Then the operator signs in with their own account.</p><div><Button variant="outline" disabled={serverWorking} onClick={() => { setServerWorking(true); void window.office.server.stop().then(() => setServer(null)).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not stop office server')).finally(() => setServerWorking(false)) }}><Square data-icon="inline-start" />Stop shared access</Button></div></div> : <Button disabled={!isAdministrator || serverWorking} onClick={() => { setServerWorking(true); void window.office.server.start().then(setServer).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not start office server')).finally(() => setServerWorking(false)) }}><Wifi data-icon="inline-start" />{serverWorking ? 'Starting…' : 'Start shared office server'}</Button>}{isAdministrator && <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input className="mt-1 size-4 accent-primary" type="checkbox" checked={autoStart} disabled={serverWorking || (!server && !autoStart)} onChange={(event) => void changeAutoStart(event.target.checked)} /><span><span className="font-medium">Start host when I sign in to Windows</span><span className="mt-1 block text-xs text-muted-foreground">Keeps sharing available after reboot, but only while this PC is on, this Windows account is signed in, and the app can reach the network. Disabling this does not stop an already running server.</span></span></label>}{!isAdministrator && <p className="text-xs text-muted-foreground">An administrator must start or stop shared access.</p>}</CardContent></Card>}
    <div className="grid gap-5 xl:grid-cols-3">
      <Card><CardHeader><Archive className="mb-1 size-5 text-primary" /><CardTitle className="text-base">Create a backup</CardTitle><CardDescription>Writes a consistent SQLite snapshot while the app is open.</CardDescription></CardHeader><CardContent className="grid gap-3"><p className="text-sm text-muted-foreground">Saved automatically in the app data folder’s <code className="rounded bg-muted px-1">backups</code> directory. Keep a copy on a separate drive for recovery.</p><div className="flex flex-wrap gap-2"><Button disabled={working !== null} onClick={() => void run('backup', () => window.office.database.backup(), (result) => toast.success(`Backup created · ${readableSize(result.bytes)} · ${result.path}`))}><Archive data-icon="inline-start" />{working === 'backup' ? 'Creating backup…' : 'Create backup now'}</Button><Button variant="outline" disabled={working !== null} onClick={() => void window.office.database.openBackups().catch((error) => toast.error(error instanceof Error ? error.message : 'Could not open backup folder'))}><FolderOpen data-icon="inline-start" />Open backup folder</Button></div></CardContent></Card>
      <Card><CardHeader><Download className="mb-1 size-5 text-primary" /><CardTitle className="text-base">Export office data</CardTitle><CardDescription>Save portable JSON records to a location you choose.</CardDescription></CardHeader><CardContent className="grid gap-3"><p className="text-sm text-muted-foreground">Includes company, accounts, inventory, transactions, and audit records. Password hashes and user credentials are excluded. This export is not a restorable database backup.</p><Button variant="outline" disabled={working !== null} onClick={() => void run('export', () => window.office.database.exportData(), (result) => { if (!result.canceled) toast.success(`Data export saved · ${result.path}`) })}><Download data-icon="inline-start" />{working === 'export' ? 'Exporting…' : 'Export data as JSON'}</Button></CardContent></Card>
      <Card><CardHeader><ShieldCheck className="mb-1 size-5 text-primary" /><CardTitle className="text-base">Verify database</CardTitle><CardDescription>Checks SQLite integrity and foreign-key references.</CardDescription></CardHeader><CardContent className="grid gap-3"><p className="text-sm text-muted-foreground">This is a diagnostic check, not a repair operation. Make a backup first if you suspect damage.</p><Button variant="outline" disabled={working !== null} onClick={() => void run('verify', () => window.office.database.verify(), (result) => { setVerification(result); toast[result.ok ? 'success' : 'error'](result.ok ? 'Database checks passed' : 'Database verification found issues') })}><RefreshCw data-icon="inline-start" className={working === 'verify' ? 'animate-spin' : ''} />{working === 'verify' ? 'Checking…' : 'Verify database now'}</Button></CardContent></Card>
    </div>
    {verification && <Card><CardHeader><div className="flex flex-wrap items-center gap-2"><CardTitle className="text-base">Latest verification</CardTitle><Badge variant={verification.ok ? 'secondary' : 'destructive'}>{verification.ok ? 'Passed' : 'Issues found'}</Badge></div><CardDescription>Checked {new Date(verification.checkedAt).toLocaleString()}. No data is changed by verification.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div><p className="mb-2 text-sm font-medium">SQLite integrity</p>{verification.integrity.map((line, index) => <p key={index} className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4" />{line}</p>)}</div><div><p className="mb-2 text-sm font-medium">Tables and records</p><div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">{Object.entries(verification.tableCounts).map(([table, count]) => <div key={table} className="contents"><span>{table.replaceAll('_', ' ')}</span><span className="text-right tabular-nums">{count}</span></div>)}</div></div>{verification.foreignKeyViolations.length > 0 && <div className="sm:col-span-2"><p className="mb-2 text-sm font-medium text-destructive">Foreign-key violations</p><pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(verification.foreignKeyViolations, null, 2)}</pre></div>}</CardContent></Card>}
    <p className="text-xs text-muted-foreground">The database remains on the host PC. Remote operators connect through encrypted HTTPS and the host checks their permissions for each operation. This is not a cloud service and does not provide conflict merging. Keep regular backups and do not expose the host directly to the public internet.</p>
  </section>
}
