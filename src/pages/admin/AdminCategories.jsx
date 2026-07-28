import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LockKeyhole, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { addAdminCategory, getAdminCategories, updateAdminCategory } from '@/services/adminService';

const emptyCreate = { parentId: '', slug: '', displayLabel: '', sortOrder: 0, reason: '' };

export default function AdminCategories() {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editForm, setEditForm] = useState(null);
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading, error } = useQuery({ queryKey: ['admin-categories'], queryFn: getAdminCategories });
  const roots = useMemo(() => categories.filter((category) => !category.parent_id), [categories]);
  const byRoot = useMemo(() => Object.fromEntries(roots.map((root) => [root.category_id, categories.filter((category) => category.parent_id === root.category_id)])), [categories, roots]);
  const invalidate = () => { queryClient.invalidateQueries({ queryKey: ['admin-categories'] }); queryClient.invalidateQueries({ queryKey: ['admin-audit'] }); };
  const addMutation = useMutation({ mutationFn: addAdminCategory, onSuccess: () => { invalidate(); setCreating(false); setCreateForm(emptyCreate); toast.success('Category added'); }, onError: (failure) => toast.error(failure.message) });
  const updateMutation = useMutation({ mutationFn: updateAdminCategory, onSuccess: () => { invalidate(); setEditing(null); setEditForm(null); toast.success('Category updated'); }, onError: (failure) => toast.error(failure.message) });

  const openEdit = (category) => {
    setEditing(category);
    setEditForm({ categoryId: category.category_id, displayLabel: category.display_label, sortOrder: category.sort_order, isActive: category.is_active, reason: '' });
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6"><div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h1 className="text-3xl font-bold">Categories</h1><p className="mt-1 max-w-3xl text-muted-foreground">Manage display labels, availability, and order while stable IDs and slugs remain unchanged.</p></div><Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Add subcategory</Button></div>
      <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">Referenced categories are deactivated instead of deleted. The four top-level marketplace categories are protected.</p>
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error.message}</p>}
      {isLoading ? <Card className="p-8 text-center text-muted-foreground">Loading categories…</Card> : <div className="space-y-5">{roots.map((root) => <Card key={root.category_id}><CardHeader className="flex-row items-center justify-between space-y-0"><div><CardTitle className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-muted-foreground" />{root.display_label}</CardTitle><p className="mt-1 font-mono text-xs text-muted-foreground">{root.slug} · {root.marketplace_kind}</p></div><div className="flex items-center gap-2"><Badge>{root.listing_count} adverts</Badge><Button size="sm" variant="outline" onClick={() => openEdit(root)}>Edit label</Button></div></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b text-left"><th className="py-2">Display label</th><th className="py-2">Stable slug</th><th className="py-2">Order</th><th className="py-2">Adverts</th><th className="py-2">State</th><th className="py-2 text-right">Action</th></tr></thead><tbody>{byRoot[root.category_id].map((category) => <tr key={category.category_id} className="border-b last:border-0"><td className="py-2 font-medium">{category.display_label}</td><td className="py-2 font-mono text-xs text-muted-foreground">{category.slug}</td><td className="py-2">{category.sort_order}</td><td className="py-2">{category.listing_count}</td><td className="py-2"><Badge variant={category.is_active ? 'default' : 'secondary'}>{category.is_active ? 'Active' : 'Inactive'}</Badge></td><td className="py-2 text-right"><Button size="sm" variant="outline" onClick={() => openEdit(category)}>Edit</Button></td></tr>)}</tbody></table></div></CardContent></Card>)}</div>}
    </div>

    <Dialog open={creating} onOpenChange={setCreating}><DialogContent><DialogHeader><DialogTitle>Add approved subcategory</DialogTitle></DialogHeader><div className="space-y-3"><div><Label htmlFor="category-parent">Top-level category</Label><Select value={createForm.parentId} onValueChange={(parentId) => setCreateForm((form) => ({ ...form, parentId }))}><SelectTrigger id="category-parent" className="mt-1"><SelectValue placeholder="Choose category" /></SelectTrigger><SelectContent>{roots.map((root) => <SelectItem key={root.category_id} value={root.category_id}>{root.display_label}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="category-slug">Stable slug</Label><Input id="category-slug" className="mt-1" value={createForm.slug} onChange={(event) => setCreateForm((form) => ({ ...form, slug: event.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="solar_installers" /><p className="mt-1 text-xs text-muted-foreground">Lowercase letters, numbers, and underscores. This cannot be changed later.</p></div><div><Label htmlFor="category-label">Display label</Label><Input id="category-label" className="mt-1" value={createForm.displayLabel} onChange={(event) => setCreateForm((form) => ({ ...form, displayLabel: event.target.value }))} /></div><div><Label htmlFor="category-order">Sort order</Label><Input id="category-order" type="number" min="0" max="10000" className="mt-1" value={createForm.sortOrder} onChange={(event) => setCreateForm((form) => ({ ...form, sortOrder: Number(event.target.value) }))} /></div><div><Label htmlFor="category-create-reason">Reason</Label><Textarea id="category-create-reason" className="mt-1" value={createForm.reason} onChange={(event) => setCreateForm((form) => ({ ...form, reason: event.target.value }))} /></div><Button disabled={!createForm.parentId || createForm.slug.length < 2 || createForm.displayLabel.trim().length < 2 || createForm.reason.trim().length < 3 || addMutation.isPending} onClick={() => addMutation.mutate(createForm)}>{addMutation.isPending ? 'Adding…' : 'Add category'}</Button></div></DialogContent></Dialog>

    <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}><DialogContent><DialogHeader><DialogTitle>Edit {editing?.display_label}</DialogTitle></DialogHeader>{editForm && <div className="space-y-3"><div><Label htmlFor="category-stable-slug">Stable slug</Label><Input id="category-stable-slug" className="mt-1 font-mono" value={editing.slug} disabled /></div><div><Label htmlFor="category-edit-label">Display label</Label><Input id="category-edit-label" className="mt-1" value={editForm.displayLabel} onChange={(event) => setEditForm((form) => ({ ...form, displayLabel: event.target.value }))} /></div><div><Label htmlFor="category-edit-order">Sort order</Label><Input id="category-edit-order" type="number" min="0" max="10000" className="mt-1" value={editForm.sortOrder} onChange={(event) => setEditForm((form) => ({ ...form, sortOrder: Number(event.target.value) }))} /></div><div className="flex items-center justify-between rounded-lg border p-3"><div><Label htmlFor="category-active">Active</Label><p className="text-xs text-muted-foreground">Inactive categories stay attached to existing adverts.</p></div><Switch id="category-active" checked={editForm.isActive} disabled={editing.is_protected} onCheckedChange={(isActive) => setEditForm((form) => ({ ...form, isActive }))} /></div><div><Label htmlFor="category-edit-reason">Reason</Label><Textarea id="category-edit-reason" className="mt-1" value={editForm.reason} onChange={(event) => setEditForm((form) => ({ ...form, reason: event.target.value }))} /></div><Button disabled={editForm.displayLabel.trim().length < 2 || editForm.reason.trim().length < 3 || updateMutation.isPending} onClick={() => updateMutation.mutate(editForm)}>{updateMutation.isPending ? 'Saving…' : 'Save category'}</Button></div>}</DialogContent></Dialog>
    </div>
  );
}
