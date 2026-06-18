const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://xhbhxoweylgdbngyvtit.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhoYmh4b3dleWxnZGJuZ3l2dGl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDc3MjgxOCwiZXhwIjoyMDk2MzQ4ODE4fQ.vAX2Dt0Gf-H_3lxFQP1tBOZQbRxCAdBnQ1XcXTHjK50'
);

async function run() {
  const res = await supabase
    .from('weekly_plans')
    .select(`
      *,
      daily_schedules(
        *,
        group:contact_groups(id, name, color, members:contact_group_members(count)),
        template:email_templates(id, name),
        smtp_config:smtp_configs(id, label, from_email, from_name)
      )
    `);
  
  console.log("Error:", res.error);
  console.log("Data:", JSON.stringify(res.data, null, 2));
}

run();
