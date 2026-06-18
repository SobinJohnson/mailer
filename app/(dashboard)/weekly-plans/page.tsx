import { createClient } from '@/lib/supabase/server';
import { WeeklyPlanTable } from '@/components/weekly-plans/WeeklyPlanTable';

export const dynamic = 'force-dynamic';

export default async function WeeklyPlansPage() {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from('weekly_plans')
    .select(`
      *,
      daily_schedules(
        id, day_of_week,
        group:contact_groups(name),
        template:email_templates(name)
      )
    `)
    .order('start_date', { ascending: false });

  return <WeeklyPlanTable initialPlans={plans || []} />;
}
