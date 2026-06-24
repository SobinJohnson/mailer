'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Search, FileText, Eye } from 'lucide-react';
import { EmailTemplate } from '@/types';
import Link from 'next/link';

import { useClientTable } from '@/hooks/useClientTable';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { ArrowUpDown } from 'lucide-react';
import { TemplatePreviewModal } from './TemplatePreviewModal';
import useSWR from 'swr';

interface TemplateTableProps {
  initialTemplates: EmailTemplate[];
}

const categoryLabel: Record<string, string> = {
  intro: 'Intro',
  follow_up: 'Follow-up',
  product: 'Product',
  event: 'Event',
};

const fetcher = (url: string) => fetch(url).then(res => res.ok ? res.json() : Promise.reject('Failed to fetch')).then(res => res.data || res);

export function TemplateTable({ initialTemplates }: TemplateTableProps) {
  const router = useRouter();
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { data: templates } = useSWR('/api/templates', fetcher, {
    fallbackData: initialTemplates,
    revalidateOnFocus: false,
  });

  const handlePreviewClick = (t: EmailTemplate) => {
    setSelectedTemplate(t);
    setIsPreviewOpen(true);
  };

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
    data: templates || initialTemplates,
    pageSize: 10,
    initialSortBy: 'updated_at',
    searchableFields: ['name', 'subject'],
  });

  return (
    <div className="space-y-6 animate-page-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.6px]">Templates</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Reusable email templates with dynamic variables.</p>
        </div>
        <Link href="/templates/new" className="w-full sm:w-auto">
          <Button size="sm" className="w-full sm:w-auto h-9 px-2.5 sm:px-3.5 rounded-[8px] bg-foreground hover:bg-foreground/90 text-background text-[13px] press-effect shrink-0 gap-1 sm:gap-1.5 justify-center">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Template</span>
          </Button>
        </Link>
      </div>

      <div className="rounded-[14px] border border-border overflow-hidden bg-background">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
          <div className="relative flex-1 max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search templates…"
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
              <TableHead onClick={() => handleSort('subject')} className="hidden sm:table-cell cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Subject <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('category')} className="hidden md:table-cell cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Category <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead className="hidden lg:table-cell text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10">Variables</TableHead>
              <TableHead onClick={() => handleSort('updated_at')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 text-right hover:text-foreground">
                <div className="flex items-center justify-end gap-1">Updated <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead className="w-12 h-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-7 h-7 text-muted-foreground/30" />
                    <p className="text-[13px] text-muted-foreground">No templates matched.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow
                  key={t.id}
                  className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted/50"
                  onClick={() => router.push(`/templates/${t.id}`)}
                >
                  <TableCell className="py-3.5">
                    <span className="text-[14px] font-medium text-foreground">{t.name}</span>
                    <p className="text-[12px] text-muted-foreground sm:hidden mt-0.5 truncate max-w-[200px]">{t.subject}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-[13px] text-muted-foreground py-3.5 max-w-[220px] truncate">
                    {t.subject}
                  </TableCell>
                  <TableCell className="hidden md:table-cell py-3.5">
                    {t.category ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[5px] text-[11px] font-medium bg-muted text-muted-foreground">
                        {categoryLabel[t.category] ?? t.category}
                      </span>
                    ) : (
                      <span className="text-[13px] text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell py-3.5">
                    {t.variables?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {t.variables.slice(0, 3).map(v => (
                          <code key={v} className="text-[10px] font-mono bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-[4px]">
                            {'{{'}{v}{'}}'}
                          </code>
                        ))}
                        {t.variables.length > 3 && (
                          <span className="text-[11px] text-muted-foreground">+{t.variables.length - 3}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[13px] text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-[13px] text-muted-foreground py-3.5">
                    {new Date(t.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </TableCell>
                  <TableCell className="text-right py-3.5 select-none" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="w-8 h-8 rounded-full hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                      onClick={() => handlePreviewClick(t)}
                      title="Preview template"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
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

      {selectedTemplate && (
        <TemplatePreviewModal 
          template={{
            name: selectedTemplate.name,
            subject: selectedTemplate.subject,
            body_html: selectedTemplate.body_html,
          }}
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
}
