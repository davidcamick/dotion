import { OpenAI } from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { google } from 'googleapis'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const tools = [
  {
    type: 'function',
    function: {
        name: 'change_view',
        description: 'Changes the user\'s calendar view to a specific date, mode, or zoom level. Use this when the user mentions looking at a future date (e.g., "next week", "in 2 weeks") or wants to see a different view (day, week).',
        parameters: {
            type: 'object',
            properties: {
                date: { type: 'string', description: 'Target date in ISO 8601 format (YYYY-MM-DD)' },
                viewMode: { type: 'number', description: 'Number of days to show (1, 2, 3, or 7)' },
                zoomLevel: { type: 'number', description: 'Zoom level (0.5 to 2.0)' }
            }
        }
    }
  },
  {
    type: 'function',
    function: {
        name: 'propose_slots',
        description: 'VITAL: You MUST use this tool whenever you want to suggest time slots to the user. The user CANNOT see slots unless you use this tool. Use this for requests like "when can I...", "find time for...", "suggest a time".',
        parameters: {
            type: 'object',
            properties: {
                slots: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            start: { type: 'string', description: 'ISO 8601 start time' },
                            end: { type: 'string', description: 'ISO 8601 end time' },
                            label: { type: 'string', description: 'Short context (e.g. "After meeting", "Morning slot")' }
                        },
                        required: ['start', 'end']
                    }
                }
            },
            required: ['slots']
        }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_calendar_event',
      description: 'Create a new event on the user\'s Google Calendar. Use this when the user asks to add, create, or schedule an event.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'The title/name of the event',
          },
          start: {
            type: 'string',
            description: 'Start time in ISO 8601 format (e.g., 2026-01-27T14:00:00)',
          },
          end: {
            type: 'string',
            description: 'End time in ISO 8601 format (e.g., 2026-01-27T15:00:00)',
          },
          description: {
            type: 'string',
            description: 'Optional description or notes for the event',
          },
          location: {
            type: 'string',
            description: 'Optional location of the event',
          },
        },
        required: ['summary', 'start'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_calendar_event',
      description: 'Update an existing event on the user\'s Google Calendar. Use this when the user asks to modify, change, or reschedule an event.',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The ID of the event to update',
          },
          summary: {
            type: 'string',
            description: 'New title/name of the event',
          },
          start: {
            type: 'string',
            description: 'New start time in ISO 8601 format',
          },
          end: {
            type: 'string',
            description: 'New end time in ISO 8601 format',
          },
          description: {
            type: 'string',
            description: 'New description or notes',
          },
          location: {
            type: 'string',
            description: 'New location',
          },
        },
        required: ['eventId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_calendar_event',
      description: 'Delete an event from the user\'s Google Calendar. Use this when the user asks to remove, delete, or cancel an event.',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The ID of the event to delete',
          },
        },
        required: ['eventId'],
      },
    },
  },
]

