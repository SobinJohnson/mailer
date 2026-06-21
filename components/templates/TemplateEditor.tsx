'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Save, Sparkles, PenTool, Image as ImageIcon, Eye } from 'lucide-react';
import { EmailTemplate } from '@/types';
import Link from 'next/link';
import { toast } from 'sonner';
import { TemplatePreviewModal } from './TemplatePreviewModal';

interface TemplateEditorProps {
  template: EmailTemplate;
  isNew?: boolean;
}

export function TemplateEditor({ template, isNew = false }: TemplateEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [subject, setSubject] = useState(template.subject);
  const [category, setCategory] = useState(template.category || '');
  const [attachments, setAttachments] = useState<any[]>(template.attachments || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Write your email template here...',
      }),
    ],
    content: template.body_html,
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[400px] text-[17px] leading-[1.6]',
      },
    },
  });

  const availableVariables = ['first_name', 'last_name', 'company_name', 'designation', 'sender_name', 'signature'];

  const insertVariable = (variable: string) => {
    if (editor) {
      editor.chain().focus().insertContent(`{{${variable}}}`).run();
    }
  };

  const extractVariables = (html: string) => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = Array.from(html.matchAll(regex));
    return Array.from(new Set(matches.map(m => m[1])));
  };

  const handleSave = async () => {
    if (!editor) return;
    setIsSaving(true);
    
    const html = editor.getHTML();
    const text = editor.getText();
    const variables = extractVariables(html);

    const payload = {
      name,
      subject,
      body_html: html,
      body_text: text,
      category: category || null,
      variables,
      attachments,
    };

    try {
      const url = isNew ? '/api/templates' : `/api/templates/${template.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save');
      
      const { data } = await res.json();
      toast.success('Template saved successfully');
      if (isNew) {
        router.push(`/templates/${data.id}`);
      } else {
        router.refresh();
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Failed to save template', { description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
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

      const data = await res.json();

      // Add to attachments
      setAttachments(prev => [...prev, {
        filename: data.filename,
        path: data.url, // Nodemailer uses 'path' for URLs
        storage_path: data.storagePath,
        storagePath: data.storagePath
      }]);
    } catch (err: any) {
      toast.error('Upload failed', { description: err.message });
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 bg-background/80 backdrop-blur-md py-4 z-10 border-b border-border">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Link href="/templates" className="shrink-0">
            <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 hover:bg-secondary">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </Button>
          </Link>
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.374px] border-none shadow-none px-0 focus-visible:ring-0 flex-1 sm:w-[400px] text-foreground bg-transparent"
            placeholder="Template Name"
          />
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto justify-end">
          {!isNew && (
            <Button 
              onClick={async () => {
                if (!confirm('Are you sure you want to delete this template?')) return;
                try {
                  const res = await fetch(`/api/templates/${template.id}`, { method: 'DELETE' });
                  if (!res.ok) throw new Error('Failed to delete');
                  router.push('/templates');
                  router.refresh();
                } catch (err: any) {
                  console.error(err);
                  toast.error('Failed to delete template', { description: err.message });
                }
              }}
              variant="outline" 
              size="sm" 
              className="rounded-full h-10 px-4 sm:px-5 text-[13px] sm:text-[14px] text-destructive border-destructive/20 hover:bg-destructive/10"
            >
              Delete
            </Button>
          )}
          <Button 
            onClick={() => setIsPreviewOpen(true)}
            variant="outline" 
            size="sm" 
            className="rounded-full h-10 px-4 sm:px-5 text-[13px] sm:text-[14px]"
          >
            <Eye className="w-4 h-4 mr-2 text-muted-foreground" />
            Preview
          </Button>
          <Button variant="outline" size="sm" className="rounded-full h-10 px-4 sm:px-5 text-[13px] sm:text-[14px]">
            <Sparkles className="w-4 h-4 mr-2 text-primary" />
            AI Rewrite
          </Button>
          <Button onClick={handleSave} disabled={isSaving} size="sm" className="rounded-full h-10 px-5 sm:px-6 bg-foreground hover:bg-foreground/90 text-background text-[13px] sm:text-[14px]">
            {isSaving ? 'Saving...' : 'Save Template'}
            <Save className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Editor Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="space-y-2">
            <label className="text-[14px] font-medium text-muted-foreground ml-1">Subject Line</label>
            <Input 
              value={subject} 
              onChange={(e) => setSubject(e.target.value)}
              className="text-[17px] h-14 rounded-[14px] border-border shadow-sm focus-visible:ring-1 focus-visible:ring-primary px-4 bg-background"
              placeholder="e.g., Quick question about {{company_name}}"
            />
          </div>

          <div className="border border-border rounded-[18px] bg-background shadow-sm overflow-hidden flex flex-col">
            {/* Editor Toolbar (Minimal) */}
            <div className="flex items-center gap-2 p-3 border-b border-border bg-secondary/20">
              <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground" onClick={() => editor?.chain().focus().toggleBold().run()}>
                Bold
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground" onClick={() => editor?.chain().focus().toggleItalic().run()}>
                Italic
              </Button>
              <div className="w-[1px] h-4 bg-border mx-2" />
              <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
                <ImageIcon className="w-4 h-4 mr-2" /> Image
              </Button>
            </div>
            
            {/* Tiptap Editor */}
            <div className="p-6 md:p-8">
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="p-6 rounded-[18px] bg-secondary/30 border border-border/50">
            <h3 className="text-[14px] font-semibold text-foreground flex items-center mb-4">
              <PenTool className="w-4 h-4 mr-2" /> Variables
            </h3>
            <p className="text-[13px] text-muted-foreground mb-4 leading-relaxed">
              Click a variable to insert it at your cursor. These will be replaced automatically when sending.
            </p>
            <div className="flex flex-wrap gap-2">
              {availableVariables.map(v => (
                <Badge 
                  key={v} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors font-mono text-[11px] py-1"
                  onClick={() => insertVariable(v)}
                >
                  {'{'}{'{'}{v}{'}'}{'}'}
                </Badge>
              ))}
            </div>
          </div>

          <div className="p-6 rounded-[18px] border border-border/50">
            <h3 className="text-[14px] font-semibold text-foreground mb-4">Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[13px] text-muted-foreground mb-2 block">Category</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-10 rounded-[8px] border border-border bg-background text-[14px] px-3 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">None</option>
                  <option value="intro">Introduction</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="product">Product Update</option>
                  <option value="event">Event Invite</option>
                </select>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-[18px] border border-border/50">
            <h3 className="text-[14px] font-semibold text-foreground mb-4 flex items-center">
              Attachments
            </h3>
            <div className="space-y-4">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-[8px] bg-secondary/30 border border-border text-[13px]">
                  <span className="truncate max-w-[150px]">{att.filename}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-destructive hover:bg-destructive/10" onClick={() => removeAttachment(i)}>
                    Remove
                  </Button>
                </div>
              ))}
              
              <div className="relative">
                <input 
                  type="file" 
                  onChange={handleFileUpload} 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isUploading}
                />
                <Button variant="outline" className="w-full h-10 border-dashed text-[13px]" disabled={isUploading}>
                  {isUploading ? 'Uploading...' : '+ Add Attachment'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                PDFs, Images, Documents (Max 10MB)
              </p>
            </div>
          </div>
        </div>
      </div>

      <TemplatePreviewModal
        template={{
          name: name,
          subject: subject,
          body_html: editor ? editor.getHTML() : template.body_html,
        }}
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  );
}
