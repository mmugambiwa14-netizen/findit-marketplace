import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, LockKeyhole, Plus } from 'lucide-react';
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
import {
  addAdminTaxonomyNode,
  getAdminTaxonomy,
  updateAdminTaxonomyNode,
} from '@/services/taxonomyAdminService';
import { ListRowsSkeleton } from '@/components/loading/LoadingSkeletons';

const emptyCreate = {
  parentId: '',
  stableSlug: '',
  canonicalSlug: '',
  displayLabel: '',
  description: '',
  nodeType: 'category',
  isPostable: true,
  sortOrder: 0,
  aliasesText: '',
  synonymsText: '',
  marketsText: '',
  localizedLabelsText: '',
  reason: '',
};

function commaList(value) {
  return [...new Set(String(value || '').split(',').map((item) => item.trim()).filter(Boolean))];
}

function localizedLabels(value) {
  return Object.fromEntries(
    String(value || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(':');
        if (separator < 1) throw new TypeError('Localized labels must use locale: Label, one per line.');
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

function localizedLabelsText(value) {
  return Object.entries(value || {}).map(([locale, label]) => `${locale}: ${label}`).join('\n');
}

function createPayload(form, parent) {
  return {
    parentId: form.parentId,
    stableSlug: form.stableSlug,
    canonicalSlug: form.canonicalSlug || form.stableSlug,
    displayLabel: form.displayLabel,
    description: form.description,
    nodeType: form.nodeType,
    isPostable: form.nodeType === 'category' && form.isPostable,
    sortOrder: form.sortOrder,
    schemaBinding: { schema: parent?.marketplaceKind },
    aliases: commaList(form.aliasesText).map((item) => item.toLowerCase()),
    synonyms: commaList(form.synonymsText),
    localizedLabels: localizedLabels(form.localizedLabelsText),
    marketAvailability: commaList(form.marketsText).map((item) => item.toUpperCase()),
    reason: form.reason,
  };
}

function editPayload(form) {
  return {
    categoryId: form.categoryId,
    canonicalSlug: form.canonicalSlug,
    displayLabel: form.displayLabel,
    description: form.description,
    sortOrder: form.sortOrder,
    isActive: form.isActive,
    isPostable: form.isPostable,
    aliases: commaList(form.aliasesText).map((item) => item.toLowerCase()),
    synonyms: commaList(form.synonymsText),
    localizedLabels: localizedLabels(form.localizedLabelsText),
    marketAvailability: commaList(form.marketsText).map((item) => item.toUpperCase()),
    supersededBy: form.supersededBy || null,
    validTo: form.validTo || null,
    schemaBinding: form.schemaBinding,
    reason: form.reason,
  };
}

function stateVariant(node) {
  if (node.supersededBy) return 'outline';
  if (!node.isActive) return 'secondary';
  return 'default';
}

function nodeState(node) {
  if (node.supersededBy) return 'Superseded';
  return node.isActive ? 'Active' : 'Inactive';
}

export default function AdminCategories() {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editForm, setEditForm] = useState(null);
  const queryClient = useQueryClient();
  const { data: categories = [], isLoading, error } = useQuery({
    queryKey: ['admin-taxonomy'],
    queryFn: getAdminTaxonomy,
  });

  const roots = useMemo(
    () => categories.filter((category) => category.depth === 0).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories],
  );
  const parentOptions = useMemo(
    () => categories.filter((category) => category.isActive && !category.supersededBy && category.nodeType !== 'facet'),
    [categories],
  );
  const selectedParent = parentOptions.find((category) => category.id === createForm.parentId) ?? null;
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-taxonomy'] });
    queryClient.invalidateQueries({ queryKey: ['public-category-taxonomy'] });
    queryClient.invalidateQueries({ queryKey: ['admin-audit'] });
  };

  const addMutation = useMutation({
    mutationFn: addAdminTaxonomyNode,
    onSuccess: () => {
      invalidate();
      setCreating(false);
      setCreateForm(emptyCreate);
      toast.success('Taxonomy node added');
    },
    onError: (failure) => toast.error(failure.message),
  });
  const updateMutation = useMutation({
    mutationFn: updateAdminTaxonomyNode,
    onSuccess: () => {
      invalidate();
      setEditing(null);
      setEditForm(null);
      toast.success('Taxonomy node updated');
    },
    onError: (failure) => toast.error(failure.message),
  });

  const openEdit = (category) => {
    setEditing(category);
    setEditForm({
      categoryId: category.id,
      canonicalSlug: category.canonicalSlug,
      displayLabel: category.displayLabel,
      description: category.description,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      isPostable: category.isPostable,
      aliasesText: category.aliases.join(', '),
      synonymsText: category.synonyms.join(', '),
      marketsText: category.marketAvailability.join(', '),
      localizedLabelsText: localizedLabelsText(category.localizedLabels),
      supersededBy: category.supersededBy || '',
      validTo: category.validTo ? new Date(category.validTo).toISOString().slice(0, 16) : '',
      schemaBinding: category.schemaBinding,
      reason: '',
    });
  };

  const submitCreate = () => {
    try {
      addMutation.mutate(createPayload(createForm, selectedParent));
    } catch (failure) {
      toast.error(failure.message);
    }
  };

  const submitEdit = () => {
    try {
      updateMutation.mutate(editPayload(editForm));
    } catch (failure) {
      toast.error(failure.message);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-3xl font-bold">Taxonomy</h1>
            <p className="mt-1 max-w-3xl text-muted-foreground">Manage the canonical marketplace classification tree. Stable slugs remain immutable; current labels, aliases, markets, postability and replacements can evolve safely.</p>
          </div>
          <Button onClick={() => setCreating(true)}><Plus className="mr-2 h-4 w-4" />Add taxonomy node</Button>
        </div>
        <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">Tree depth does not determine whether a listing can be posted. Only active nodes explicitly marked postable can receive new listings. Superseded nodes remain resolvable for historical links.</p>
        {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error.message}</p>}

        {isLoading ? (
          <Card className="p-4"><ListRowsSkeleton rows={8} showThumbnail={false} label="Loading taxonomy" /></Card>
        ) : (
          <div className="space-y-5">
            {roots.map((root) => {
              const rows = categories.filter((category) => category.marketplaceKind === root.marketplaceKind && category.id !== root.id);
              return (
                <Card key={root.id}>
                  <CardHeader className="flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-4 w-4 text-muted-foreground" />{root.displayLabel}</CardTitle>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{root.stableSlug} · {root.marketplaceKind}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{root.descendantListingCount} adverts</Badge>
                      <Button size="sm" variant="outline" onClick={() => openEdit(root)}>Edit root</Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-sm">
                        <thead><tr className="border-b text-left"><th className="py-2">Node</th><th className="py-2">Stable slug</th><th className="py-2">Current slug</th><th className="py-2">Type</th><th className="py-2">Postable</th><th className="py-2">Adverts</th><th className="py-2">Markets</th><th className="py-2">State</th><th className="py-2 text-right">Action</th></tr></thead>
                        <tbody>
                          {rows.map((category) => (
                            <tr key={category.id} className="border-b last:border-0">
                              <td className="py-2 font-medium">
                                <span className="inline-flex items-center" style={{ paddingLeft: `${Math.max(0, category.depth - 1) * 18}px` }}>
                                  {category.depth > 1 && <ChevronRight className="mr-1 h-3.5 w-3.5 text-muted-foreground" />}
                                  {category.displayLabel}
                                </span>
                                {category.pathLabels.length > 2 && <p className="mt-0.5 text-xs font-normal text-muted-foreground">{category.pathLabels.slice(1, -1).join(' / ')}</p>}
                              </td>
                              <td className="py-2 font-mono text-xs text-muted-foreground">{category.stableSlug}</td>
                              <td className="py-2 font-mono text-xs">{category.canonicalSlug}</td>
                              <td className="py-2"><Badge variant="outline">{category.nodeType}</Badge></td>
                              <td className="py-2">{category.isPostable ? 'Yes' : 'No'}</td>
                              <td className="py-2">{category.descendantListingCount}</td>
                              <td className="py-2">{category.marketAvailability.length ? category.marketAvailability.join(', ') : 'All'}</td>
                              <td className="py-2"><Badge variant={stateVariant(category)}>{nodeState(category)}</Badge></td>
                              <td className="py-2 text-right"><Button size="sm" variant="outline" onClick={() => openEdit(category)}>Edit</Button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={creating} onOpenChange={(open) => { setCreating(open); if (!open) setCreateForm(emptyCreate); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Add taxonomy node</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="taxonomy-parent">Parent node</Label><Select value={createForm.parentId} onValueChange={(parentId) => setCreateForm((form) => ({ ...form, parentId }))}><SelectTrigger id="taxonomy-parent" className="mt-1"><SelectValue placeholder="Choose parent" /></SelectTrigger><SelectContent>{parentOptions.map((node) => <SelectItem key={node.id} value={node.id}>{'— '.repeat(node.depth)}{node.displayLabel} ({node.marketplaceKind})</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="taxonomy-stable-slug">Stable slug</Label><Input id="taxonomy-stable-slug" className="mt-1" value={createForm.stableSlug} onChange={(event) => setCreateForm((form) => ({ ...form, stableSlug: event.target.value.toLowerCase().replace(/\s+/g, '_'), canonicalSlug: form.canonicalSlug || event.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="detached_house" /><p className="mt-1 text-xs text-muted-foreground">Immutable after creation.</p></div>
            <div><Label htmlFor="taxonomy-canonical-slug">Current slug</Label><Input id="taxonomy-canonical-slug" className="mt-1" value={createForm.canonicalSlug} onChange={(event) => setCreateForm((form) => ({ ...form, canonicalSlug: event.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="house" /></div>
            <div><Label htmlFor="taxonomy-label">Display label</Label><Input id="taxonomy-label" className="mt-1" value={createForm.displayLabel} onChange={(event) => setCreateForm((form) => ({ ...form, displayLabel: event.target.value }))} /></div>
            <div><Label htmlFor="taxonomy-type">Node type</Label><Select value={createForm.nodeType} onValueChange={(nodeType) => setCreateForm((form) => ({ ...form, nodeType, isPostable: nodeType === 'category' ? form.isPostable : false }))}><SelectTrigger id="taxonomy-type" className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="group">Group</SelectItem><SelectItem value="category">Category</SelectItem><SelectItem value="facet">Facet</SelectItem></SelectContent></Select></div>
            <div className="sm:col-span-2"><Label htmlFor="taxonomy-description">Description</Label><Textarea id="taxonomy-description" className="mt-1" value={createForm.description} onChange={(event) => setCreateForm((form) => ({ ...form, description: event.target.value }))} /></div>
            <div><Label htmlFor="taxonomy-order">Sort order</Label><Input id="taxonomy-order" type="number" min="0" max="10000" className="mt-1" value={createForm.sortOrder} onChange={(event) => setCreateForm((form) => ({ ...form, sortOrder: Number(event.target.value) }))} /></div>
            <div className="flex items-center justify-between rounded-lg border p-3"><div><Label htmlFor="taxonomy-postable">Postable</Label><p className="text-xs text-muted-foreground">Only category nodes may receive listings.</p></div><Switch id="taxonomy-postable" checked={createForm.isPostable} disabled={createForm.nodeType !== 'category'} onCheckedChange={(isPostable) => setCreateForm((form) => ({ ...form, isPostable }))} /></div>
            <div><Label htmlFor="taxonomy-aliases">Aliases</Label><Input id="taxonomy-aliases" className="mt-1" value={createForm.aliasesText} onChange={(event) => setCreateForm((form) => ({ ...form, aliasesText: event.target.value }))} placeholder="old_slug, alternate_slug" /></div>
            <div><Label htmlFor="taxonomy-synonyms">Search synonyms</Label><Input id="taxonomy-synonyms" className="mt-1" value={createForm.synonymsText} onChange={(event) => setCreateForm((form) => ({ ...form, synonymsText: event.target.value }))} placeholder="pickup, bakkie" /></div>
            <div><Label htmlFor="taxonomy-markets">Market availability</Label><Input id="taxonomy-markets" className="mt-1" value={createForm.marketsText} onChange={(event) => setCreateForm((form) => ({ ...form, marketsText: event.target.value }))} placeholder="ZW, ZA (blank = all)" /></div>
            <div><Label htmlFor="taxonomy-localized">Localized labels</Label><Textarea id="taxonomy-localized" className="mt-1 min-h-20" value={createForm.localizedLabelsText} onChange={(event) => setCreateForm((form) => ({ ...form, localizedLabelsText: event.target.value }))} placeholder={'sn: Imba\nnd: ...'} /></div>
            <div className="sm:col-span-2"><Label htmlFor="taxonomy-create-reason">Reason</Label><Textarea id="taxonomy-create-reason" className="mt-1" value={createForm.reason} onChange={(event) => setCreateForm((form) => ({ ...form, reason: event.target.value }))} /></div>
            <div className="sm:col-span-2"><Button className="w-full" disabled={!createForm.parentId || createForm.stableSlug.length < 1 || createForm.displayLabel.trim().length < 2 || createForm.reason.trim().length < 3 || addMutation.isPending} onClick={submitCreate}>{addMutation.isPending ? 'Adding…' : 'Add taxonomy node'}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => { if (!open) { setEditing(null); setEditForm(null); } }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Edit {editing?.displayLabel}</DialogTitle></DialogHeader>
          {editForm && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="taxonomy-edit-stable">Stable slug</Label><Input id="taxonomy-edit-stable" className="mt-1 font-mono" value={editing.stableSlug} disabled /></div>
              <div><Label htmlFor="taxonomy-edit-type">Node type</Label><Input id="taxonomy-edit-type" className="mt-1" value={editing.nodeType} disabled /></div>
              <div><Label htmlFor="taxonomy-edit-canonical">Current slug</Label><Input id="taxonomy-edit-canonical" className="mt-1" value={editForm.canonicalSlug} onChange={(event) => setEditForm((form) => ({ ...form, canonicalSlug: event.target.value.toLowerCase().replace(/\s+/g, '_') }))} /></div>
              <div><Label htmlFor="taxonomy-edit-label">Display label</Label><Input id="taxonomy-edit-label" className="mt-1" value={editForm.displayLabel} onChange={(event) => setEditForm((form) => ({ ...form, displayLabel: event.target.value }))} /></div>
              <div className="sm:col-span-2"><Label htmlFor="taxonomy-edit-description">Description</Label><Textarea id="taxonomy-edit-description" className="mt-1" value={editForm.description} onChange={(event) => setEditForm((form) => ({ ...form, description: event.target.value }))} /></div>
              <div><Label htmlFor="taxonomy-edit-order">Sort order</Label><Input id="taxonomy-edit-order" type="number" min="0" max="10000" className="mt-1" value={editForm.sortOrder} onChange={(event) => setEditForm((form) => ({ ...form, sortOrder: Number(event.target.value) }))} /></div>
              <div className="space-y-2 rounded-lg border p-3"><div className="flex items-center justify-between"><Label htmlFor="taxonomy-edit-active">Active</Label><Switch id="taxonomy-edit-active" checked={editForm.isActive} disabled={editing.isProtected} onCheckedChange={(isActive) => setEditForm((form) => ({ ...form, isActive }))} /></div><div className="flex items-center justify-between"><Label htmlFor="taxonomy-edit-postable">Postable</Label><Switch id="taxonomy-edit-postable" checked={editForm.isPostable} disabled={editing.nodeType !== 'category' || Boolean(editForm.supersededBy)} onCheckedChange={(isPostable) => setEditForm((form) => ({ ...form, isPostable }))} /></div></div>
              <div><Label htmlFor="taxonomy-edit-aliases">Aliases</Label><Input id="taxonomy-edit-aliases" className="mt-1" value={editForm.aliasesText} onChange={(event) => setEditForm((form) => ({ ...form, aliasesText: event.target.value }))} /></div>
              <div><Label htmlFor="taxonomy-edit-synonyms">Search synonyms</Label><Input id="taxonomy-edit-synonyms" className="mt-1" value={editForm.synonymsText} onChange={(event) => setEditForm((form) => ({ ...form, synonymsText: event.target.value }))} /></div>
              <div><Label htmlFor="taxonomy-edit-markets">Market availability</Label><Input id="taxonomy-edit-markets" className="mt-1" value={editForm.marketsText} onChange={(event) => setEditForm((form) => ({ ...form, marketsText: event.target.value }))} placeholder="Blank = all markets" /></div>
              <div><Label htmlFor="taxonomy-edit-localized">Localized labels</Label><Textarea id="taxonomy-edit-localized" className="mt-1 min-h-20" value={editForm.localizedLabelsText} onChange={(event) => setEditForm((form) => ({ ...form, localizedLabelsText: event.target.value }))} /></div>
              {editing.nodeType === 'category' && !editing.isProtected && <div className="sm:col-span-2"><Label htmlFor="taxonomy-replacement">Superseded by</Label><Select value={editForm.supersededBy || 'none'} onValueChange={(value) => setEditForm((form) => ({ ...form, supersededBy: value === 'none' ? '' : value, isPostable: value === 'none' ? form.isPostable : false }))}><SelectTrigger id="taxonomy-replacement" className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not superseded</SelectItem>{categories.filter((candidate) => candidate.id !== editing.id && candidate.marketplaceKind === editing.marketplaceKind && candidate.nodeType === 'category' && candidate.isActive && !candidate.supersededBy).map((candidate) => <SelectItem key={candidate.id} value={candidate.id}>{candidate.pathLabels.join(' / ')}</SelectItem>)}</SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Existing records keep the stable node; new posting stops and old links can redirect to the replacement.</p></div>}
              <div className="sm:col-span-2"><Label htmlFor="taxonomy-edit-reason">Reason</Label><Textarea id="taxonomy-edit-reason" className="mt-1" value={editForm.reason} onChange={(event) => setEditForm((form) => ({ ...form, reason: event.target.value }))} /></div>
              <div className="sm:col-span-2"><Button className="w-full" disabled={editForm.displayLabel.trim().length < 2 || editForm.reason.trim().length < 3 || updateMutation.isPending} onClick={submitEdit}>{updateMutation.isPending ? 'Saving…' : 'Save taxonomy node'}</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
