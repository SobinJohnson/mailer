'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Users,
  Building2,
  Pencil,
  Trash2,
  X,
  Check,
  Search,
  ChevronDown,
  ChevronRight,
  UsersRound,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  first_name: string;
  last_name?: string;
  email: string;
  company_id?: string;
  company?: { name: string };
}

interface GroupMember {
  contact: Contact;
}

interface Group {
  id: string;
  name: string;
  description?: string;
  color: string;
  created_at: string;
  members: GroupMember[];
}

interface Company {
  id: string;
  name: string;
  contacts: Contact[];
}

interface GroupsManagerProps {
  initialGroups: Group[];
  companies: Company[];
}

// ─── Colour palette ───────────────────────────────────────────────────────────
const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#0ea5e9', '#3b82f6',
];

// ─── Helper ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GroupCard({
  group,
  onEdit,
  onDelete,
}: {
  group: Group;
  onEdit: (g: Group) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const memberCount = group.members?.length ?? 0;

  return (
    <div className="bg-background border border-border rounded-[14px] overflow-hidden hover:border-border/80 hover:shadow-sm transition-all duration-150">
      {/* Header strip */}
      <div className="h-1.5 w-full" style={{ backgroundColor: group.color }} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 text-white text-[13px] font-bold shadow-sm"
              style={{ backgroundColor: group.color }}
            >
              {initials(group.name)}
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground truncate">{group.name}</p>
              {group.description && (
                <p className="text-[12px] text-muted-foreground mt-0.5 line-clamp-1">{group.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onEdit(group)}
              className="p-1.5 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              title="Edit group"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(group.id)}
              className="p-1.5 rounded-[6px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete group"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{memberCount} contact{memberCount !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Expand members */}
        {memberCount > 0 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            {expanded ? 'Hide' : 'Preview'} members
          </button>
        )}

        {expanded && (
          <div className="mt-3 border border-border/60 rounded-[10px] divide-y divide-border/40 max-h-[240px] overflow-y-auto">
            {group.members.map(({ contact }) => (
              <div key={contact.id} className="flex items-center gap-3 px-3 py-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white text-[9px] font-bold"
                  style={{ backgroundColor: group.color }}
                >
                  {initials(`${contact.first_name} ${contact.last_name || ''}`)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-foreground truncate">
                    {contact.first_name} {contact.last_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{contact.email}</p>
                </div>
                {contact.company && (
                  <span className="text-[11px] text-muted-foreground shrink-0 hidden sm:block">
                    {contact.company.name}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Group Editor (Create / Edit) ─────────────────────────────────────────────

function GroupEditor({
  editingGroup,
  companies,
  onClose,
  onSaved,
}: {
  editingGroup: Group | null;
  companies: Company[];
  onClose: () => void;
  onSaved: (group: Group) => void;
}) {
  const isEditing = !!editingGroup;

  const [name, setName] = useState(editingGroup?.name ?? '');
  const [description, setDescription] = useState(editingGroup?.description ?? '');
  const [color, setColor] = useState(editingGroup?.color ?? COLORS[0]);
  const [search, setSearch] = useState('');
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());

  // Initialise selected contacts from existing members
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(
    new Set(editingGroup?.members?.map(m => m.contact.id) ?? [])
  );
  const [saving, setSaving] = useState(false);

  const allContacts: Contact[] = useMemo(
    () => companies.flatMap(c => c.contacts.map(ct => ({ ...ct, company: { name: c.name } }))),
    [companies]
  );

  const filteredCompanies = useMemo(() => {
    if (!search.trim()) return companies;
    const q = search.toLowerCase();
    return companies
      .map(company => ({
        ...company,
        contacts: company.contacts.filter(
          c =>
            c.first_name.toLowerCase().includes(q) ||
            (c.last_name || '').toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q)
        ),
      }))
      .filter(c => c.name.toLowerCase().includes(q) || c.contacts.length > 0);
  }, [companies, search]);

  const toggleContact = (id: string) =>
    setSelectedContacts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleCompany = (company: Company) => {
    const ids = company.contacts.map(c => c.id);
    const allSelected = ids.every(id => selectedContacts.has(id));
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const toggleExpanded = (companyId: string) =>
    setExpandedCompanies(prev => {
      const next = new Set(prev);
      next.has(companyId) ? next.delete(companyId) : next.add(companyId);
      return next;
    });

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        color,
        contact_ids: Array.from(selectedContacts),
      };

      const res = isEditing
        ? await fetch(`/api/groups/${editingGroup!.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });

      if (!res.ok) throw new Error(await res.text());

      // Re-fetch the saved group with members for accurate preview
      const groupRes = await fetch('/api/groups');
      if (groupRes.ok) {
        const { data: allGroups } = await groupRes.json();
        const saved = isEditing
          ? allGroups.find((g: Group) => g.id === editingGroup!.id)
          : allGroups[0];
        if (saved) {
          onSaved(saved);
          return;
        }
      }
      onClose();
    } catch (err: any) {
      alert(`Failed to save group: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[3px] animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative ml-auto h-full w-full max-w-2xl bg-background border-l border-border flex flex-col shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-[18px] font-semibold text-foreground">
              {isEditing ? 'Edit Group' : 'New Mail Group'}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {isEditing ? 'Update group details and members' : 'Select contacts to include in this group'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Name & Description */}
            <div className="space-y-4">
              <div>
                <Label className="text-[13px]">Group Name *</Label>
                <Input
                  id="group-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Tech Startups Q3, VIP Prospects…"
                  className="mt-1.5 rounded-[8px]"
                />
              </div>
              <div>
                <Label className="text-[13px]">Description</Label>
                <Textarea
                  id="group-description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What is this group for?"
                  className="mt-1.5 rounded-[8px] resize-none"
                  rows={2}
                />
              </div>

              {/* Color */}
              <div>
                <Label className="text-[13px]">Group Color</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-7 h-7 rounded-full border-2 transition-all duration-100 shrink-0"
                      style={{
                        backgroundColor: c,
                        borderColor: color === c ? 'white' : 'transparent',
                        boxShadow: color === c ? `0 0 0 2px ${c}` : undefined,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* Contact Selector */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label className="text-[13px]">Select Contacts</Label>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {selectedContacts.size} selected · {allContacts.length} available
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedContacts(new Set(allContacts.map(c => c.id)))}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  >
                    All
                  </button>
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <button
                    type="button"
                    onClick={() => setSelectedContacts(new Set())}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  >
                    None
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  id="contact-search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search contacts or companies…"
                  className="pl-9 h-9 text-[13px] rounded-[8px]"
                />
              </div>

              {/* Company / Contact tree */}
              <div className="border border-border rounded-[10px] divide-y divide-border/60 max-h-[340px] overflow-y-auto">
                {filteredCompanies.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground text-center py-8">No results</p>
                ) : (
                  filteredCompanies.map(company => {
                    const companyIds = company.contacts.map(c => c.id);
                    const allSel = companyIds.length > 0 && companyIds.every(id => selectedContacts.has(id));
                    const partialSel = companyIds.some(id => selectedContacts.has(id)) && !allSel;
                    const isOpen = expandedCompanies.has(company.id) || !!search.trim();

                    return (
                      <div key={company.id}>
                        {/* Company row */}
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-secondary/30 hover:bg-secondary/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={allSel}
                            ref={el => { if (el) el.indeterminate = partialSel; }}
                            onChange={() => toggleCompany(company)}
                            disabled={companyIds.length === 0}
                            className="w-4 h-4 rounded cursor-pointer"
                          />
                          <button
                            type="button"
                            onClick={() => toggleExpanded(company.id)}
                            className="flex items-center gap-2 flex-1 text-left"
                          >
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-[13px] font-medium text-foreground">{company.name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              ({companyIds.length})
                            </span>
                            {!search.trim() && (
                              <span className="ml-auto">
                                {isOpen
                                  ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                  : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                                }
                              </span>
                            )}
                          </button>
                        </div>

                        {/* Contact rows */}
                        {isOpen && company.contacts.map(contact => (
                          <label
                            key={contact.id}
                            className="flex items-center gap-3 px-4 py-2 pl-10 cursor-pointer hover:bg-accent/30 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={selectedContacts.has(contact.id)}
                              onChange={() => toggleContact(contact.id)}
                              className="w-4 h-4 rounded cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                              <span className="text-[13px] text-foreground">
                                {contact.first_name} {contact.last_name}
                              </span>
                              <span className="text-[12px] text-muted-foreground ml-2">{contact.email}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4 shrink-0 flex justify-between items-center gap-3">
          <div className="text-[12px] text-muted-foreground">
            {selectedContacts.size > 0
              ? `${selectedContacts.size} contact${selectedContacts.size !== 1 ? 's' : ''} will be in this group`
              : 'No contacts selected yet'}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="rounded-[8px]">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="rounded-[8px]"
            >
              {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Group'}
              {!saving && <Check className="w-4 h-4 ml-1.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function GroupsManager({ initialGroups, companies }: GroupsManagerProps) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(g => g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q));
  }, [groups, search]);

  const openNew = () => {
    setEditingGroup(null);
    setEditorOpen(true);
  };

  const openEdit = (group: Group) => {
    setEditingGroup(group);
    setEditorOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this group? This cannot be undone.')) return;
    const res = await fetch(`/api/groups/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setGroups(prev => prev.filter(g => g.id !== id));
    } else {
      alert('Failed to delete group.');
    }
  };

  const handleSaved = (saved: Group) => {
    setGroups(prev => {
      const idx = prev.findIndex(g => g.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setEditorOpen(false);
  };

  return (
    <>
      {editorOpen && (
        <GroupEditor
          editingGroup={editingGroup}
          companies={companies}
          onClose={() => setEditorOpen(false)}
          onSaved={handleSaved}
        />
      )}

      <div className="space-y-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[34px] font-semibold tracking-[-0.374px] text-foreground">Mail Groups</h1>
            <p className="text-[17px] text-muted-foreground mt-1">
              Organise contacts into reusable groups for campaigns
            </p>
          </div>
          <Button id="new-group-btn" onClick={openNew} className="rounded-[10px] h-10 px-5 gap-2 shrink-0">
            <Plus className="w-4 h-4" />
            New Group
          </Button>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            {
              label: 'Total Groups',
              value: groups.length,
              icon: UsersRound,
            },
            {
              label: 'Total Members',
              value: groups.reduce((a, g) => a + (g.members?.length ?? 0), 0),
              icon: Users,
            },
            {
              label: 'Active Companies',
              value: companies.length,
              icon: Building2,
            },
          ].map(stat => (
            <div
              key={stat.label}
              className="bg-background border border-border rounded-[14px] px-5 py-4 flex items-center gap-4"
            >
              <div className="w-9 h-9 rounded-[10px] bg-secondary flex items-center justify-center shrink-0">
                <stat.icon className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[22px] font-semibold text-foreground">{stat.value}</p>
                <p className="text-[12px] text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            id="groups-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search groups…"
            className="pl-10 rounded-[10px]"
          />
        </div>

        {/* Groups grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <UsersRound className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-[17px] font-semibold text-foreground mb-1">
              {search ? 'No groups match your search' : 'No groups yet'}
            </h3>
            <p className="text-[14px] text-muted-foreground max-w-xs">
              {search
                ? 'Try a different keyword.'
                : 'Create your first mail group to organise contacts for campaigns.'}
            </p>
            {!search && (
              <Button onClick={openNew} className="mt-5 rounded-[10px]">
                <Plus className="w-4 h-4 mr-2" /> Create Group
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
