import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  const isSetupPage = request.nextUrl.pathname.startsWith('/setup');
  const isApiRoute = request.nextUrl.pathname.startsWith('/api');

  // Routes that handle their own auth (via CRON_SECRET bearer token)
  const isSelfAuthedRoute =
    request.nextUrl.pathname.startsWith('/api/send/process') ||
    request.nextUrl.pathname.startsWith('/api/sync/imap');
  
  // Setup routes are open during first-run; save route has its own lock
  const isSetupApi = request.nextUrl.pathname.startsWith('/api/setup');

  // Allow self-authenticated and setup API routes through
  if (isSelfAuthedRoute || isSetupApi) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login (except auth pages, setup page)
  if (!user && !isAuthPage && !isSetupPage) {
    // For API routes, return 401 instead of redirect
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
