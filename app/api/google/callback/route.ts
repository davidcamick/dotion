import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing Google OAuth environment variables' },
      { status: 500 }
    )
  }

  const cookieStore = cookies()
  const storedState = cookieStore.get('google_oauth_state')?.value
  cookieStore.delete('google_oauth_state')

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(new URL('/?auth=error', request.url))
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  const tokenData = await tokenRes.json()

  if (!tokenRes.ok || !tokenData.access_token || !tokenData.expires_in) {
    console.error('OAuth token error', tokenData)
    return NextResponse.redirect(new URL('/?auth=error', request.url))
  }

  const expiresAt = Date.now() + tokenData.expires_in * 1000

  cookieStore.set('google_access_token', tokenData.access_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
  cookieStore.set('google_access_token_expires_at', String(expiresAt), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  return NextResponse.redirect(new URL('/', request.url))
}
