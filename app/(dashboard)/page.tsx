import { createClient, ensureSystemSettings } from '@/lib/supabase/server';
import { Building2, Users, Megaphone, Send, ArrowUpRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  await ensureSystemSettings();
  
  const supabase = await createClient();

  const [
    { count: companyCount },
    { count: contactCount },
    { count: campaignCount },
    { count: sentTodayCount },
  ] = await Promise.all([
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'running'),
    supabase
      .from('campaign_recipients')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ]);

  const stats = [
    {
      title: 'Companies',
      value: companyCount ?? 0,
      desc: 'in CRM',
      href: '/companies',
      icon: Building2,
    },
    {
      title: 'Contacts',
      value: contactCount ?? 0,
      desc: 'across companies',
      href: '/contacts',
      icon: Users,
    },
    {
      title: 'Active Campaigns',
      value: campaignCount ?? 0,
      desc: 'currently running',
      href: '/campaigns',
      icon: Megaphone,
    },
    {
      title: 'Sent Today',
      value: sentTodayCount ?? 0,
      desc: 'emails delivered',
      href: '/queue',
      icon: Send,
    },
  ];

  const quickActions = [
    {
      label: 'New Campaign',
      href: '/campaigns/new',
      desc: 'Start an outbound email sequence',
      icon: Megaphone,
    },
    {
      label: 'Add Company',
      href: '/companies',
      desc: 'Grow your contact database',
      icon: Building2,
    },
    {
      label: 'Create Template',
      href: '/templates/new',
      desc: 'Write a reusable email template',
      icon: Send,
    },
    {
      label: 'Configure SMTP',
      href: '/settings',
      desc: 'Connect an outbound email server',
      icon: ArrowUpRight,
    },
  ];

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="animate-page-in">
        <h1 className="text-[26px] font-semibold text-foreground tracking-[-0.5px]">
          Overview
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          Your outbound operations at a glance.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-stagger">
        {stats.map((stat) => (
          <Link
            key={stat.title}
            href={stat.href}
            className="group flex flex-col justify-between p-5 rounded-[12px] bg-background border border-border hover-lift cursor-pointer"
          >
            <div className="flex items-center justify-between mb-5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
                {stat.title}
              </span>
              <stat.icon className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1 sm:gap-0">
              <span className="text-[32px] font-semibold text-foreground tracking-[-1.5px] leading-none">
                {stat.value}
              </span>
              <div className="flex items-center gap-1 mb-0.5 shrink-0">
                <span className="text-[12px] text-muted-foreground">{stat.desc}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:translate-x-0.5 group-hover:text-muted-foreground transition-all duration-150" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Divider */}
      <div className="h-px bg-border/60" />

      {/* Quick Actions */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
            Quick Actions
          </h2>
          <div className="flex-1 h-px bg-border/40" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-stagger">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group flex flex-col gap-3 p-4 rounded-[10px] border border-border bg-background hover:bg-secondary hover:border-border/60 transition-all duration-150"
            >
              <div className="w-8 h-8 rounded-[8px] bg-secondary group-hover:bg-accent flex items-center justify-center transition-colors duration-150">
                <action.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground leading-snug">{action.label}</p>
                <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Getting started tip */}
      {(companyCount ?? 0) === 0 && (
        <div className="rounded-[12px] border border-dashed border-border bg-secondary/30 p-6 flex items-start gap-4 animate-fade-in">
          <div className="w-8 h-8 rounded-[8px] bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <ArrowUpRight className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-foreground">Getting started</p>
            <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
              Start by adding your first company and contacts, then create an email template and configure your SMTP connection. You'll be ready to launch your first campaign in minutes.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Link href="/companies" className="text-[12px] font-medium text-primary hover:underline">
                Add Company →
              </Link>
              <Link href="/settings" className="text-[12px] font-medium text-muted-foreground hover:text-foreground">
                Configure SMTP →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
