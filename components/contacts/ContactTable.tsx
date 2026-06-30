'use client';

import { toast } from 'sonner';
import { useState, useMemo } from 'react';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Search, Mail, Building2, Upload, Download, Users } from 'lucide-react';
import { Contact, Company } from '@/types';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { ContactImportModal } from './ContactImportModal';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

import { useClientTable } from '@/hooks/useClientTable';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { ArrowUpDown, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ContactTableProps {
  initialContacts: Contact[];
  companies: Array<{ id: string; name: string }>;
  count: number;
  currentPage: number;
  pageSize: number;
  status: string;
}

export function ContactTable({ initialContacts, companies, count, currentPage: initialPage, pageSize, status }: ContactTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);
  const activeFilter = (status || 'all') as 'all' | 'active' | 'inactive';

  const {
    search,
    setSearch,
    paginatedData: filtered,
    currentPage,
    totalPages,
    totalResults,
    setCurrentPage,
    handleSort,
  } = useClientTable({
    data: initialContacts,
    pageSize,
    serverSide: true,
    serverCount: count,
    initialSortBy: 'created_at',
  });

  const handleFilterChange = (filter: 'all' | 'active' | 'inactive') => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (filter === 'all') {
      params.delete('status');
    } else {
      params.set('status', filter);
    }
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleExport = () => {
    const exportData = filtered.map(c => ({
      first_name: c.first_name,
      last_name: c.last_name || '',
      email: c.email,
      company_name: (c as any).company?.name || '',
      designation: c.designation || '',
      phone: c.phone || '',
      linkedin_url: c.linkedin_url || '',
      is_primary: c.is_primary ? 'true' : 'false',
      notes: c.notes || '',
      created_at: new Date(c.created_at).toLocaleString(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contacts");
    XLSX.writeFile(wb, "contacts_export.xlsx");
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to delete contact', { description: err.message });
    }
  };

  return (
    <>
    <div className="space-y-6 animate-page-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.6px]">Contacts</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {initialContacts.length} {initialContacts.length === 1 ? 'contact' : 'contacts'} across all companies.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="flex-1 sm:flex-initial h-9 px-2.5 sm:px-3.5 rounded-[8px] text-[13px] border-border text-muted-foreground hover:text-foreground justify-center gap-1 sm:gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export Page</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="flex-1 sm:flex-initial h-9 px-2.5 sm:px-3.5 rounded-[8px] text-[13px] border-border text-muted-foreground hover:text-foreground justify-center gap-1 sm:gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import</span>
          </Button>
          <Link
            href="/contacts/new"
            className={cn(
              buttonVariants({ size: "sm" }),
              "flex-1 sm:flex-initial h-9 px-2.5 sm:px-3.5 rounded-[8px] bg-foreground hover:bg-foreground/90 text-background text-[13px] press-effect flex items-center justify-center shrink-0 gap-1 sm:gap-1.5"
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Contact</span>
          </Link>
        </div>
      </div>

      <div className="rounded-[14px] border border-border overflow-hidden bg-background">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
          <div className="relative flex-1 max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 rounded-[6px] text-[13px] bg-background border-border"
            />
          </div>
          
          {/* Tag-based filters (Active / Inactive) */}
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-[8px] border border-border">
            <button
              type="button"
              onClick={() => handleFilterChange('all')}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-[6px] transition-all cursor-pointer",
                activeFilter === 'all' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('active')}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-[6px] transition-all cursor-pointer",
                activeFilter === 'active' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange('inactive')}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-[6px] transition-all cursor-pointer",
                activeFilter === 'inactive' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Inactive
            </button>
          </div>
          
          <span className="text-[12px] text-muted-foreground ml-auto">
            {totalResults} result{totalResults !== 1 ? 's' : ''}
          </span>
        </div>
 
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border bg-secondary/20">
              <TableHead onClick={() => handleSort('first_name')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Name <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('email')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Email <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10">Company</TableHead>
              <TableHead onClick={() => handleSort('designation')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Role <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10">Status</TableHead>
              <TableHead className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="w-7 h-7 text-muted-foreground/30" />
                    <p className="text-[13px] font-medium text-foreground">
                      {search || activeFilter !== 'all' ? 'No contacts matched.' : 'No contacts yet'}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {search || activeFilter !== 'all' ? 'Try a different search term or filter status.' : 'Click "Add Contact" above to get started.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer border-b border-border/60 last:border-0 group hover:bg-muted/50"
                  onClick={() => router.push(`/contacts/${contact.id}`)}
                >
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[14px] font-medium text-foreground">
                        {contact.first_name} {contact.last_name}
                      </span>
                      {contact.is_primary && (
                        <span className="text-[10px] font-semibold text-primary bg-primary/8 px-1.5 py-0.5 rounded-[4px]">
                          Primary
                        </span>
                      )}
                      {contact.is_general_mailbox && (
                        <span className="text-[10px] font-semibold text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-500/10 px-1.5 py-0.5 rounded-[4px] border border-orange-200 dark:border-orange-500/20">
                          General Mailbox
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground py-3.5">
                    {contact.email}
                  </TableCell>
                  <TableCell className="py-3.5">
                    {(contact as any).company ? (
                      <Link
                        href={`/companies/${contact.company_id}`}
                        prefetch={false}
                        className="text-[13px] text-foreground hover:text-primary transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        {(contact as any).company.name}
                      </Link>
                    ) : (
                      <span className="text-[13px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground py-3.5">
                    {contact.designation || '—'}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border whitespace-nowrap",
                      contact.is_active !== false 
                        ? "text-emerald-600 bg-emerald-100 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20" 
                        : "text-neutral-500 bg-neutral-100 border-neutral-200 dark:text-neutral-400 dark:bg-neutral-500/10 dark:border-neutral-500/20"
                    )}>
                      {contact.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                    {/* Desktop View Action Buttons */}
                    <div className="hidden md:flex items-center justify-end gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const newStatus = contact.is_active === false;
                          try {
                            const res = await fetch(`/api/contacts/${contact.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ is_active: newStatus })
                            });
                            if (!res.ok) throw new Error('Failed to toggle status');
                            toast.success(newStatus ? 'Contact activated' : 'Contact deactivated');
                            router.refresh();
                          } catch (err: any) {
                            toast.error('Failed to toggle status', { description: err.message });
                          }
                        }}
                        className="h-7 text-[12px] px-2 border-border hover:bg-accent/60"
                      >
                        {contact.is_active !== false ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Link 
                        href={`/contacts/${contact.id}/edit`}
                        className={cn(
                          buttonVariants({ variant: 'outline', size: 'sm' }),
                          "h-7 text-[12px] px-2 flex items-center"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        Edit
                      </Link>
                      <Button variant="outline" size="sm" onClick={(e) => handleDelete(contact.id, e)} className="h-7 text-[12px] px-2 text-destructive border-destructive/20 hover:bg-destructive/10">
                        Delete
                      </Button>
                    </div>

                    {/* Mobile View Dropdown Menu */}
                    <div className="flex md:hidden items-center justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-8 w-8 p-0 flex items-center justify-center border border-border/40 hover:bg-muted/80 rounded-[6px] outline-none cursor-pointer">
                          <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[130px] z-[100]">
                          <DropdownMenuItem
                            onClick={async (e) => {
                              e.stopPropagation();
                              const newStatus = contact.is_active === false;
                              try {
                                const res = await fetch(`/api/contacts/${contact.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ is_active: newStatus })
                                });
                                if (!res.ok) throw new Error('Failed to toggle status');
                                toast.success(newStatus ? 'Contact activated' : 'Contact deactivated');
                                router.refresh();
                              } catch (err: any) {
                                toast.error('Failed to toggle status', { description: err.message });
                              }
                            }}
                          >
                            {contact.is_active !== false ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/contacts/${contact.id}/edit`)}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive focus:bg-destructive/10 font-medium"
                            onClick={(e) => handleDelete(contact.id, e)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PaginationControls 
          currentPage={currentPage}
          totalPages={totalPages}
          totalResults={totalResults}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
    <ContactImportModal
      open={importOpen}
      onClose={() => setImportOpen(false)}
    />
    </>
  );
}
