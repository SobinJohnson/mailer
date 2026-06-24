'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Search, Megaphone } from 'lucide-react';
import Link from 'next/link';

import { useClientTable } from '@/hooks/useClientTable';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { ArrowUpDown } from 'lucide-react';

import useSWR from 'swr';

interface CampaignTableProps {
  initialCampaigns: any[];
}

const statusStyles: Record<string, string> = {
  draft:     'bg-muted text-muted-foreground',
  running:   'bg-primary/8 text-primary',
  completed: 'bg-foreground/8 text-foreground',
  paused:    'bg-warning/8 text-warning',
};

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : Promise.reject('Failed to fetch')).then(res => res.data || res);

export function CampaignTable({ initialCampaigns }: CampaignTableProps) {
  const router = useRouter();
  const [isDisabled, setIsDisabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { data: campaigns } = useSWR('/api/campaigns', fetcher, {
    fallbackData: initialCampaigns,
    revalidateOnFocus: false,
  });

  useEffect(() => {
    setIsDisabled(localStorage.getItem('hideCampaigns') === 'true');
    setMounted(true);
  }, []);

  const {
    search,
    setSearch,
    paginatedData: filtered,
    currentPage,
    totalPages,
    totalResults,
    setCurrentPage,
    handleSort,
  } = useClientTable<any>({
    data: campaigns || initialCampaigns,
    pageSize: 10,
    initialSortBy: 'created_at',
    searchableFields: ['name', 'status'],
  });

  if (!mounted) {
    return null;
  }

  if (isDisabled) {
    return (
      <div className="max-w-md mx-auto my-12 text-center space-y-6 bg-background border border-border rounded-[18px] p-8 shadow-sm animate-page-in">
        <div className="w-12 h-12 rounded-full bg-warning/10 text-warning flex items-center justify-center mx-auto">
          <Megaphone className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-[20px] font-semibold text-foreground tracking-[-0.3px]">Campaigns Section Disabled</h2>
          <p className="text-[14px] text-muted-foreground leading-relaxed">
            The standard Campaigns section has been hidden to avoid confusion while using the Weekly Planner. You can re-enable it in settings.
          </p>
        </div>
        <Button 
          onClick={() => router.push('/settings')} 
          className="h-10 px-5 rounded-[10px] bg-foreground text-background hover:bg-foreground/90 font-medium text-[14px] w-full"
        >
          Go to Settings
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-page-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.6px]">Campaigns</h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Outbound email sequences.
          </p>
        </div>
        <Link href="/campaigns/new" className="w-full sm:w-auto">
          <Button size="sm" className="w-full sm:w-auto h-9 px-2.5 sm:px-3.5 rounded-[8px] bg-foreground hover:bg-foreground/90 text-background text-[13px] press-effect shrink-0 gap-1 sm:gap-1.5 justify-center">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Campaign</span>
          </Button>
        </Link>
      </div>

      <div className="rounded-[14px] border border-border overflow-hidden bg-background">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
          <div className="relative flex-1 max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search campaigns…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 rounded-[6px] text-[13px] bg-background border-border"
            />
          </div>
          <span className="text-[12px] text-muted-foreground ml-auto">{totalResults} result{totalResults !== 1 ? 's' : ''}</span>
        </div>

        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border bg-secondary/20">
              <TableHead onClick={() => handleSort('name')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Name <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('status')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead className="hidden sm:table-cell text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10">Template</TableHead>
              <TableHead className="hidden md:table-cell text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10">SMTP</TableHead>
              <TableHead onClick={() => handleSort('created_at')} className="hidden sm:table-cell cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 text-right hover:text-foreground">
                <div className="flex items-center justify-end gap-1">Created <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Megaphone className="w-7 h-7 text-muted-foreground/30" />
                    <p className="text-[13px] text-muted-foreground">No campaigns matched.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/50"
                  onClick={() => router.push(`/campaigns/${c.id}`)}
                >
                  <TableCell className="py-3.5">
                    <span className="text-[14px] font-medium text-foreground">{c.name}</span>
                    <p className="text-[12px] text-muted-foreground sm:hidden mt-0.5">{c.template?.name || '—'}</p>
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-[5px] text-[11px] font-medium capitalize ${statusStyles[c.status] || statusStyles.draft}`}>
                      {c.status}
                    </span>
                    <p className="text-[11px] text-muted-foreground sm:hidden mt-1">
                      {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-[13px] text-muted-foreground py-3.5">{c.template?.name || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-[13px] text-muted-foreground py-3.5">{c.smtp_config?.label || '—'}</TableCell>
                  <TableCell className="hidden sm:table-cell text-right text-[13px] text-muted-foreground py-3.5">
                    {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
        <PaginationControls 
          currentPage={currentPage}
          totalPages={totalPages}
          totalResults={totalResults}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
