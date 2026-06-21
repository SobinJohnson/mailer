'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Rocket, Copy, ArrowLeft, Plus, Trash2, Clock, Users,
  FileText, Zap, CheckCircle2, AlertCircle, Loader2, Pencil
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Group { id: string; name: string; color: string; members: { count: number }[] }
interface Template { id: string; name: string; subject?: string }
interface SmtpConfig { id: string; label: string; from_email: string; from_name: string | null }

interface DailySchedule {
  id: string;
  weekly_plan_id: string;
  day_of_week: string;
  group_id: string | null;
  template_id: string | null;
  smtp_config_id: string | null;
  send_time: string;
  send_gap_minutes: number;
  gap_jitter_pct: number;
  attachments: any[];
  group: Group | null;
  template: Template | null;
  smtp_config: SmtpConfig | null;
}

interface Plan {
  id: string;
  name: string;
  start_date: string;
  status: 'draft' | 'active' | 'completed';
  daily_schedules: DailySchedule[];
}

interface Props {
  plan: Plan;
  templates: Template[];
  smtpConfigs: SmtpConfig[];
  groups: Group[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-secondary text-muted-foreground border-border',
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  completed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonday(startDate: string): Date {
  const d = new Date(startDate + 'T00:00:00');
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatWeekRange(startDate: string) {
  const start = getMonday(startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function resolveDate(startDate: string, day: string) {
  const offset = DAYS.indexOf(day);
  const d = getMonday(startDate);
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function memberCount(group: Group | null): number {
  if (!group?.members?.length) return 0;
  const c = (group.members[0] as any)?.count;
  return typeof c === 'number' ? c : 0;
}

// ─── Day Card ─────────────────────────────────────────────────────────────────

function DayCard({
  day,
  schedule,
  date,
  isEditable,
  onEdit,
  onClear,
}: {
  day: string;
  schedule: DailySchedule | undefined;
  date: string;
  isEditable: boolean;
  onEdit: () => void;
  onClear: () => void;
}) {
  const hasSchedule = !!(schedule?.group_id || schedule?.template_id || schedule?.smtp_config_id);

  return (
    <div
      className={`relative flex flex-col min-h-[180px] rounded-[14px] border transition-all duration-150 overflow-hidden
        ${hasSchedule
          ? 'bg-background border-border hover:border-foreground/20 cursor-pointer'
          : isEditable
            ? 'bg-secondary/30 border-dashed border-border/60 hover:border-border cursor-pointer hover:bg-secondary/50'
            : 'bg-secondary/20 border-dashed border-border/40'
        }`}
      onClick={isEditable ? onEdit : undefined}
    >
      {/* Day header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <p className="text-[13px] font-semibold text-foreground">{day.slice(0, 3)}</p>
          <p className="text-[11px] text-muted-foreground">{date}</p>
        </div>
        {hasSchedule && isEditable && (
          <div className="flex gap-1">
            <button
              onClick={e => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="Edit"
            >
              <Plus className="w-3.5 h-3.5 rotate-45" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onClear(); }}
              className="p-1.5 rounded-[6px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Clear day"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-4">
        {hasSchedule ? (
          <div className="space-y-2.5">
            <div className="flex items-start gap-2">
              <div
                className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                style={{ backgroundColor: schedule!.group?.color || '#cbd5e1' }}
              />
              <div className="min-w-0">
                <p className={`text-[12px] font-medium truncate leading-tight ${schedule!.group ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                  {schedule!.group?.name || 'No group selected'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {schedule!.group ? `${memberCount(schedule!.group)} contacts` : '0 contacts'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className={`text-[11px] truncate leading-tight ${schedule!.template ? 'text-muted-foreground' : 'text-muted-foreground/45'}`}>
                {schedule!.template?.name || 'No template selected'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <p className="text-[11px] text-muted-foreground">
                {schedule!.send_time || '09:00'} · {schedule!.send_gap_minutes}m gap
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <p className={`text-[11px] truncate ${schedule!.smtp_config ? 'text-muted-foreground' : 'text-muted-foreground/45'}`}>
                {schedule!.smtp_config?.label || 'No SMTP sender'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-4 text-center">
            {isEditable ? (
              <>
                <Plus className="w-5 h-5 text-muted-foreground/40 mb-1.5" />
                <p className="text-[12px] text-muted-foreground/60">Click to schedule</p>
              </>
            ) : (
              <p className="text-[12px] text-muted-foreground/40">Not scheduled</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Day Schedule Dialog ──────────────────────────────────────────────────────

function DayDialog({
  open,
  day,
  schedule,
  groups,
  templates,
  smtpConfigs,
  planId,
  onSave,
  onClose,
}: {
  open: boolean;
  day: string | null;
  schedule: DailySchedule | undefined;
  groups: Group[];
  templates: Template[];
  smtpConfigs: SmtpConfig[];
  planId: string;
  onSave: (schedule: DailySchedule) => void;
  onClose: () => void;
}) {
  const [groupId, setGroupId] = useState(schedule?.group_id || '');
  const [templateId, setTemplateId] = useState(schedule?.template_id || '');
  const [smtpId, setSmtpId] = useState(schedule?.smtp_config_id || '');
  const [sendTime, setSendTime] = useState(schedule?.send_time?.slice(0, 5) || '09:00');
  const [gapMinutes, setGapMinutes] = useState(schedule?.send_gap_minutes ?? 2);
  const [jitterPct, setJitterPct] = useState(schedule?.gap_jitter_pct ?? 20);
  const [saving, setSaving] = useState(false);

  if (!day) return null;

  async function handleSave() {
    if (!groupId && !templateId && !smtpId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/weekly-plans/${planId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: day,
          group_id: groupId || null,
          template_id: templateId || null,
          smtp_config_id: smtpId || null,
          send_time: sendTime,
          send_gap_minutes: gapMinutes,
          gap_jitter_pct: jitterPct,
          attachments: schedule?.attachments || [],
        }),
      });
      const { data } = await res.json();
      if (data) {
        const grp = groups.find(g => g.id === groupId) || null;
        const tmpl = templates.find(t => t.id === templateId) || null;
        const smtp = smtpConfigs.find(s => s.id === smtpId) || null;
        onSave({ ...data, group: grp, template: tmpl, smtp_config: smtp });
      }
    } finally {
      setSaving(false);
    }
  }

  const selectedGroup = groups.find(g => g.id === groupId);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg rounded-[18px]">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-semibold">
            Schedule — {day}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Group */}
          <div>
            <Label className="text-[13px]">Contact Group</Label>
            <select
              value={groupId}
              onChange={e => setGroupId(e.target.value)}
              className="w-full mt-1.5 h-10 rounded-[8px] border border-border bg-background px-3 text-[13px]"
            >
              <option value="">Select a group…</option>
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name} ({memberCount(g)} contacts)
                </option>
              ))}
            </select>
            {selectedGroup && (
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: selectedGroup.color }} />
                {memberCount(selectedGroup)} contacts will receive this send
              </p>
            )}
          </div>

          {/* Template */}
          <div>
            <Label className="text-[13px]">Email Template</Label>
            <select
              value={templateId}
              onChange={e => setTemplateId(e.target.value)}
              className="w-full mt-1.5 h-10 rounded-[8px] border border-border bg-background px-3 text-[13px]"
            >
              <option value="">Select a template…</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* SMTP */}
          <div>
            <Label className="text-[13px]">SMTP Sender</Label>
            <select
              value={smtpId}
              onChange={e => setSmtpId(e.target.value)}
              className="w-full mt-1.5 h-10 rounded-[8px] border border-border bg-background px-3 text-[13px]"
            >
              <option value="">Select a sender…</option>
              {smtpConfigs.map(s => (
                <option key={s.id} value={s.id}>{s.label} ({s.from_email})</option>
              ))}
            </select>
          </div>

