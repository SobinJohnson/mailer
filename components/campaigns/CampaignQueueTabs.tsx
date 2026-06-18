'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell,
  TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RefreshCw, Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface CampaignQueueTabsProps {
  groupedRecipients: Record<string, any[]>;
}

export function CampaignQueueTabs({ groupedRecipients }: CampaignQueueTabsProps) {
  // Sort dates descending
  const dates = Object.keys(groupedRecipients).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  
  const today = new Date().toLocaleDateString('en-CA');
  
  // Default to today if it exists, otherwise the most recent date
  const [activeDate, setActiveDate] = useState<string>(
    dates.includes(today) ? today : (dates[0] || today)
  );

  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    router.refresh();
    toast.success('Refreshed Queue', {
      description: 'The queue status has been updated.',
    });
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleSendNow = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/send/process', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to process queue');
      
      toast.success('Queue Processed', {
        description: `Successfully processed ${data.processed} emails (Sent: ${data.sent}, Failed: ${data.failed})`,
      });
      router.refresh();
    } catch (err: any) {
      toast.error('Error processing queue', {
        description: err.message,
      });
    } finally {
      setSending(false);
    }
  };

  const activeRecipients = groupedRecipients[activeDate] || [];
  const dateSent = activeRecipients.filter((r: any) => r.status === 'sent').length;
  const dateQueued = activeRecipients.filter((r: any) => r.status === 'queued' || r.status === 'pending').length;

  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA');

  const getDisplayDate = (d: string) => {
    if (d === today) return 'Today';
    if (d === tomorrow) return 'Tomorrow';
    return d;
  };

  if (dates.length === 0) {
    return (
      <div className="bg-background border border-border rounded-[18px] p-12 text-center text-muted-foreground shadow-sm">
        No recipients queued.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Quick Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-1">
          {dates.map(dateKey => (
            <button
              key={dateKey}
              onClick={() => setActiveDate(dateKey)}
              className={`px-4 py-2 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
                activeDate === dateKey 
                  ? 'bg-foreground text-background shadow-md' 
                  : 'bg-secondary text-muted-foreground border border-border hover:bg-secondary/80'
              }`}
            >
              {getDisplayDate(dateKey)}
              <span className="ml-2 opacity-60 text-[11px]">
                ({groupedRecipients[dateKey]?.length || 0})
              </span>
            </button>
          ))}
        </div>
        
        {/* Specific Date Picker */}
        <div className="flex items-center gap-2 pb-2">
          <span className="text-[13px] text-muted-foreground font-medium">Jump to Date:</span>
          <input 
            type="date"
            value={activeDate}
            onChange={(e) => {
              if (e.target.value) setActiveDate(e.target.value);
            }}
            className="h-9 px-3 py-1 rounded-[8px] border border-border bg-background text-[13px] shadow-sm outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Actions: Refresh & Send Now */}
        <div className="flex items-center gap-2 pb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 rounded-[8px] text-[13px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleSendNow}
            disabled={sending}
            className="h-9 rounded-[8px] text-[13px]"
          >
            {sending ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 mr-1.5" />
            )}
            {sending ? 'Sending...' : 'Send Now'}
          </Button>
        </div>
      </div>

      {/* Active Tab Content */}
      <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm space-y-4 animate-fade-in">
        <div className="flex items-center justify-between border-b border-border/50 pb-3 gap-3 flex-wrap">
          <h3 className="text-[16px] font-medium text-foreground">
            {getDisplayDate(activeDate)}
            {activeDate !== today && activeDate !== tomorrow && (
              <span className="text-muted-foreground ml-2 font-normal text-[14px] hidden sm:inline">({activeDate})</span>
            )}
          </h3>
          <div className="flex gap-3 text-[13px]">
            <span className="text-green-600 font-medium">Sent: {dateSent}</span>
            <span className="text-muted-foreground font-medium">Queued: {dateQueued}</span>
          </div>
        </div>

        <div className="border border-border rounded-[11px] overflow-hidden">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-foreground">Contact</TableHead>
                <TableHead className="hidden sm:table-cell font-semibold text-foreground">Company</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeRecipients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    No recipients found for this date.
                  </TableCell>
                </TableRow>
              ) : (
                activeRecipients.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{r.contact?.first_name} {r.contact?.last_name}</p>
                      <p className="text-[12px] text-muted-foreground">{r.contact?.email}</p>
                      <p className="text-[11px] text-muted-foreground sm:hidden">{r.contact?.company?.name}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{r.contact?.company?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`font-normal rounded-full ${
                        r.status === 'sent' ? 'bg-green-500/10 text-green-700 border-green-500/20' :
                        r.status === 'failed' ? 'bg-red-500/10 text-red-700 border-red-500/20' :
                        'bg-secondary text-muted-foreground border-border'
                      }`}>
                        {r.status}
                      </Badge>
                      {r.error_message && (
                        <p className="text-[11px] text-red-500 mt-1 max-w-[200px] truncate" title={r.error_message}>
                          {r.error_message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-[13px] whitespace-nowrap">
                      {r.status === 'sent' && r.sent_at
                        ? new Date(r.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : r.scheduled_send
                          ? new Date(r.scheduled_send).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
