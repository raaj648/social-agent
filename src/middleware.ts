import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: { [key: string]: unknown } }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const publicPaths = ['/login', '/signup', '/auth/confirm', '/admin/login'];
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));
  const isApiWebhook = pathname.startsWith('/api/webhooks');
  const isCallback = pathname.startsWith('/api/auth/callback');

  if (isApiWebhook || isCallback) return supabaseResponse;

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.startsWith('/admin') ? '/admin/login' : '/login';
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  if (user && isPublicPath) {
    const url = request.nextUrl.clone();
    if (pathname.startsWith('/admin/login')) {
      url.pathname = '/admin';
    } else {
      url.pathname = '/dashboard';
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};