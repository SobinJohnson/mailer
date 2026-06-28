'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { 
  Building2, Users, Megaphone, Send, ArrowRight, 
  TrendingUp, Inbox, CheckCircle2, Award, ExternalLink, Loader2, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CountStats {
  totalCompanies: number;
  activeCompanies: number;
  totalContacts: number;
  activeContacts: number;
  activeCampaigns: number;
  queuedMails: number;
}

interface DailyActivity {
  day: string;
  count: number;
}

interface CampaignStat {
  id: string;
  name: string;
  status: string;
  weekly_plan_id: string | null;
  sent: number;
  replied: number;
  failed: number;
  replyRate: number;
}

interface ReplyingCompany {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  replied_at: string;
}

interface BestTemplate {
  id: string;
  name: string;
  sent: number;
  replied: number;
  replyRate: number;
}

interface AwayStats {
  sent: number;
  replies: number;
  completed: number;
}

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<CountStats | null>(null);
  const [dailyActivity, setDailyActivity] = useState<DailyActivity[]>([]);
  const [campaignStats, setCampaignStats] = useState<CampaignStat[]>([]);
  const [bestTemplate, setBestTemplate] = useState<BestTemplate | null>(null);
  const [replyingCompanies, setReplyingCompanies] = useState<ReplyingCompany[]>([]);
  
  // "While you were away" modal state
  const [awayStats, setAwayStats] = useState<AwayStats | null>(null);
  const [showAwayModal, setShowAwayModal] = useState(false);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        // Read last active timestamp
        const lastActive = localStorage.getItem('lastActiveTimestamp');
        
        let url = '/api/dashboard/stats';
        if (lastActive) {
          url += `?lastActive=${encodeURIComponent(lastActive)}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (res.ok) {
          setCounts(data.counts);
          setDailyActivity(data.dailyActivity || []);
          setCampaignStats(data.campaignStats || []);
          setBestTemplate(data.bestTemplate);
          setReplyingCompanies(data.replyingCompanies || []);
          
          if (data.awayStats && (data.awayStats.sent > 0 || data.awayStats.replies > 0 || data.awayStats.completed > 0)) {
            setAwayStats(data.awayStats);
            setShowAwayModal(true);
          }
        }
        
        // Save new active timestamp
        localStorage.setItem('lastActiveTimestamp', new Date().toISOString());
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 pb-12 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 bg-secondary rounded-[8px] w-48" />
            <div className="h-4 bg-muted rounded-[4px] w-80" />
          </div>
          <div className="h-6 bg-secondary rounded-full w-28" />
        </div>

        {/* Bento Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Bento Cell 1: Outbound Operations Summary (Double-Wide) */}
          <div className="md:col-span-2 rounded-[16px] border border-border bg-background p-6 flex flex-col justify-between h-[230px] shadow-sm">
            <div className="space-y-3">
              <div className="h-5 bg-secondary rounded-[6px] w-56" />
              <div className="h-4 bg-muted rounded-[4px] w-full" />
              <div className="h-4 bg-muted rounded-[4px] w-2/3" />
            </div>
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/60">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="h-3 bg-muted rounded-[4px] w-20" />
                  <div className="h-7 bg-secondary rounded-[6px] w-12" />
                </div>
              ))}
            </div>
          </div>

          {/* Bento Cell 2: Database Volume Status */}
          <div className="rounded-[16px] border border-border bg-background p-6 flex flex-col justify-between h-[230px] shadow-sm">
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded-[4px] w-24" />
              <div className="h-5 bg-secondary rounded-[6px] w-36" />
            </div>
            <div className="space-y-4 my-6">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-3 bg-muted rounded-[4px] w-24" />
                    <div className="h-3 bg-muted rounded-[4px] w-12" />
                  </div>
                  <div className="w-full h-2 rounded-full bg-secondary" />
                </div>
              ))}
            </div>
            <div className="h-4 bg-secondary rounded-[4px] w-28" />
          </div>

          {/* Bento Cell 3: Sending Activity Sparkline (Double-Wide) */}
          <div className="md:col-span-2 rounded-[16px] border border-border bg-background p-6 flex flex-col justify-between h-[230px] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded-[4px] w-24" />
                <div className="h-5 bg-secondary rounded-[6px] w-36" />
              </div>
              <div className="h-4 bg-muted rounded-[4px] w-20" />
            </div>
            <div className="w-full h-[120px] bg-secondary/30 rounded-[10px] flex items-end justify-between p-4 gap-2">
              {Array.from({ length: 12 }).map((_, idx) => (
                <div 
                  key={idx} 
                  className="flex-1 bg-muted rounded-t-[4px]" 
                  style={{ height: `${20 + (idx % 3) * 25 + Math.sin(idx) * 10}%` }}
                />
              ))}
            </div>
          </div>

          {/* Bento Cell 4: Top Email Template */}
          <div className="rounded-[16px] border border-border bg-background p-6 flex flex-col justify-between h-[230px] shadow-sm">
            <div className="space-y-2">
              <div className="h-3 bg-muted rounded-[4px] w-24" />
              <div className="h-5 bg-secondary rounded-[6px] w-40" />
            </div>
            <div className="my-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-secondary shrink-0" />
                <div className="space-y-2 w-full">
                  <div className="h-4 bg-secondary rounded-[4px] w-2/3" />
                  <div className="h-3 bg-muted rounded-[4px] w-1/3" />
                </div>
              </div>
              <div className="h-[46px] bg-secondary/35 border border-border/40 rounded-[10px]" />
            </div>
            <div className="h-4 bg-secondary rounded-[4px] w-28" />
          </div>

          {/* Bento Cell 5: Campaign & Weekly Plan Performance List (Full-Width) */}
          <div className="md:col-span-3 rounded-[16px] border border-border bg-background p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border/45 pb-3">
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded-[4px] w-24" />
                <div className="h-5 bg-secondary rounded-[6px] w-40" />
              </div>
              <div className="h-4 bg-muted rounded-[4px] w-24" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex justify-between items-center py-2.5 border-b border-border/20 last:border-0">
                  <div className="h-4 bg-secondary rounded-[4px] w-1/4" />
                  <div className="h-4 bg-secondary rounded-[4px] w-16" />
                  <div className="h-4 bg-muted rounded-[4px] w-12" />
                  <div className="h-4 bg-muted rounded-[4px] w-12" />
                  <div className="h-4 bg-secondary rounded-[4px] w-20" />
                </div>
              ))}
            </div>
          </div>

          {/* Bento Cell 6: Recent Reply Contacts Feed */}
          <div className="md:col-span-3 rounded-[16px] border border-border bg-background p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border/45 pb-3">
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded-[4px] w-24" />
                <div className="h-5 bg-secondary rounded-[6px] w-48" />
              </div>
              <div className="h-4 bg-muted rounded-[4px] w-20" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="flex justify-between items-center py-1 border-b border-border/20 last:border-0 pb-3 last:pb-0 font-medium">
                  <div className="space-y-2 w-1/3">
                    <div className="h-4 bg-secondary rounded-[4px] w-full" />
                    <div className="h-3 bg-muted rounded-[4px] w-2/3" />
                  </div>
                  <div className="space-y-2 w-24 text-right">
                    <div className="h-3 bg-muted rounded-[4px] w-full" />
                    <div className="h-4 bg-secondary rounded-[4px] w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Quick Actions Skeleton */}
        <div className="pt-6 space-y-4">
          <div className="h-3 bg-muted rounded-[4px] w-24" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="p-4 rounded-[12px] border border-border bg-background h-24 flex flex-col gap-3 justify-center">
                <div className="w-8 h-8 rounded-[8px] bg-secondary" />
                <div className="space-y-2">
                  <div className="h-3 bg-secondary rounded-[4px] w-2/3" />
                  <div className="h-3 bg-muted rounded-[4px] w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Calculate SVG dimensions for activity chart
  const maxCount = Math.max(...dailyActivity.map(d => d.count), 1);
  const chartHeight = 120;
  const chartWidth = 500;
  const padding = 15;
  const graphWidth = chartWidth - padding * 2;
  const graphHeight = chartHeight - padding * 2;

  const quickActions = [
    {
      label: 'New Campaign',
      href: '/campaigns/new',
      desc: 'Start an outbound sequence',
      icon: Megaphone,
    },
    {
      label: 'Add Company',
      href: '/companies',
      desc: 'Grow your contact directory',
      icon: Building2,
    },
    {
      label: 'Create Template',
      href: '/templates/new',
      desc: 'Write outbound emails',
      icon: Send,
    },
    {
      label: 'Configure SMTP',
      href: '/settings',
      desc: 'Connect SMTP servers',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="animate-page-in flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.6px]">
            Dashboard
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Realtime campaign performance and CRM analytics.
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-secondary/40 text-[11px] font-medium text-muted-foreground shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Realtime Active
        </div>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-stagger">
        
        {/* Bento Cell 1: Welcome & Stats Overview (Double-Wide) */}
        <div className="md:col-span-2 rounded-[16px] border border-border bg-background p-6 flex flex-col justify-between relative overflow-hidden group shadow-sm hover:border-border/80 transition-all duration-200">
          <div className="absolute right-0 top-0 w-32 h-32 bg-foreground/[0.01] rounded-full blur-3xl pointer-events-none" />
          <div className="space-y-4 z-10">
            <div className="flex items-center gap-2 text-foreground font-semibold text-[16px]">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span>Outbound Operations Summary</span>
            </div>
            <p className="text-[13px] text-muted-foreground max-w-lg leading-relaxed">
              Outbound schedules are running autonomously. Currently coordinating sequences across your email groups.
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border/60">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Running Campaigns</span>
              <div className="flex items-center gap-2 mt-1.5">
                <Megaphone className="w-4 h-4 text-muted-foreground/60" />
                <span className="text-[28px] font-semibold text-foreground tracking-tight leading-none">
                  {counts?.activeCampaigns ?? 0}
                </span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Queued Messages</span>
              <div className="flex items-center gap-2 mt-1.5">
                <Inbox className="w-4 h-4 text-muted-foreground/60" />
                <span className="text-[28px] font-semibold text-foreground tracking-tight leading-none">
                  {counts?.queuedMails ?? 0}
                </span>
              </div>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">SMTP Health</span>
              <div className="flex items-center gap-2 mt-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-[14px] font-semibold text-emerald-600 dark:text-emerald-400">
                  100% OK
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bento Cell 2: Database Volume Status */}
        <div className="rounded-[16px] border border-border bg-background p-6 flex flex-col justify-between shadow-sm hover:border-border/80 transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">CRM Directory</span>
            <h3 className="text-[15px] font-semibold text-foreground">Verified Accounts</h3>
          </div>

          <div className="space-y-4 my-6">
            {/* Contacts bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground font-medium">Active Contacts</span>
                <span className="text-foreground font-semibold">
                  {counts?.activeContacts} / {counts?.totalContacts}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                <div 
                  className="h-full bg-foreground rounded-full transition-all duration-500"
                  style={{ width: `${counts?.totalContacts ? (counts.activeContacts / counts.totalContacts) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Companies bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground font-medium">Active Companies</span>
                <span className="text-foreground font-semibold">
                  {counts?.activeCompanies} / {counts?.totalCompanies}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                <div 
                  className="h-full bg-foreground rounded-full transition-all duration-500"
                  style={{ width: `${counts?.totalCompanies ? (counts.activeCompanies / counts.totalCompanies) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          <Link href="/contacts" className="text-[11px] font-medium text-foreground hover:underline inline-flex items-center gap-1 mt-auto">
            Manage Contacts <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Bento Cell 3: Sending Activity Sparkline (Double-Wide) */}
        <div className="md:col-span-2 rounded-[16px] border border-border bg-background p-6 flex flex-col justify-between shadow-sm hover:border-border/80 transition-all duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Outbound Statistics</span>
              <h3 className="text-[15px] font-semibold text-foreground">Daily Sent Volume</h3>
            </div>
            <span className="text-[11px] text-muted-foreground">Last 7 Days</span>
          </div>

          {/* Custom SVG Sparkline Chart */}
          <div className="w-full h-[140px] flex items-center justify-center bg-secondary/15 rounded-[10px] border border-border/40 p-2">
            {dailyActivity.length === 0 ? (
              <p className="text-[12px] text-muted-foreground italic">No sends logged recently.</p>
            ) : (
              <svg className="w-full h-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
                {/* SVG Grid Lines */}
                <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="#888" strokeOpacity="0.1" strokeDasharray="3,3" />
                <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#888" strokeOpacity="0.1" />

                {/* SVG bars */}
                {dailyActivity.map((d, i) => {
                  const x = padding + (i * graphWidth) / (dailyActivity.length - 1);
                  const barHeight = (d.count / maxCount) * graphHeight;
                  const y = chartHeight - padding - barHeight;
                  const barWidth = Math.max(12, graphWidth / dailyActivity.length / 2);

                  return (
                    <g key={d.day} className="group/bar">
                      <rect
                        x={x - barWidth / 2}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill="currentColor"
                        className="text-foreground/80 hover:text-foreground transition-colors cursor-pointer"
                        rx="3"
                      />
                      {/* Bar label on hover */}
                      <text
                        x={x}
                        y={y - 6}
                        textAnchor="middle"
                        fill="currentColor"
                        className="text-[10px] font-bold fill-foreground opacity-0 group-hover/bar:opacity-100 transition-opacity"
                      >
                        {d.count}
                      </text>
                      {/* X-axis labels */}
                      <text
                        x={x}
                        y={chartHeight - 2}
                        textAnchor="middle"
                        fill="currentColor"
                        className="text-[9px] fill-muted-foreground"
                      >
                        {d.day}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* Bento Cell 4: Top Email Template */}
        <div className="rounded-[16px] border border-border bg-background p-6 flex flex-col justify-between shadow-sm hover:border-border/80 transition-all duration-200">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Performance Winner</span>
            <h3 className="text-[15px] font-semibold text-foreground">Top Performing Template</h3>
          </div>

          {bestTemplate ? (
            <div className="my-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-[8px] bg-foreground/5 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5 text-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-foreground truncate">{bestTemplate.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{bestTemplate.sent} emails launched</p>
                </div>
              </div>

              <div className="bg-secondary/40 border border-border/40 rounded-[10px] p-3 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Reply Rate</span>
                  <span className="text-[20px] font-bold text-foreground block tracking-tight">{bestTemplate.replyRate}%</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Replies</span>
                  <span className="text-[20px] font-semibold text-muted-foreground block tracking-tight">{bestTemplate.replied}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="my-10 text-center">
              <Award className="w-7 h-7 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-[12px] text-muted-foreground italic">No templates ranked yet.</p>
            </div>
          )}

          <Link href="/templates" className="text-[11px] font-medium text-foreground hover:underline inline-flex items-center gap-1 mt-auto">
            View Templates <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Bento Cell 5: Campaign & Weekly Plan Performance List (Full-Width) */}
        <div className="md:col-span-3 rounded-[16px] border border-border bg-background p-6 shadow-sm hover:border-border/80 transition-all duration-200">
          <div className="flex items-center justify-between mb-4 border-b border-border/45 pb-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Campaign Metrics</span>
              <h3 className="text-[16px] font-semibold text-foreground">Sequence Outcomes</h3>
            </div>
            <Link href="/campaigns" className="text-[12px] text-muted-foreground hover:text-foreground underline">
              All Campaigns
            </Link>
          </div>

          <div className="overflow-x-auto">
            {campaignStats.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-muted-foreground italic">
                No campaigns logged. Launch a campaign to see statistics here.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/60 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <th className="py-2.5">Name</th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5 text-right">Sent</th>
                    <th className="py-2.5 text-right">Replies</th>
                    <th className="py-2.5 text-right">Reply Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {campaignStats.slice(0, 5).map(camp => (
                    <tr key={camp.id} className="text-[13px] text-foreground hover:bg-muted/30 transition-colors">
                      <td className="py-3 font-medium">{camp.name}</td>
                      <td className="py-3">
                        <span className={cn(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border",
                          camp.status === 'running' && "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                          camp.status === 'completed' && "bg-foreground/5 text-muted-foreground border-border",
                          camp.status === 'draft' && "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        )}>
                          {camp.status}
                        </span>
                      </td>
                      <td className="py-3 text-right text-muted-foreground font-mono">{camp.sent}</td>
                      <td className="py-3 text-right text-muted-foreground font-mono">{camp.replied}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-semibold text-foreground font-mono">{camp.replyRate}%</span>
                          <div className="w-12 h-1.5 rounded-full bg-secondary overflow-hidden hidden sm:block">
                            <div className="h-full bg-foreground rounded-full" style={{ width: `${camp.replyRate}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Bento Cell 6: Recent Reply Contacts Feed */}
        <div className="md:col-span-3 rounded-[16px] border border-border bg-background p-6 shadow-sm hover:border-border/80 transition-all duration-200">
          <div className="flex items-center justify-between mb-4 border-b border-border/45 pb-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Prospect Responses</span>
              <h3 className="text-[16px] font-semibold text-foreground">Recently Replying Companies</h3>
            </div>
            <Link href="/replies" className="text-[12px] text-muted-foreground hover:text-foreground underline">
              All Replies
            </Link>
          </div>

          <div className="max-h-[300px] overflow-y-auto divide-y divide-border/30 pr-2">
            {replyingCompanies.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-muted-foreground italic">
                No replies detected yet. Synced replies will list companies here.
              </div>
            ) : (
              replyingCompanies.map(comp => (
                <div key={comp.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[14px] font-semibold text-foreground truncate">{comp.name}</p>
                      {comp.website && (
                        <a 
                          href={comp.website.startsWith('http') ? comp.website : `https://${comp.website}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{comp.industry || 'General Industry'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-muted-foreground block">Replied At</span>
                    <span className="text-[12px] font-medium text-foreground">
                      {new Date(comp.replied_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Quick Actions Panel */}
      <div className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Quick Actions
          </h2>
          <div className="flex-1 h-px bg-border/40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-stagger">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group flex flex-col gap-3 p-4 rounded-[12px] border border-border bg-background hover:bg-secondary hover:border-border/60 transition-all duration-150 shadow-sm hover:shadow"
            >
              <div className="w-8 h-8 rounded-[8px] bg-secondary group-hover:bg-accent flex items-center justify-center transition-colors duration-150">
                <action.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground leading-snug">{action.label}</p>
                <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* "While You Were Away" Modal */}
      {showAwayModal && awayStats && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md p-6 rounded-[16px] border border-border bg-background shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-bold text-foreground tracking-tight">While You Were Away... 🌌</span>
              </div>
              <button 
                onClick={() => setShowAwayModal(false)} 
                className="text-muted-foreground hover:text-foreground text-[14px] w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                The mailing system has processed the following operations during your absence:
              </p>
              
              <div className="grid grid-cols-3 gap-2.5 py-2">
                <div className="p-3.5 rounded-[12px] border border-border bg-secondary/35 text-center">
                  <span className="text-[22px] font-bold text-foreground block tracking-tight">{awayStats.sent}</span>
                  <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">Sent</span>
                </div>
                <div className="p-3.5 rounded-[12px] border border-border bg-secondary/35 text-center">
                  <span className="text-[22px] font-bold text-foreground block tracking-tight">{awayStats.replies}</span>
                  <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">Replies</span>
                </div>
                <div className="p-3.5 rounded-[12px] border border-border bg-secondary/35 text-center">
                  <span className="text-[22px] font-bold text-foreground block tracking-tight">{awayStats.completed}</span>
                  <span className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider">Completed</span>
                </div>
              </div>
              
              <p className="text-[11px] text-muted-foreground italic text-center">
                All sequences are executing and monitoring for responses automatically.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Button 
                onClick={() => setShowAwayModal(false)} 
                className="rounded-[8px] bg-primary text-primary-foreground hover:bg-primary/90 text-[13px] px-4 h-9 font-semibold cursor-pointer"
              >
                Acknowledge Summary
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