          {/* Timing */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[12px]">Send Time</Label>
              <Input
                type="time"
                value={sendTime}
                onChange={e => setSendTime(e.target.value)}
                className="mt-1.5 h-9 rounded-[7px] text-[13px]"
              />
            </div>
            <div>
              <Label className="text-[12px]">Gap (min)</Label>
              <Input
                type="number"
                min={1}
                value={gapMinutes}
                onChange={e => setGapMinutes(Number(e.target.value))}
                className="mt-1.5 h-9 rounded-[7px] text-[13px]"
              />
            </div>
            <div>
              <Label className="text-[12px]">Jitter (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={jitterPct}
                onChange={e => setJitterPct(Number(e.target.value))}
                className="mt-1.5 h-9 rounded-[7px] text-[13px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="rounded-[8px] h-9">Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || (!groupId && !templateId && !smtpId)}
              className="rounded-[8px] h-9"
            >
              {saving ? 'Saving…' : 'Save Day'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Calendar Component ──────────────────────────────────────────────────

export function WeeklyPlannerCalendar({ plan, templates, smtpConfigs, groups }: Props) {
  const router = useRouter();

  const [schedules, setSchedules] = useState<DailySchedule[]>(plan.daily_schedules || []);
  const [planStatus, setPlanStatus] = useState(plan.status);
  const [editDay, setEditDay] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<{ results: any[]; errors: any[] } | null>(null);
  const [duplicating, setDuplicating] = useState(false);

  const [planName, setPlanName] = useState(plan.name);
  const [planStartDate, setPlanStartDate] = useState(plan.start_date);
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [editName, setEditName] = useState(plan.name);
  const [editStartDate, setEditStartDate] = useState(plan.start_date);
  const [savingPlan, setSavingPlan] = useState(false);

  async function handleSavePlan() {
    if (!editName || !editStartDate) return;
    setSavingPlan(true);
    try {
      const res = await fetch(`/api/weekly-plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          start_date: editStartDate,
        }),
      });
      const { data, error } = await res.json();
      if (error) {
        toast.error('Failed to save plan', { description: typeof error === 'string' ? error : error.message });
      } else if (data) {
        setPlanName(data.name);
        setPlanStartDate(data.start_date);
        setEditPlanOpen(false);
        toast.success('Weekly plan updated');
        router.refresh();
      }
    } catch (err: any) {
      toast.error('Failed to save plan', { description: err.message });
    } finally {
      setSavingPlan(false);
    }
  }

  const scheduleMap = Object.fromEntries(schedules.map(s => [s.day_of_week, s]));
  const isEditable = planStatus === 'draft';

  const configuredCount = schedules.filter(
    s => s.group_id && s.template_id && s.smtp_config_id
  ).length;

  function handleSaveDay(updated: DailySchedule) {
    setSchedules(prev => {
      const exists = prev.findIndex(s => s.day_of_week === updated.day_of_week);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = updated;
        return next;
      }
      return [...prev, updated];
    });
    setEditDay(null);
  }

  async function handleClearDay(day: string) {
    if (!confirm(`Remove the schedule for ${day}?`)) return;
    await fetch(`/api/weekly-plans/${plan.id}/schedule/${day}`, { method: 'DELETE' });
    setSchedules(prev => prev.filter(s => s.day_of_week !== day));
  }

  async function handleLaunch() {
    if (!confirm(`Launch "${plan.name}"? This will queue all configured days immediately.`)) return;
    setLaunching(true);
    setLaunchResult(null);
    try {
      const res = await fetch(`/api/weekly-plans/${plan.id}/launch`, { method: 'POST' });
      const json = await res.json();
      setPlanStatus('active');
      setLaunchResult({ results: json.results || [], errors: json.errors || [] });
    } finally {
      setLaunching(false);
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const res = await fetch(`/api/weekly-plans/${plan.id}/duplicate`, { method: 'POST' });
      const { data } = await res.json();
      if (data) router.push(`/weekly-plans/${data.id}`);
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <Link href="/weekly-plans" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-foreground">{planName}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-[5px] text-[11px] font-medium border ${STATUS_BADGE[planStatus]}`}>
              {planStatus}
            </span>
            {isEditable && (
              <button
                onClick={() => {
                  setEditName(planName);
                  setEditStartDate(planStartDate);
                  setEditPlanOpen(true);
                }}
                className="p-1 rounded-[6px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
                title="Edit plan name/date"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground pl-6">
            {formatWeekRange(planStartDate)} · {configuredCount} of 7 days configured
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleDuplicate}
            disabled={duplicating}
            className="rounded-[9px] h-9 gap-2 text-[13px]"
          >
            {duplicating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Duplicate Week</span>
            <span className="sm:hidden">Duplicate</span>
          </Button>

          {isEditable && (
            <Button
              onClick={handleLaunch}
              disabled={launching || configuredCount === 0}
              className="rounded-[9px] h-9 gap-2 text-[13px]"
            >
              {launching ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Launching…</>
              ) : (
                <><Rocket className="w-3.5 h-3.5" /> Launch Week</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Launch result banner */}
      {launchResult && (
        <div className="rounded-[12px] border bg-background p-4 space-y-2">
          {launchResult.results.map(r => (
            <div key={r.day} className="flex items-center gap-2 text-[13px] text-emerald-600">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span><strong>{r.day}</strong> — {r.recipients} recipients queued</span>
            </div>
          ))}
          {launchResult.errors.map(e => (
            <div key={e.day} className="flex items-center gap-2 text-[13px] text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span><strong>{e.day}</strong> — {e.error}</span>
            </div>
          ))}
        </div>
      )}

      {/* 7-day calendar grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {DAYS.map(day => (
          <DayCard
            key={day}
            day={day}
            schedule={scheduleMap[day]}
            date={resolveDate(planStartDate, day)}
            isEditable={isEditable}
            onEdit={() => setEditDay(day)}
            onClear={() => handleClearDay(day)}
          />
        ))}
      </div>

      {/* Help text */}
      {isEditable && configuredCount === 0 && (
        <div className="flex items-start gap-3 rounded-[12px] border border-dashed border-border bg-secondary/30 p-4">
          <Users className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[13px] text-muted-foreground">
            Click any day card above to assign a contact group, template, and sender. Once all desired days are configured, hit <strong>Launch Week</strong> to queue all emails automatically.
          </p>
        </div>
      )}

      {/* Edit Plan Dialog */}
      <Dialog open={editPlanOpen} onOpenChange={setEditPlanOpen}>
        <DialogContent className="max-w-md rounded-[18px]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold">Edit Weekly Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-[13px]">Plan Name</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Plan Name"
                className="mt-1.5 rounded-[8px]"
              />
            </div>
            <div>
              <Label className="text-[13px]">Week Start (Monday)</Label>
              <Input
                type="date"
                value={editStartDate}
                onChange={e => setEditStartDate(e.target.value)}
                className="mt-1.5 rounded-[8px]"
              />
              <p className="text-[12px] text-muted-foreground mt-1">Anchor date for this weekly planner.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditPlanOpen(false)} className="rounded-[8px]">Cancel</Button>
              <Button onClick={handleSavePlan} disabled={savingPlan || !editName || !editStartDate} className="rounded-[8px]">
                {savingPlan ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day schedule dialog — keyed by day so state resets on day change */}
      <DayDialog
        key={editDay || ''}
        open={!!editDay}
        day={editDay}
        schedule={editDay ? scheduleMap[editDay] : undefined}
        groups={groups}
        templates={templates}
        smtpConfigs={smtpConfigs}
        planId={plan.id}
        onSave={handleSaveDay}
        onClose={() => setEditDay(null)}
      />
    </div>
  );
}
