'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface CampaignDetailActionsProps {
  campaignId: string;
  status: string;
}

export function CampaignDetailActions({ campaignId, status }: CampaignDetailActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);

  const handleDelete = async () => {
    if (status === 'running') {
      if (!confirm('This campaign is currently running. Are you sure you want to delete it? This will stop all pending emails.')) return;
    } else {
      if (!confirm('Are you sure you want to delete this campaign? All recipient logs will be removed.')) return;
    }
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete campaign');
      router.push('/campaigns');
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Failed to delete campaign');
      setIsDeleting(false);
    }
  };

  const handleProcessQueue = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/send/manual', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`Processed ${data.processed || 0} queued emails. Sent: ${data.sent || 0}, Failed: ${data.failed || 0}`);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      alert('Failed to process queue: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleProcessQueue}
        disabled={isProcessing}
        className="h-9 px-3.5 rounded-[8px] text-[13px]"
      >
        {isProcessing ? 'Checking...' : 'Re-check Queue (Force Send)'}
      </Button>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleDelete}
        disabled={isDeleting}
        className="h-9 px-3.5 rounded-[8px] text-[13px] text-destructive border-destructive/20 hover:bg-destructive/10"
      >
        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
        Delete Campaign
      </Button>
    </div>
  );
}
