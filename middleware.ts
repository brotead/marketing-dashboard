import { NextResponse, type NextRequest } from 'next/server'

// Supabase stores the session in a cookie named sb-{project-ref}-auth-token
// Checking the cookie directly avoids a network round-trip on every navigation.
const PROJECT_REF = 'riyxqtupvorjyylzmbvz'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always pass through: auth callback, API routes, Next.js internals, static files
  if (
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/')
  ) {
    return NextResponse.next()
  }

  // Session exists if Supabase auth cookie is present
  const hasSession = request.cookies.getAll().some(
    c => c.name.startsWith(`sb-${PROJECT_REF}-auth-token`)
  )

  const isLoginPage = pathname === '/login'

  // No session → redirect to login
  if (!hasSession && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Has session → don't show login again
  if (hasSession && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|logo\\.png|.*\\.png|.*\\.jpg|.*\\.ico|.*\\.svg).*)',
  ],
}
