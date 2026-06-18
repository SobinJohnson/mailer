'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Send, Play } from 'lucide-react';
import { toast } from 'sonner';

export function ManualTriggers() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleProcessQueue = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/send/process', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to process queue');
      
      toast.success('Queue Processed', {
        description: `Successfully processed ${data.processed} emails (Sent: ${data.sent}, Failed: ${data.failed})`,
      });
    } catch (err: any) {
      toast.error('Error processing queue', {
        description: err.message,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncImap = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/sync/imap', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to sync IMAP');
      
      const totalMatches = data.results?.reduce((acc: number, curr: any) => acc + (curr.matches || 0), 0) || 0;
      
      toast.success('IMAP Sync Complete', {
        description: `Checked connected mailboxes. Found ${totalMatches} new replies.`,
      });
    } catch (err: any) {
      toast.error('Error syncing IMAP', {
        description: err.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        className="h-8 text-[12px] bg-background"
        onClick={handleSyncImap}
        disabled={isSyncing}
      >
        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
        {isSyncing ? 'Syncing...' : 'Sync Replies'}
      </Button>
      
      <Button 
        variant="default" 
        size="sm" 
        className="h-8 text-[12px]"
        onClick={handleProcessQueue}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
        ) : (
          <Play className="w-3.5 h-3.5 mr-1.5" />
        )}
        {isProcessing ? 'Processing...' : 'Run Queue'}
      </Button>
    </div>
  );
}
