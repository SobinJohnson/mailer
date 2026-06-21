'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Check, Loader2, Server, ServerCrash } from 'lucide-react';
import { SmtpConfig } from '@/types';
import { toast } from 'sonner';

interface SmtpConfigFormProps {
  configs: SmtpConfig[];
}

export function SmtpConfigForm({ configs }: SmtpConfigFormProps) {
  const router = useRouter();
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [formData, setFormData] = useState({
    label: '',
    host: 'smtp.hostinger.com',
    port: 465,
    secure: true,
    username: '',
    password: '',
    from_email: '',
    from_name: '',
    imap_host: '',
    imap_port: 993,
    imap_secure: true,
    imap_username: '',
    imap_password: '',
    is_default: configs.length === 0,
    signature_html: '',
  });

  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEdit = (config: SmtpConfig) => {
    setEditingId(config.id);
    setFormData({
      label: config.label,
      host: config.host,
      port: config.port,
      secure: config.secure,
      username: config.username,
      password: '', // require re-entry or placeholder
      from_email: config.from_email,
      from_name: config.from_name || '',
      imap_host: config.imap_host || '',
      imap_port: config.imap_port || 993,
      imap_secure: config.imap_secure ?? true,
      imap_username: config.imap_username || '',
      imap_password: '',
      is_default: config.is_default,
      signature_html: config.signature_html || '',
    });
    setTestResult(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this server?')) return;
    try {
      const res = await fetch(`/api/smtp/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Connection deleted successfully');
      router.refresh();
      if (editingId === id) cancelEdit();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to delete configuration', { description: err.message });
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      label: '',
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      username: '',
      password: '',
      from_email: '',
      from_name: '',
      imap_host: '',
      imap_port: 993,
      imap_secure: true,
      imap_username: '',
      imap_password: '',
      is_default: configs.length === 0,
      signature_html: '',
    });
    setTestResult(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId || undefined,
          host: formData.host,
          port: Number(formData.port),
          secure: formData.secure,
          username: formData.username,
          password: formData.password || undefined,
          from_email: formData.from_email || formData.username,
          from_name: formData.from_name || 'CRM Test',
        }),
      });
      const data = await res.json();
      setTestResult({ success: data.success, message: data.success ? 'Connection successful!' : data.error });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const endpoint = editingId ? `/api/smtp/${editingId}` : '/api/smtp';
      const method = editingId ? 'PUT' : 'POST';
      
      // If editing and password is empty, don't send password
      const payload: any = {
        ...formData,
        port: Number(formData.port),
      };
      if (editingId && !formData.password) {
        delete payload.password;
      }

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        let errMsg = 'Failed to save config';
        try {
          const errData = await res.json();
          errMsg = errData.error || JSON.stringify(errData);
        } catch {}
        throw new Error(errMsg);
      }
      
      toast.success('Connection saved successfully');
      cancelEdit();
      router.refresh();
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to save configuration', { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
      {/* Form Side */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-foreground">{editingId ? 'Edit SMTP Server' : 'Add SMTP Server'}</h2>
            <p className="text-[14px] text-muted-foreground mt-1">Configure your mailer settings (e.g., Hostinger).</p>
          </div>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={cancelEdit} className="text-[13px]">
              Cancel Edit
            </Button>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Label</Label>
              <Input 
                value={formData.label} 
                onChange={(e) => setFormData({...formData, label: e.target.value})} 
                placeholder="Sales Mailer 1" 
                className="h-10 rounded-[8px] text-[14px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Host</Label>
              <Input 
                value={formData.host} 
                onChange={(e) => setFormData({...formData, host: e.target.value})} 
                className="h-10 rounded-[8px] text-[14px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">Username (Email)</Label>
              <Input 
                value={formData.username} 
                onChange={(e) => setFormData({...formData, username: e.target.value})} 
                className="h-10 rounded-[8px] text-[14px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">{editingId ? 'Password (leave blank to keep)' : 'Password / App Password'}</Label>
              <Input 
                type="password" 
                value={formData.password} 
                onChange={(e) => setFormData({...formData, password: e.target.value})} 
                className="h-10 rounded-[8px] text-[14px]"
                placeholder={editingId ? '••••••••' : ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">From Email</Label>
              <Input 
                value={formData.from_email} 
                onChange={(e) => setFormData({...formData, from_email: e.target.value})} 
                placeholder="info@koldpwr.com" 
                className="h-10 rounded-[8px] text-[14px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] text-muted-foreground">From Name</Label>
              <Input 
                value={formData.from_name} 
                onChange={(e) => setFormData({...formData, from_name: e.target.value})} 
                placeholder="John Doe" 
                className="h-10 rounded-[8px] text-[14px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="space-y-2 col-span-2 sm:col-span-1">
              <Label className="text-[13px] text-muted-foreground">Port</Label>
              <Input 
                type="number"
                value={formData.port} 
                onChange={(e) => setFormData({...formData, port: Number(e.target.value)})} 
                className="h-10 rounded-[8px] text-[14px]"
              />
            </div>
            <div className="flex flex-col justify-center gap-2 mt-2">
              <Label className="text-[13px] text-muted-foreground">Use SSL/TLS</Label>
              <Switch 
                checked={formData.secure} 
                onCheckedChange={(checked) => setFormData({...formData, secure: checked})}
              />
            </div>
            <div className="flex flex-col justify-center gap-2 mt-2">
              <Label className="text-[13px] text-muted-foreground">Set Default</Label>
              <Switch 
                checked={formData.is_default} 
                onCheckedChange={(checked) => setFormData({...formData, is_default: checked})}
              />
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label className="text-[13px] text-muted-foreground">HTML Signature (Optional)</Label>
            <textarea 
              value={formData.signature_html} 
              onChange={(e) => setFormData({...formData, signature_html: e.target.value})} 
              placeholder="<p><strong>Sales | KOLDPWR</strong><br>ESD Packaging & Handling</p>" 
              className="w-full min-h-[100px] rounded-[8px] text-[14px] bg-background border border-input p-3 focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-background resize-y"
            />
            <p className="text-[12px] text-muted-foreground">Use {'{{signature}}'} in your templates to inject this HTML.</p>
            
            {/* Signature Preview */}
            <div className="mt-3 space-y-1.5">
              <Label className="text-[12px] text-muted-foreground">Signature Preview</Label>
              <div 
                className="p-4 border border-border rounded-[8px] bg-secondary/10 min-h-[60px] text-[14px] text-foreground overflow-auto"
                dangerouslySetInnerHTML={{ 
                  __html: formData.signature_html || '<p class="text-muted-foreground italic text-[13px]">No signature content. Preview will show up here...</p>' 
                }}
              />
            </div>
          </div>

          {testResult && (
            <div className={`p-3 rounded-[8px] text-[13px] flex items-center gap-2 ${testResult.success ? 'bg-green-500/10 text-green-700' : 'bg-red-500/10 text-red-700'}`}>
              {testResult.success ? <Check className="w-4 h-4" /> : <ServerCrash className="w-4 h-4" />}
              {testResult.message}
            </div>
          )}

          <div className="pt-6 border-t border-border mt-6">
            <h3 className="text-[14px] font-semibold text-foreground mb-4">IMAP Settings (Optional for Reply Tracking)</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[13px] text-muted-foreground">IMAP Host</Label>
                  <Input 
                    value={formData.imap_host || ''} 
                    onChange={(e) => setFormData({...formData, imap_host: e.target.value})} 
                    placeholder="imap.hostinger.com" 
                    className="h-10 rounded-[8px] text-[14px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] text-muted-foreground">IMAP Port</Label>
                  <Input 
                    type="number"
                    value={formData.imap_port || 993} 
                    onChange={(e) => setFormData({...formData, imap_port: Number(e.target.value)})} 
                    className="h-10 rounded-[8px] text-[14px]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[13px] text-muted-foreground">IMAP Username</Label>
                  <Input 
                    value={formData.imap_username || ''} 
                    onChange={(e) => setFormData({...formData, imap_username: e.target.value})} 
                    className="h-10 rounded-[8px] text-[14px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[13px] text-muted-foreground">{editingId ? 'IMAP Password (leave blank to keep)' : 'IMAP Password'}</Label>
                  <Input 
                    type="password" 
                    value={formData.imap_password || ''} 
                    onChange={(e) => setFormData({...formData, imap_password: e.target.value})} 
                    className="h-10 rounded-[8px] text-[14px]"
                    placeholder={editingId ? '••••••••' : ''}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={handleTest} 
              disabled={isTesting || !formData.host || !formData.username || (!editingId && !formData.password)}
              className="flex-1 rounded-[8px] h-12 sm:h-10 text-[14px]"
            >
              {isTesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
              Test Connection
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !formData.label || (!editingId && !testResult?.success)}
              className="flex-1 rounded-[8px] h-12 sm:h-10 bg-primary hover:bg-primary-focus text-primary-foreground text-[14px]"
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              {editingId ? 'Update Configuration' : 'Save Configuration'}
            </Button>
          </div>
        </div>
      </div>

      {/* List Side */}
      <div className="space-y-6">
        <div>
          <h2 className="text-[17px] font-semibold text-foreground">Saved Servers</h2>
          <p className="text-[14px] text-muted-foreground mt-1">Your available outbound SMTP connections.</p>
        </div>

        <div className="space-y-3">
          {configs.length === 0 ? (
            <div className="p-8 text-center border border-border rounded-[18px] bg-secondary/30 text-muted-foreground text-[14px]">
              No servers configured yet.
            </div>
          ) : (
            configs.map(config => (
              <div key={config.id} className={`p-4 border ${editingId === config.id ? 'border-primary shadow-md' : 'border-border'} rounded-[14px] bg-background shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all`}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-[14px] text-foreground truncate">{config.label}</h3>
                    {config.is_default && (
                      <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide">Default</span>
                    )}
                  </div>
                  <p className="text-[13px] text-muted-foreground truncate">{config.from_email} ({config.host}:{config.port})</p>
                </div>
                <div className="flex gap-2 shrink-0 self-end sm:self-auto">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(config)} className="h-7 text-[12px] px-2">
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(config.id)} className="h-7 text-[12px] px-2 text-destructive border-destructive/20 hover:bg-destructive/10">
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
