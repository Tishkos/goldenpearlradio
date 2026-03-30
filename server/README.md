# Radio Stream Server (Node.js)

A Node.js server for real-time radio streaming with FFmpeg support. This server provides audio streaming capabilities that require FFmpeg, which is not available in Supabase Edge Functions.

## Features

- **Real-time Streaming**: Streams scheduled radio shows with automatic content sequencing
- **FFmpeg Support**: Full audio encoding/decoding capabilities
- **Content Management**: Automatically plays tracks, talks, advertisements, and news in sequence
- **Multi-station Support**: Handles multiple radio stations simultaneously
- **Live Status Updates**: Provides current show information and listener counts

## Prerequisites

- Node.js 18+ 
- FFmpeg installed and available in PATH
- Supabase project with configured environment variables

### Installing FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Windows:**
Download from [FFmpeg website](https://ffmpeg.org/download.html) and add to PATH.

## Installation

1. Install dependencies (from project root):
```bash
npm install
```

2. Create a `.env` file in the project root:
```bash
# Add these to your existing .env file
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=3001
CORS_ORIGIN=*
```

## Running

**Development (server only):**
```bash
npm run dev:server
```

**Development (client and server together):**
```bash
npm run dev:all
```

**Production:**
```bash
npm run build:server
npm run start:server
```

**Build everything:**
```bash
npm run build:all
```

The server will start on port 3001 (or the port specified in `.env`).

## API Endpoints

### GET `/stream?station={stationId}&apikey={apiKey}`

Streams audio for the specified radio station.

**Query Parameters:**
- `station` (required): The radio station ID
- `apikey` (optional): Supabase API key for authentication (can also be sent as header)

**Response:**
- Content-Type: `audio/mpeg`
- Streaming MP3 audio data

### GET `/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-20T10:00:00.000Z"
}
```

## Frontend Integration

Update your frontend to point to the Node.js server:

```typescript
const streamUrl = `http://localhost:3001/stream?station=${selectedStation}&apikey=${apiKey}`;
```

For production, replace `localhost:3001` with your deployed server URL.

## Deployment

### Option 1: VPS/Cloud Server

1. Set up a VPS (DigitalOcean, Linode, AWS EC2, etc.)
2. Install Node.js and FFmpeg
3. Clone your repository
4. Set up environment variables
5. Use PM2 or systemd to run the server:

```bash
# With PM2
npm install -g pm2
pm2 start dist/index.js --name radio-stream
pm2 save
pm2 startup
```

### Option 2: Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
```

Build and run:
```bash
docker build -t radio-stream .
docker run -p 3001:3001 --env-file .env radio-stream
```

### Option 3: Railway/Render/Fly.io

These platforms support FFmpeg. Deploy as a Node.js application and ensure FFmpeg is available in the build environment.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes |
| `PORT` | Server port (default: 3001) | No |
| `CORS_ORIGIN` | CORS allowed origins (comma-separated or `*`) | No |
| `NODE_ENV` | Environment (development/production) | No |

## Troubleshooting

### FFmpeg not found

Ensure FFmpeg is installed and in your PATH:
```bash
ffmpeg -version
```

### Audio not playing

1. Check server logs for errors
2. Verify the station has a scheduled show
3. Ensure audio URLs are accessible
4. Check browser console for CORS errors

### High CPU usage

The audio mixing engine runs every 100ms. For better performance:
- Use a server with adequate CPU resources
- Consider reducing `TICK_INTERVAL_MS` (may affect audio quality)
- Monitor and optimize audio file sizes

## Architecture

The streaming system uses a `RadioStreamer` class that:

1. Monitors scheduled shows for each station
2. Automatically transitions between shows based on schedule
3. Sequences through show items in order
4. Mixes multiple audio tracks in real-time
5. Encodes to MP3 using FFmpeg
6. Streams to all connected listeners

## License

MIT

