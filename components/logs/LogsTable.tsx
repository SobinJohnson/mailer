'use client';

import { useState } from 'react';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useClientTable } from '@/hooks/useClientTable';
import { PaginationControls } from '@/components/shared/PaginationControls';
import { ArrowUpDown, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface LogsTableProps {
  logs: any[];
}

export function LogsTable({ logs }: LogsTableProps) {
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const flatLogs = logs.map(l => ({
    ...l,
    search_name: `${l.contact?.first_name || ''} ${l.contact?.last_name || ''} ${l.contact?.email || ''}`,
    search_campaign: l.campaign?.name || '',
    sort_time: l.sent_at || l.scheduled_send
  }));

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
    data: flatLogs,
    pageSize: 10,
    initialSortBy: 'sort_time',
    initialSortDirection: 'desc',
    searchableFields: ['search_name', 'search_campaign', 'status'],
  });

  return (
    <div className="space-y-6 animate-page-in">
      <div>
        <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.6px]">Send Logs</h1>
        <p className="text-[14px] text-muted-foreground mt-1">
          History of all sent and failed emails. Click a row to see exactly what was sent and why it failed.
        </p>
      </div>

      <div className="rounded-[14px] border border-border overflow-hidden bg-background">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
          <div className="relative flex-1 max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search logs…"
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
              <TableHead onClick={() => handleSort('search_name')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Recipient <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('search_campaign')} className="hidden sm:table-cell cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Campaign <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('status')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('sort_time')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 text-right hover:text-foreground">
                <div className="flex items-center justify-end gap-1">Time <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center text-[13px] text-muted-foreground">
                  No logs matched.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((log) => (
                <TableRow
                  key={log.id}
                  className="border-b border-border/60 last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedLog(log)}
                >
                  <TableCell className="py-3.5">
                    <p className="text-[14px] font-medium text-foreground">
                      {log.contact?.first_name} {log.contact?.last_name}
                    </p>
                    <p className="text-[12px] text-muted-foreground">{log.contact?.email}</p>
                    <p className="text-[11px] text-muted-foreground sm:hidden mt-0.5 truncate max-w-[160px]">{log.campaign?.name}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-[13px] text-muted-foreground py-3.5">
                    {log.campaign?.name}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <Badge variant="outline" className={`font-normal rounded-full ${
                      log.status === 'sent' ? 'bg-green-500/10 text-green-700 border-green-500/20' :
                      log.status === 'replied' ? 'bg-blue-500/10 text-blue-700 border-blue-500/20' :
                      log.status === 'failed' ? 'bg-red-500/10 text-red-700 border-red-500/20' :
                      log.status === 'skipped' ? 'bg-orange-500/10 text-orange-700 border-orange-500/20' :
                      'bg-secondary text-muted-foreground border-border'
                    }`}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-[13px] text-muted-foreground py-3.5 whitespace-nowrap">
                    {new Date(log.sort_time).toLocaleString('en-US', {
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
          currentPage={currentPage}
          totalPages={totalPages}
          totalResults={totalResults}
          onPageChange={setCurrentPage}
        />
      </div>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        {selectedLog && (
          <DialogContent className="sm:max-w-5xl bg-background rounded-[16px] border-border shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 border-b border-border bg-secondary/30">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`font-normal rounded-full ${
                  selectedLog.status === 'sent' ? 'bg-green-500/10 text-green-700 border-green-500/20' :
                  selectedLog.status === 'replied' ? 'bg-blue-500/10 text-blue-700 border-blue-500/20' :
                  selectedLog.status === 'failed' ? 'bg-red-500/10 text-red-700 border-red-500/20' :
                  selectedLog.status === 'skipped' ? 'bg-orange-500/10 text-orange-700 border-orange-500/20' :
                  'bg-secondary text-muted-foreground border-border'
                }`}>
                  {selectedLog.status.toUpperCase()}
                </Badge>
                <DialogTitle className="text-[20px] font-semibold text-foreground">
                  Send Details
                </DialogTitle>
              </div>
            </DialogHeader>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">To</p>
                  <p className="text-[14px] text-foreground font-medium break-all">{selectedLog.contact?.email}</p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">From (SMTP)</p>
                  <p className="text-[14px] text-foreground font-medium">{selectedLog.campaign?.smtp_config?.label || 'Unknown SMTP'}</p>
                  <p className="text-[12px] text-muted-foreground break-all">{selectedLog.campaign?.from_email}</p>
                </div>
              </div>

              {selectedLog.status === 'failed' && selectedLog.error_message && (
                <div>
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Error Reason</p>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-[8px] p-3 text-red-700 text-[13px] font-mono break-all">
                    {selectedLog.error_message}
                  </div>
                </div>
              )}

              {selectedLog.email_snapshot ? (
                <div className="space-y-4 border-t border-border pt-6 mt-6">
                  <div>
                    <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Subject</p>
                    <p className="text-[14px] text-foreground font-medium">{selectedLog.email_snapshot.subject}</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Message Body</p>
                    <div className="bg-background border border-border rounded-[12px] p-4 text-[14px] text-foreground prose max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: selectedLog.email_snapshot.body_html }} />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[13px] text-muted-foreground italic border-t border-border pt-6 mt-6">
                  No snapshot available. The email may have failed before generation.
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
