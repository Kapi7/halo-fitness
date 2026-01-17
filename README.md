# Halo Fitness

A modern fitness studio booking system built with React and Node.js.

## Features

- Online class booking (HIIT, Pilates, Reformer, Rehabilitative)
- User authentication (Email + Google OAuth)
- Admin dashboard for schedule management
- Email notifications for bookings
- Responsive design

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion
- **Backend**: Node.js, Express, TypeScript
- **Database**: SQLite with Drizzle ORM
- **Email**: Nodemailer (Gmail SMTP)

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd halo-fitness
```

2. Install dependencies:
```bash
npm run install:all
```

3. Set up environment variables:
```bash
# Server
cp server/.env.example server/.env
# Edit server/.env with your values

# Client (optional for local dev)
cp client/.env.example client/.env
```

4. Initialize the database:
```bash
npm run db:push
npm run db:seed
```

5. Start development servers:
```bash
npm run dev
```

The app will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Deployment to Render

### Option 1: Blueprint (Recommended)

1. Push code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com)
3. Click "New" → "Blueprint"
4. Connect your GitHub repository
5. Render will detect `render.yaml` and create both services

### Option 2: Manual Setup

#### Backend (Web Service)

1. Create new Web Service
2. Connect GitHub repo
3. Settings:
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
4. Add environment variables (see `server/.env.example`)
5. Add a disk:
   - **Mount Path**: `/opt/render/project/src/data`
   - **Size**: 1 GB

#### Frontend (Static Site)

1. Create new Static Site
2. Connect GitHub repo
3. Settings:
   - **Root Directory**: `client`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Add environment variable:
   - `VITE_API_URL`: Your backend URL (e.g., `https://halo-fitness-api.onrender.com`)
5. Add rewrite rule:
   - Source: `/*`
   - Destination: `/index.html`

### Environment Variables

#### Backend (Required)
- `JWT_SECRET` - Secret for JWT tokens
- `FRONTEND_URL` - Frontend URL for CORS and email links

#### Backend (Optional)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- `SMTP_HOST` - SMTP server (default: smtp.gmail.com)
- `SMTP_PORT` - SMTP port (default: 587)
- `SMTP_USER` - Email address
- `SMTP_PASS` - App password
- `EMAIL_FROM` - From address for emails
- `ADMIN_EMAILS` - Comma-separated admin emails

#### Frontend
- `VITE_API_URL` - Backend API URL

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - Development: `http://localhost:5173/auth/google/callback`
   - Production: `https://your-frontend-url/auth/google/callback`

## License

Private - All rights reserved
