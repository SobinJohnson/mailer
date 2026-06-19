'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { File, UploadCloud, X, Loader2 } from 'lucide-react';
import { Attachment } from '@/types';
import { toast } from 'sonner';

interface AttachmentUploaderProps {
  onUploadSuccess: (attachment: Attachment) => void;
  accept?: string;
  maxSizeMB?: number;
}

export function AttachmentUploader({ onUploadSuccess, accept = '.pdf,.doc,.docx,.png,.jpg,.jpeg', maxSizeMB = 5 }: AttachmentUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }

    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/attachments', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let errorMsg = 'Upload failed';
        try {
          const json = await res.json();
          errorMsg = json.error || errorMsg;
        } catch {
          const text = await res.text();
          errorMsg = text || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const { data } = await res.json();
      toast.success('File uploaded successfully');
      onUploadSuccess(data);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to upload file', { description: err.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border-2 border-dashed border-border rounded-[14px] p-8 text-center bg-secondary/10 hover:bg-secondary/30 transition-colors">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept={accept}
      />
      
      {isUploading ? (
        <div className="flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-[14px] text-muted-foreground">Uploading securely...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-3">
          <UploadCloud className="w-8 h-8 text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-[14px] font-medium text-foreground">
              Drag & drop or <button type="button" className="text-primary hover:underline" onClick={() => fileInputRef.current?.click()}>browse</button>
            </p>
            <p className="text-[12px] text-muted-foreground">
              Supported files: PDF, DOCX, Images (Max {maxSizeMB}MB)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
