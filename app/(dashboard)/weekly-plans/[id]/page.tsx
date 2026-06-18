import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { WeeklyPlannerCalendar } from '@/components/weekly-plans/WeeklyPlannerCalendar';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function WeeklyPlanDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [planRes, templatesRes, smtpRes, groupsRes] = await Promise.all([
    supabase
      .from('weekly_plans')
      .select(`
        *,
        daily_schedules(
          *,
          group:contact_groups(id, name, color, members:contact_group_members(count)),
          template:email_templates(id, name),
          smtp_config:smtp_configs(id, label, from_email, from_name)
        )
      `)
      .eq('id', id)
      .single(),
    supabase.from('email_templates').select('id, name, subject').order('name'),
    supabase.from('smtp_configs').select('id, label, from_email, from_name').order('label'),
    supabase
      .from('contact_groups')
      .select('id, name, color, members:contact_group_members(count)')
      .order('name'),
  ]);

  if (planRes.error || !planRes.data) notFound();

  return (
    <WeeklyPlannerCalendar
      plan={planRes.data}
      templates={templatesRes.data || []}
      smtpConfigs={smtpRes.data || []}
      groups={groupsRes.data || []}
    />
  );
}
