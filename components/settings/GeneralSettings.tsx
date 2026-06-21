'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export function GeneralSettings() {
  const [hideCampaigns, setHideCampaigns] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setHideCampaigns(localStorage.getItem('hideCampaigns') === 'true');
    setMounted(true);
  }, []);

  const handleToggle = (checked: boolean) => {
    setHideCampaigns(checked);
    localStorage.setItem('hideCampaigns', String(checked));
    // Dispatch custom event to notify layout and other components instantly
    window.dispatchEvent(new Event('local-storage-settings-change'));
    toast.success(checked ? 'Campaigns section disabled' : 'Campaigns section enabled', {
      description: checked 
        ? 'Standard campaigns are now hidden from navigation.'
        : 'Standard campaigns are now visible in navigation.'
    });
  };

  if (!mounted) return null;

  return (
    <div className="bg-background border border-border rounded-[18px] p-8 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-[20px] font-semibold tracking-[-0.3px] text-foreground">General Preferences</h2>
          <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[600px]">
            Configure layout and toggle visible sections. If you are using the Weekly Planner, disabling standard campaigns can simplify your workspace and avoid confusion.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[14px] font-medium text-foreground select-none">
            Hide Campaigns Section
          </span>
          <Switch
            checked={hideCampaigns}
            onCheckedChange={handleToggle}
          />
        </div>
      </div>
    </div>
  );
}
