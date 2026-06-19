'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Cloud, Server, Download, CheckCircle2, XCircle, Loader2, ArrowRight, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

type Mode = 'choose' | 'supabase' | 'selfhosted';
type TestStatus = 'idle' | 'testing' | 'success' | 'error';

export default function SetupPage() {
  const [mode, setMode] = useState<Mode>('choose');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [supabaseServiceKey, setSupabaseServiceKey] = useState('');
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [generatedKeys, setGeneratedKeys] = useState<{ jwtSecret: string; anonKey: string; serviceRoleKey: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateSecureKeys = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/setup/generate-keys', { method: 'POST' });
      const data = await res.json();
      if (data.jwtSecret) {
        setGeneratedKeys(data);
        // Pre-fill the test fields
        setSupabaseUrl('http://localhost:8000');
        setSupabaseAnonKey(data.anonKey);
        setSupabaseServiceKey(data.serviceRoleKey);
      }
    } catch (err: any) {
      toast.error('Failed to generate keys', { description: err.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadDockerEnv = () => {
    if (!generatedKeys) return;
    const envContent = `POSTGRES_PASSWORD=secure-db-password-${Math.floor(Math.random() * 10000)}
POSTGRES_PORT=5432
JWT_SECRET=${generatedKeys.jwtSecret}
JWT_EXP=3600
API_EXTERNAL_URL=http://localhost:8000
SITE_URL=http://localhost:3000
KONG_HTTP_PORT=8000
DISABLE_SIGNUP=false
GOOGLE_AUTH_ENABLED=false
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ANON_KEY=${generatedKeys.anonKey}
SERVICE_ROLE_KEY=${generatedKeys.serviceRoleKey}
`;
    const blob = new Blob([envContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '.env';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const testConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');

    try {
      const res = await fetch('/api/setup/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: supabaseUrl,
          anonKey: supabaseAnonKey,
          serviceKey: supabaseServiceKey,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setTestStatus('success');
        setTestMessage('Connection successful! All tables verified.');
      } else {
        setTestStatus('error');
        setTestMessage(data.error || 'Connection failed.');
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Could not reach the test endpoint.');
    }
  };

  const saveConfig = async () => {
    try {
      const res = await fetch('/api/setup/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: supabaseUrl,
          anonKey: supabaseAnonKey,
          serviceKey: supabaseServiceKey,
        }),
      });
      if (res.ok) {
        window.location.href = '/login';
      }
    } catch (err: any) {
      toast.error('Failed to save configuration', { description: err.message });
    }
  };

  // ── Choose Mode ───────────────────────────────────────────
  if (mode === 'choose') {
    return (
      <div className="min-h-screen flex bg-background">
        {/* Left branding panel */}
        <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-foreground p-12">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-background/10 flex items-center justify-center">
              <Send className="w-3.5 h-3.5 text-background" />
            </div>
            <span className="text-[15px] font-semibold text-background tracking-[-0.3px]">Mailer</span>
          </div>

          <div className="space-y-6">
            <p className="text-[32px] font-semibold text-background leading-[1.2] tracking-[-0.8px]">
              Set up your database.
            </p>
            <p className="text-[15px] text-background/60 leading-relaxed">
              Mailer works with Supabase Cloud or a self-hosted PostgreSQL database via Docker. Choose the option that fits your setup.
            </p>
          </div>

          <p className="text-[12px] text-background/30 tracking-wider uppercase">
            Open Source · Self-hostable
          </p>
        </div>

        {/* Right — options */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-[520px] animate-page-in space-y-8">
            {/* Mobile logo */}
            <div className="flex items-center gap-2 mb-2 lg:hidden">
              <div className="w-7 h-7 rounded-[8px] bg-foreground flex items-center justify-center">
                <Send className="w-3.5 h-3.5 text-background" />
              </div>
              <span className="text-[15px] font-semibold tracking-[-0.3px]">Mailer</span>
            </div>

            <div>
              <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.6px]">
                Choose your database
              </h1>
              <p className="text-[14px] text-muted-foreground mt-1.5">
                Select how you want to host your data.
              </p>
            </div>

            {/* Supabase Cloud Card */}
            <button
              onClick={() => setMode('supabase')}
              className="w-full p-6 rounded-[16px] border-2 border-border hover:border-primary/60 bg-background hover:bg-primary/3 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-[12px] bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Cloud className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[16px] font-semibold text-foreground">Supabase Cloud</h3>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">Recommended</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
                    Connect to your existing Supabase project. Zero infrastructure management — just paste your project URL and keys.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
              </div>
            </button>

            {/* Self-Hosted Card */}
            <button
              onClick={() => setMode('selfhosted')}
              className="w-full p-6 rounded-[16px] border-2 border-border hover:border-primary/60 bg-background hover:bg-primary/3 transition-all text-left group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-[12px] bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Server className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-[16px] font-semibold text-foreground">Self-Hosted (Docker)</h3>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
                    Run PostgreSQL locally using Docker. Full data ownership — everything stays on your machine. Requires Docker Desktop.
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Supabase Cloud Setup ──────────────────────────────────
  if (mode === 'supabase') {
    return (
      <div className="min-h-screen flex bg-background">
        <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-foreground p-12">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[8px] bg-background/10 flex items-center justify-center">
              <Cloud className="w-3.5 h-3.5 text-background" />
            </div>
            <span className="text-[15px] font-semibold text-background tracking-[-0.3px]">Supabase Cloud</span>
          </div>
          <div className="space-y-6">
            <p className="text-[32px] font-semibold text-background leading-[1.2] tracking-[-0.8px]">
              Connect your Supabase project.
            </p>
            <p className="text-[15px] text-background/60 leading-relaxed">
              Find your credentials in the Supabase Dashboard under Project Settings → API.
            </p>
          </div>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[13px] text-background/50 hover:text-background/80 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open Supabase Dashboard
          </a>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-[440px] animate-page-in space-y-6">
            <button
              onClick={() => setMode('choose')}
              className="text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              ← Back to options
            </button>

            <div>
              <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.6px]">Supabase Cloud</h1>
              <p className="text-[14px] text-muted-foreground mt-1.5">
                Enter your project credentials.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[13px] font-medium text-muted-foreground mb-2 block">Project URL</label>
                <Input
                  placeholder="https://xxxxx.supabase.co"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  className="h-12 rounded-[10px] text-[14px] bg-secondary border-transparent"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-muted-foreground mb-2 block">Anon Key (Public)</label>
                <Input
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  className="h-12 rounded-[10px] text-[14px] bg-secondary border-transparent font-mono text-[12px]"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-muted-foreground mb-2 block">Service Role Key (Secret)</label>
                <Input
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIs..."
                  value={supabaseServiceKey}
                  onChange={(e) => setSupabaseServiceKey(e.target.value)}
                  className="h-12 rounded-[10px] text-[14px] bg-secondary border-transparent font-mono text-[12px]"
                />
              </div>
            </div>

            {testStatus !== 'idle' && (
              <div className={`flex items-center gap-2 p-3 rounded-[10px] text-[13px] ${
                testStatus === 'testing' ? 'bg-blue-500/8 text-blue-700' :
                testStatus === 'success' ? 'bg-emerald-500/8 text-emerald-700' :
                'bg-destructive/8 text-destructive'
              }`}>
                {testStatus === 'testing' && <Loader2 className="w-4 h-4 animate-spin" />}
                {testStatus === 'success' && <CheckCircle2 className="w-4 h-4" />}
                {testStatus === 'error' && <XCircle className="w-4 h-4" />}
                {testMessage || 'Testing connection...'}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                onClick={testConnection}
                variant="outline"
                disabled={!supabaseUrl || !supabaseAnonKey || testStatus === 'testing'}
                className="h-12 rounded-[10px] text-[14px] flex-1"
              >
                Test Connection
              </Button>
              <Button
                onClick={saveConfig}
                disabled={testStatus !== 'success'}
                className="h-12 rounded-[10px] bg-foreground hover:bg-foreground/90 text-background text-[14px] flex-1"
              >
                Save & Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Self-Hosted Setup ─────────────────────────────────────
  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-foreground p-12">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-background/10 flex items-center justify-center">
            <Server className="w-3.5 h-3.5 text-background" />
          </div>
          <span className="text-[15px] font-semibold text-background tracking-[-0.3px]">Self-Hosted</span>
        </div>
        <div className="space-y-6">
          <p className="text-[32px] font-semibold text-background leading-[1.2] tracking-[-0.8px]">
            Your data, your server.
          </p>
          <p className="text-[15px] text-background/60 leading-relaxed">
            Run Postgres + Supabase Auth locally via Docker. The same codebase works for both cloud and self-hosted.
          </p>
        </div>
        <p className="text-[12px] text-background/30 tracking-wider uppercase">
          Requires Docker Desktop
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[520px] animate-page-in space-y-8">
          <button
            onClick={() => setMode('choose')}
            className="text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            ← Back to options
          </button>

          <div>
            <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.6px]">Self-Hosted Setup</h1>
            <p className="text-[14px] text-muted-foreground mt-1.5">
              Follow these steps to run everything locally.
            </p>
          </div>

          {/* Step 1: Download */}
          <div className="p-5 rounded-[14px] border border-border bg-background space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-foreground text-background text-[13px] font-bold flex items-center justify-center">1</span>
              <h3 className="text-[15px] font-semibold text-foreground">Download Docker Files</h3>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed pl-10">
              The <code className="text-[12px] bg-secondary px-1.5 py-0.5 rounded">docker/</code> folder in your project root contains everything. No download needed if you already have the repo.
            </p>
            <div className="pl-10 flex gap-2">
              <a href="/api/setup/download-docker" download>
                <Button variant="outline" size="sm" className="h-9 rounded-[8px] text-[13px]">
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download ZIP
                </Button>
              </a>
            </div>
          </div>

          {/* Step 2: Run */}
          <div className="p-5 rounded-[14px] border border-border bg-background space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-foreground text-background text-[13px] font-bold flex items-center justify-center">2</span>
              <h3 className="text-[15px] font-semibold text-foreground">Start Docker Containers</h3>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed pl-10">
              Open a terminal and run the setup script:
            </p>
            <div className="pl-10 space-y-2">
              <div className="flex items-center gap-2 p-3 bg-foreground rounded-[8px]">
                <code className="text-[12px] text-background font-mono flex-1">cd docker && setup.bat</code>
                <button onClick={() => copyToClipboard('cd docker && setup.bat', 'cmd')} className="text-background/60 hover:text-background">
                  {copied === 'cmd' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                On macOS/Linux: <code className="text-[11px] bg-secondary px-1 py-0.5 rounded">chmod +x setup.sh && ./setup.sh</code>
              </p>
            </div>
          </div>

          {/* Step 3: Configure */}
          <div className="p-5 rounded-[14px] border border-border bg-background space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-foreground text-background text-[13px] font-bold flex items-center justify-center">3</span>
              <h3 className="text-[15px] font-semibold text-foreground">Generate Secure Keys</h3>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed pl-10">
              For production security, generate unique cryptographic keys for your server.
            </p>
            <div className="pl-10 space-y-4">
              {!generatedKeys ? (
                <Button 
                  onClick={generateSecureKeys} 
                  disabled={isGenerating}
                  className="h-10 px-4 rounded-[8px] bg-foreground hover:bg-foreground/90 text-background text-[13px]"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Generate Unique Keys'}
                </Button>
              ) : (
                <div className="space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-2 p-3 bg-emerald-500/10 text-emerald-600 rounded-[8px] text-[13px]">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Keys generated successfully!</span>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-[13px] font-medium text-foreground">1. Update Docker Configuration:</p>
                    <p className="text-[12px] text-muted-foreground">Download this file and save it as <code className="bg-secondary px-1 rounded">docker/.env</code>, then restart Docker.</p>
                    <Button onClick={downloadDockerEnv} variant="outline" size="sm" className="h-8 text-[12px]">
                      <Download className="w-3.5 h-3.5 mr-1.5" />
                      Download docker/.env
                    </Button>
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <p className="text-[13px] font-medium text-foreground">2. Update .env.local:</p>
                    <p className="text-[12px] text-muted-foreground">These values will be saved automatically when you complete Step 4.</p>
                    {[
                      { label: 'NEXT_PUBLIC_SUPABASE_URL', value: 'http://localhost:8000' },
                      { label: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', value: generatedKeys.anonKey },
                      { label: 'SUPABASE_SERVICE_KEY', value: generatedKeys.serviceRoleKey },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-2 p-2.5 bg-secondary/50 rounded-[8px] border border-border/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                          <p className="text-[11px] font-mono text-foreground truncate mt-0.5">{value}</p>
                        </div>
                        <button onClick={() => copyToClipboard(`${label}=${value}`, label)} className="text-muted-foreground hover:text-foreground shrink-0">
                          {copied === label ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 4: Verify */}
          <div className="p-5 rounded-[14px] border border-border bg-background space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-foreground text-background text-[13px] font-bold flex items-center justify-center">4</span>
              <h3 className="text-[15px] font-semibold text-foreground">Test & Connect</h3>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed pl-10">
              After updating .env.local, paste your credentials to verify the connection:
            </p>
            <div className="pl-10 space-y-3">
              <Input
                placeholder="http://localhost:8000"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="h-10 rounded-[8px] text-[13px] bg-secondary/50 border-border/50"
              />
              <Input
                placeholder="Anon Key"
                value={supabaseAnonKey}
                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                className="h-10 rounded-[8px] text-[13px] bg-secondary/50 border-border/50 font-mono text-[11px]"
              />
              <Input
                type="password"
                placeholder="Service Role Key"
                value={supabaseServiceKey}
                onChange={(e) => setSupabaseServiceKey(e.target.value)}
                className="h-10 rounded-[8px] text-[13px] bg-secondary/50 border-border/50 font-mono text-[11px]"
              />

              {testStatus !== 'idle' && (
                <div className={`flex items-center gap-2 p-3 rounded-[8px] text-[13px] ${
                  testStatus === 'testing' ? 'bg-blue-500/8 text-blue-700' :
                  testStatus === 'success' ? 'bg-emerald-500/8 text-emerald-700' :
                  'bg-destructive/8 text-destructive'
                }`}>
                  {testStatus === 'testing' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {testStatus === 'success' && <CheckCircle2 className="w-4 h-4" />}
                  {testStatus === 'error' && <XCircle className="w-4 h-4" />}
                  {testMessage || 'Testing connection...'}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={testConnection}
                  variant="outline"
                  disabled={!supabaseUrl || !supabaseAnonKey || testStatus === 'testing'}
                  className="h-10 rounded-[8px] text-[13px] flex-1"
                >
                  Test Connection
                </Button>
                <Button
                  onClick={saveConfig}
                  disabled={testStatus !== 'success'}
                  className="h-10 rounded-[8px] bg-foreground hover:bg-foreground/90 text-background text-[13px] flex-1"
                >
                  Save & Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
