'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Building2, Users, FileText, Megaphone, Search, Loader2, ArrowRight, Command } from 'lucide-react';

type ResultType = 'company' | 'contact' | 'template' | 'campaign';

interface SearchResult {
  type: ResultType;
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string;
  status?: string;
}

const typeConfig: Record<ResultType, { icon: React.ElementType; label: string; color: string }> = {
  company:  { icon: Building2, label: 'Company',  color: 'text-blue-500' },
  contact:  { icon: Users,     label: 'Contact',  color: 'text-violet-500' },
  template: { icon: FileText,  label: 'Template', color: 'text-amber-500' },
  campaign: { icon: Megaphone, label: 'Campaign', color: 'text-green-500' },
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Cmd+K shortcut
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        setSelectedIndex(0);
      } catch { /* noop */ }
      finally { setLoading(false); }
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  const navigate = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter' && results[selectedIndex]) {
        navigate(results[selectedIndex].href);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, selectedIndex, navigate]);

  const grouped = results.reduce<Record<ResultType, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {} as Record<ResultType, SearchResult[]>);

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      className="group flex items-center gap-2.5 h-8 px-3 rounded-[8px] bg-secondary hover:bg-accent border border-border/60 text-muted-foreground hover:text-foreground transition-all duration-150 text-[13px]"
      aria-label="Open search"
    >
      <Search className="w-3.5 h-3.5 shrink-0" />
      <span className="hidden sm:inline">Search everything…</span>
      <span className="hidden sm:flex items-center gap-0.5 ml-1">
        <kbd className="text-[10px] font-mono bg-background border border-border rounded-[4px] px-1.5 py-0.5 text-muted-foreground/60">⌘K</kbd>
      </span>
    </button>
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop (z-30 is below the z-40 navbar, so navbar isn't darkened!) */}
      <div
        className="fixed inset-0 bg-foreground/5 backdrop-blur-[2px] z-30 animate-fade-in"
        onClick={() => setOpen(false)}
      />

      {/* Palette (z-50 is above everything) */}
      <div className="fixed top-[18vh] left-1/2 -translate-x-1/2 z-50 w-full max-w-[580px] px-4 animate-scale-in">
        <div className="rounded-[16px] border border-border bg-background shadow-2xl shadow-black/5 overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
            {loading
              ? <Loader2 className="w-4 h-4 text-muted-foreground animate-spin shrink-0" />
              : <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            }
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search companies, contacts, templates, campaigns…"
              className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground outline-none border-none"
            />
            <kbd className="text-[11px] font-mono bg-secondary border border-border rounded-[5px] px-2 py-1 text-muted-foreground hidden sm:block">
              esc
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[380px] overflow-y-auto">
            {!query || query.length < 2 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-muted-foreground">
                  Type at least 2 characters to search across all records.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {['/companies', '/contacts', '/templates', '/campaigns'].map(path => (
                    <button
                      key={path}
                      onClick={() => navigate(path)}
                      className="text-[12px] px-3 py-1.5 rounded-[6px] bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground border border-border/60 transition-colors capitalize"
                    >
                      {path.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            ) : results.length === 0 && !loading ? (
              <div className="px-4 py-8 text-center">
                <p className="text-[13px] text-muted-foreground">No results for <strong>"{query}"</strong></p>
              </div>
            ) : (
              <div className="py-2">
                {(Object.entries(grouped) as [ResultType, SearchResult[]][]).map(([type, items]) => {
                  const config = typeConfig[type];
                  return (
                    <div key={type} className="mb-1">
                      <div className="flex items-center gap-2 px-4 py-1.5">
                        <config.icon className={`w-3 h-3 ${config.color}`} />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{config.label}s</span>
                      </div>
                      {items.map((result) => {
                        const globalIdx = results.indexOf(result);
                        const isSelected = globalIdx === selectedIndex;
                        return (
                          <button
                            key={result.id}
                            onClick={() => navigate(result.href)}
                            onMouseEnter={() => setSelectedIndex(globalIdx)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 ${
                              isSelected ? 'bg-secondary' : 'hover:bg-secondary/60'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-foreground/8' : 'bg-secondary'
                            }`}>
                              <config.icon className={`w-3.5 h-3.5 ${config.color}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-foreground truncate">{result.title}</p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {result.meta ? `${result.meta} · ` : ''}{result.subtitle}
                              </p>
                            </div>
                            <ArrowRight className={`w-3.5 h-3.5 text-muted-foreground/40 shrink-0 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2.5 border-t border-border flex items-center gap-3 bg-secondary/30">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <kbd className="font-mono bg-background border border-border rounded-[4px] px-1.5 py-0.5">↑↓</kbd>
              Navigate
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <kbd className="font-mono bg-background border border-border rounded-[4px] px-1.5 py-0.5">↵</kbd>
              Open
            </div>
            <div className="ml-auto text-[11px] text-muted-foreground">
              {results.length > 0 && `${results.length} result${results.length !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
