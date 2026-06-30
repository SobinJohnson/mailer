import { createClient } from '@/lib/supabase/server';
import { GroupsManager } from '@/components/groups/GroupsManager';

export const dynamic = 'force-dynamic';

export default async function GroupsPage() {
  const supabase = await createClient();

  const [groupsRes, companiesRes] = await Promise.all([
    supabase
      .from('contact_groups')
      .select(`
        id, name, description, color, created_at,
        members:contact_group_members(
          contact:contacts(id, first_name, last_name, email, company_id,
            company:companies(name))
        )
      `)
      .order('created_at', { ascending: false })
      .range(0, 49),
    supabase
      .from('companies')
      .select('id, name, contacts(id, first_name, last_name, email, is_primary)')
      .eq('status', 'active')
      .order('name'),
  ]);

  return (
    <GroupsManager
      initialGroups={(groupsRes.data as any[]) || []}
      companies={companiesRes.data || []}
    />
  );
}
