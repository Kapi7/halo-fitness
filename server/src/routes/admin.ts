import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, ne, gte, desc } from 'drizzle-orm';
import { addHours, parseISO } from 'date-fns';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { getCalendarService } from '../services/calendar.js';

const router = Router();

// All admin routes require auth + admin check
router.use(authMiddleware, adminMiddleware);

// Get schedule defaults
router.get('/schedule/defaults', async (req, res) => {
  try {
    const defaults = await db
      .select()
      .from(schema.scheduleConfigs)
      .where(eq(schema.scheduleConfigs.type, 'default'))
      .orderBy(schema.scheduleConfigs.dayOfWeek);

    // Ensure all days exist
    const days = [0, 1, 2, 3, 4, 5, 6];
    const fullData = days.map((d) => {
      const existing = defaults.find((item) => item.dayOfWeek === d);
      return (
        existing || {
          dayOfWeek: d,
          startTime: '08:00',
          slotsCount: 4,
          isClosed: d === 0 || d === 6,
        }
      );
    });

    return res.json({ defaults: fullData });
  } catch (error) {
    console.error('Get defaults error:', error);
    return res.status(500).json({ error: 'Failed to fetch defaults' });
  }
});

// Update schedule defaults
router.put('/schedule/defaults', async (req, res) => {
  try {
    const { config } = req.body;

    for (const item of config) {
      if (item.id) {
        await db
          .update(schema.scheduleConfigs)
          .set({
            startTime: item.startTime || item.start_time,
            slotsCount: item.slotsCount || item.slots_count,
            isClosed: item.isClosed ?? item.is_closed,
          })
          .where(eq(schema.scheduleConfigs.id, item.id));
      } else {
        // Check if exists for day
        const [existing] = await db
          .select()
          .from(schema.scheduleConfigs)
          .where(
            and(
              eq(schema.scheduleConfigs.type, 'default'),
              eq(schema.scheduleConfigs.dayOfWeek, item.dayOfWeek ?? item.day_of_week)
            )
          )
          .limit(1);

        if (existing) {
          await db
            .update(schema.scheduleConfigs)
            .set({
              startTime: item.startTime || item.start_time,
              slotsCount: item.slotsCount || item.slots_count,
              isClosed: item.isClosed ?? item.is_closed,
            })
            .where(eq(schema.scheduleConfigs.id, existing.id));
        } else {
          await db.insert(schema.scheduleConfigs).values({
            type: 'default',
            dayOfWeek: item.dayOfWeek ?? item.day_of_week,
            startTime: item.startTime || item.start_time,
            slotsCount: item.slotsCount || item.slots_count,
            isClosed: item.isClosed ?? item.is_closed,
          });
        }
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Update defaults error:', error);
    return res.status(500).json({ error: 'Failed to update defaults' });
  }
});

// Get single day overrides
router.get('/schedule/overrides', async (req, res) => {
  try {
    const overrides = await db
      .select()
      .from(schema.scheduleConfigs)
      .where(eq(schema.scheduleConfigs.type, 'override'))
      .orderBy(desc(schema.scheduleConfigs.specificDate))
      .limit(20);

    return res.json({ overrides });
  } catch (error) {
    console.error('Get overrides error:', error);
    return res.status(500).json({ error: 'Failed to fetch overrides' });
  }
});

// Add single day override
router.post('/schedule/overrides', async (req, res) => {
  try {
    const { date, start_time, slots_count, is_closed } = req.body;

    // Check if override exists
    const [existing] = await db
      .select()
      .from(schema.scheduleConfigs)
      .where(
        and(
          eq(schema.scheduleConfigs.type, 'override'),
          eq(schema.scheduleConfigs.specificDate, date)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(schema.scheduleConfigs)
        .set({ startTime: start_time, slotsCount: slots_count, isClosed: is_closed })
        .where(eq(schema.scheduleConfigs.id, existing.id));
    } else {
      await db.insert(schema.scheduleConfigs).values({
        type: 'override',
        specificDate: date,
        startTime: start_time,
        slotsCount: slots_count,
        isClosed: is_closed,
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Add override error:', error);
    return res.status(500).json({ error: 'Failed to add override' });
  }
});

// Delete override
router.delete('/schedule/overrides/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(schema.scheduleConfigs).where(eq(schema.scheduleConfigs.id, id));
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete override error:', error);
    return res.status(500).json({ error: 'Failed to delete override' });
  }
});

// Get weekly overrides
router.get('/schedule/weekly-overrides', async (req, res) => {
  try {
    const overrides = await db
      .select()
      .from(schema.scheduleConfigs)
      .where(eq(schema.scheduleConfigs.type, 'weekly_override'))
      .orderBy(desc(schema.scheduleConfigs.weekStartDate));

    // Group by week_start_date
    const grouped: Record<string, typeof overrides> = {};
    for (const ov of overrides) {
      if (ov.weekStartDate) {
        if (!grouped[ov.weekStartDate]) grouped[ov.weekStartDate] = [];
        grouped[ov.weekStartDate].push(ov);
      }
    }

    return res.json({ overrides: grouped });
  } catch (error) {
    console.error('Get weekly overrides error:', error);
    return res.status(500).json({ error: 'Failed to fetch weekly overrides' });
  }
});

// Add weekly override
router.post('/schedule/weekly-overrides', async (req, res) => {
  try {
    const { week_start_date, days_config } = req.body;

    // Delete existing for this week
    await db
      .delete(schema.scheduleConfigs)
      .where(
        and(
          eq(schema.scheduleConfigs.type, 'weekly_override'),
          eq(schema.scheduleConfigs.weekStartDate, week_start_date)
        )
      );

    // Insert new configs
    for (const day of days_config) {
      await db.insert(schema.scheduleConfigs).values({
        type: 'weekly_override',
        weekStartDate: week_start_date,
        dayOfWeek: day.day_of_week,
        startTime: day.start_time,
        slotsCount: day.slots_count,
        isClosed: day.is_closed,
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Add weekly override error:', error);
    return res.status(500).json({ error: 'Failed to add weekly override' });
  }
});

// Delete weekly override
router.delete('/schedule/weekly-overrides/:weekStartDate', async (req, res) => {
  try {
    const { weekStartDate } = req.params;
    await db
      .delete(schema.scheduleConfigs)
      .where(
        and(
          eq(schema.scheduleConfigs.type, 'weekly_override'),
          eq(schema.scheduleConfigs.weekStartDate, weekStartDate)
        )
      );
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete weekly override error:', error);
    return res.status(500).json({ error: 'Failed to delete weekly override' });
  }
});

// Get sessions
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await db
      .select()
      .from(schema.classSessions)
      .where(ne(schema.classSessions.status, 'cancelled'))
      .orderBy(desc(schema.classSessions.startTime))
      .limit(50);

    // Enrich with participants
    const enriched = await Promise.all(
      sessions.map(async (s) => {
        const bookings = await db
          .select()
          .from(schema.bookings)
          .where(
            and(eq(schema.bookings.sessionId, s.id), eq(schema.bookings.status, 'confirmed'))
          );

        const participants = await Promise.all(
          bookings.map(async (b) => {
            const [user] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, b.userId))
              .limit(1);
            return user || { firstName: 'Unknown', lastName: '' };
          })
        );

        return { ...s, participants };
      })
    );

    return res.json({ sessions: enriched });
  } catch (error) {
    console.error('Get sessions error:', error);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Cancel session
router.post('/sessions/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    const [session] = await db
      .select()
      .from(schema.classSessions)
      .where(eq(schema.classSessions.id, id))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Cancel in DB
    await db
      .update(schema.classSessions)
      .set({ status: 'cancelled' })
      .where(eq(schema.classSessions.id, id));

    // Cancel Bookings
    const bookings = await db
      .select()
      .from(schema.bookings)
      .where(and(eq(schema.bookings.sessionId, id), eq(schema.bookings.status, 'confirmed')));

    for (const b of bookings) {
      await db.update(schema.bookings).set({ status: 'cancelled' }).where(eq(schema.bookings.id, b.id));
    }

    // Delete from GCal
    if (session.googleEventId) {
      const calendarService = await getCalendarService();
      if (calendarService) {
        try {
          await calendarService.deleteEvent(session.googleEventId);
        } catch (e) {
          console.error('Failed to delete calendar event:', e);
        }
      }
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Cancel session error:', error);
    return res.status(500).json({ error: 'Failed to cancel session' });
  }
});

// Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const now = new Date().toISOString();

    // Active (future) bookings
    const activeBookings = await db
      .select()
      .from(schema.bookings)
      .innerJoin(schema.classSessions, eq(schema.bookings.sessionId, schema.classSessions.id))
      .where(
        and(
          eq(schema.bookings.status, 'confirmed'),
          gte(schema.classSessions.startTime, now)
        )
      );

    const activeRevenue = activeBookings.reduce((sum, b) => sum + (b.bookings.price || 0), 0);

    // Past bookings
    const pastBookings = await db
      .select()
      .from(schema.bookings)
      .innerJoin(schema.classSessions, eq(schema.bookings.sessionId, schema.classSessions.id))
      .where(eq(schema.bookings.status, 'confirmed'));

    const pastRevenue = pastBookings
      .filter((b) => new Date(b.class_sessions.startTime) < new Date())
      .reduce((sum, b) => sum + (b.bookings.price || 0), 0);

    // Total scheduled sessions (upcoming)
    const upcomingSessions = await db
      .select()
      .from(schema.classSessions)
      .where(
        and(
          eq(schema.classSessions.status, 'scheduled'),
          gte(schema.classSessions.startTime, now)
        )
      );
    const totalScheduledSessions = upcomingSessions.length;

    // Calculate total hours to work (upcoming sessions)
    const totalHoursToWork = upcomingSessions.reduce((sum, session) => {
      const start = new Date(session.startTime);
      const end = new Date(session.endTime);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    // Total registered users
    const allUsers = await db.select().from(schema.users);
    const totalUsers = allUsers.length;

    // Top users by booking count
    const allConfirmedBookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.status, 'confirmed'));

    const userBookingCount: Record<string, number> = {};
    for (const booking of allConfirmedBookings) {
      userBookingCount[booking.userId] = (userBookingCount[booking.userId] || 0) + 1;
    }

    const sortedUserIds = Object.entries(userBookingCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topUsers = await Promise.all(
      sortedUserIds.map(async ([userId, bookingCount]) => {
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, userId))
          .limit(1);
        return {
          id: userId,
          name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
          email: user?.email || '',
          bookings: bookingCount,
        };
      })
    );

    // Total completed hours (past sessions)
    const pastSessions = await db
      .select()
      .from(schema.classSessions)
      .innerJoin(schema.bookings, eq(schema.classSessions.id, schema.bookings.sessionId))
      .where(eq(schema.bookings.status, 'confirmed'));

    const completedSessionIds = new Set<string>();
    const completedHours = pastSessions
      .filter((s) => new Date(s.class_sessions.startTime) < new Date())
      .reduce((sum, s) => {
        if (completedSessionIds.has(s.class_sessions.id)) return sum;
        completedSessionIds.add(s.class_sessions.id);
        const start = new Date(s.class_sessions.startTime);
        const end = new Date(s.class_sessions.endTime);
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }, 0);

    return res.json({
      activeRevenue,
      pastRevenue,
      totalScheduledSessions,
      totalHoursToWork: Math.round(totalHoursToWork * 10) / 10,
      totalUsers,
      topUsers,
      completedHours: Math.round(completedHours * 10) / 10,
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;
