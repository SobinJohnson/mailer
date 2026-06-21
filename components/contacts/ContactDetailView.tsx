'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, MapPin, Briefcase, Plus, Save, Loader2, Link2, Mail, Phone, Calendar, User, Inbox, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ContactDetailActions } from './ContactDetailActions';
import { toast } from 'sonner';
import Link from 'next/link';
import { Company, Contact } from '@/types';

interface ExtendedContact extends Contact {
  company?: Company;
}

interface CampaignEnrollment {
  id: string;
  status: string;
  created_at: string;
  campaign: {
    id: string;
    name: string;
    status: string;
  } | null;
}

interface ContactDetailViewProps {
  initialContact: ExtendedContact;
  campaigns: CampaignEnrollment[];
}

export function ContactDetailView({ initialContact, campaigns }: ContactDetailViewProps) {
  const router = useRouter();
  const [contact, setContact] = useState<ExtendedContact>(initialContact);
  const [notes, setNotes] = useState(initialContact.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);

  const [campaignsPage, setCampaignsPage] = useState(1);
  const CAMPAIGNS_PAGE_SIZE = 5;
  const totalCampaignsPages = Math.ceil((campaigns || []).length / CAMPAIGNS_PAGE_SIZE);
  const activeCampaignsPage = Math.min(campaignsPage, Math.max(1, totalCampaignsPages));

  const paginatedCampaigns = (campaigns || []).slice(
    (activeCampaignsPage - 1) * CAMPAIGNS_PAGE_SIZE,
    activeCampaignsPage * CAMPAIGNS_PAGE_SIZE
  );

  const handleNotesBlur = async () => {
    if (notes === (contact.notes || '')) return;

    setSavingNotes(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error('Failed to update notes');
      setContact(prev => ({ ...prev, notes }));
      toast.success('Notes saved');
    } catch (err: any) {
      toast.error('Failed to save notes', { description: err.message });
      setNotes(contact.notes || '');
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="w-full space-y-8 animate-page-in">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[30px] sm:text-[36px] font-semibold tracking-[-0.03em] text-foreground leading-none">
              {contact.first_name} {contact.last_name || ''}
            </h1>
            {contact.is_primary && (
              <Badge variant="outline" className="bg-primary/8 text-primary border-primary/20 text-[10px] font-bold uppercase tracking-wider py-0.5 px-2.5 rounded-full">Primary</Badge>
            )}
            {contact.is_general_mailbox && (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20 dark:bg-orange-500/5 dark:text-orange-400 text-[10px] font-bold uppercase tracking-wider py-0.5 px-2.5 rounded-full">General Mailbox</Badge>
            )}
          </div>
          <p className="text-[13px] text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Added on {new Date(contact.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="shrink-0">
          <ContactDetailActions contact={contact} />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Contact Details, Notes */}
        <div className="lg:col-span-2 space-y-8">
          {/* Contact Details Grid */}
          <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm">
            <h2 className="text-[16px] font-semibold text-foreground mb-4 tracking-tight flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Contact Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
              <div className="flex flex-col gap-1 p-3 rounded-[10px] bg-secondary/15 border border-border/40">
                <span className="text-muted-foreground text-[12px] font-medium flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email Address</span>
                <span className="font-semibold text-primary mt-0.5 break-all select-all">{contact.email}</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-[10px] bg-secondary/15 border border-border/40">
                <span className="text-muted-foreground text-[12px] font-medium flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone Number</span>
                <span className="font-semibold text-foreground mt-0.5">{contact.phone || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-[10px] bg-secondary/15 border border-border/40">
                <span className="text-muted-foreground text-[12px] font-medium flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Designation / Role</span>
                <span className="font-semibold text-foreground mt-0.5">{contact.designation || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-[10px] bg-secondary/15 border border-border/40">
                <span className="text-muted-foreground text-[12px] font-medium flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> LinkedIn</span>
                {contact.linkedin_url ? (
                  <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold mt-0.5 flex items-center gap-1 truncate">
                    <span>{contact.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '')}</span>
                    <Link2 className="w-3 h-3 shrink-0" />
                  </a>
                ) : <span className="font-semibold text-foreground mt-0.5">—</span>}
              </div>
            </div>
          </div>

          {/* Quick Notes Section */}
          <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-foreground tracking-tight">
                Contact Notes
              </h2>
              {savingNotes && (
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Saving...</span>
                </div>
              )}
            </div>
            
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Write detailed notes about this contact... (Changes save automatically when you click outside)"
              className="w-full min-h-[120px] text-[14px] text-foreground bg-secondary/20 hover:bg-secondary/40 focus:bg-background border border-transparent focus:border-primary/30 p-4 rounded-[12px] focus:outline-none transition-all resize-y leading-relaxed"
            />
          </div>
        </div>

        {/* Right Column: Company Info & Campaigns */}
        <div className="space-y-6">
          {/* Company Card */}
          <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm space-y-4">
            <h2 className="text-[14px] font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Company Info
            </h2>
            {contact.company ? (
              <div className="space-y-3">
                <div>
                  <Link 
                    href={`/companies/${contact.company.id}`}
                    className="text-[15px] font-semibold text-primary hover:underline flex items-center gap-1.5"
                  >
                    {contact.company.name}
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                  {contact.company.industry && (
                    <p className="text-[12px] text-muted-foreground mt-0.5">{contact.company.industry}</p>
                  )}
                </div>
                <Separator className="border-border/40" />
                <dl className="text-[12.5px] space-y-1.5">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Location</dt>
                    <dd className="font-medium text-foreground">
                      {contact.company.city ? `${contact.company.city}${contact.company.state ? `, ${contact.company.state}` : ''}` : '—'}
                    </dd>
                  </div>
                  {contact.company.website && (
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Website</dt>
                      <dd className="font-medium text-primary hover:underline truncate max-w-[150px]">
                        <a href={contact.company.website} target="_blank" rel="noreferrer">
                          {contact.company.website.replace(/^https?:\/\//, '')}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">No associated company.</p>
            )}
          </div>

          {/* Campaigns Card */}
          <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm space-y-4">
            <h2 className="text-[14px] font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              <Inbox className="w-4 h-4 text-muted-foreground" />
              Campaign Enrollments
            </h2>
            {(!campaigns || campaigns.length === 0) ? (
              <p className="text-[12.5px] text-muted-foreground py-2">Not enrolled in any campaigns.</p>
            ) : (
              <div className="space-y-3">
                {paginatedCampaigns.map((cr) => (
                  <div key={cr.id} className="p-3 border border-border/80 rounded-[10px] bg-secondary/10 flex flex-col gap-1.5">
                    {cr.campaign ? (
                      <Link 
                        href={`/campaigns/${cr.campaign.id}`}
                        className="text-[13px] font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1"
                      >
                        {cr.campaign.name}
                        <Link2 className="w-3 h-3 shrink-0 text-muted-foreground" />
                      </Link>
                    ) : (
                      <span className="text-[13px] font-medium text-foreground">—</span>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Status: <Badge variant="secondary" className="px-1 py-0 rounded-[4px] capitalize text-[10px]">{cr.status}</Badge></span>
                      <span>Enrolled {new Date(cr.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalCampaignsPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-border/60 mt-4">
                <span className="text-[12px] text-muted-foreground">
                  Page <span className="font-semibold text-foreground">{activeCampaignsPage}</span> of {totalCampaignsPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCampaignsPage(prev => Math.max(1, prev - 1))}
                    disabled={activeCampaignsPage <= 1}
                    className="w-7 h-7 rounded-[6px]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCampaignsPage(prev => Math.min(totalCampaignsPages, prev + 1))}
                    disabled={activeCampaignsPage >= totalCampaignsPages}
                    className="w-7 h-7 rounded-[6px]"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
