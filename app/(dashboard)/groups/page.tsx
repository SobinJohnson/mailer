import { createClient } from '@/lib/supabase/server';
import { GroupsManager } from '@/components/groups/GroupsManager';

export const dynamic = 'force-dynamic';

export default async function GroupsPage() {
  const supabase = await createClient();

  const [groupsRes, companiesRes] = await Promise.all([
    supabase
      .from('contact_groups')
      .select(`
        *,
        members:contact_group_members(
          contact:contacts(id, first_name, last_name, email, company_id,
            company:companies(name))
        )
      `)
      .order('created_at', { ascending: false }),
    supabase
      .from('companies')
      .select('id, name, contacts(id, first_name, last_name, email, is_primary)')
      .eq('status', 'active')
      .order('name'),
  ]);

  return (
    <GroupsManager
      initialGroups={groupsRes.data || []}
      companies={companiesRes.data || []}
    />
  );
}
