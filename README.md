# dotion
# Dotion Chat

A super modern and minimal ChatGPT wrapper built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 🚀 **Streaming responses** - Real-time streaming from ChatGPT
- 🎨 **Modern UI** - Clean, minimal design with Tailwind CSS
- ⚡ **Fast** - Built with Next.js 14 App Router
- 🔒 **Secure** - API key stored in environment variables

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
