import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Building2, Globe, MapPin, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { CompanyDetailActions } from '@/components/companies/CompanyDetailActions';

export const dynamic = 'force-dynamic';

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: company, error } = await supabase
    .from('companies')
    .select(`
      *,
      contacts (*)
    `)
    .eq('id', id)
    .single();

  if (error || !company) {
    notFound();
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-[34px] font-semibold tracking-[-0.374px] text-foreground leading-[1.1]">{company.name}</h1>
            <Badge variant="outline" className={`font-normal rounded-full ${company.status === 'active' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border'}`}>
              {company.status}
            </Badge>
          </div>
          <p className="text-[17px] text-muted-foreground">
            Added {new Date(company.created_at).toLocaleDateString()}
          </p>
        </div>
        <CompanyDetailActions company={company} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm">
            <h2 className="text-[17px] font-semibold text-foreground mb-4">Company Details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px]">
              <div>
                <dt className="text-muted-foreground mb-1 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Industry</dt>
                <dd className="font-medium text-foreground">{company.industry || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Location</dt>
                <dd className="font-medium text-foreground">
                  {company.city ? `${company.city}${company.state ? `, ${company.state}` : ''}` : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Website</dt>
                <dd className="font-medium text-foreground">
                  {company.website ? (
                    <a href={company.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      {company.website.replace(/^https?:\/\//, '')}
                    </a>
                  ) : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> LinkedIn</dt>
                <dd className="font-medium text-foreground">
                  {company.linkedin_url ? (
                    <a href={company.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      LinkedIn Profile
                    </a>
                  ) : '—'}
                </dd>
              </div>
            </dl>

            {company.notes && (
              <>
                <Separator className="my-4" />
                <div>
                  <h3 className="text-[14px] font-medium text-foreground mb-2">Notes</h3>
                  <p className="text-[14px] text-muted-foreground whitespace-pre-wrap">{company.notes}</p>
                </div>
              </>
            )}
          </div>

          <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[17px] font-semibold text-foreground">Contacts ({company.contacts?.length || 0})</h2>
            </div>
            
            <div className="space-y-4">
              {(!company.contacts || company.contacts.length === 0) ? (
                <p className="text-[14px] text-muted-foreground text-center py-6">No contacts added yet.</p>
              ) : (
                company.contacts.map((contact: any) => (
                  <div key={contact.id} className="p-4 border border-border rounded-[11px] flex items-start justify-between">
                    <div>
                      <h4 className="text-[14px] font-semibold text-foreground">
                        {contact.first_name} {contact.last_name}
                        {contact.is_primary && (
                          <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-primary/20 text-[10px] uppercase">Primary</Badge>
                        )}
                      </h4>
                      <p className="text-[12px] text-muted-foreground mt-0.5">{contact.designation || 'No title'}</p>
                      <div className="mt-2 text-[12px] text-foreground flex flex-wrap gap-4">
                        <span className="text-primary">{contact.email}</span>
                        {contact.phone && <span>{contact.phone}</span>}
                        {contact.linkedin_url && (
                          <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            LinkedIn
                          </a>
                        )}
                      </div>
                      {contact.notes && (
                        <p className="mt-3 text-[12px] text-muted-foreground bg-secondary/30 p-2 rounded-[6px] border border-border/50">
                          {contact.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-background border border-border rounded-[18px] p-6 shadow-sm">
            <h2 className="text-[14px] font-semibold text-foreground mb-3">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {(!company.tags || company.tags.length === 0) ? (
                <p className="text-[12px] text-muted-foreground">No tags</p>
              ) : (
                company.tags.map((tag: string) => (
                  <Badge key={tag} variant="secondary" className="font-normal">
                    {tag}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
