import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const cookieStore = cookies()
  cookieStore.delete('google_access_token')
  cookieStore.delete('google_access_token_expires_at')

  return NextResponse.redirect(new URL('/', request.url))
}
