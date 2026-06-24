'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { Button } from '@/components/ui/button';
import { X, Upload, Download, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ContactImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function ContactImportModal({ open, onClose }: ContactImportModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const downloadTemplate = () => {
    const templateData = [
      {
        company_name: 'Acme Corp',
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@acme.com',
        designation: 'CEO',
        phone: '+15550000',
        linkedin_url: 'https://linkedin.com/in/janesmith',
        is_primary: 'true',
        notes: 'Met at conference',
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "contact_import_template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error('The uploaded file is empty.');
      }

      const res = await fetch('/api/contacts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts: jsonData }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Failed to import contacts');
      }

      setSuccess(`Successfully imported ${result.inserted} contacts!`);
      setTimeout(() => {
        onClose();
        mutate('/api/contacts');
        router.refresh();
      }, 2000);

    } catch (err: any) {
      setError(err.message || 'An error occurred while importing');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-foreground/10 backdrop-blur-[2px] z-40 animate-fade-in" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[500px] bg-background border border-border shadow-xl rounded-[16px] z-50 animate-scale-in flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 text-foreground">
            <FileSpreadsheet className="w-5 h-5" />
            <h2 className="text-[16px] font-semibold tracking-tight">Import Contacts</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-[6px] text-muted-foreground hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6">
          <div className="space-y-3">
            <h3 className="text-[14px] font-medium text-foreground">Format Rules & Guidelines</h3>
            <ul className="text-[13px] text-muted-foreground space-y-2 list-disc pl-4">
              <li><strong>Required columns:</strong> <code className="bg-secondary/50 px-1 py-0.5 rounded text-foreground">company_name</code>, <code className="bg-secondary/50 px-1 py-0.5 rounded text-foreground">first_name</code>, <code className="bg-secondary/50 px-1 py-0.5 rounded text-foreground">email</code></li>
              <li><strong>Optional columns:</strong> last_name, designation, phone, linkedin_url, is_primary, notes.</li>
              <li><strong>Important:</strong> Ensure <code className="bg-secondary/50 px-1 py-0.5 rounded">company_name</code> matches an existing company in your CRM exactly, otherwise the row will be skipped.</li>
            </ul>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="mt-2 h-8 text-[12px]">
              <Download className="w-3.5 h-3.5 mr-1.5" /> Download Template .xlsx
            </Button>
          </div>

          <div className="border-t border-border pt-6">
            {error && (
              <div className="mb-4 p-3 rounded-[8px] bg-destructive/10 text-destructive border border-destructive/20 text-[13px] flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-3 rounded-[8px] bg-green-500/10 text-green-700 border border-green-500/20 text-[13px] flex gap-2 items-center">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <p>{success}</p>
              </div>
            )}

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !!success}
              className="w-full h-11 rounded-[8px] bg-foreground hover:bg-foreground/90 text-background text-[14px]"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              {loading ? 'Importing Data...' : 'Select Excel/CSV File to Import'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