async function executeCalendarFunction(
  functionName: string,
  args: any,
  accessToken: string
) {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  const timeZone = process.env.GOOGLE_TIMEZONE || 'UTC'
  const calendarId = process.env.GOOGLE_CALENDAR_ID

  if (functionName === 'propose_slots' || functionName === 'change_view') {
      return { success: true, isUiOnly: true }
  }

  if (functionName === 'create_calendar_event') {
    console.log('Create event called with args:', JSON.stringify(args, null, 2))
    
    const event = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: args.summary,
        description: args.description,
        location: args.location,
        start: {
          dateTime: args.start,
          timeZone,
        },
        end: {
          dateTime: args.end || args.start,
          timeZone,
        },
      },
    })
    
    console.log('Create successful:', event.data.id)
    return { success: true, eventId: event.data.id, summary: args.summary }
  }

  if (functionName === 'update_calendar_event') {
    console.log('Update event called with args:', JSON.stringify(args, null, 2))
    
    // First, fetch the existing event to get current values
    const existingEvent = await calendar.events.get({
      calendarId,
      eventId: args.eventId,
    })
    
    console.log('Existing event:', JSON.stringify({
      summary: existingEvent.data.summary,
      start: existingEvent.data.start,
      end: existingEvent.data.end,
    }, null, 2))

    const updateData: any = {}
    if (args.summary !== undefined) updateData.summary = args.summary
    if (args.description !== undefined) updateData.description = args.description
    if (args.location !== undefined) updateData.location = args.location
    
    // For start/end times, we need both or neither to maintain a valid time range
    // If only one is provided, keep the other from the existing event
    if (args.start !== undefined || args.end !== undefined) {
      const existingStart = existingEvent.data.start?.dateTime || existingEvent.data.start?.date
      const existingEnd = existingEvent.data.end?.dateTime || existingEvent.data.end?.date
      
      updateData.start = {
        dateTime: args.start || existingStart,
        timeZone,
      }
      updateData.end = {
        dateTime: args.end || existingEnd,
        timeZone,
      }
    }

    console.log('Update payload:', JSON.stringify(updateData, null, 2))

    const event = await calendar.events.patch({
      calendarId,
      eventId: args.eventId,
      requestBody: updateData,
    })
    
    console.log('Update successful:', event.data.id)
    return { success: true, eventId: event.data.id, summary: event.data.summary, originalEvent: existingEvent.data }
  }

  if (functionName === 'delete_calendar_event') {
    console.log('Delete event called with eventId:', args.eventId)
    
    // Fetch first for undo context
    const event = await calendar.events.get({
      calendarId,
      eventId: args.eventId,
    })

    await calendar.events.delete({
      calendarId,
      eventId: args.eventId,
    })
    
    console.log('Delete successful')
    return { success: true, eventId: args.eventId, summary: event.data.summary, originalEvent: event.data }
  }

  return { error: 'Unknown function' }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, calendarEvents } = await req.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Get access token for calendar operations
    const cookieStore = cookies()
    const accessToken = cookieStore.get('google_access_token')?.value
    const expiresAt = cookieStore.get('google_access_token_expires_at')?.value
    const isAuthed = accessToken && expiresAt && Date.now() < Number(expiresAt)

    // Build system message with calendar context
    const timeZone = process.env.GOOGLE_TIMEZONE || 'UTC'
    const now = new Date()
    const currentDateTime = now.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone
    })
    
    let systemMessage = `You are a helpful assistant. The current date and time is: ${currentDateTime}.

IMPORTANT TIMEZONE INFORMATION:
- The user's timezone is: ${timeZone}
- When creating or updating events, you MUST use ISO 8601 format WITHOUT timezone suffix (e.g., "2026-01-28T15:00:00")
- The system will automatically apply the ${timeZone} timezone
- DO NOT use UTC (Z suffix) or timezone offsets in your datetime strings
- When modifying event times, carefully calculate the new times based on the original times shown below

- When suggesting specific time slots to the user (e.g. for a break, meeting, or focused work), you MUST use the 'propose_slots' tool.
- DO NOT just list the slots in your text response. The UI needs the structured data to display interactive options.
- If you say "Here are some options" or "I found some times", you MUST call 'propose_slots' in the same turn.

CRITICAL PRESENTATION STYLE:
- You MUST provide a brief, friendly conversational summary properly answering the user's request.
- When finding slots or events, summarize the context (e.g. "You have class and Bible study today, but I found a few breaks.") before distinguishing the UI elements.
- DO NOT list specific times or event details in the text if they are going to be shown in a UI card.
- Assume the user can see the UI cards, so your text should just be a friendly conversational lead-in.
- Be concise and sound like a helpful friend (using words like "I found", "Here are", "Check these out").

CRITICAL TOOL USAGE:
- You CANNOT perform calendar actions (create, update, delete) by text alone.
- You MUST call the corresponding tool ('create_calendar_event', 'update_calendar_event', 'delete_calendar_event') to execute the action.
- If you say "I will update...", "I'm scheduling...", or "I'll delete...", you MUST output the tool call in that SAME response.
- Do NOT say you have done something unless you have successfully called the tool.

CRITICAL UI INTERACTION LOGIC:
- If the user selects a slot (e.g., says "I'll take the slot: ..."), you MUST immediately call 'create_calendar_event' with those details.
- Use the date/time information from the user's message to fill the start/end times.
- Derive a summary from the slot label (e.g. "Nap", "Study Session") or the conversation context.
- Do not ask for confirmation again; just book it.`
    
    if (calendarEvents && calendarEvents.length > 0) {
      const eventsText = calendarEvents
        .map((day: any) => {
          const dayEvents = day.events
            .map((event: any) => {
              const start = new Date(event.start).toLocaleString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone
              })
              const end = event.end ? new Date(event.end).toLocaleString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZone
              }) : ''
              // Also show raw ISO times for precision
              const startISO = new Date(event.start).toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone
              })
              return `  - ${event.summary} (ID: ${event.id}) (${start}${end ? ' - ' + end : ''})${event.location ? ' at ' + event.location : ''}`
            })
            .join('\n')
          
          return `${day.label} (${day.date}):\n${dayEvents || '  No events'}`
        })
        .join('\n\n')
      
      systemMessage += `\n\nHere is the user's upcoming calendar schedule (next few weeks):\n\n${eventsText}\n\nYou can reference these events when answering questions about the user's schedule. When the user asks to modify or delete an event, use the event ID shown above.

WHEN EXTENDING OR MODIFYING EVENT TIMES:
1. Look at the current start/end times shown above
2. Calculate the new times carefully (e.g., "extend by 15 minutes" means add exactly 15 minutes to the end time)
3. Use the format: YYYY-MM-DDTHH:MM:SS (e.g., "2026-01-28T16:15:00")
4. Do NOT include timezone offsets or Z suffix`
    }

    if (isAuthed) {
      systemMessage += `\n\nYou have access to manage the user's Google Calendar. You can create new events, update existing events, or delete events using the provided functions.`
    }

    // Pre-process messages to inject toolData context
    const processedMessages = messages.map((msg: any) => {
      if (msg.role === 'assistant' && msg.toolData) {
        let contextInjection = ''
        if (msg.toolData.type === 'event' || msg.toolData.type === 'create' || msg.toolData.type === 'update') {
           contextInjection = `\n\n[SYSTEM CONTEXT: I just executed a calendar operation. Event ID: ${msg.toolData.eventId}. Summary: "${msg.toolData.summary}". Time: ${msg.toolData.start} to ${msg.toolData.end}. If the user asks to "move", "change", or "delete" this, use this ID.]`
        }
        
        // Return a clean message object for OpenAI, without the custom 'toolData' property
        return {
           role: msg.role,
           content: msg.content + contextInjection
        }
      }
      
      // Strip toolData from user messages if present (though unlikely)
      const { toolData, ...cleanMsg } = msg
      return cleanMsg
    })

    const messagesWithSystem = [
      { role: 'system', content: systemMessage },
      ...processedMessages
    ]

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messagesWithSystem,
      tools: isAuthed ? tools : undefined,
      stream: true,
    })

    const encoder = new TextEncoder()
    
    const customReadable = new ReadableStream({
      async start(controller) {
        let functionCalls: any[] = []
        let currentFunctionCall: any = null

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta

          // Handle function calls
          if (delta?.tool_calls) {
            for (const toolCall of delta.tool_calls) {
              if (toolCall.index !== undefined) {
                if (!functionCalls[toolCall.index]) {
                  functionCalls[toolCall.index] = {
                    id: toolCall.id,
                    type: 'function',
                    function: { name: '', arguments: '' }
                  }
                }
                const fc = functionCalls[toolCall.index]
                if (toolCall.function?.name) {
                  fc.function.name += toolCall.function.name
                }
                if (toolCall.function?.arguments) {
                  fc.function.arguments += toolCall.function.arguments
                }
              }
            }
          }

          // Stream regular content
          const data = `data: ${JSON.stringify(chunk)}\n\n`
          controller.enqueue(encoder.encode(data))
        }

        // Execute function calls if any
        if (functionCalls.length > 0 && accessToken) {
          console.log(`Executing ${functionCalls.length} function call(s)`)
          for (const fc of functionCalls) {
            try {
              console.log(`Calling function: ${fc.function.name}`)
              console.log(`Raw arguments: ${fc.function.arguments}`)
              const args = JSON.parse(fc.function.arguments)
              const result = await executeCalendarFunction(
                fc.function.name,
                args,
                accessToken
              )
              console.log(`Function result:`, result)

              // Send function result back to stream
              if (result.success && (fc.function.name === 'create_calendar_event' || fc.function.name === 'update_calendar_event' || fc.function.name === 'delete_calendar_event')) {
                // Send specialized UI data
                const toolDataChunk = {
                  tool_result_data: {
                    type: fc.function.name.replace('_calendar_event', ''),
                    eventId: result.eventId,
                    summary: result.summary,
                    start: args.start || result.originalEvent?.start?.dateTime || result.originalEvent?.start?.date,
                    end: args.end || result.originalEvent?.end?.dateTime || result.originalEvent?.end?.date,
                    location: args.location || result.originalEvent?.location,
                    originalEvent: result.originalEvent
                  }
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolDataChunk)}\n\n`))
              } else if (fc.function.name === 'propose_slots' && args.slots) {
                  const toolDataChunk = {
                      tool_result_data: {
                          type: 'slots',
                          slots: args.slots
                      }
                  }
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolDataChunk)}\n\n`))
              } else if (fc.function.name === 'change_view') {
                const toolDataChunk = {
                    tool_result_data: {
                        type: 'view_update',
                        date: args.date,
                        viewMode: args.viewMode,
                        zoomLevel: args.zoomLevel
                    }
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(toolDataChunk)}\n\n`))
              } else {
                // Standard text response for other actions
                const functionResultChunk = {
                  choices: [{
                    delta: {
                      content: `\n\n✓ ${fc.function.name === 'create_calendar_event' ? 'Created' : fc.function.name === 'update_calendar_event' ? 'Updated' : 'Deleted'} calendar event${result.summary ? `: ${result.summary}` : ''}`
                    },
                    index: 0,
                    finish_reason: null
                  }]
                }
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(functionResultChunk)}\n\n`))
              }

              // Signal calendar refresh needed
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ refresh_calendar: true })}\n\n`))
            } catch (error) {
              console.error('Function execution error:', error)
              const errorChunk = {
                choices: [{
                  delta: { content: `\n\n✗ Failed to execute calendar operation` },
                  index: 0,
                  finish_reason: null
                }]
              }
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`))
            }
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(customReadable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
