'use client';

import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ListOrdered } from 'lucide-react';

import { useClientTable } from '@/hooks/useClientTable';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { ArrowUpDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface QueueTableProps {
  initialQueue: any[];
}

const statusStyles: Record<string, string> = {
  queued:  'bg-primary/8 text-primary',
  pending: 'bg-muted text-muted-foreground',
};

export function QueueTable({ initialQueue }: QueueTableProps) {
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
    data: initialQueue,
    pageSize: 10,
    initialSortBy: 'scheduled_send',
    // We want to sort chronologically, scheduled_send is a date string.
    // The hook will sort it as string which works for ISO strings.
    initialSortDirection: 'asc', 
    searchableFields: ['status'], 
  });

  // Because searchableFields doesn't deep search nested objects (contact.email, campaign.name),
  // we can use the default full search without specifying fields, or just pass empty searchableFields
  // to search all string values, but since they are nested objects we can just implement the default search behavior
  // wait, the generic useClientTable doesn't search deep nested fields by default unless specified or overridden.
  // Actually, let's just let it be, or we can flatten the data before passing it, or add deep search to useClientTable later if needed.
  // Let's pass the data as is. The user can search by status.
  // To make it better, I will map the initialQueue to include flattened fields for searching.
  const flatQueue = initialQueue.map(item => ({
    ...item,
    search_name: `${item.contact?.first_name || ''} ${item.contact?.last_name || ''} ${item.contact?.email || ''}`,
    search_campaign: item.campaign?.name || ''
  }));

  const {
    search: qsSearch,
    setSearch: setQsSearch,
    paginatedData: qsFiltered,
    currentPage: qsPage,
    totalPages: qsTotal,
    totalResults: qsResults,
    setCurrentPage: setQsPage,
    handleSort: handleQsSort,
  } = useClientTable({
    data: flatQueue,
    pageSize: 10,
    initialSortBy: 'scheduled_send',
    initialSortDirection: 'asc',
    searchableFields: ['search_name', 'search_campaign', 'status'],
  });

  return (
    <div className="space-y-6 animate-page-in">
      <div>
        <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.6px]">Queue</h1>
        <p className="text-[14px] text-muted-foreground mt-1">
          {initialQueue.length} email{initialQueue.length !== 1 ? 's' : ''} scheduled.
        </p>
      </div>

      <div className="rounded-[14px] border border-border overflow-hidden bg-background">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
          <div className="relative flex-1 max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search queue…"
              value={qsSearch}
              onChange={(e) => setQsSearch(e.target.value)}
              className="pl-8 h-8 rounded-[6px] text-[13px] bg-background border-border"
            />
          </div>
          <span className="text-[12px] text-muted-foreground ml-auto">{qsResults} result{qsResults !== 1 ? 's' : ''}</span>
        </div>

        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border bg-secondary/20">
              <TableHead onClick={() => handleQsSort('search_name')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Recipient <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleQsSort('search_campaign')} className="hidden sm:table-cell cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Campaign <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleQsSort('status')} className="hidden sm:table-cell cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleQsSort('scheduled_send')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 text-right hover:text-foreground">
                <div className="flex items-center justify-end gap-1">Scheduled <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {qsFiltered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ListOrdered className="w-7 h-7 text-muted-foreground/30" />
                    <p className="text-[13px] text-muted-foreground">No emails matched.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              qsFiltered.map((item) => (
                <TableRow key={item.id} className="border-b border-border/60 last:border-0 hover:bg-muted/50">
                  <TableCell className="py-3.5">
                    <p className="text-[14px] font-medium text-foreground">
                      {item.contact?.first_name} {item.contact?.last_name}
                    </p>
                    <p className="text-[12px] text-muted-foreground">{item.contact?.email}</p>
                    <div className="sm:hidden mt-1 flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-[5px] text-[11px] font-medium capitalize ${statusStyles[item.status] ?? statusStyles.pending}`}>
                        {item.status}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">{item.campaign?.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-[13px] text-muted-foreground py-3.5">
                    {item.campaign?.name}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-[5px] text-[11px] font-medium capitalize ${statusStyles[item.status] ?? statusStyles.pending}`}>
                      {item.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-[13px] text-muted-foreground py-3.5 whitespace-nowrap">
                    {new Date(item.scheduled_send).toLocaleString('en-US', {
                      month: 'short', day: 'numeric',
                      hour: 'numeric', minute: '2-digit',
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
        <PaginationControls 
          currentPage={qsPage}
          totalPages={qsTotal}
          totalResults={qsResults}
          onPageChange={setQsPage}
        />
      </div>
    </div>
  );
}
