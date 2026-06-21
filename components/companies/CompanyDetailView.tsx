'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, MapPin, Briefcase, Plus, Save, Loader2, Link2, Mail, Phone, Calendar, Building2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CompanyDetailActions } from './CompanyDetailActions';
import { toast } from 'sonner';
import Link from 'next/link';
import { Company as DbCompany, Contact as DbContact } from '@/types';

export interface ExtendedCompany extends DbCompany {
  contacts: DbContact[];
}

interface CompanyDetailViewProps {
  initialCompany: ExtendedCompany;
}

export function CompanyDetailView({ initialCompany }: CompanyDetailViewProps) {
  const router = useRouter();
  const [company, setCompany] = useState<ExtendedCompany>(initialCompany);
  const [companyNotes, setCompanyNotes] = useState(initialCompany.notes || '');
  const [savingCompanyNotes, setSavingCompanyNotes] = useState(false);
  
  // Track notes state for each contact individually
  const [contactNotes, setContactNotes] = useState<Record<string, string>>(
    (initialCompany.contacts || []).reduce((acc, c) => {
      acc[c.id] = c.notes || '';
      return acc;
    }, {} as Record<string, string>)
  );
  
  const [savingContactId, setSavingContactId] = useState<string | null>(null);

  const [contactsPage, setContactsPage] = useState(1);
  const CONTACTS_PAGE_SIZE = 5;
  const totalContactsPages = Math.ceil((company.contacts || []).length / CONTACTS_PAGE_SIZE);
  const activeContactsPage = Math.min(contactsPage, Math.max(1, totalContactsPages));
  
  const paginatedContacts = (company.contacts || []).slice(
    (activeContactsPage - 1) * CONTACTS_PAGE_SIZE,
    activeContactsPage * CONTACTS_PAGE_SIZE
  );

  const handleCompanyNotesBlur = async () => {
    if (companyNotes === (company.notes || '')) return;
    
    setSavingCompanyNotes(true);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: companyNotes }),
      });
      if (!res.ok) throw new Error('Failed to update company notes');
      const data = await res.json();
      setCompany(prev => ({ ...prev, notes: companyNotes }));
      toast.success('Company notes saved');
    } catch (err: any) {
      toast.error('Failed to save company notes', { description: err.message });
      setCompanyNotes(company.notes || '');
    } finally {
      setSavingCompanyNotes(false);
    }
  };

  const handleContactNotesBlur = async (contactId: string) => {
    const currentNotes = contactNotes[contactId] || '';
    const initialNotes = (company.contacts || []).find(c => c.id === contactId)?.notes || '';
    if (currentNotes === initialNotes) return;
    
    setSavingContactId(contactId);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: currentNotes }),
      });
      if (!res.ok) throw new Error('Failed to update contact notes');
      
      setCompany(prev => ({
        ...prev,
        contacts: (prev.contacts || []).map(c => 
          c.id === contactId ? { ...c, notes: currentNotes } : c
        )
      }));
      toast.success('Contact notes saved');
    } catch (err: any) {
      toast.error('Failed to save contact notes', { description: err.message });
      // Reset
      setContactNotes(prev => ({
        ...prev,
        [contactId]: initialNotes
      }));
    } finally {
      setSavingContactId(null);
    }
  };

  return (
    <div className="w-full space-y-8 animate-page-in">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[30px] sm:text-[36px] font-semibold tracking-[-0.03em] text-foreground leading-none">{company.name}</h1>
            <Badge variant="outline" className={`font-normal rounded-full capitalize py-0.5 px-2.5 text-[11px] ${
              company.status === 'active' 
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-400' 
                : 'bg-muted text-muted-foreground border-border'
            }`}>
              {company.status.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-[13px] text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Added on {new Date(company.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="shrink-0">
          <CompanyDetailActions company={company} />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left / Wider column: Details, Notes & Contacts */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Company Details Grid */}
          <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm">
            <h2 className="text-[16px] font-semibold text-foreground mb-4 tracking-tight flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              Company Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-[14px]">
              <div className="flex flex-col gap-1 p-3 rounded-[10px] bg-secondary/15 border border-border/40">
                <span className="text-muted-foreground text-[12px] font-medium flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Industry</span>
                <span className="font-semibold text-foreground mt-0.5">{company.industry || '—'}</span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-[10px] bg-secondary/15 border border-border/40">
                <span className="text-muted-foreground text-[12px] font-medium flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</span>
                <span className="font-semibold text-foreground mt-0.5">
                  {company.city ? `${company.city}${company.state ? `, ${company.state}` : ''}` : '—'}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-[10px] bg-secondary/15 border border-border/40">
                <span className="text-muted-foreground text-[12px] font-medium flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Website</span>
                {company.website ? (
                  <a href={company.website} target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold mt-0.5 truncate flex items-center gap-1">
                    {company.website.replace(/^https?:\/\//, '')}
                    <Link2 className="w-3 h-3 shrink-0" />
                  </a>
                ) : <span className="font-semibold text-foreground mt-0.5">—</span>}
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-[10px] bg-secondary/15 border border-border/40">
                <span className="text-muted-foreground text-[12px] font-medium flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> LinkedIn</span>
                {company.linkedin_url ? (
                  <a href={company.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline font-semibold mt-0.5 flex items-center gap-1">
                    LinkedIn Profile
                    <Link2 className="w-3 h-3 shrink-0" />
                  </a>
                ) : <span className="font-semibold text-foreground mt-0.5">—</span>}
              </div>
            </div>
          </div>

          {/* Quick Notes Section */}
          <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-foreground tracking-tight flex items-center gap-2">
                Company Notes
              </h2>
              {savingCompanyNotes && (
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground animate-pulse">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Saving...</span>
                </div>
              )}
            </div>
            
            <textarea
              value={companyNotes}
              onChange={(e) => setCompanyNotes(e.target.value)}
              onBlur={handleCompanyNotesBlur}
              placeholder="Write detailed notes about this company... (Changes save automatically when you click outside)"
              className="w-full min-h-[120px] text-[14px] text-foreground bg-secondary/20 hover:bg-secondary/40 focus:bg-background border border-transparent focus:border-primary/30 p-4 rounded-[12px] focus:outline-none transition-all resize-y leading-relaxed"
            />
          </div>

          {/* Contacts Section */}
          <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="text-[17px] font-semibold text-foreground tracking-tight">Contacts ({company.contacts?.length || 0})</h2>
              <Link href={`/contacts/new?companyId=${company.id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
                <Plus className="w-3.5 h-3.5" />
                Add Contact
              </Link>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              {(!company.contacts || company.contacts.length === 0) ? (
                <p className="text-[14px] text-muted-foreground text-center py-8">No contacts added yet.</p>
              ) : (
                paginatedContacts.map((contact) => (
                  <div key={contact.id} className="p-5 border border-border rounded-[14px] bg-secondary/10 hover:bg-secondary/15 transition-all flex flex-col md:flex-row gap-5">
                    
                    {/* Contact Info (Left) */}
                    <div className="flex-1 space-y-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-[15px] font-semibold text-foreground">
                            {contact.first_name} {contact.last_name || ''}
                          </h4>
                          {contact.is_primary && (
                            <Badge variant="outline" className="bg-primary/8 text-primary border-primary/20 text-[9px] font-bold uppercase tracking-wider py-0 px-1.5 rounded-[4px]">Primary</Badge>
                          )}
                        </div>
                        <p className="text-[12.5px] text-muted-foreground mt-0.5 font-medium">{contact.designation || 'No title'}</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12.5px] border-t border-border/40 pt-2">
                        <div className="flex items-center gap-2 text-muted-foreground truncate">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                          <span className="text-primary truncate">{contact.email}</span>
                        </div>
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                        {contact.linkedin_url && (
                          <div className="col-span-1 sm:col-span-2 flex items-center gap-2 text-muted-foreground">
                            <Globe className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                            <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
                              {contact.linkedin_url.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, '')}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Contact Notes Editor (Right) */}
                    <div className="flex-1 flex flex-col gap-2 min-w-0 md:border-l md:border-border/60 md:pl-5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11.5px] font-semibold text-muted-foreground uppercase tracking-wider">Contact Notes</span>
                        {savingContactId === contact.id && (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground animate-pulse">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            <span>Saving...</span>
                          </div>
                        )}
                      </div>
                      <textarea
                        value={contactNotes[contact.id] ?? ''}
                        onChange={(e) => setContactNotes(prev => ({ ...prev, [contact.id]: e.target.value }))}
                        onBlur={() => handleContactNotesBlur(contact.id)}
                        placeholder={`Write notes about ${contact.first_name}...`}
                        className="w-full text-[13px] bg-background hover:bg-secondary/40 focus:bg-background border border-border/80 focus:border-primary/30 p-2.5 rounded-[8px] focus:outline-none transition-all resize-y min-h-[70px] leading-relaxed"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {totalContactsPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-border/60 mt-4">
                <span className="text-[12px] text-muted-foreground">
                  Page <span className="font-semibold text-foreground">{activeContactsPage}</span> of {totalContactsPages}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setContactsPage(prev => Math.max(1, prev - 1))}
                    disabled={activeContactsPage <= 1}
                    className="w-7 h-7 rounded-[6px]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setContactsPage(prev => Math.min(totalContactsPages, prev + 1))}
                    disabled={activeContactsPage >= totalContactsPages}
                    className="w-7 h-7 rounded-[6px]"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right / Narrow Column: Metadata & Tags */}
        <div className="space-y-6">
          <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm space-y-4">
            <h2 className="text-[14px] font-semibold text-foreground tracking-tight">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {(!company.tags || company.tags.length === 0) ? (
                <p className="text-[12px] text-muted-foreground">No tags configured.</p>
              ) : (
                company.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="font-normal rounded-full py-0.5 px-2.5 text-[11px]">
                    {tag}
                  </Badge>
                ))
              )}
            </div>
          </div>

          <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm space-y-4">
            <h2 className="text-[14px] font-semibold text-foreground tracking-tight">Quick Information</h2>
            <dl className="text-[12.5px] space-y-2">
              <div className="flex justify-between py-1 border-b border-border/40">
                <dt className="text-muted-foreground">Company Status</dt>
                <dd className="font-semibold text-foreground capitalize">{company.status.replace('_', ' ')}</dd>
              </div>
              <div className="flex justify-between py-1 border-b border-border/40">
                <dt className="text-muted-foreground">Total Contacts</dt>
                <dd className="font-semibold text-foreground">{company.contacts?.length || 0}</dd>
              </div>
              <div className="flex justify-between py-1">
                <dt className="text-muted-foreground">Unique ID</dt>
                <dd className="font-mono text-[10px] text-muted-foreground select-all">{company.id.slice(0, 8)}...</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
