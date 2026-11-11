import { useCallback, useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmActionDialog } from '@/components/feedback/ConfirmActionDialog'
import type { ItemCategory } from '@/types'
import { PageHeader } from '@/components/layout/PageHeader'

export function CategoriesPage() {
  const [categories, setCategories] = useState<ItemCategory[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ItemCategory | null>(null)
  const [value, setValue] = useState('')
  const [description, setDescription] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const refresh = useCallback(async () => setCategories(await window.office.items.categories()), [])
  useEffect(() => { void refresh().catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load categories')) }, [refresh])
  function edit(category?: ItemCategory) { setEditing(category ?? null); setValue(category?.name ?? ''); setDescription(category?.description ?? ''); setOpen(true) }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    try {
      await window.office.items.saveCategory({ name: value, description, ...(editing ? { originalName: editing.name } : {}) })
      await refresh(); setOpen(false); toast.success(editing ? 'Category updated' : 'Category added')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save category') }
  }
  return <section className="flex flex-col gap-5">
    <PageHeader title="Categories" description="Manage the categories available from the Items page." actions={<Button data-operator-new title="Add category (Ctrl+N)" onClick={() => edit()}><Plus data-icon="inline-start"/>Add category</Button>} />
    <Card><CardHeader><CardTitle>Item categories</CardTitle><CardDescription>These saved categories appear in the item category selector.</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="w-20">ID</TableHead><TableHead>Category name</TableHead><TableHead>Description</TableHead><TableHead className="w-28 text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{categories.map((category) => <TableRow key={category.id}><TableCell className="tabular-nums">{category.id}</TableCell><TableCell className="font-medium">{category.name}</TableCell><TableCell className="text-muted-foreground">{category.description || '—'}</TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="icon-sm" aria-label={`Edit ${category.name}`} onClick={() => edit(category)}><Pencil/></Button><Button variant="ghost" size="icon-sm" aria-label={`Delete ${category.name}`} onClick={() => setDeleting(category.name)}><Trash2/></Button></div></TableCell></TableRow>)}{!categories.length && <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No categories saved yet.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="w-[min(92vw,32rem)]"><DialogHeader><DialogTitle>{editing ? 'Edit category' : 'Add category'}</DialogTitle><DialogDescription>Save a category name and description for item records.</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={(event) => void save(event)}><label className="grid gap-2 text-sm font-medium">Category name<Input autoFocus required maxLength={100} value={value} onChange={(event) => setValue(event.target.value)}/></label><label className="grid gap-2 text-sm font-medium">Description<Input maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)}/></label><DialogFooter>    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button data-operator-save title="Save category (Ctrl+S)" type="submit">Save category</Button></DialogFooter></form></DialogContent></Dialog>
    <ConfirmActionDialog open={deleting !== null} onOpenChange={(next) => { if (!next) setDeleting(null) }} title={`Delete ${deleting ?? 'category'}?`} description="Items using this category must be moved to another category first." onConfirm={() => { const target = deleting; setDeleting(null); if (target) void window.office.items.deleteCategory(target).then(refresh).then(() => toast.success('Category deleted')).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not delete category')) }}/>
  </section>
}
