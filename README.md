# dotion
# Dotion Chat

A super modern and minimal ChatGPT wrapper built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🚀 **Streaming responses** - Real-time streaming from ChatGPT
- 🎨 **Modern UI** - Clean, minimal design with Tailwind CSS
- ⚡ **Fast** - Built with Next.js 14 App Router
- 🔒 **Secure** - API key stored in environment variables

## 🧠 AI Architecture

Dotion uses a sophisticated AI integration (powered by `gpt-4o`) that acts as a fully capable calendar agent, not just a chatbot.

### Context Window
Every request includes a highly optimized context package:
- **System Time & Timezone:** Precise execution of "tomorrow", "next Friday", etc.
- **Calendar Data:** A filtered view of user's events (Past 3 days to Future 21 days) to reduce token usage while maintaining relevant context.
- **Short-term Memory:** Recent tool outputs (e.g., "I just created event ID 123") are injected into the context so the AI can "remember" and modify what it just did.

### AI Tools & UI Components
The AI doesn't just output text; it drives the React UI via structured tool calls:

| AI Function | Behavior | UI Component |
|-------------|----------|--------------|
| `propose_slots` | Suggests multiple times for meetings/breaks | **Slot Picker:** Interactive, selectable chips. Clicking one instantly books the slot. |
| `create_calendar_event` | Adds a new event to Google Calendar | **Event Card:** A specialized "Created" card with summary details. |
| `update_calendar_event` | Modifies time, title, or details | **Event Card:** Shows the "Updated" state and remembers the ID for further referencing. |
| `delete_calendar_event` | Removes an event | **Event Card:** A "Deleted" confirmation card. |
| `change_view` | Navigates the calendar visually | **Calendar View:** Automatically jumps to specific dates, changes zoom level (0.5x-2x), or switches modes (Day/Week). |

### Data Flow
1. **User Input:** "Find time for a nap on Friday."
2. **Server:** Injects calendar data + system prompts & streams response.
3. **AI Decision:** Calls `propose_slots` with calculated free times.
4. **Client-Side Hydration:** The generic tool JSON is intercepted and hydrated into the interactive `<SlotPicker />` component within the chat stream.
5. **Action:** User clicks a slot -> Client sends "I'll take [Slot]" -> AI triggers `create_calendar_event` -> UI shows generic `<CalendarEventCard />` success.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure OpenAI API Key**
   
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```
   
   Get your API key from: https://platform.openai.com/api-keys

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Build for Production

```bash
npm run build
npm start
```

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS
- **OpenAI API** - ChatGPT integration
- **Streaming** - Server-sent events for real-time responses

## How It Works

- User types a message in the chat interface
- Message is sent to `/api/chat` endpoint
- Server calls OpenAI API with streaming enabled
- Responses are streamed back in real-time using Server-Sent Events
- UI updates progressively as each token arrives

## License

MIT
