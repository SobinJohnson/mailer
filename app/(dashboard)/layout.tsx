'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from 'next-themes';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Megaphone,
  ListOrdered,
  Settings,
  LogOut,
  Menu,
  X,
  Send,
  ChevronLeft,
  UsersRound,
  CalendarDays,
  Sun,
  Moon,
} from 'lucide-react';
import { GlobalSearch } from '@/components/shared/GlobalSearch';
import { ManualTriggers } from '@/components/shared/ManualTriggers';

const navItems = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    hint: 'Overview and quick stats',
  },
  {
    title: 'Companies',
    href: '/companies',
    icon: Building2,
    hint: 'Your CRM company directory',
  },
  {
    title: 'Contacts',
    href: '/contacts',
    icon: Users,
    hint: 'Contacts across companies',
  },
  {
    title: 'Mail Groups',
    href: '/groups',
    icon: UsersRound,
    hint: 'Reusable contact groups for campaigns',
  },
  {
    title: 'Templates',
    href: '/templates',
    icon: FileText,
    hint: 'Email templates with variables',
  },
  {
    title: 'Campaigns',
    href: '/campaigns',
    icon: Megaphone,
    hint: 'Outbound email sequences',
  },
  {
    title: 'Weekly Planner',
    href: '/weekly-plans',
    icon: CalendarDays,
    hint: 'Schedule daily sends across a full week',
  },
  {
    title: 'Queue',
    href: '/queue',
    icon: ListOrdered,
    hint: 'Scheduled email dispatch queue',
  },
  {
    title: 'Logs',
    href: '/logs',
    icon: FileText,
    hint: 'Detailed send logs',
  },
  {
    title: 'Replies',
    href: '/replies',
    icon: Users,
    hint: 'Incoming replies',
  },
];

