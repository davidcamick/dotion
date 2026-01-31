import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI' },
      { status: 500 }
    )
  }

  const state = crypto.randomUUID()
  const cookieStore = cookies()
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope:
      'openid email profile https://www.googleapis.com/auth/calendar',
    include_granted_scopes: 'true',
    state,
    access_type: 'offline', // Request refresh token
    prompt: 'consent',
  })

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  return NextResponse.redirect(url)
}
