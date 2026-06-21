'use client';

import { useState } from 'react';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { MessageCircleReply, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
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
import { toast } from 'sonner';

interface RepliesTableProps {
  replies: any[];
}

export function RepliesTable({ replies }: RepliesTableProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedReply, setSelectedReply] = useState<any | null>(null);
  const router = useRouter();

  const flatReplies = replies.map(r => ({
    ...r,
    search_name: `${r.contact?.first_name || ''} ${r.contact?.last_name || ''} ${r.contact?.email || ''}`,
    search_campaign: r.campaign?.name || '',
    search_subject: r.reply_snapshot?.subject || r.email_snapshot?.subject || ''
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
    data: flatReplies,
    pageSize: 10,
    initialSortBy: 'replied_at',
    initialSortDirection: 'desc',
    searchableFields: ['search_name', 'search_campaign', 'search_subject'],
  });

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync/manual', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to sync');

      const totalMatches = data.results?.reduce((acc: number, r: any) => acc + (r.matches || 0), 0) || 0;
      toast.success('Sync complete', { description: `Found ${totalMatches} new replies.` });
      router.refresh();
    } catch (err: any) {
      toast.error('Sync failed', { description: err.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const openInGmail = (messageId: string) => {
    const cleanId = messageId.replace(/[<>]/g, '');
    const url = `https://mail.google.com/mail/u/0/#search/rfc822msgid%3A${encodeURIComponent(cleanId)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-page-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.6px]">Replies</h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            Incoming replies synced via IMAP. Tap a row to view the message.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isSyncing}
          className="h-9 px-3.5 rounded-[8px] text-[13px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync IMAP'}
        </Button>
      </div>

      <div className="rounded-[14px] border border-border overflow-hidden bg-background">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/30">
          <div className="relative flex-1 max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search replies…"
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
                <div className="flex items-center gap-1">Contact <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('search_campaign')} className="hidden sm:table-cell cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Campaign <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('search_subject')} className="hidden md:table-cell cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 hover:text-foreground">
                <div className="flex items-center gap-1">Subject <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
              <TableHead onClick={() => handleSort('replied_at')} className="cursor-pointer text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] h-10 text-right hover:text-foreground">
                <div className="flex items-center justify-end gap-1">Replied At <ArrowUpDown className="w-3 h-3" /></div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <MessageCircleReply className="w-7 h-7 text-muted-foreground/30" />
                    <p className="text-[13px] text-muted-foreground">No replies matched.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((reply) => (
                <TableRow
                  key={reply.id}
                  className="border-b border-border/60 last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedReply(reply)}
                >
                  <TableCell className="py-3.5">
                    <p className="text-[14px] font-medium text-foreground">
                      {reply.contact?.first_name} {reply.contact?.last_name}
                    </p>
                    <p className="text-[12px] text-muted-foreground">{reply.contact?.email}</p>
                    <p className="text-[11px] text-muted-foreground sm:hidden mt-0.5 truncate max-w-[160px]">{reply.campaign?.name}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-[13px] text-muted-foreground py-3.5">
                    {reply.campaign?.name}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-[13px] text-foreground font-medium py-3.5 max-w-[200px] truncate">
                    {reply.search_subject || 'Unknown Subject'}
                  </TableCell>
                  <TableCell className="text-right text-[13px] text-muted-foreground py-3.5 whitespace-nowrap">
                    {reply.replied_at
                      ? new Date(reply.replied_at).toLocaleString('en-US', {
                        month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                      })
                      : 'Unknown'}
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

      <Dialog open={!!selectedReply} onOpenChange={(open) => !open && setSelectedReply(null)}>
        {selectedReply && (
          <DialogContent className="sm:max-w-5xl bg-background rounded-[16px] border-border shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="p-6 border-b border-border bg-secondary/30 flex flex-row items-center justify-between">
              <DialogTitle className="text-[20px] font-semibold text-foreground">
                Incoming Reply
              </DialogTitle>
              {selectedReply.reply_snapshot?.message_id && (
                <Button
                  onClick={() => openInGmail(selectedReply.reply_snapshot.message_id)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-[12px] rounded-[6px]"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Reply in Gmail
                </Button>
              )}
            </DialogHeader>
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">From</p>
                  <p className="text-[14px] text-foreground font-medium">{selectedReply.contact?.first_name} {selectedReply.contact?.last_name}</p>
                  <p className="text-[12px] text-muted-foreground break-all">{selectedReply.contact?.email}</p>
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Campaign</p>
                  <p className="text-[14px] text-foreground font-medium">{selectedReply.campaign?.name}</p>
                </div>
              </div>

              {selectedReply.reply_snapshot ? (
                <div className="space-y-4 border-t border-border pt-6 mt-6">
                  <div>
                    <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Subject</p>
                    <p className="text-[14px] text-foreground font-medium">{selectedReply.reply_snapshot.subject}</p>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Message Body</p>
                    <div className="bg-background border border-border rounded-[12px] p-4 text-[14px] text-foreground prose max-w-none">
                      {selectedReply.reply_snapshot.body_html ? (
                        <div dangerouslySetInnerHTML={{ __html: selectedReply.reply_snapshot.body_html }} />
                      ) : (
                        <div className="whitespace-pre-wrap">{selectedReply.reply_snapshot.body_text}</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-[13px] text-muted-foreground italic border-t border-border pt-6 mt-6">
                  No snapshot available for this reply. (It may have been processed before snapshots were enabled).
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
