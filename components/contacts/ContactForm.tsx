'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface Company {
  id: string;
  name: string;
}

interface ContactFormProps {
  initialData?: any; // To support editing later
  companies: Company[];
}

export function ContactForm({ initialData, companies }: ContactFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [validatingEmail, setValidatingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'validating' | 'deliverable' | 'mx_valid' | 'risky' | 'undeliverable'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [overrideValidation, setOverrideValidation] = useState(false);

  const [form, setForm] = useState({
    company_id: initialData?.company_id ?? '',
    first_name: initialData?.first_name || '',
    last_name: initialData?.last_name || '',
    email: initialData?.email || '',
    designation: initialData?.designation || '',
    phone: initialData?.phone || '',
    linkedin_url: initialData?.linkedin_url || '',
    is_primary: initialData?.is_primary || false,
    is_general_mailbox: initialData?.is_general_mailbox || false,
    notes: initialData?.notes || '',
    verification_status: initialData?.verification_status ?? 'unverified',
    is_active: initialData?.is_active !== false,
  });

  useEffect(() => {
    if (initialData?.verification_status) {
      const status = initialData.verification_status;
      if (status === 'verified') {
        setEmailStatus('deliverable');
        setEmailError('Email address verified and active.');
      } else if (status === 'risky') {
        setEmailStatus('risky');
        setEmailError('This email address could not be fully verified and might be risky.');
      } else if (status === 'failed') {
        setEmailStatus('undeliverable');
        setEmailError('This email address is invalid and will bounce.');
      }
    }
  }, [initialData]);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));
  }

  function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setForm(prev => ({ ...prev, email: val, verification_status: 'unverified' }));
    setEmailStatus('idle');
    setEmailError(null);
    setOverrideValidation(false);
  }

  async function handleVerifyEmail() {
    const email = form.email.trim();
    if (!email) {
      setEmailStatus('idle');
      setEmailError(null);
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      setEmailStatus('undeliverable');
      setEmailError('The email address format is invalid.');
      return;
    }

    setValidatingEmail(true);
    setEmailStatus('validating');
    setEmailError(null);

    try {
      const res = await fetch('/api/contacts/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      if (data.valid) {
        setEmailStatus(data.status);
        let friendlyMsg = '';
        let vStatus: 'verified' | 'risky' = 'verified';
        if (data.status === 'deliverable') {
          friendlyMsg = 'Email address verified and active.';
        } else if (data.status === 'mx_valid') {
          friendlyMsg = 'Email address is valid.';
        } else if (data.status === 'risky') {
          vStatus = 'risky';
          const rawDetails = data.error || data.details || '';
          if (rawDetails.toLowerCase().includes('role')) {
            friendlyMsg = 'This is a generic role address (like info@ or admin@).';
          } else {
            friendlyMsg = 'This email looks risky (it might be temporary, or the server is busy).';
          }
        }
        setEmailError(friendlyMsg);
        setForm(prev => ({ ...prev, verification_status: vStatus }));
      } else {
        setEmailStatus('undeliverable');
        const rawError = data.error || '';
        let friendlyMsg = 'This email address is invalid and will bounce.';
        if (rawError.toLowerCase().includes('rejected_email')) {
          friendlyMsg = 'This mailbox does not exist on the domain.';
        } else if (rawError.toLowerCase().includes('invalid_domain')) {
          friendlyMsg = 'The email domain does not exist.';
        } else if (rawError.toLowerCase().includes('disposable')) {
          friendlyMsg = 'This is a temporary/disposable email address.';
        }
        setEmailError(friendlyMsg);
        setForm(prev => ({ ...prev, verification_status: 'failed' }));
      }
    } catch (err: any) {
      console.error(err);
      setEmailStatus('risky');
      setEmailError('Could not verify email reachability at this moment.');
    } finally {
      setValidatingEmail(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const isEditing = !!initialData;
      const url = isEditing ? `/api/contacts/${initialData.id}` : '/api/contacts';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to save contact');
      router.push('/contacts');
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
          href="/contacts"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'icon' }),
            "h-8 w-8 rounded-[8px] flex items-center justify-center"
          )}
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-[24px] font-semibold text-foreground tracking-tight">
            {initialData ? 'Edit Contact' : 'Add New Contact'}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Fill in the details for the contact profile.
          </p>
        </div>
      </div>

      <div className="rounded-[14px] border border-border overflow-hidden bg-background">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-[14px] font-medium text-foreground pb-2 border-b border-border">Core Details</h3>
            
            <div className="space-y-1.5 max-w-md">
              <Label className="text-[13px] text-muted-foreground">Company *</Label>
              {companies.length === 0 ? (
                <p className="mt-1.5 text-[12px] text-destructive">
                  No companies yet — please add a company first.
                </p>
              ) : (
                <select
                  value={form.company_id}
                  onChange={set('company_id')}
                  required
                  className="w-full h-10 rounded-[8px] text-[14px] bg-background border border-input px-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-background"
                >
                  <option value="">Select a company…</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                id="is_general_mailbox"
                checked={form.is_general_mailbox}
                onChange={e => {
                  setForm(prev => ({ ...prev, is_general_mailbox: e.target.checked, last_name: e.target.checked ? '' : prev.last_name }));
                }}
                className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
              />
              <label htmlFor="is_general_mailbox" className="text-[13px] text-foreground cursor-pointer select-none">
                This is a general mailbox (e.g. procurement@, info@)
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">
                  {form.is_general_mailbox ? 'Greeting Name (e.g. Team, Sir/Madam) *' : 'First Name *'}
                </Label>
                <Input
                  value={form.first_name}
                  onChange={set('first_name')}
                  required
                  placeholder={form.is_general_mailbox ? "Team" : "Jane"}
                  className="h-10 rounded-[8px] text-[14px]"
                />
              </div>
              {!form.is_general_mailbox && (
                <div className="space-y-1.5">
                  <Label className="text-[13px] text-muted-foreground">Last Name</Label>
                  <Input
                    value={form.last_name}
                    onChange={set('last_name')}
                    placeholder="Smith"
                    className="h-10 rounded-[8px] text-[14px]"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Email *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      value={form.email}
                      onChange={handleEmailChange}
                      required
                      type="email"
                      placeholder="jane@acme.com"
                      className="h-10 rounded-[8px] text-[14px] pr-10"
                    />
                    {validatingEmail && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleVerifyEmail}
                    disabled={validatingEmail || !form.email.trim()}
                    className="h-10 px-4 rounded-[8px] text-[13px] font-medium shrink-0"
                  >
                    Verify
                  </Button>
                </div>
                {emailStatus === 'deliverable' && (
                  <p className="text-[12px] text-green-500 font-medium">✓ {emailError || 'Email address verified and active.'}</p>
                )}
                {emailStatus === 'mx_valid' && (
                  <p className="text-[12px] text-blue-500 font-medium">✓ {emailError || 'Email address is valid.'}</p>
                )}
                {emailStatus === 'risky' && (
                  <p className="text-[12px] text-amber-500 font-medium">⚠️ {emailError || 'This email address could not be fully verified and might be risky.'}</p>
                )}
                {emailStatus === 'undeliverable' && (
                  <div className="space-y-2 mt-1.5">
                    <p className="text-[12px] text-destructive font-medium">❌ {emailError || 'This email address is invalid and will bounce.'}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="override_validation"
                        checked={overrideValidation}
                        onChange={e => setOverrideValidation(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-input accent-destructive cursor-pointer"
                      />
                      <label htmlFor="override_validation" className="text-[11px] text-muted-foreground cursor-pointer select-none">
                        Save anyway (Skip verification)
                      </label>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Job Title</Label>
                <Input
                  value={form.designation}
                  onChange={set('designation')}
                  placeholder="CEO, CTO…"
                  className="h-10 rounded-[8px] text-[14px]"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[14px] font-medium text-foreground pb-2 border-b border-border">Contact & Social</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={set('phone')}
                  placeholder="+1 555 0000"
                  type="tel"
                  className="h-10 rounded-[8px] text-[14px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] text-muted-foreground">LinkedIn URL</Label>
                <Input
                  value={form.linkedin_url}
                  onChange={set('linkedin_url')}
                  placeholder="https://linkedin.com/in/janesmith"
                  type="url"
                  className="h-10 rounded-[8px] text-[14px]"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="is_primary"
                checked={form.is_primary}
                onChange={e => setForm(prev => ({ ...prev, is_primary: e.target.checked }))}
                className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
              />
              <label htmlFor="is_primary" className="text-[13px] text-foreground cursor-pointer select-none">
                Mark as primary contact for this company
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
                className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
              />
              <label htmlFor="is_active" className="text-[13px] text-foreground cursor-pointer select-none font-medium">
                Active contact status (Uncheck to temporarily exclude from all campaigns/schedules)
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-[14px] font-medium text-foreground pb-2 border-b border-border">Additional Info</h3>
            <div className="space-y-1.5">
              <Label className="text-[13px] text-muted-foreground">Notes</Label>
              <textarea
                value={form.notes}
                onChange={set('notes')}
                placeholder="Any relevant notes about this contact…"
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
              disabled={
                loading || 
                !form.first_name || 
                !form.email || 
                !form.company_id || 
                validatingEmail || 
                (emailStatus === 'undeliverable' && !overrideValidation)
              }
              className="h-10 px-5 rounded-[8px] bg-primary hover:bg-primary/90 text-primary-foreground text-[14px] press-effect"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {initialData ? 'Save Changes' : 'Add Contact'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
