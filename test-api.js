const fetch = require('node-fetch');

async function test() {
  const res = await fetch('http://localhost:3000/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: "Test Campaign",
      description: "",
      template_id: null,
      smtp_config_id: null,
      from_name: "Test",
      from_email: "test@test.com",
      reply_to: "",
      send_gap_minutes: 15,
      gap_jitter_pct: 20,
      scheduled_at: null,
      active_days: ["Monday"],
      followup_template_id: null,
      followup_gap_days: null
    })
  });
  
  const data = await res.text();
  console.log("Status:", res.status);
  console.log("Body:", data);
}

test();
