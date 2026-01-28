import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { DateTime } from 'luxon'
import { cookies } from 'next/headers'

const requiredEnv = ['GOOGLE_CALENDAR_ID']

export async function GET() {
  try {
    const cookieStore = cookies()
    const accessToken = cookieStore.get('google_access_token')?.value
    const expiresAt = cookieStore.get('google_access_token_expires_at')?.value

    if (!accessToken || !expiresAt || Date.now() > Number(expiresAt)) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const missing = requiredEnv.filter((key) => !process.env[key])
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing env vars: ${missing.join(', ')}` },
        { status: 500 }
      )
    }

    const timeZone = process.env.GOOGLE_TIMEZONE || 'UTC'
    const now = DateTime.now().setZone(timeZone)

    // Get the start of the week (Sunday) and fetch a full week
    const startOfWeek = now.startOf('week')
    const timeMin = startOfWeek.toISO()
    const timeMax = startOfWeek.plus({ days: 7 }).toISO()

    const oauth2Client = new google.auth.OAuth2()

    oauth2Client.setCredentials({
      access_token: accessToken,
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    const res = await calendar.events.list({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      timeMin: timeMin || undefined,
      timeMax: timeMax || undefined,
      singleEvents: true,
      orderBy: 'startTime',
      timeZone,
    })

    const events = res.data.items || []

    // Build array of 7 days from start of week
    const days = Array.from({ length: 7 }, (_, i) => {
      const dayDate = startOfWeek.plus({ days: i })
      const dayLabel = dayDate.toFormat('EEE d') // e.g., "Mon 27"
      const dateKey = dayDate.toISODate()
      
      const dayEvents = events
        .map((event) => {
          const startRaw = event.start?.dateTime || event.start?.date
          const endRaw = event.end?.dateTime || event.end?.date
          if (!startRaw) return null

          const start = DateTime.fromISO(startRaw, { zone: timeZone })
          const end = endRaw
            ? DateTime.fromISO(endRaw, { zone: timeZone })
            : null

          return {
            id: event.id || '',
            summary: event.summary || 'Untitled',
            start,
            end,
            location: event.location || '',
            colorId: event.colorId || '0',
          }
        })
        .filter((event) => event && event.start.toISODate() === dateKey)
        .map((event) => ({
          id: event!.id,
          summary: event!.summary,
          start: event!.start.toISO(),
          end: event!.end?.toISO() || null,
          location: event!.location,
          colorId: event!.colorId,
        }))

      return {
        label: dayLabel,
        date: dateKey,
        isToday: dateKey === now.toISODate(),
        events: dayEvents,
      }
    })

    return NextResponse.json({ timeZone, days })
  } catch (error) {
    console.error('Calendar error:', error)
    return NextResponse.json(
      { error: 'Failed to load calendar events' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = cookies()
    const accessToken = cookieStore.get('google_access_token')?.value
    const expiresAt = cookieStore.get('google_access_token_expires_at')?.value

    if (!accessToken || !expiresAt || Date.now() > Number(expiresAt)) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { summary, description, start, end, location } = await req.json()

    if (!summary || !start) {
      return NextResponse.json(
        { error: 'summary and start are required' },
        { status: 400 }
      )
    }

    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken })
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    const timeZone = process.env.GOOGLE_TIMEZONE || 'UTC'

    const event = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      requestBody: {
        summary,
        description,
        location,
        start: {
          dateTime: start,
          timeZone,
        },
        end: {
          dateTime: end || start,
          timeZone,
        },
      },
    })

    return NextResponse.json({ success: true, eventId: event.data.id })
  } catch (error) {
    console.error('Create event error:', error)
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    )
  }
}

export async function PUT(req: Request) {
  try {
    const cookieStore = cookies()
    const accessToken = cookieStore.get('google_access_token')?.value
    const expiresAt = cookieStore.get('google_access_token_expires_at')?.value

    if (!accessToken || !expiresAt || Date.now() > Number(expiresAt)) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { eventId, summary, description, start, end, location } = await req.json()

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId is required' },
        { status: 400 }
      )
    }

    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken })
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    const timeZone = process.env.GOOGLE_TIMEZONE || 'UTC'

    const updateData: any = {}
    if (summary !== undefined) updateData.summary = summary
    if (description !== undefined) updateData.description = description
    if (location !== undefined) updateData.location = location
    if (start !== undefined) {
      updateData.start = { dateTime: start, timeZone }
    }
    if (end !== undefined) {
      updateData.end = { dateTime: end, timeZone }
    }

    const event = await calendar.events.patch({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      eventId,
      requestBody: updateData,
    })

    return NextResponse.json({ success: true, eventId: event.data.id })
  } catch (error) {
    console.error('Update event error:', error)
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = cookies()
    const accessToken = cookieStore.get('google_access_token')?.value
    const expiresAt = cookieStore.get('google_access_token_expires_at')?.value

    if (!accessToken || !expiresAt || Date.now() > Number(expiresAt)) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { eventId } = await req.json()

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId is required' },
        { status: 400 }
      )
    }

    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: accessToken })
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    await calendar.events.delete({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      eventId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete event error:', error)
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    )
  }
}
