'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarDays, Plus, ArrowRight, Trash2, Copy } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getMondayOf(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const sunday = d.getDay() === 0;
  if (sunday) return dateStr;
  return dateStr;
}

function formatWeekRange(startDate: string) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(startDate + 'T00:00:00');
  end.setDate(end.getDate() + 6);
  return `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-secondary text-muted-foreground border-border',
  active: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  completed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

interface Plan {
  id: string;
  name: string;
  start_date: string;
  status: 'draft' | 'active' | 'completed';
  created_at: string;
  daily_schedules: Array<{
    id: string;
    day_of_week: string;
    group: { name: string } | null;
    template: { name: string } | null;
  }>;
}

export function WeeklyPlanTable({ initialPlans }: { initialPlans: Plan[] }) {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Default Monday date = next Monday
  function getNextMonday() {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 1 ? 7 : (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  function openCreate() {
    setNewName('');
    setNewDate(getNextMonday());
    setDialogOpen(true);
  }

  async function handleCreate() {
    if (!newName || !newDate) return;
    setCreating(true);
    try {
      const res = await fetch('/api/weekly-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, start_date: newDate }),
      });
      const { data } = await res.json();
      if (data) router.push(`/weekly-plans/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this weekly plan and all its scheduled days?')) return;
    setDeleting(id);
    await fetch(`/api/weekly-plans/${id}`, { method: 'DELETE' });
    setPlans(p => p.filter(pl => pl.id !== id));
    setDeleting(null);
  }

  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/weekly-plans/${id}/duplicate`, { method: 'POST' });
    const { data } = await res.json();
    if (data) router.push(`/weekly-plans/${data.id}`);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.4px] text-foreground">Weekly Planner</h1>
          <p className="text-[14px] text-muted-foreground mt-1">Schedule daily outbound sends for an entire week in one place.</p>
        </div>
        <Button onClick={openCreate} className="rounded-[9px] h-9 px-3.5 sm:px-4 gap-1.5 sm:gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Week Plan</span>
        </Button>
      </div>

      {plans.length === 0 ? (
        <div className="border border-dashed border-border rounded-[14px] py-20 flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 rounded-[12px] bg-secondary flex items-center justify-center">
            <CalendarDays className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-[15px] font-medium text-foreground">No weekly plans yet</p>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-xs">
              Create a plan to schedule daily outbound sends — each day can target a different group with a different template.
            </p>
          </div>
          <Button onClick={openCreate} variant="outline" className="rounded-[8px] gap-2">
            <Plus className="w-4 h-4" /> Create first plan
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => {
            const configured = plan.daily_schedules?.length || 0;
            return (
              <div key={plan.id} className="group border border-border rounded-[14px] bg-background p-5 hover:border-foreground/20 transition-colors">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                      <Link
                        href={`/weekly-plans/${plan.id}`}
                        className="text-[16px] font-semibold text-foreground hover:underline truncate"
                      >
                        {plan.name}
                      </Link>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-[5px] text-[11px] font-medium border ${STATUS_STYLES[plan.status]}`}>
                        {plan.status}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground">{formatWeekRange(plan.start_date)}</p>

                    {/* Day pills */}
                    <div className="flex gap-1.5 mt-3 flex-wrap">
                      {DAYS.map(day => {
                        const sched = plan.daily_schedules?.find(s => s.day_of_week === day);
                        return (
                          <div
                            key={day}
                            className={`px-2 py-1 rounded-[6px] text-[11px] font-medium border ${
                              sched
                                ? 'bg-foreground/5 text-foreground border-border'
                                : 'text-muted-foreground/40 border-dashed border-border/40'
                            }`}
                          >
                            {day.slice(0, 3)}
                            {sched && (
                              <span className="ml-1 text-muted-foreground opacity-70 hidden sm:inline">· {sched.group?.name || '?'}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDuplicate(plan.id)}
                      title="Duplicate for next week"
                      className="p-1.5 rounded-[7px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      disabled={deleting === plan.id}
                      title="Delete plan"
                      className="p-1.5 rounded-[7px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/weekly-plans/${plan.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-secondary text-foreground text-[12px] font-medium hover:bg-secondary/80 transition-colors"
                    >
                      Open <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-[18px]">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold">New Weekly Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-[13px]">Plan Name</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Outbound — Week 26"
                className="mt-1.5 rounded-[8px]"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-[13px]">Week Start (Monday)</Label>
              <Input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="mt-1.5 rounded-[8px]"
              />
              <p className="text-[12px] text-muted-foreground mt-1">Should be a Monday — that anchors Mon–Sun for this plan.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-[8px]">Cancel</Button>
              <Button onClick={handleCreate} disabled={creating || !newName || !newDate} className="rounded-[8px]">
                {creating ? 'Creating…' : 'Create Plan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
