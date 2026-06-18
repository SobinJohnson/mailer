'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import { Company } from '@/types';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface CompanyDetailActionsProps {
  company: Company;
}

export function CompanyDetailActions({ company }: CompanyDetailActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this company? All associated contacts and data will be removed.')) return;
    
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/companies/${company.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete company');
      router.push('/companies');
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Failed to delete company');
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link 
        href={`/companies/${company.id}/edit`}
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
