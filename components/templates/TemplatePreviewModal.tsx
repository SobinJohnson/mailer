'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Monitor, Smartphone, RefreshCw } from 'lucide-react';

interface TemplatePreviewModalProps {
  template: {
    name: string;
    subject: string;
    body_html: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export function TemplatePreviewModal({ template, isOpen, onClose }: TemplatePreviewModalProps) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [variables, setVariables] = useState<Record<string, string>>({});
  
  // Extract variables from subject and body
  const extractVariables = (text: string) => {
    if (!text) return [];
    const regex = /\{\{(\w+)\}\}/g;
    const matches = Array.from(text.matchAll(regex));
    return Array.from(new Set(matches.map(m => m[1])));
  };

  const allVars = Array.from(
    new Set([
      ...extractVariables(template.subject),
      ...extractVariables(template.body_html),
    ])
  );

  // Initialize variable values with default mock data
  const defaultMockValues: Record<string, string> = {
    first_name: 'Sarah',
    last_name: 'Conner',
    company_name: 'Cyberdyne Systems',
    designation: 'CTO',
    sender_name: 'John Miller',
    signature: '<p>Best regards,<br><b>John Miller</b><br>Sales Director | Mailer CRM</p>',
  };

  useEffect(() => {
    if (isOpen) {
      const initialVals: Record<string, string> = {};
      allVars.forEach(v => {
        initialVals[v] = defaultMockValues[v] || `[${v}]`;
      });
      setVariables(initialVals);
    }
  }, [isOpen, template]);

  const handleVarChange = (name: string, val: string) => {
    setVariables(prev => ({ ...prev, [name]: val }));
  };

  const interpolate = (content: string) => {
    if (!content) return '';
    let interpolated = content;
    Object.entries(variables).forEach(([k, v]) => {
      // Escape special regex chars in key
      const escapedKey = k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g');
      interpolated = interpolated.replace(regex, v);
    });
    return interpolated;
  };

  const resetMockData = () => {
    const resetVals: Record<string, string> = {};
    allVars.forEach(v => {
      resetVals[v] = defaultMockValues[v] || `[${v}]`;
    });
    setVariables(resetVals);
  };

  const renderedSubject = interpolate(template.subject);
  const renderedBody = interpolate(template.body_html);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl rounded-[18px] h-[90vh] md:h-[80vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="px-6 py-4 border-b border-border flex flex-row items-center justify-between shrink-0">
          <div>
            <DialogTitle className="text-[18px] font-semibold text-foreground flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              Preview Template: {template.name || 'Untitled'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Variables configuration panel */}
          <div className="w-full md:w-85 border-b md:border-b-0 md:border-r border-border p-5 overflow-y-auto shrink-0 bg-secondary/10 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Test Variables</h4>
              {allVars.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-[11px] text-primary px-2 hover:bg-primary/5 flex items-center gap-1"
                  onClick={resetMockData}
                >
                  <RefreshCw className="w-3 h-3" /> Reset
                </Button>
              )}
            </div>

            {allVars.length === 0 ? (
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                This template has no dynamic variables (e.g. <code>{"{{first_name}}"}</code>). Add variables in the template editor to customize content.
              </p>
            ) : (
              <div className="space-y-4">
                {allVars.map(v => (
                  <div key={v} className="space-y-1.5">
                    <label className="text-[12px] font-medium text-foreground flex items-center gap-1">
                      <code className="text-[10px] font-mono bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-[4px]">
                        {v}
                      </code>
                    </label>
                    <Input 
                      value={variables[v] || ''}
                      onChange={(e) => handleVarChange(v, e.target.value)}
                      className="h-9 rounded-[8px] border-border text-[13px] bg-background"
                      placeholder={`Enter test ${v}...`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Render Preview Frame */}
          <div className="flex-1 flex flex-col bg-secondary/5 overflow-hidden">
            {/* Toolbar */}
            <div className="px-6 py-2.5 border-b border-border bg-background flex items-center justify-between shrink-0">
              <span className="text-[12px] font-medium text-muted-foreground">EMAIL CLIENT SIMULATOR</span>
              
              <div className="flex items-center gap-1 bg-secondary/50 rounded-[8px] p-0.5 border border-border">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`h-7 px-2.5 text-[11px] rounded-[6px] transition-all ${device === 'desktop' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                  onClick={() => setDevice('desktop')}
                >
                  <Monitor className="w-3.5 h-3.5 mr-1.5" /> Desktop
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`h-7 px-2.5 text-[11px] rounded-[6px] transition-all ${device === 'mobile' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                  onClick={() => setDevice('mobile')}
                >
                  <Smartphone className="w-3.5 h-3.5 mr-1.5" /> Mobile
                </Button>
              </div>
            </div>

            {/* Email client window */}
            <div className="flex-1 p-6 overflow-y-auto flex items-start justify-center min-h-0">
              <div className={`w-full bg-background border border-border rounded-[12px] shadow-sm overflow-hidden flex flex-col transition-all duration-200 ${device === 'mobile' ? 'max-w-[375px] h-[600px]' : 'max-w-3xl'}`}>
                {/* Email Header */}
                <div className="px-5 py-4 border-b border-border/80 bg-secondary/5 space-y-1.5 text-[13px]">
                  <div className="flex gap-2">
                    <span className="font-semibold text-muted-foreground w-12 shrink-0">From:</span>
                    <span className="text-foreground">sender@example.com</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-muted-foreground w-12 shrink-0">To:</span>
                    <span className="text-foreground">recipient@example.com</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold text-muted-foreground w-12 shrink-0">Subject:</span>
                    <span className="text-foreground font-medium">{renderedSubject || '(No Subject)'}</span>
                  </div>
                </div>

                {/* Email Body */}
                <div className="flex-1 p-6 overflow-y-auto select-text">
                  <div 
                    className="prose prose-slate max-w-none text-[15px] leading-relaxed break-words"
                    dangerouslySetInnerHTML={{ __html: renderedBody }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
