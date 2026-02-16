import 'dotenv/config';
import express from 'express';
import cors from 'cors';
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

// TEMP: Merge Thursday Feb 19 into single 09:30 slot
app.get('/api/temp-merge-thu19', async (req, res) => {
  const VERSION = 'v5';
  try {
    const { db } = await import('./db/index.js');
    const schema = await import('./db/schema.js');
    const { eq, and, sql } = await import('drizzle-orm');

    // 1. Create/update override: 1 slot at 09:30 for 2026-02-19
    let existing: any;
    try {
      const rows = await db
        .select()
        .from(schema.scheduleConfigs)
        .where(
          and(
            eq(schema.scheduleConfigs.type, 'override'),
            eq(schema.scheduleConfigs.specificDate, '2026-02-19')
          )
        )
        .limit(1);
      existing = rows[0];
    } catch (e: any) {
      return res.json({ error: 'Step 1 failed: ' + e.message, version: VERSION });
    }

    try {
      if (existing) {
        await db.update(schema.scheduleConfigs)
          .set({ startTime: '09:30', slotsCount: 1, isClosed: false })
          .where(eq(schema.scheduleConfigs.id, existing.id));
      } else {
        await db.insert(schema.scheduleConfigs).values({
          type: 'override',
          specificDate: '2026-02-19',
          startTime: '09:30',
          slotsCount: 1,
          isClosed: false,
        });
      }
    } catch (e: any) {
      return res.json({ error: 'Step 1b failed: ' + e.message, version: VERSION });
    }

    // 2. Get all sessions for Feb 19
    let allSessions: any[];
    try {
      allSessions = await db
        .select()
        .from(schema.classSessions)
        .where(sql.raw(`"start_time" LIKE '2026-02-19%'`));
    } catch (e: any) {
      return res.json({ error: 'Step 2 failed: ' + e.message, version: VERSION });
    }

    // 3. Find or keep the 09:30 session
    const target = allSessions.find(s => s.startTime.includes('T07:30'));
    const others = allSessions.filter(s => s.id !== target?.id);

    if (!target) {
      return res.json({ error: 'No 09:30 session found', sessions: allSessions.map(s => ({ id: s.id, start: s.startTime })) });
    }

    // 4. Move all bookings from other sessions to the 09:30 session
    for (const s of others) {
      const bookings = await db
        .select()
        .from(schema.bookings)
        .where(eq(schema.bookings.sessionId, s.id));

      for (const b of bookings) {
        // Check if same user already in target
        const [existingBooking] = await db
          .select()
          .from(schema.bookings)
          .where(
            and(
              eq(schema.bookings.sessionId, target.id),
              eq(schema.bookings.userId, b.userId)
            )
          )
          .limit(1);

        if (!existingBooking) {
          await db.update(schema.bookings)
            .set({ sessionId: target.id })
            .where(eq(schema.bookings.id, b.id));
        } else {
          // Delete duplicate
          await db.delete(schema.bookings).where(eq(schema.bookings.id, b.id));
        }
      }

      // Delete the empty session
      await db.delete(schema.classSessions).where(eq(schema.classSessions.id, s.id));
    }

    // 5. Update target session participant count
    const finalBookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.sessionId, target.id));

    await db.update(schema.classSessions)
      .set({ currentParticipants: finalBookings.length })
      .where(eq(schema.classSessions.id, target.id));

    // Verify
    const result = await db
      .select()
      .from(schema.classSessions)
      .where(sql.raw(`"start_time" LIKE '2026-02-19%'`));

    const resultBookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.sessionId, target.id));

    return res.json({
      success: true,
      message: 'Thursday Feb 19 merged to single 09:30 slot',
      sessions: result.length,
      participants: resultBookings.length,
      participantNames: resultBookings.map(b => b.clientName || b.userId)
    });
  } catch (error: any) {
    console.error('Merge error:', error);
    return res.json({ error: error.message, stack: error.stack?.split('\n').slice(0,5), version: VERSION });
  }
});

// TEMP: Remove Itay from Thursday Feb 19 09:30
app.get('/api/temp-remove-itay-thu19', async (req, res) => {
  try {
    const { db } = await import('./db/index.js');
    const schema = await import('./db/schema.js');
    const { eq, and, sql } = await import('drizzle-orm');

    // Find 09:30 session for Feb 19
    const sessions = await db
      .select()
      .from(schema.classSessions)
      .where(sql.raw(`"start_time" LIKE '2026-02-19%'`));

    const target = sessions.find(s => s.startTime.includes('T07:30'));
    if (!target) return res.json({ error: 'No 09:30 session found' });

    // Find bookings with user names
    const bookings = await db
      .select({
        bookingId: schema.bookings.id,
        userId: schema.bookings.userId,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        clientName: schema.bookings.clientName,
      })
      .from(schema.bookings)
      .leftJoin(schema.users, eq(schema.bookings.userId, schema.users.id))
      .where(eq(schema.bookings.sessionId, target.id));

    const itayBooking = bookings.find(b =>
      (b.firstName || b.clientName || '').toLowerCase().includes('itay')
    );

    if (!itayBooking) return res.json({ error: 'Itay not found', names: bookings.map(b => b.firstName || b.clientName) });

    // Delete Itay's booking
    await db.delete(schema.bookings).where(eq(schema.bookings.id, itayBooking.bookingId));

    // Update participant count
    await db.update(schema.classSessions)
      .set({ currentParticipants: bookings.length - 1 })
      .where(eq(schema.classSessions.id, target.id));

    const remaining = bookings.filter(b => b.bookingId !== itayBooking.bookingId);
    return res.json({
      success: true,
      message: 'Itay removed from Thursday Feb 19 09:30',
      participants: remaining.length,
      names: remaining.map(b => b.firstName || b.clientName)
    });
  } catch (error: any) {
    return res.json({ error: error.message });
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
// deploy trigger 1771273518
