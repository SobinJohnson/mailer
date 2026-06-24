'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface CompanyFormProps {
  initialData?: any; // To support editing later
}

export function CompanyForm({ initialData }: CompanyFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: initialData?.name || '',
    industry: initialData?.industry || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    website: initialData?.website || '',
    linkedin_url: initialData?.linkedin_url || '',
    tags: initialData?.tags?.join(', ') || '',
    status: initialData?.status || 'active',
    notes: initialData?.notes || '',
  });

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const isEditing = !!initialData;
      const url = isEditing ? `/api/companies/${initialData.id}` : '/api/companies';
      const method = isEditing ? 'PUT' : 'POST';

      const payload = {
        ...form,
        tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save company');
      mutate('/api/companies');
      router.push('/companies');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-page-in">
      <div className="flex items-center gap-4">
        <Link 
          href="/companies"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon' }),
            "h-8 w-8 rounded-[8px] flex items-center justify-center"
          )}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-[24px] font-semibold text-foreground tracking-tight">
            {initialData ? 'Edit Company' : 'Add New Company'}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Fill in the details for the company profile.
          </p>
        </div>
      </div>

      <div className="rounded-[14px] border border-border overflow-hidden bg-background">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-[14px] font-medium text-foreground pb-2 border-b border-border">Core Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Company Name *</Label>
                <Input
                  value={form.name}
                  onChange={set('name')}
                  required
                  placeholder="Acme Corp"
                  className="h-10 rounded-[8px] text-[14px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Industry</Label>
                <Input
                  value={form.industry}
                  onChange={set('industry')}
                  placeholder="SaaS, Finance…"
                  className="h-10 rounded-[8px] text-[14px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Status</Label>
                <select
                  value={form.status}
                  onChange={set('status')}
                  className="w-full h-10 rounded-[8px] text-[14px] bg-background border border-input px-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-background"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="prospect">Prospect</option>
                  <option value="do_not_contact">Do Not Contact</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Tags (comma separated)</Label>
                <Input
                  value={form.tags}
                  onChange={set('tags')}
                  placeholder="Enterprise, VIP, B2B"
                  className="h-10 rounded-[8px] text-[14px]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[14px] font-medium text-foreground pb-2 border-b border-border">Location & Links</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">City</Label>
                <Input
                  value={form.city}
                  onChange={set('city')}
                  placeholder="New York"
                  className="h-10 rounded-[8px] text-[14px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">State</Label>
                <Input
                  value={form.state}
                  onChange={set('state')}
                  placeholder="NY"
                  className="h-10 rounded-[8px] text-[14px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Website</Label>
                <Input
                  value={form.website}
                  onChange={set('website')}
                  placeholder="https://acme.com"
                  type="url"
                  className="h-10 rounded-[8px] text-[14px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">LinkedIn URL</Label>
                <Input
                  value={form.linkedin_url}
                  onChange={set('linkedin_url')}
                  placeholder="https://linkedin.com/company/acme"
                  type="url"
                  className="h-10 rounded-[8px] text-[14px]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[14px] font-medium text-foreground pb-2 border-b border-border">Additional Info</h3>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Notes</Label>
              <textarea
                value={form.notes}
                onChange={set('notes')}
                placeholder="Any relevant notes about this company…"
                rows={5}
                className="w-full rounded-[8px] text-[14px] bg-background border border-input px-3 py-2.5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-background resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-[8px] bg-destructive/10 text-destructive border border-destructive/20 text-[13px]">
              {error}
            </div>
          )}

          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="h-10 px-5 rounded-[8px] text-[14px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !form.name}
              className="h-10 px-5 rounded-[8px] bg-primary hover:bg-primary/90 text-primary-foreground text-[14px] press-effect"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {initialData ? 'Save Changes' : 'Create Company'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
