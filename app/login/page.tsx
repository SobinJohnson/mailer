'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        });
        if (error) throw error;
        setError('Check your email for a confirmation link.');
        setLoading(false);
        return;
      }
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left — branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 bg-foreground p-12">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-[8px] bg-background/10 flex items-center justify-center">
            <Send className="w-3.5 h-3.5 text-background" />
          </div>
          <span className="text-[15px] font-semibold text-background tracking-[-0.3px]">Mailer</span>
        </div>

        <div className="space-y-6">
          <p className="text-[32px] font-semibold text-background leading-[1.2] tracking-[-0.8px]">
            Precision outreach at scale.
          </p>
          <p className="text-[15px] text-background/60 leading-relaxed">
            A minimal CRM and email orchestration platform built for modern sales teams. Compose, schedule, and deliver — without the noise.
          </p>
        </div>

        <p className="text-[12px] text-background/30 tracking-wider uppercase">
          Open Source · Self-hostable
        </p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-[380px] animate-page-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-7 h-7 rounded-[8px] bg-foreground flex items-center justify-center">
              <Send className="w-3.5 h-3.5 text-background" />
            </div>
            <span className="text-[15px] font-semibold tracking-[-0.3px]">Mailer</span>
          </div>

          <div className="mb-8">
            <h1 className="text-[28px] font-semibold text-foreground tracking-[-0.6px]">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-[14px] text-muted-foreground mt-1.5">
              {mode === 'login'
                ? 'Sign in to your workspace.'
                : 'Get started with Mailer today.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              id="email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-12 px-4 rounded-[10px] text-[14px] bg-secondary border-transparent hover:border-border focus:border-primary"
            />

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="h-12 px-4 rounded-[10px] text-[14px] bg-secondary border-transparent hover:border-border focus:border-primary pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword
                  ? <EyeOff className="w-4 h-4" />
                  : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div
                className={`text-[13px] px-4 py-3 rounded-[8px] animate-fade-in ${
                  error.includes('Check your email')
                    ? 'bg-primary/8 text-primary'
                    : 'bg-destructive/8 text-destructive'
                }`}
              >
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-[10px] bg-foreground hover:bg-foreground/90 text-background text-[14px] font-medium press-effect mt-2"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <>
                    {mode === 'login' ? 'Sign in' : 'Create account'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
              }
            </Button>
          </form>

          <div className="mt-6 flex items-center gap-4 before:h-px before:flex-1 before:bg-border/60 after:h-px after:flex-1 after:bg-border/60">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Or</span>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                  redirectTo: `${window.location.origin}/auth/callback`,
                }
              });
              if (error) {
                setError(error.message);
                setLoading(false);
              }
            }}
            className="w-full h-12 rounded-[10px] mt-6 text-[14px] font-medium press-effect"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>

          <div className="mt-6 text-center">
            <p className="text-[13px] text-muted-foreground">
              {mode === 'login' ? "No account?" : "Have an account?"}{' '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setError(null);
                }}
                className="text-foreground font-medium hover:text-primary transition-colors"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
