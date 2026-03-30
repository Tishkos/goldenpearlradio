# How to Start the Backend Server

The backend server and **PostgreSQL database** must be running for the application to work (login, stream, admin).

## Quick Start

**1. Start the database first (once per session):**
```bash
npm run db:start
```
This starts PostgreSQL in Docker on port 5432. (Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker installed.)

**2. Start frontend and backend:**
```bash
npm run dev
```
This starts:
- Frontend (Vite) on `http://localhost:5173`
- Backend (Express) on `http://localhost:3001`

### Other options
- **Backend only:** `npm run dev:server`
- **Frontend only:** `npm run dev:client`
- **Stop database:** `npm run db:stop`

## Prerequisites

1. **PostgreSQL**: Start it with `npm run db:start` (uses `docker-compose.yml`). If you don't use Docker, run your own Postgres and set `DATABASE_URL` in `.env` accordingly.

2. **Environment variables**: Ensure a `.env` file in the project root with (matches `docker-compose.yml`):
   ```
   DATABASE_URL="postgresql://radio_user:radio_password@localhost:5432/radio_db?schema=public"
   DIRECT_URL="postgresql://radio_user:radio_password@localhost:5432/radio_db?schema=public"
   PORT=3001
   JWT_SECRET=your-secret-key-here
   CORS_ORIGIN=http://localhost:5173
   ```

## Troubleshooting

### "ERR_CONNECTION_REFUSED" Error
This means the backend server is not running. Start it with:
```bash
npm run dev:server
```

### Database connection (e.g. "Can't reach database server at localhost:5432")
Start PostgreSQL first:
```bash
npm run db:start
```
Then run `npm run dev` again. If you don't use Docker, run PostgreSQL yourself and ensure `DATABASE_URL` in `.env` is correct.

Check if the database is accessible:
```bash
npm run db:studio
```

### Port Already in Use
If port 3001 is already in use, either:
1. Stop the process using port 3001
2. Change the PORT in your `.env` file

## Admin Login

Default admin credentials (if created):
- Email: `admin@radio.com`
- Password: (set during admin user creation)

To create an admin user:
```bash
npm run db:create-admin
```

