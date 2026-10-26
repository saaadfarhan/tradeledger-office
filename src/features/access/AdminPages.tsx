import { useEffect, useState } from 'react'
import { Download, Plus, RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { AuditEvent, AuthorizedDevice, OfficeUser } from '@/types'
import { ConfirmActionDialog } from '@/components/feedback/ConfirmActionDialog'
import { FormSectionHeading } from '@/components/forms/FormSectionHeading'
import { pageNames, permissionPages, userPermissionPresets } from '@/app/navigation'
import { Field } from '@/components/forms/Fields'

export function UserRightsPage({ currentUsername, isAdministrator, users, onRefresh, onSave, onDelete }: { currentUsername: string; isAdministrator: boolean; users: OfficeUser[]; onRefresh: () => void; onSave: (value: { username: string; password: string; permissions: string[]; macAddress: string }) => Promise<void>; onDelete: (username: string) => Promise<void> }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [macAddress, setMacAddress] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])
  const [activePreset, setActivePreset] = useState('')
  const [editing, setEditing] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteUserOpen, setDeleteUserOpen] = useState(false)
  const [devices, setDevices] = useState<AuthorizedDevice[]>([])
  const [deviceUser, setDeviceUser] = useState('')
  const [deviceName, setDeviceName] = useState('')
  const [issuingDevice, setIssuingDevice] = useState(false)
  const [issuedPassphrase, setIssuedPassphrase] = useState('')
  useEffect(() => { if (isAdministrator) void window.office.devices.list().then(setDevices).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load authorized devices')) }, [isAdministrator])
  useEffect(() => {
    if (!isAdministrator) return
    return window.office.sync.onDataChanged(() => { void window.office.devices.list().then(setDevices).catch(() => {}) })
  }, [isAdministrator])
  const reset = () => { setUsername(''); setPassword(''); setMacAddress(''); setPermissions([]); setActivePreset(''); setEditing(false); setSheetOpen(false) }
  const selectUser = (user: OfficeUser) => { if (!isAdministrator) return; setUsername(user.username); setPassword(''); setMacAddress(user.macAddress || ''); setPermissions(user.permissions); setActivePreset(''); setEditing(true); setSheetOpen(true) }
  const newUser = () => { if (!isAdministrator) return; setUsername(''); setPassword(''); setMacAddress(''); setPermissions([]); setActivePreset(''); setEditing(false); setSheetOpen(true) }
  async function save(event: React.SubmitEvent) {
    event.preventDefault()
    if (!isAdministrator) return
    setSaving(true)
    try { await onSave({ username, password, permissions, macAddress }); reset() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save user') }
    finally { setSaving(false) }
  }
  async function remove() { if (!isAdministrator) return; try { await onDelete(username); reset() } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not delete user') } }
  async function issueDevice(event: React.FormEvent) {
    event.preventDefault()
    if (!isAdministrator || !deviceUser || !deviceName.trim()) return
    setIssuingDevice(true)
    try {
      const issued = await window.office.devices.create({ username: deviceUser, name: deviceName.trim() })
      setDevices(await window.office.devices.list())
      const file = new Blob([JSON.stringify(issued.bundle, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(file)
      const link = document.createElement('a'); link.href = url; link.download = `tradeledger-device-${issued.device.deviceId}.json`; link.click(); URL.revokeObjectURL(url)
      setIssuedPassphrase(issued.passphrase)
      setDeviceName('')
      toast.success('Device credential issued. Give its file and one-time passphrase to the user through separate trusted channels.')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not issue device credential') }
    finally { setIssuingDevice(false) }
  }
  async function revokeDevice(deviceId: string) {
    try { await window.office.devices.revoke(deviceId); setDevices(await window.office.devices.list()); toast.success('Device access revoked') }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not revoke device') }
  }
  if (!isAdministrator) return <section className="rounded-lg border bg-card p-6"><h1 className="text-xl font-semibold">Administrator access required</h1><p className="mt-1 text-sm text-muted-foreground">Only an administrator can manage office users.</p></section>
  return <section className="flex min-w-0 flex-col gap-4 sm:gap-5">
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><h1 className="text-xl font-semibold tracking-tight sm:text-2xl">User Rights</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Manage office accounts and the pages each account may open.</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={onRefresh}><RefreshCw data-icon="inline-start" />Refresh</Button><Button className="w-full sm:w-auto" size="sm" onClick={newUser}><Plus data-icon="inline-start" />New user</Button></div></div>
    <Tabs defaultValue="users" className="min-w-0">
      <TabsList className="grid w-full grid-cols-2 sm:w-fit"><TabsTrigger value="users">Users</TabsTrigger><TabsTrigger value="devices">Devices</TabsTrigger></TabsList>
      <TabsContent value="users" className="mt-2 min-w-0"><Card className="min-w-0"><CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3"><CardTitle className="text-base">Office users</CardTitle><CardDescription>Select a user to edit their account and page access.</CardDescription></CardHeader><CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
      <div className="grid gap-2 md:hidden">{users.map((user) => <div key={user.username} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="truncate font-medium">{user.username}{user.username === currentUsername && <Badge className="ml-2 align-middle" variant="secondary">You</Badge>}</p><p className="mt-1 text-xs text-muted-foreground">{user.permissions.length} accessible pages</p></div><Button size="sm" variant="outline" onClick={() => selectUser(user)}>Edit</Button></div>)}{!users.length && <p className="rounded-md border p-4 text-center text-sm text-muted-foreground">No users.</p>}</div>
      <div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow><TableHead>User name</TableHead><TableHead>Accessible pages</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{users.map((user) => <TableRow key={user.username}><TableCell className="font-medium">{user.username}{user.username === currentUsername && <Badge className="ml-2" variant="secondary">You</Badge>}</TableCell><TableCell>{user.permissions.length}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => selectUser(user)}>Edit rights</Button></TableCell></TableRow>)}{!users.length && <TableRow><TableCell colSpan={3} className="h-20 text-center text-muted-foreground">No users.</TableCell></TableRow>}</TableBody></Table></div>
    </CardContent></Card></TabsContent>
      <TabsContent value="devices" className="mt-2 min-w-0"><Card className="min-w-0"><CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-primary" />Authorized devices</CardTitle><CardDescription>Issue a device certificate tied to one user. Revoking it blocks future requests immediately.</CardDescription></CardHeader><CardContent className="grid min-w-0 gap-4 p-4 pt-0 sm:p-6 sm:pt-0">
      <form onSubmit={(event) => void issueDevice(event)} className="grid min-w-0 gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"><Field label="User account" id="device-user"><select id="device-user" className="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm" required value={deviceUser} onChange={(event) => setDeviceUser(event.target.value)}><option value="">Select user…</option>{users.map((user) => <option key={user.username} value={user.username}>{user.username}</option>)}</select></Field><Field label="Device name" id="device-name"><Input id="device-name" required maxLength={80} placeholder="Saad’s laptop" value={deviceName} onChange={(event) => setDeviceName(event.target.value)} /></Field><Button className="w-full sm:w-auto" type="submit" disabled={issuingDevice || !users.length}><Download data-icon="inline-start" />{issuingDevice ? 'Issuing…' : 'Issue credential'}</Button></form>
      {issuedPassphrase && <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm"><p className="font-medium">One-time passphrase for the downloaded file</p><code className="mt-1 block select-all break-all">{issuedPassphrase}</code><p className="mt-1 text-xs text-muted-foreground">Share the file and this passphrase through separate trusted channels. It will not be shown again.</p><Button className="mt-2" size="sm" variant="outline" onClick={() => setIssuedPassphrase('')}>Dismiss</Button></div>}
      <div className="grid gap-2 md:hidden">{devices.map((device) => <article key={device.deviceId} className="grid min-w-0 gap-3 rounded-lg border p-3"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium">{device.name}</p><p className="mt-1 text-sm text-muted-foreground">For {device.username} · issued {new Date(device.createdAt).toLocaleDateString()}</p></div><Badge className="shrink-0" variant={device.revokedAt ? 'destructive' : 'secondary'}>{device.revokedAt ? 'Revoked' : 'Active'}</Badge></div><code className="break-all text-xs text-muted-foreground">{device.fingerprint}</code>{!device.revokedAt && <Button className="w-full" size="sm" variant="outline" onClick={() => void revokeDevice(device.deviceId)}>Revoke device</Button>}</article>)}{!devices.length && <p className="rounded-md border p-4 text-center text-sm text-muted-foreground">No device credentials have been issued.</p>}</div>
      <div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow><TableHead>Device</TableHead><TableHead>User</TableHead><TableHead>Issued</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{devices.map((device) => <TableRow key={device.deviceId}><TableCell><span className="font-medium">{device.name}</span><code className="mt-1 block break-all text-xs text-muted-foreground">{device.fingerprint.slice(0, 20)}…</code></TableCell><TableCell>{device.username}</TableCell><TableCell className="whitespace-nowrap">{new Date(device.createdAt).toLocaleDateString()}</TableCell><TableCell><Badge variant={device.revokedAt ? 'destructive' : 'secondary'}>{device.revokedAt ? 'Revoked' : 'Active'}</Badge></TableCell><TableCell className="text-right">{!device.revokedAt && <Button size="sm" variant="outline" onClick={() => void revokeDevice(device.deviceId)}>Revoke</Button>}</TableCell></TableRow>)}{!devices.length && <TableRow><TableCell colSpan={5} className="h-16 text-center text-muted-foreground">No device credentials have been issued.</TableCell></TableRow>}</TableBody></Table></div>
      <p className="text-xs text-muted-foreground">Device private keys are encrypted with the recipient’s one-time passphrase in transit and protected by this computer’s OS after import.</p>
    </CardContent></Card></TabsContent>
    </Tabs>
    <p className="text-xs text-muted-foreground">Passwords are stored as salted PBKDF2 hashes. Page access is checked by the Electron data bridge as well as navigation.</p>
      <Sheet open={isAdministrator && sheetOpen} onOpenChange={(open) => { if (!isAdministrator) return; setSheetOpen(open); if (!open) { setUsername(''); setPassword(''); setMacAddress(''); setPermissions([]); setActivePreset(''); setEditing(false) } }}>
      <SheetContent side="right" className="flex data-[side=right]:w-[min(100vw,38rem)] flex-col gap-0 overflow-hidden p-0 data-[side=right]:sm:max-w-none">
        <SheetHeader className="border-b px-4 py-4 sm:px-6 sm:py-5"><SheetTitle>{editing ? `Edit ${username}` : 'Create office user'}</SheetTitle><SheetDescription>{editing ? 'Update this account’s page access. Leave password blank to keep the current password.' : 'Create a local sign-in account and choose the pages it may access.'}</SheetDescription></SheetHeader>
        <form onSubmit={(event) => void save(event)} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"><FieldGroup>
            <FormSectionHeading title="Account details" className="w-full" />
            <Field label="User name" id="user-rights-name"><Input id="user-rights-name" autoComplete="username" required maxLength={80} value={username} disabled={editing} onChange={(event) => setUsername(event.target.value)} /></Field>
            <Field label={editing ? 'New password (optional)' : 'Password'} id="user-rights-password"><Input id="user-rights-password" type="password" autoComplete="new-password" minLength={editing && !password ? undefined : 8} required={!editing} value={password} onChange={(event) => setPassword(event.target.value)} /><p className="text-xs text-muted-foreground">Passwords must contain at least 8 characters.</p></Field>
            <Field label="Allowed device MAC (optional)" id="user-rights-mac"><Input id="user-rights-mac" placeholder="AA:BB:CC:DD:EE:FF" value={macAddress} onChange={(event) => setMacAddress(event.target.value)} /><p className="text-xs text-muted-foreground">Leave blank to allow sign-in from any device. Shared-office sign-in can identify devices on the same local network.</p></Field>
            <FormSectionHeading title="Page access" className="w-full" />
            {!editing && <FieldSet className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <FieldLegend className="col-span-full" variant="label">Start with a preset (optional)</FieldLegend>
              {userPermissionPresets.map((preset) => <Button key={preset.name} type="button" variant={activePreset === preset.name ? 'secondary' : 'outline'} className="h-auto min-h-16 justify-start whitespace-normal px-3 py-2 text-left" onClick={() => { setActivePreset(preset.name); setPermissions(preset.permissions) }}><span className="flex flex-col items-start gap-1"><span className="font-medium">{preset.name}</span><span className="text-xs font-normal text-muted-foreground">{preset.description}</span></span></Button>)}
              <p className="col-span-full text-xs text-muted-foreground">Presets grant access to whole pages, including the actions available there. Review and adjust the page checkboxes below before creating the account.</p>
            </FieldSet>}
            <FieldSet className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              <FieldLegend className="col-span-full" variant="label">Choose accessible pages</FieldLegend>
              {permissionPages.map((key) => <label key={key} className="flex min-h-9 items-center gap-2 rounded-md border px-3 text-sm"><input className="size-4 accent-primary" type="checkbox" checked={permissions.includes(pageNames[key])} disabled={editing && username === currentUsername && !isAdministrator} onChange={(event) => { setActivePreset(''); setPermissions((current) => event.target.checked ? [...current, pageNames[key]] : current.filter((entry) => entry !== pageNames[key])) }} />{pageNames[key]}</label>)}
            </FieldSet>
            {editing && username === currentUsername && !isAdministrator && <p className="text-sm text-muted-foreground">Only an administrator can change your page permissions. You can still update your password here.</p>}
          </FieldGroup></div>
          <SheetFooter className="mt-0 flex-col-reverse items-stretch gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            {editing && username !== currentUsername ? <Button className="w-full sm:w-auto" type="button" variant="destructive" onClick={() => setDeleteUserOpen(true)}>Delete user</Button> : <span className="hidden sm:block" />}
            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto"><Button className="w-full" type="button" variant="outline" onClick={reset}>Cancel</Button><Button className="w-full" type="submit" disabled={saving || !username || !permissions.some((permission) => !['Overview', 'Manual'].includes(permission)) || (!editing && password.length < 8)}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create user'}</Button></div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
    <ConfirmActionDialog open={deleteUserOpen} onOpenChange={setDeleteUserOpen} title={`Delete user ${username}?`} description="This user will no longer be able to sign in to this office." confirmLabel="Delete user" onConfirm={() => { setDeleteUserOpen(false); void remove() }} />
  </section>
}

export function AuditLogPage({ events, onRefresh }: { events: AuditEvent[]; onRefresh: () => void }) {
  const [filter, setFilter] = useState('')
  const visible = events.filter((event) => `${event.eventTime} ${event.username} ${event.action} ${event.details}`.toLowerCase().includes(filter.toLowerCase()))
  return <section className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1><p className="mt-1 text-sm text-muted-foreground">Recent sign-ins and data changes recorded in this local database.</p></div><div className="flex gap-2"><Input className="w-56" placeholder="Filter audit entries" value={filter} onChange={(event) => setFilter(event.target.value)} /><Button variant="outline" onClick={onRefresh}><RefreshCw data-icon="inline-start" />Refresh</Button></div></div><Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>{visible.map((event, index) => <TableRow key={`${event.eventTime}-${event.action}-${index}`}><TableCell className="whitespace-nowrap tabular-nums">{new Date(event.eventTime).toLocaleString()}</TableCell><TableCell>{event.username}</TableCell><TableCell><Badge variant="secondary">{event.action}</Badge></TableCell><TableCell>{event.details || '—'}</TableCell></TableRow>)}{!visible.length && <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">{filter ? 'No audit entries match that filter.' : 'No audit events have been recorded.'}</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card><p className="text-xs text-muted-foreground">Showing up to the latest 1,000 events. The log is read-only from this screen.</p></section>
}
