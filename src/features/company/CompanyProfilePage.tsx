import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import type { CompanyProfile } from '@/types'
import { Field } from '@/components/forms/Fields'
import { cn } from 'cn'

export function CompanyProfilePage({ profile, onboarding, isAdministrator, adminToolsPasswordConfigured, onSave }: { profile: CompanyProfile | null; onboarding: boolean; isAdministrator: boolean; adminToolsPasswordConfigured: boolean; onSave: (value: CompanyProfile, password?: { currentPassword: string; newPassword: string }) => Promise<void> }) {
  const [values, setValues] = useState<CompanyProfile>(profile ?? { name: '', address: '', phone: '', fiscalYear: '', logoPath: '' })
  const [saving, setSaving] = useState(false)
  const [currentAdminToolsPassword, setCurrentAdminToolsPassword] = useState('')
  const [newAdminToolsPassword, setNewAdminToolsPassword] = useState('')
  const [confirmAdminToolsPassword, setConfirmAdminToolsPassword] = useState('')
  useEffect(() => { if (profile) setValues(profile) }, [profile])

  async function submit(event: React.SubmitEvent) {
    event.preventDefault(); setSaving(true)
    if ((!adminToolsPasswordConfigured || newAdminToolsPassword) && newAdminToolsPassword.length < 12) { toast.error('Use an administrator password with at least 12 characters'); setSaving(false); return }
    if (newAdminToolsPassword !== confirmAdminToolsPassword) { toast.error('The administrator passwords do not match'); setSaving(false); return }
    try {
      await onSave(values, !adminToolsPasswordConfigured || newAdminToolsPassword ? { currentPassword: currentAdminToolsPassword, newPassword: newAdminToolsPassword } : undefined)
      setCurrentAdminToolsPassword(''); setNewAdminToolsPassword(''); setConfirmAdminToolsPassword('')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save company profile') }
    finally { setSaving(false) }
  }

  return <section className={cn('mx-auto flex w-full min-w-0 flex-col', onboarding ? 'max-w-5xl gap-3' : 'max-w-3xl gap-4 sm:gap-6')}>
    <header>
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{onboarding ? 'Set up your company' : 'Company profile'}</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{onboarding ? 'Add the details shown on your reports and set a password for administrator-only pages.' : 'Update the company details shown on the dashboard and printed documents.'}</p>
    </header>

    <form onSubmit={(event) => void submit(event)} className={cn('grid', onboarding ? 'gap-3' : 'gap-4 sm:gap-4')}>
      <div className={cn('grid min-w-0 items-start gap-3 sm:gap-4', isAdministrator && (onboarding ? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]' : 'lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'))}>
        <Card size={onboarding ? 'sm' : 'default'} className="order-1 min-w-0">
          <CardHeader className={cn(onboarding ? 'px-4 pt-4 pb-1' : 'p-4 pb-2 sm:p-5 sm:pb-2')}>
            <CardTitle className="text-base">Company details</CardTitle>
            <CardDescription>{onboarding ? 'Used on the dashboard and printed documents.' : 'These details appear on the dashboard and printed documents.'}</CardDescription>
          </CardHeader>
          <CardContent className={cn(onboarding ? 'px-4 pb-4 pt-2' : 'p-4 pt-2 sm:p-5 sm:pt-2')}>
            <FieldGroup className={cn('grid min-w-0 grid-cols-1 sm:grid-cols-2', onboarding ? 'gap-3' : 'gap-4 sm:gap-4')}>
              <div className="min-w-0 sm:col-span-2"><Field label="Company name" id="company-name"><Input id="company-name" required maxLength={120} value={values.name} onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))} /></Field></div>
              <Field label="Phone" id="company-phone"><Input id="company-phone" type="tel" value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} /></Field>
              <Field label="Fiscal year" id="company-year"><Input id="company-year" placeholder="For example: 2026–2027" value={values.fiscalYear} onChange={(event) => setValues((current) => ({ ...current, fiscalYear: event.target.value }))} /></Field>
              <Field label="Address" id="company-address"><Input id="company-address" value={values.address} onChange={(event) => setValues((current) => ({ ...current, address: event.target.value }))} /></Field>
              <Field label="Company logo (optional)" id="company-logo"><Input id="company-logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; try { const logoPath = window.office.company.pathForFile(file); if (!logoPath) throw new Error('Could not read the selected file path'); setValues((current) => ({ ...current, logoPath })) } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not select logo') } }} /><p title={values.logoPath || undefined} className="mt-1 break-all text-xs text-muted-foreground">{values.logoPath || 'Shown on printed documents.'}</p></Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {isAdministrator && <Card size={onboarding ? 'sm' : 'default'} className="order-2 min-w-0">
          <CardHeader className={cn(onboarding ? 'px-4 pt-4 pb-1' : 'p-4 pb-2 sm:p-5 sm:pb-2')}>
            <CardTitle className="text-base">Administrator password</CardTitle>
            <CardDescription>{adminToolsPasswordConfigured ? 'Change the password for User Rights and Database Tools.' : 'A separate password protects User Rights and Database Tools.'}</CardDescription>
          </CardHeader>
          <CardContent className={cn(onboarding ? 'px-4 pb-4 pt-2' : 'p-4 pt-2 sm:p-5 sm:pt-2')}>
            <FieldGroup className={cn('grid min-w-0', onboarding ? 'gap-3' : 'gap-4')}>
              <p className="text-xs text-muted-foreground">Use at least 12 characters. Keep it different from your sign-in password.</p>
              {adminToolsPasswordConfigured && <Field label="Current administrator password" id="company-admin-current" required={Boolean(newAdminToolsPassword)}><Input id="company-admin-current" type="password" autoComplete="current-password" required={Boolean(newAdminToolsPassword)} value={currentAdminToolsPassword} onChange={(event) => setCurrentAdminToolsPassword(event.target.value)} /></Field>}
              <Field label={adminToolsPasswordConfigured ? 'New administrator password (optional)' : 'Set administrator password'} id="company-admin-new"><Input id="company-admin-new" type="password" autoComplete="new-password" minLength={12} required={!adminToolsPasswordConfigured} value={newAdminToolsPassword} onChange={(event) => setNewAdminToolsPassword(event.target.value)} /></Field>
              {(!adminToolsPasswordConfigured || newAdminToolsPassword) && <Field label="Confirm administrator password" id="company-admin-confirm"><Input id="company-admin-confirm" type="password" autoComplete="new-password" minLength={12} required value={confirmAdminToolsPassword} onChange={(event) => setConfirmAdminToolsPassword(event.target.value)} /></Field>}
            </FieldGroup>
          </CardContent>
        </Card>}
      </div>

      <Separator />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button className="w-full sm:w-auto" type="submit" disabled={saving || !values.name.trim()}>{saving ? 'Saving…' : onboarding ? 'Save and finish setup' : 'Save changes'}</Button>
      </div>
    </form>
  </section>
}
