import { createClient } from '@/lib/supabase/client';
import * as XLSX from 'xlsx';

export async function exportAnalysisReport() {
  const supabase = createClient();

  const [
    groupsRes,
    membersRes,
    plansRes,
    campaignsRes,
    recipientsRes
  ] = await Promise.all([
    supabase.from('contact_groups').select('id, name, description, color, created_at'),
    supabase.from('contact_group_members').select('group_id, contact_id'),
    supabase.from('weekly_plans').select('id, name, status, start_date, created_at'),
    supabase.from('campaigns').select('id, name, weekly_plan_id, status, scheduled_at, template:email_templates(name), smtp:smtp_configs(label)').not('weekly_plan_id', 'is', null),
    supabase.from('campaign_recipients').select('campaign_id, status'),
  ]);

  const groups = groupsRes.data || [];
  const members = membersRes.data || [];
  const plans = plansRes.data || [];
  const campaigns = campaignsRes.data || [];
  const recipients = recipientsRes.data || [];

  // 1. Process Groups
  const groupStats = groups.map(g => {
    const groupMembers = members.filter(m => m.group_id === g.id);
    return {
      'Group Name': g.name,
      'Description': g.description || '',
      'Color Tag': g.color,
      'Total Members': groupMembers.length,
      'Created At': new Date(g.created_at).toLocaleDateString(),
    };
  });

  // 2. Process Weekly Plans
  const planStats = plans.map(p => {
    const planCampaigns = campaigns.filter(c => c.weekly_plan_id === p.id);
    return {
      'Plan Name': p.name,
      'Start Date (Monday)': p.start_date,
      'Status': p.status,
      'Total Daily Schedules Run': planCampaigns.length,
      'Created At': new Date(p.created_at).toLocaleDateString(),
    };
  });

  // 3. Process Weekly Plan Campaign Runs (How they ran)
  const campaignStats = campaigns.map(c => {
    const campRecipients = recipients.filter(r => r.campaign_id === c.id);
    const total = campRecipients.length;
    const sent = campRecipients.filter(r => r.status === 'sent').length;
    const failed = campRecipients.filter(r => r.status === 'failed').length;
    const replied = campRecipients.filter(r => r.status === 'replied').length;
    const queued = campRecipients.filter(r => r.status === 'queued' || r.status === 'pending').length;
    const parentPlan = plans.find(p => p.id === c.weekly_plan_id);

    return {
      'Weekly Plan Name': parentPlan?.name || 'Unknown',
      'Daily Campaign Name': c.name,
      'Status': c.status,
      'Scheduled At': c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : 'N/A',
      'Template Used': (c as any).template?.name || 'N/A',
      'Sender SMTP': (c as any).smtp?.label || 'N/A',
      'Total Contacts Target': total,
      'Queued': queued,
      'Sent Successfully': sent,
      'Failed': failed,
      'Replied': replied,
      'Reply Rate': total > 0 ? `${Math.round((replied / total) * 100)}%` : '0%',
    };
  });

  // Create sheets
  const wsGroups = XLSX.utils.json_to_sheet(groupStats);
  const wsPlans = XLSX.utils.json_to_sheet(planStats);
  const wsRuns = XLSX.utils.json_to_sheet(campaignStats);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsPlans, 'Weekly Plans');
  XLSX.utils.book_append_sheet(wb, wsRuns, 'Weekly Planner Runs');
  XLSX.utils.book_append_sheet(wb, wsGroups, 'Mail Groups');

  // Save workbook
  XLSX.writeFile(wb, `Mailer_CRM_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}
