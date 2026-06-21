'use client';

import { toast } from 'sonner';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { Contact } from '@/types';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface ContactDetailActionsProps {
  contact: Contact;
}

export function ContactDetailActions({ contact }: ContactDetailActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete contact');
      }
      toast.success('Contact deleted successfully');
      router.push('/contacts');
      router.refresh();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to delete contact', { description: err.message });
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link 
        href={`/contacts/${contact.id}/edit`}
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          "h-8 px-3 rounded-[6px] text-[13px] flex items-center"
        )}
      >
        <Pencil className="w-3.5 h-3.5 mr-1.5" />
        Edit
      </Link>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleDelete}
        disabled={isDeleting}
        className="h-8 px-3 rounded-[6px] text-[13px] text-destructive border-destructive/20 hover:bg-destructive/10"
      >
        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
        Delete
      </Button>
    </div>
  );
}
