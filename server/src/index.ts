import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import * as schema from './db/schema.js';
import authRoutes from './routes/auth.js';
import availabilityRoutes from './routes/availability.js';
import bookingsRoutes from './routes/bookings.js';
import adminRoutes from './routes/admin.js';
import { getAuthUrl, handleOAuthCallback } from './services/calendar.js';
import { authMiddleware, AuthRequest } from './middleware/auth.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
  'https://halo-fitness.com',
  'https://www.halo-fitness.com',
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ONE-TIME migration: move 10:00 bookings to 09:30 on Feb 16
app.post('/api/migrate-feb16', async (req, res) => {
  const secret = req.headers['x-migrate-secret'];
  if (secret !== 'halo-move-2026') return res.status(403).json({ error: 'forbidden' });

  try {
    const sqlite = (db as any)._client || (db as any).session?.client;
    
    // Create new session at 09:30
    const newSessionId = crypto.randomUUID();
    const oldSessionId = 'd0e95761-b26f-4e4f-84bd-7671b763ddcf'; // 10:00 HIIT Group
    
    // Get old session details
    const oldSession = await db.select().from(schema.classSessions).where(eq(schema.classSessions.id, oldSessionId));
    if (!oldSession.length) return res.status(404).json({ error: 'old session not found' });
    
    // Insert new session at 09:30 (Cyprus = UTC+2 in Feb, so 09:30 local = 07:30 UTC)
    await db.insert(schema.classSessions).values({
      id: newSessionId,
      startTime: '2026-02-16T07:30:00.000Z',
      endTime: '2026-02-16T08:30:00.000Z',
      classType: oldSession[0].classType,
      mode: oldSession[0].mode,
      status: 'scheduled',
    });
    
    // Move all bookings from old session to new
    const moved = await db.update(schema.bookings)
      .set({ sessionId: newSessionId })
      .where(eq(schema.bookings.sessionId, oldSessionId));
    
    // Delete old session
    await db.delete(schema.classSessions).where(eq(schema.classSessions.id, oldSessionId));
    
    res.json({ success: true, newSessionId, message: 'Moved 10:00 bookings to 09:30' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/admin', adminRoutes);

// Google Calendar OAuth routes
app.get('/api/auth/google', authMiddleware, (req: AuthRequest, res) => {
  const url = getAuthUrl();
  if (!url) {
    return res.status(500).json({ error: 'Google Calendar not configured' });
  }
  res.json({ url });
});

app.get('/api/auth/google/callback', authMiddleware, async (req: AuthRequest, res) => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  const success = await handleOAuthCallback(code, req.user!.id);
  if (success) {
    res.redirect('/admin?calendar=connected');
  } else {
    res.redirect('/admin?calendar=error');
  }
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    HALO FITNESS API                       ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}                   ║
║                                                           ║
║  Endpoints:                                               ║
║    POST /api/auth/register    - Register new user         ║
║    POST /api/auth/login       - Login                     ║
║    GET  /api/auth/me          - Get current user          ║
║    GET  /api/availability/:date - Get slots for date      ║
║    POST /api/bookings         - Create booking            ║
║    GET  /api/bookings         - Get user's bookings       ║
║    DELETE /api/bookings/:id   - Cancel booking            ║
║    GET  /api/admin/*          - Admin endpoints           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
