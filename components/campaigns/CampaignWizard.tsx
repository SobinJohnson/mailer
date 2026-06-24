'use client';

import { toast } from 'sonner';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronRight, ChevronLeft, Rocket, Users, UsersRound, Check } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface GroupMember {
  contact: { id: string; first_name: string; last_name?: string; email: string };
}

interface MailGroup {
  id: string;
  name: string;
  description?: string;
  color: string;
  members: GroupMember[];
}

interface CampaignWizardProps {
  templates: any[];
  smtpConfigs: any[];
  companies: any[];
  groups: MailGroup[];
}

export function CampaignWizard({ templates, smtpConfigs, companies, groups }: CampaignWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [smtpId, setSmtpId] = useState('');
  const [fromName, setFromName] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [gapMinutes, setGapMinutes] = useState(2);
  const [jitterPct, setJitterPct] = useState(20);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sendTime, setSendTime] = useState('');
  const [activeDays, setActiveDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  const [followups, setFollowups] = useState<Array<{template_id: string; gap_days: number}>>([]);

  // Recipient mode
  const [recipientMode, setRecipientMode] = useState<'manual' | 'groups'>('manual');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  // Derived — contacts from selected groups (deduplicated)
  const groupContactIds = useMemo(() => {
    const ids = new Set<string>();
    groups
      .filter(g => selectedGroupIds.includes(g.id))
      .forEach(g => g.members?.forEach(m => ids.add(m.contact.id)));
    return Array.from(ids);
  }, [groups, selectedGroupIds]);

  // The final recipient list used at launch
  const finalRecipients = recipientMode === 'groups' ? groupContactIds : selectedContacts;

  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
    );
  };

  const handleSmtpChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSmtpId(id);
    const config = smtpConfigs.find(c => c.id === id);
    if (config) {
      setFromName(config.from_name || '');
      setFromEmail(config.from_email || '');
    }
  };

  const handleCreateAndLaunch = async () => {
    setIsSubmitting(true);
    try {
      // 1. Create Campaign
      const campaignRes = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          template_id: templateId,
          smtp_config_id: smtpId,
          from_name: fromName,
          from_email: fromEmail,
          reply_to: replyTo,
          send_gap_minutes: gapMinutes,
          gap_jitter_pct: jitterPct,
          start_date: startDate || null,
          end_date: endDate || null,
          send_time: sendTime || null,
          active_days: activeDays,
          followups: followups,
        }),
      });

      if (!campaignRes.ok) {
        const errData = await campaignRes.json();
        console.error('API Error Response:', errData);
        throw new Error(JSON.stringify(errData));
      }
      const { data: campaign } = await campaignRes.json();

      // 2. Launch (Schedule Recipients)
      const launchRes = await fetch(`/api/campaigns/${campaign.id}/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientIds: finalRecipients }),
      });

      if (!launchRes.ok) {
        let errMsg = 'Failed to launch campaign';
        try {
          const errData = await launchRes.json();
          errMsg = errData.error || errData.details?.message || JSON.stringify(errData);
        } catch(e) {}
        throw new Error(errMsg);
      }

      mutate('/api/campaigns');
      router.push(`/campaigns/${campaign.id}`);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to launch campaign', { description: err.message });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-[34px] font-semibold tracking-[-0.374px] text-foreground">Create Campaign</h1>
        <p className="text-[17px] text-muted-foreground mt-1">Step {step} of 4</p>
      </div>

      <div className="bg-background border border-border rounded-[18px] p-8 shadow-sm">
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-[22px] font-semibold text-foreground">Campaign Basics</h2>
            <div className="space-y-4 max-w-xl">
              <div>
                <Label className="text-[14px]">Campaign Name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="mt-1.5 rounded-[8px]" />
              </div>
              <div>
                <Label className="text-[14px]">Description</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} className="mt-1.5 rounded-[8px]" />
              </div>
            </div>
            <div className="pt-4 flex justify-end">
              <Button onClick={() => setStep(2)} disabled={!name} className="rounded-[8px]">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-[22px] font-semibold text-foreground">Content & Sender</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-[14px]">Email Template</Label>
                  <select 
                    value={templateId} 
                    onChange={e => setTemplateId(e.target.value)}
                    className="w-full mt-1.5 h-10 rounded-[8px] border border-border bg-background px-3 text-[14px]"
                  >
                    <option value="">Select a template...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[14px]">SMTP Connection</Label>
                  <select 
                    value={smtpId} 
                    onChange={handleSmtpChange}
                    className="w-full mt-1.5 h-10 rounded-[8px] border border-border bg-background px-3 text-[14px]"
                  >
                    <option value="">Select a server...</option>
                    {smtpConfigs.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-[14px]">From Name</Label>
                  <Input value={fromName} onChange={e => setFromName(e.target.value)} className="mt-1.5 rounded-[8px]" />
                </div>
                <div>
                  <Label className="text-[14px]">From Email</Label>
                  <Input value={fromEmail} onChange={e => setFromEmail(e.target.value)} className="mt-1.5 rounded-[8px]" />
                </div>
              </div>
            </div>
            <div className="pt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-[8px]">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(3)} disabled={!templateId || !smtpId || !fromName || !fromEmail} className="rounded-[8px]">
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <h2 className="text-[22px] font-semibold text-foreground">Select Recipients</h2>
              {/* Mode toggle */}
              <div className="flex rounded-[10px] border border-border overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setRecipientMode('manual')}
                  className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium transition-colors ${
                    recipientMode === 'manual'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setRecipientMode('groups')}
                  className={`flex items-center gap-2 px-4 py-2 text-[13px] font-medium border-l border-border transition-colors ${
                    recipientMode === 'groups'
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                  }`}
                >
                  <UsersRound className="w-3.5 h-3.5" />
                  Groups
                </button>
              </div>
            </div>

            {/* ── MANUAL MODE ── */}
            {recipientMode === 'manual' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-medium text-primary">{selectedContacts.length} selected</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => setSelectedContacts(companies.flatMap((c: any) => c.contacts?.map((ct: any) => ct.id) || []))}
                      className="h-8 text-[12px]"
                    >
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedContacts([])} className="h-8 text-[12px]">
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2 border border-border rounded-[11px] p-4">
                  {companies.map((company: any) => {
                    const companyContactIds = company.contacts?.map((c: any) => c.id) || [];
                    const isAllSelected = companyContactIds.length > 0 && companyContactIds.every((id: string) => selectedContacts.includes(id));
                    const isPartiallySelected = companyContactIds.some((id: string) => selectedContacts.includes(id)) && !isAllSelected;
                    const handleCompanyToggle = () => {
                      if (isAllSelected) {
                        setSelectedContacts(prev => prev.filter(id => !companyContactIds.includes(id)));
                      } else {
                        setSelectedContacts(prev => {
                          const next = [...prev];
                          companyContactIds.forEach((id: string) => { if (!next.includes(id)) next.push(id); });
                          return next;
                        });
                      }
                    };
                    return (
                      <div key={company.id} className="space-y-2">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={isAllSelected}
                            ref={el => { if (el) el.indeterminate = isPartiallySelected; }}
                            onChange={handleCompanyToggle}
                            disabled={companyContactIds.length === 0}
                            className="rounded border-border w-4 h-4 cursor-pointer"
                          />
                          <h3 className="text-[14px] font-semibold text-foreground cursor-pointer select-none" onClick={handleCompanyToggle}>
                            {company.name} <span className="text-[12px] font-normal text-muted-foreground ml-1">({companyContactIds.length})</span>
                          </h3>
                        </div>
                        {company.contacts?.length > 0 && (
                          <div className="space-y-1 pl-7 border-l-2 border-border/50 ml-2">
                            {company.contacts.map((contact: any) => (
                              <label key={contact.id} className="flex items-center gap-3 py-1 cursor-pointer">
                                <input type="checkbox"
                                  checked={selectedContacts.includes(contact.id)}
                                  onChange={() => toggleContact(contact.id)}
                                  className="rounded border-border w-4 h-4"
                                />
                                <span className="text-[13px] text-muted-foreground">
                                  {contact.first_name} {contact.last_name} <span className="opacity-60">· {contact.email}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── GROUPS MODE ── */}
            {recipientMode === 'groups' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: group picker */}
                <div className="space-y-3">
                  <p className="text-[13px] text-muted-foreground">Select one or more groups to include their contacts.</p>
                  {groups.length === 0 ? (
                    <div className="border border-dashed border-border rounded-[12px] p-8 text-center">
                      <UsersRound className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-[13px] text-muted-foreground">No groups yet.</p>
                      <a href="/groups" target="_blank" className="text-[12px] text-primary underline mt-1 inline-block">Create a group →</a>
                    </div>
                  ) : (
                    <div className="border border-border rounded-[12px] divide-y divide-border/60 overflow-hidden">
                      {groups.map(group => {
                        const isSel = selectedGroupIds.includes(group.id);
                        return (
                          <button
                            key={group.id}
                            type="button"
                            onClick={() =>
                              setSelectedGroupIds(prev =>
                                isSel ? prev.filter(id => id !== group.id) : [...prev, group.id]
                              )
                            }
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                              isSel ? 'bg-primary/8' : 'hover:bg-accent/40'
                            }`}
                          >
                            <div
                              className="w-8 h-8 rounded-[8px] shrink-0 flex items-center justify-center text-white text-[11px] font-bold"
                              style={{ backgroundColor: group.color }}
                            >
                              {group.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-foreground truncate">{group.name}</p>
                              <p className="text-[11px] text-muted-foreground">{group.members?.length ?? 0} contacts</p>
                            </div>
                            {isSel && <Check className="w-4 h-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right: preview */}
                <div className="border border-border rounded-[12px] overflow-hidden">
                  <div className="px-4 py-3 bg-secondary/30 border-b border-border">
                    <p className="text-[13px] font-medium text-foreground">
                      Preview · {groupContactIds.length} unique contact{groupContactIds.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {groupContactIds.length === 0 ? (
                    <div className="flex items-center justify-center py-16 text-center px-4">
                      <p className="text-[13px] text-muted-foreground">Select a group to preview its contacts here.</p>
                    </div>
                  ) : (
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-border/40">
                      {groups
                        .filter(g => selectedGroupIds.includes(g.id))
                        .map(group => (
                          <div key={group.id}>
                            <div className="px-4 py-2 bg-secondary/20 flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                              <span className="text-[12px] font-medium text-muted-foreground">{group.name}</span>
                            </div>
                            {group.members?.map(({ contact }) => (
                              <div key={contact.id} className="flex items-center gap-3 px-4 py-2 pl-6">
                                <div
                                  className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white text-[9px] font-bold"
                                  style={{ backgroundColor: group.color }}
                                >
                                  {contact.first_name[0]}{(contact.last_name || '')[0]}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[12px] font-medium text-foreground truncate">
                                    {contact.first_name} {contact.last_name}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">{contact.email}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-[8px]">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={finalRecipients.length === 0}
                className="rounded-[8px]"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <h2 className="text-[22px] font-semibold text-foreground">Scheduling & Launch</h2>
            <div className="space-y-6 max-w-2xl">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-[14px]">Start Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1.5 rounded-[8px]" />
                </div>
                <div>
                  <Label className="text-[14px]">End Date</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1.5 rounded-[8px]" />
                </div>
                <div>
                  <Label className="text-[14px]">Send Time</Label>
                  <Input type="time" value={sendTime} onChange={e => setSendTime(e.target.value)} className="mt-1.5 rounded-[8px]" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label className="text-[14px]">Send Gap (minutes)</Label>
                  <Input type="number" value={gapMinutes} onChange={e => setGapMinutes(Number(e.target.value))} className="mt-1.5 rounded-[8px]" />
                  <p className="text-[12px] text-muted-foreground mt-1">Wait time between each email.</p>
                </div>
                <div>
                  <Label className="text-[14px]">Jitter (%)</Label>
                  <Input type="number" value={jitterPct} onChange={e => setJitterPct(Number(e.target.value))} className="mt-1.5 rounded-[8px]" />
                  <p className="text-[12px] text-muted-foreground mt-1">Randomness applied to gap to look human.</p>
                </div>
              </div>

              <div className="border-t border-border pt-6 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[16px] font-semibold text-foreground">Follow-up Sequence</h3>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setFollowups([...followups, { template_id: '', gap_days: 3 }])}
                    className="h-8 text-[12px]"
                  >
                    + Add Follow-up
                  </Button>
                </div>
                
                {followups.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No follow-ups added.</p>
                ) : (
                  <div className="space-y-4">
                    {followups.map((f, index) => (
                      <div key={index} className="flex flex-col sm:flex-row gap-3 sm:items-end bg-secondary/20 p-4 rounded-[12px] border border-border">
                        <div className="flex-1">
                          <Label className="text-[13px]">Step {index + 1} Template</Label>
                          <select
                            value={f.template_id}
                            onChange={e => {
                              const newF = [...followups];
                              newF[index].template_id = e.target.value;
                              setFollowups(newF);
                            }}
                            className="w-full mt-1.5 h-9 rounded-[6px] border border-border bg-background px-3 text-[13px]"
                          >
                            <option value="">Select template...</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </div>
                        <div className="sm:w-24">
                          <Label className="text-[13px]">Wait (days)</Label>
                          <Input
                            type="number"
                            value={f.gap_days}
                            onChange={e => {
                              const newF = [...followups];
                              newF[index].gap_days = Number(e.target.value);
                              setFollowups(newF);
                            }}
                            className="mt-1.5 h-9 rounded-[6px] text-[13px]"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setFollowups(followups.filter((_, i) => i !== index))}
                          className="h-9 px-2 text-destructive hover:bg-destructive/10 self-start sm:self-auto"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-[14px] p-6 mt-8">
              <h3 className="text-[17px] font-semibold text-primary mb-2">Ready to Launch</h3>
              <p className="text-[14px] text-primary/80 mb-6">
                You are about to queue <strong>{finalRecipients.length}</strong> email{finalRecipients.length !== 1 ? 's' : ''}
                {recipientMode === 'groups' && selectedGroupIds.length > 0 && (
                  <> from <strong>{selectedGroupIds.length}</strong> group{selectedGroupIds.length !== 1 ? 's' : ''}</>
                )}. They will be sent out over the next ~{Math.round((finalRecipients.length * gapMinutes) / 60)} hours within your selected active days.
              </p>
              <div className="flex justify-between items-center flex-wrap gap-3">
                <Button variant="outline" onClick={() => setStep(3)} className="rounded-[8px] border-primary/30 text-primary">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back
                </Button>
                <Button onClick={handleCreateAndLaunch} disabled={isSubmitting || gapMinutes < 1 || finalRecipients.length === 0} className="rounded-[8px] bg-primary text-primary-foreground h-11 px-6 text-[15px] font-medium shadow-md shadow-primary/20">
                  {isSubmitting ? 'Launching...' : 'Launch Campaign'}
                  <Rocket className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
