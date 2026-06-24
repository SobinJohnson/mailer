'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClientTable } from '@/hooks/useClientTable';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { ArrowUpDown } from 'lucide-react';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Search, Building2, Upload, Download } from 'lucide-react';
import { Company } from '@/types';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { CompanyImportModal } from './CompanyImportModal';
import useSWR from 'swr';

interface CompanyTableProps {
  initialCompanies: Company[];
}

const statusStyles: Record<string, string> = {
  active: 'bg-foreground/8 text-foreground',
  inactive: 'bg-muted text-muted-foreground',
  prospect: 'bg-primary/8 text-primary',
  do_not_contact: 'bg-destructive/8 text-destructive',
};

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : Promise.reject('Failed to fetch')).then(res => res.data || res);

export function CompanyTable({ initialCompanies }: CompanyTableProps) {
  const [importOpen, setImportOpen] = useState(false);
  const router = useRouter();

  const { data: companies } = useSWR('/api/companies', fetcher, {
    fallbackData: initialCompanies,
    revalidateOnFocus: false,
  });

  const {
    search,
    setSearch,
    paginatedData: filteredCompanies,
    currentPage,
    totalPages,
    totalResults,
    setCurrentPage,
    handleSort,
  } = useClientTable({
    data: companies || initialCompanies,
    pageSize: 10,
    initialSortBy: 'created_at',
    searchableFields: ['name', 'industry', 'city', 'state'],
  });

  const handleExport = () => {
    const exportData = filteredCompanies.map(c => ({
      name: c.name,
      industry: c.industry || '',
      city: c.city || '',
      state: c.state || '',
      website: c.website || '',
      linkedin_url: c.linkedin_url || '',
      status: c.status || '',
      tags: c.tags?.join(', ') || '',
      notes: c.notes || '',
      created_at: new Date(c.created_at).toLocaleString(),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Companies");
    XLSX.writeFile(wb, "companies_export.xlsx");
  };

  return (
    <>
    <div className="space-y-6 animate-page-in">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.6px]">Companies</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            {(companies || initialCompanies).length} {(companies || initialCompanies).length === 1 ? 'company' : 'companies'} in your database.
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
            href="/companies/new"
            className={cn(
              buttonVariants({ size: "sm" }),
              "flex-1 sm:flex-initial h-9 px-2.5 sm:px-3.5 rounded-[8px] bg-foreground hover:bg-foreground/90 text-background text-[13px] press-effect flex items-center justify-center shrink-0 gap-1 sm:gap-1.5"
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Company</span>
          </Link>
        </div>
      </div>

      {/* Table card */}
      <div className="rounded-[14px] border border-border overflow-hidden bg-background">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
          <div className="relative flex-1 max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search companies…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 rounded-[6px] text-[13px] bg-background border-border"
            />
          </div>
          <span className="text-[12px] text-muted-foreground ml-auto">
            {totalResults} result{totalResults !== 1 ? 's' : ''}
          </span>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border bg-secondary/20">
              <TableHead onClick={() => handleSort('name')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Company <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('industry')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Industry <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('city')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Location <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('status')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('created_at')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 text-right hover:text-foreground">
                <div className="flex items-center justify-end gap-1">Added <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCompanies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Building2 className="w-7 h-7 text-muted-foreground/30" />
                    <p className="text-[13px] font-medium text-foreground">
                      {search ? 'No companies matched.' : 'No companies yet'}
                    </p>
                    <p className="text-[12px] text-muted-foreground">
                      {search ? 'Try a different search term.' : 'Click "Add Company" above to get started.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredCompanies.map((company) => (
                <TableRow
                  key={company.id}
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/50"
                  onClick={() => router.push(`/companies/${company.id}`)}
                >
                  <TableCell className="py-3.5">
                    <span className="text-[14px] font-medium text-foreground">{company.name}</span>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground py-3.5">
                    {company.industry || '—'}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground py-3.5">
                    {company.city ? `${company.city}${company.state ? `, ${company.state}` : ''}` : '—'}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-[5px] text-[11px] font-medium capitalize ${statusStyles[company.status] || statusStyles.inactive}`}>
                      {company.status?.replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-[13px] text-muted-foreground py-3.5">
                    {new Date(company.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
    <CompanyImportModal 
      open={importOpen}
      onClose={() => setImportOpen(false)}
    />
    </>
  );
}