const bottomItems = [
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
    hint: 'SMTP and platform settings',
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hideCampaigns, setHideCampaigns] = useState(false);
  const { theme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  useEffect(() => {
    const checkSettings = () => {
      setHideCampaigns(localStorage.getItem('hideCampaigns') === 'true');
    };
    checkSettings();
    window.addEventListener('local-storage-settings-change', checkSettings);
    window.addEventListener('storage', checkSettings);
    return () => {
      window.removeEventListener('local-storage-settings-change', checkSettings);
      window.removeEventListener('storage', checkSettings);
    };
  }, []);

  const filteredNavItems = navItems.filter((item) => {
    if (item.href === '/campaigns' && hideCampaigns) {
      return false;
    }
    return true;
  });

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  const NavLink = ({
    item,
  }: {
    item: (typeof navItems)[0];
  }) => {
    const active = isActive(item.href);
    const link = (
      <Link
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`
          group relative flex items-center gap-3 rounded-[8px] px-3 py-[7px] text-[13px] font-medium
          transition-all duration-150 ease-out select-none
          ${collapsed ? 'justify-center' : ''}
          ${
            active
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
          }
        `}
      >
        <item.icon
          className={`w-[15px] h-[15px] shrink-0 transition-colors ${
            active ? 'text-background' : 'group-hover:text-foreground'
          }`}
        />
        {!collapsed && (
          <span className="truncate tracking-[-0.1px]">{item.title}</span>
        )}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger render={link} />
          <TooltipContent
            side="right"
            sideOffset={8}
            className="bg-foreground text-background text-[12px] px-2.5 py-1.5 rounded-[7px] border-0 shadow-lg"
          >
            <p className="font-medium">{item.title}</p>
            <p className="text-background/60 text-[11px] mt-0.5">{item.hint}</p>
          </TooltipContent>
        </Tooltip>
      );
    }
    return link;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div
        className={`flex items-center h-[52px] px-4 shrink-0 ${
          collapsed ? 'justify-center' : 'gap-2.5'
        }`}
      >
        <div className="w-7 h-7 rounded-[8px] bg-foreground flex items-center justify-center shrink-0">
          <Send className="w-3.5 h-3.5 text-background" />
        </div>
        {!collapsed && (
          <span className="text-[14px] font-semibold text-foreground tracking-[-0.3px]">
            Mailer
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border/60 mx-3 shrink-0" />

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="px-2 space-y-0.5">
          {filteredNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        {/* Section label */}
        {!collapsed && (
          <div className="px-3 mt-5 mb-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
              System
            </p>
          </div>
        )}
        {collapsed && <div className="h-3" />}
        <nav className="px-2 space-y-0.5">
          {bottomItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>
      </ScrollArea>

      {/* Footer / Account */}
      <div className="shrink-0 pb-3">
        <div className="h-px bg-border/60 mx-3 mb-2" />
        <div className="px-2 space-y-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  className={`flex items-center gap-2.5 w-full rounded-[8px] px-3 py-[7px] text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-all duration-150 ${
                    collapsed ? 'justify-center' : ''
                  }`}
                />
              }
            >
              <div className="w-6 h-6 rounded-full bg-foreground/10 border border-border flex items-center justify-center shrink-0">
                <span className="text-[9px] font-bold text-foreground">U</span>
              </div>
              {!collapsed && (
                <span className="truncate text-[13px] font-medium tracking-[-0.1px]">
                  Account
                </span>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              className="w-52 rounded-[12px] border-border bg-background p-1.5 shadow-xl shadow-black/8"
            >
              <div className="px-2 py-1.5 mb-1">
                <p className="text-[12px] font-medium text-foreground">Your account</p>
                <p className="text-[11px] text-muted-foreground">Mailer workspace</p>
              </div>
              <DropdownMenuSeparator className="bg-border/60 my-1" />
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings"
                    className="flex items-center gap-2 text-[13px] rounded-[8px] px-2 py-1.5 text-foreground focus:bg-accent cursor-pointer"
                  />
                }
              >
                <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                Settings
                <span className="ml-auto text-[11px] text-muted-foreground/60">SMTP, config</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Explicit Logout Button */}
          <button
            onClick={handleLogout}
            className={`flex items-center gap-2.5 w-full rounded-[8px] px-3 py-[7px] text-[13px] text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-all duration-150 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <LogOut className="w-[15px] h-[15px] shrink-0" />
            {!collapsed && (
              <span className="truncate tracking-[-0.1px] font-medium">Log out</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-sidebar-border bg-sidebar relative transition-[width] duration-200 ease-out shrink-0 ${
          collapsed ? 'w-[56px]' : 'w-[216px]'
        }`}
      >
        {sidebarContent}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute top-[64px] -right-3 w-6 h-6 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground flex items-center justify-center transition-all duration-150 z-50 shadow-sm"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft
            className={`w-3 h-3 transition-transform duration-200 ${
              collapsed ? 'rotate-180' : ''
            }`}
          />
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40 lg:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[216px] flex flex-col border-r border-sidebar-border bg-sidebar transform transition-transform duration-200 ease-out lg:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3.5 right-3 p-1 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background relative">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-6 h-[52px] border-b border-border/60 bg-background/80 backdrop-blur-md shrink-0 sticky top-0 z-40">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-1.5 -ml-1.5 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-6 h-6 rounded-[6px] bg-foreground flex items-center justify-center">
              <Send className="w-3 h-3 text-background" />
            </div>
            <span className="font-semibold text-foreground text-[14px] tracking-[-0.3px]">
              Mailer
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right — breadcrumb / user hint & DB Mode */}
          <div className="flex items-center gap-2.5 lg:gap-4 ml-auto">
            <GlobalSearch />

            {themeMounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-1.5 rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors cursor-pointer"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? (
                  <Sun className="w-[17px] h-[17px] text-amber-500" />
                ) : (
                  <Moon className="w-[17px] h-[17px]" />
                )}
              </button>
            )}

            <div className={`hidden lg:flex px-2 py-1 rounded-[6px] text-[11px] font-medium border items-center gap-1.5
              ${process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('.supabase.') 
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('.supabase.') ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('.supabase.') ? 'Cloud DB' : 'Local DB'}
            </div>
            
            {/* Show manual triggers ONLY when running on Local DB / Localhost */}
            {!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('.supabase.') && (
              <div className="hidden lg:block">
                <ManualTriggers />
              </div>
            )}
            
            <span className="hidden lg:inline text-[12px] text-muted-foreground/60">
              ⌘K to search
            </span>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full animate-page-in">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
