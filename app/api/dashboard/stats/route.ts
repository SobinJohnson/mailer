import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// In-memory cache for dashboard metrics
let cachedStats: any = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30000; // 30 seconds TTL

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const lastActiveStr = searchParams.get('lastActive');
    const refresh = searchParams.get('refresh') === 'true';

    const now = Date.now();
    if (!refresh && cachedStats && (now - cacheTimestamp < CACHE_TTL_MS)) {
      // Calculate awayStats dynamically as it depends on user's last active timestamp
      let awayStats = null;
      if (lastActiveStr) {
        try {
          const lastActive = new Date(lastActiveStr).toISOString();
          const [
            { count: awaySent },
            { count: awayReplies },
            { count: awayCompleted },
          ] = await Promise.all([
            supabase.from('send_log').select('*', { count: 'exact', head: true }).eq('status', 'sent').gt('sent_at', lastActive),
            supabase.from('campaign_recipients').select('*', { count: 'exact', head: true }).eq('status', 'replied').gt('replied_at', lastActive),
            supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'completed').gt('updated_at', lastActive),
          ]);

          awayStats = {
            sent: awaySent ?? 0,
            replies: awayReplies ?? 0,
            completed: awayCompleted ?? 0,
          };
        } catch (e) {
          console.error('Error parsing lastActive date for awayStats:', e);
        }
      }

      return NextResponse.json({
        ...cachedStats,
        awayStats,
      });
    }

    // 1. Basic counts
    const [
      { count: totalCompanies },
      { count: activeCompanies },
      { count: totalContacts },
      { count: activeContacts },
      { count: activeCampaignsCount },
      { count: queuedMailsCount },
    ] = await Promise.all([
      supabase.from('companies').select('*', { count: 'exact', head: true }),
      supabase.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'running'),
      supabase.from('campaign_recipients').select('*', { count: 'exact', head: true }).eq('status', 'queued'),
    ]);

    // 2. Fetch all send logs for daily activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { data: recentSends } = await supabase
      .from('send_log')
      .select('sent_at')
      .gte('sent_at', sevenDaysAgo.toISOString());

    // Group sends by day
    const sendsByDay: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      sendsByDay[dateStr] = 0;
    }

    recentSends?.forEach(s => {
      const dateStr = new Date(s.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (sendsByDay[dateStr] !== undefined) {
        sendsByDay[dateStr]++;
      }
    });

    const dailyActivity = Object.entries(sendsByDay)
      .map(([day, count]) => ({ day, count }))
      .reverse();

    // 3. Campaign & Weekly Plan Performance
    const { data: campaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, template_id, weekly_plan_id, created_at');

    const { data: recipients } = await supabase
      .from('campaign_recipients')
      .select('campaign_id, status, replied_at');

    const campaignStats = (campaigns || []).map(camp => {
      const campRecs = (recipients || []).filter(r => r.campaign_id === camp.id);
      const sent = campRecs.filter(r => r.status === 'sent' || r.status === 'replied').length;
      const replied = campRecs.filter(r => r.status === 'replied').length;
      const failed = campRecs.filter(r => r.status === 'failed').length;
      const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;

      return {
        id: camp.id,
        name: camp.name,
        status: camp.status,
        weekly_plan_id: camp.weekly_plan_id,
        sent,
        replied,
        failed,
        replyRate,
      };
    });

    // Best performing template
    const { data: templates } = await supabase
      .from('email_templates')
      .select('id, name');

    const templateStats = (templates || []).map(temp => {
      const campIds = (campaigns || []).filter(c => c.template_id === temp.id).map(c => c.id);
      const tempRecs = (recipients || []).filter(r => campIds.includes(r.campaign_id));
      const sent = tempRecs.filter(r => r.status === 'sent' || r.status === 'replied').length;
      const replied = tempRecs.filter(r => r.status === 'replied').length;
      const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;

      return {
        id: temp.id,
        name: temp.name,
        sent,
        replied,
        replyRate,
      };
    }).sort((a, b) => b.replyRate - a.replyRate);

    const bestTemplate = templateStats.length > 0 && templateStats[0].sent > 0 ? templateStats[0] : null;

    // 4. Replying Companies (newest first)
    const { data: repliedRecipients } = await supabase
      .from('campaign_recipients')
      .select('replied_at, contact:contacts(company:companies(id, name, website, industry))')
      .eq('status', 'replied')
      .order('replied_at', { ascending: false });

    const uniqueReplyingCompanies: any[] = [];
    const seenCompanyIds = new Set<string>();

    repliedRecipients?.forEach((r: any) => {
      const company = r.contact?.company;
      if (company && !seenCompanyIds.has(company.id)) {
        seenCompanyIds.add(company.id);
        uniqueReplyingCompanies.push({
          id: company.id,
          name: company.name,
          website: company.website,
          industry: company.industry,
          replied_at: r.replied_at,
        });
      }
    });

    // 5. While You Were Away Stats
    let awayStats = null;
    if (lastActiveStr) {
      try {
        const lastActive = new Date(lastActiveStr).toISOString();
        const [
          { count: awaySent },
          { count: awayReplies },
          { count: awayCompleted },
        ] = await Promise.all([
          supabase.from('send_log').select('*', { count: 'exact', head: true }).eq('status', 'sent').gt('sent_at', lastActive),
          supabase.from('campaign_recipients').select('*', { count: 'exact', head: true }).eq('status', 'replied').gt('replied_at', lastActive),
          supabase.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'completed').gt('updated_at', lastActive),
        ]);

        awayStats = {
          sent: awaySent ?? 0,
          replies: awayReplies ?? 0,
          completed: awayCompleted ?? 0,
        };
      } catch (e) {
        console.error('Error parsing lastActive date for awayStats:', e);
      }
    }

    const statsToCache = {
      counts: {
        totalCompanies: totalCompanies ?? 0,
        activeCompanies: activeCompanies ?? 0,
        totalContacts: totalContacts ?? 0,
        activeContacts: activeContacts ?? 0,
        activeCampaigns: activeCampaignsCount ?? 0,
        queuedMails: queuedMailsCount ?? 0,
      },
      dailyActivity,
      campaignStats,
      bestTemplate,
      replyingCompanies: uniqueReplyingCompanies,
    };

    cachedStats = statsToCache;
    cacheTimestamp = Date.now();

    return NextResponse.json({
      ...statsToCache,
      awayStats,
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown server error' },
      { status: 500 }
    );
  }
}
