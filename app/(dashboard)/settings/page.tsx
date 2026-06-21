import { createClient } from '@/lib/supabase/server';
import { SmtpConfigForm } from '@/components/shared/SmtpConfigForm';
import { GeneralSettings } from '@/components/settings/GeneralSettings';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  
  const [userRes, configsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('smtp_configs')
      .select('*')
      .order('created_at', { ascending: false })
  ]);

  const user = userRes.data.user;
  const configs = configsRes.data || [];

  if (configsRes.error) {
    console.error('Error fetching SMTP configs:', configsRes.error);
  }

  // Fetch organization membership details
  let orgMember: any = null;
  if (user) {
    const { data } = await supabase
      .from('organization_members')
      .select('role, organization:organizations(name)')
      .eq('user_id', user.id)
      .maybeSingle();
    orgMember = data;
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-[34px] font-semibold tracking-[-0.374px] text-foreground">Settings</h1>
        <p className="text-[17px] text-muted-foreground mt-1">Manage platform configuration and connections.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* General preferences toggle */}
        <GeneralSettings />

        {/* Account and Workspace Info */}
        <div className="bg-background border border-border rounded-[18px] p-8 shadow-sm">
          <div className="space-y-4">
            <div>
              <h2 className="text-[20px] font-semibold tracking-[-0.3px] text-foreground">Account & Workspace</h2>
              <p className="text-[14px] text-muted-foreground mt-0.5">Your personal credentials and active workspace.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-1">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">Logged in as</p>
                <p className="text-[15px] font-medium text-foreground">{user?.email}</p>
                <p className="text-[11px] text-muted-foreground">ID: {user?.id}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">Active Workspace</p>
                <p className="text-[15px] font-medium text-foreground">
                  {orgMember?.organization?.name || 'Default Workspace'}
                </p>
                <p className="text-[11px] text-muted-foreground">Role: <span className="capitalize">{orgMember?.role || 'owner'}</span></p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-background border border-border rounded-[18px] p-8 shadow-sm">
          <SmtpConfigForm configs={configs} />
        </div>

        <div className="bg-background border border-border rounded-[18px] p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-[20px] font-semibold tracking-[-0.3px] text-foreground">Database Connection</h2>
              <p className="text-[14px] text-muted-foreground leading-relaxed max-w-[600px]">
                Your application is currently connected to a PostgreSQL database. You can manage your connection details, switch to a self-hosted Docker instance, or connect to a different Supabase project.
              </p>
            </div>
            <div className="shrink-0">
              <a href="/setup" className="inline-flex items-center justify-center h-10 px-5 rounded-[10px] bg-foreground text-background hover:bg-foreground/90 font-medium text-[14px] transition-colors">
                Manage Connection
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
