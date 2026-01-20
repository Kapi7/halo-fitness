import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, ne, gte, lte, desc, like, or, asc, sql } from 'drizzle-orm';
import { addHours, parseISO } from 'date-fns';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth.js';
import { getCalendarService } from '../services/calendar.js';
import { sendBookingConfirmation } from '../services/email.js';
import { notifyAdminsNewBooking } from '../services/notifications.js';
import bcrypt from 'bcryptjs';

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
    const { date, start_time, slots_count, is_closed, class_type } = req.body;

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
        .set({
          startTime: start_time,
          slotsCount: slots_count,
          isClosed: is_closed,
          classType: class_type || null
        })
        .where(eq(schema.scheduleConfigs.id, existing.id));
    } else {
      await db.insert(schema.scheduleConfigs).values({
        type: 'override',
        specificDate: date,
        startTime: start_time,
        slotsCount: slots_count,
        isClosed: is_closed,
        classType: class_type || null,
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

// Bulk close multiple days (max 7 days)
router.post('/schedule/bulk-close', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate date range (max 7 days)
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 7) {
      return res.status(400).json({ error: 'Maximum 7 days can be closed at once' });
    }
    if (diffDays < 1) {
      return res.status(400).json({ error: 'End date must be on or after start date' });
    }

    // Create override for each day in range
    const closedDates: string[] = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // Check if override already exists for this date
      const [existing] = await db
        .select()
        .from(schema.scheduleConfigs)
        .where(
          and(
            eq(schema.scheduleConfigs.type, 'override'),
            eq(schema.scheduleConfigs.specificDate, dateStr)
          )
        )
        .limit(1);

      if (existing) {
        // Update existing override to closed
        await db
          .update(schema.scheduleConfigs)
          .set({ isClosed: true })
          .where(eq(schema.scheduleConfigs.id, existing.id));
      } else {
        // Create new closed override
        await db.insert(schema.scheduleConfigs).values({
          type: 'override',
          specificDate: dateStr,
          isClosed: true,
        });
      }

      closedDates.push(dateStr);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return res.json({ success: true, closedDates });
  } catch (error) {
    console.error('Bulk close error:', error);
    return res.status(500).json({ error: 'Failed to bulk close schedule' });
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
        classType: day.class_type || null,
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

    // Enrich with participants and prices
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
            return {
              ...(user || { firstName: 'Unknown', lastName: '' }),
              price: b.price,
              bookingId: b.id,
            };
          })
        );

        const totalRevenue = bookings.reduce((sum, b) => sum + (b.price || 0), 0);

        return { ...s, participants, totalRevenue };
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

// ============================================
// SLOT CLOSURES
// ============================================

// Create slot closure
router.post('/schedule/slot-closures', async (req, res) => {
  try {
    const { date, startTime, endTime, slotIndex, reason } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Must have either time range or slot index
    if (!startTime && slotIndex === undefined) {
      return res.status(400).json({ error: 'Either time range or slot index is required' });
    }

    const [closure] = await db
      .insert(schema.slotClosures)
      .values({
        date,
        startTime: startTime || null,
        endTime: endTime || null,
        slotIndex: slotIndex !== undefined ? slotIndex : null,
        reason: reason || null,
      })
      .returning();

    return res.json({ success: true, closure });
  } catch (error) {
    console.error('Create slot closure error:', error);
    return res.status(500).json({ error: 'Failed to create slot closure' });
  }
});

// Bulk create slot closures
router.post('/schedule/slot-closures/bulk', async (req, res) => {
  try {
    const { closures } = req.body;

    if (!closures || !Array.isArray(closures) || closures.length === 0) {
      return res.status(400).json({ error: 'Closures array is required' });
    }

    const created = [];
    for (const c of closures) {
      const [closure] = await db
        .insert(schema.slotClosures)
        .values({
          date: c.date,
          startTime: c.startTime || null,
          endTime: c.endTime || null,
          slotIndex: c.slotIndex !== undefined ? c.slotIndex : null,
          reason: c.reason || null,
        })
        .returning();
      created.push(closure);
    }

    return res.json({ success: true, closures: created });
  } catch (error) {
    console.error('Bulk create slot closures error:', error);
    return res.status(500).json({ error: 'Failed to create slot closures' });
  }
});

// Get slot closures
router.get('/schedule/slot-closures', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let closures;
    if (startDate && endDate) {
      closures = await db
        .select()
        .from(schema.slotClosures)
        .where(
          and(
            gte(schema.slotClosures.date, startDate as string),
            lte(schema.slotClosures.date, endDate as string)
          )
        )
        .orderBy(desc(schema.slotClosures.date));
    } else {
      closures = await db
        .select()
        .from(schema.slotClosures)
        .orderBy(desc(schema.slotClosures.date))
        .limit(50);
    }

    return res.json({ closures });
  } catch (error) {
    console.error('Get slot closures error:', error);
    return res.status(500).json({ error: 'Failed to fetch slot closures' });
  }
});

// Delete slot closure
router.delete('/schedule/slot-closures/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(schema.slotClosures).where(eq(schema.slotClosures.id, id));
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete slot closure error:', error);
    return res.status(500).json({ error: 'Failed to delete slot closure' });
  }
});

// ============================================
// PRICING TIERS
// ============================================

// Get all pricing tiers
router.get('/pricing/tiers', async (req, res) => {
  try {
    const tiers = await db
      .select()
      .from(schema.pricingTiers)
      .orderBy(asc(schema.pricingTiers.name));

    return res.json({ tiers });
  } catch (error) {
    console.error('Get pricing tiers error:', error);
    return res.status(500).json({ error: 'Failed to fetch pricing tiers' });
  }
});

// Create pricing tier
router.post('/pricing/tiers', async (req, res) => {
  try {
    const { name, description, discountPercent, isDefault } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // If this is the default tier, unset other defaults
    if (isDefault) {
      await db
        .update(schema.pricingTiers)
        .set({ isDefault: false });
    }

    const [tier] = await db
      .insert(schema.pricingTiers)
      .values({
        name,
        description: description || null,
        discountPercent: discountPercent || 0,
        isDefault: isDefault || false,
      })
      .returning();

    return res.json({ success: true, tier });
  } catch (error) {
    console.error('Create pricing tier error:', error);
    return res.status(500).json({ error: 'Failed to create pricing tier' });
  }
});

// Update pricing tier
router.put('/pricing/tiers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, discountPercent, isDefault } = req.body;

    // If setting as default, unset other defaults
    if (isDefault) {
      await db
        .update(schema.pricingTiers)
        .set({ isDefault: false });
    }

    const [tier] = await db
      .update(schema.pricingTiers)
      .set({
        name,
        description: description || null,
        discountPercent: discountPercent || 0,
        isDefault: isDefault || false,
      })
      .where(eq(schema.pricingTiers.id, id))
      .returning();

    return res.json({ success: true, tier });
  } catch (error) {
    console.error('Update pricing tier error:', error);
    return res.status(500).json({ error: 'Failed to update pricing tier' });
  }
});

// Delete pricing tier
router.delete('/pricing/tiers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Remove tier from users
    await db
      .update(schema.users)
      .set({ pricingTierId: null })
      .where(eq(schema.users.pricingTierId, id));

    // Delete tier pricing entries
    await db.delete(schema.tierPricing).where(eq(schema.tierPricing.tierId, id));

    // Delete the tier
    await db.delete(schema.pricingTiers).where(eq(schema.pricingTiers.id, id));

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete pricing tier error:', error);
    return res.status(500).json({ error: 'Failed to delete pricing tier' });
  }
});

// Get tier prices
router.get('/pricing/tiers/:id/prices', async (req, res) => {
  try {
    const { id } = req.params;

    const prices = await db
      .select()
      .from(schema.tierPricing)
      .where(eq(schema.tierPricing.tierId, id));

    return res.json({ prices });
  } catch (error) {
    console.error('Get tier prices error:', error);
    return res.status(500).json({ error: 'Failed to fetch tier prices' });
  }
});

// Set tier prices
router.post('/pricing/tiers/:id/prices', async (req, res) => {
  try {
    const { id } = req.params;
    const { prices } = req.body;

    if (!prices || !Array.isArray(prices)) {
      return res.status(400).json({ error: 'Prices array is required' });
    }

    // Delete existing prices for this tier
    await db.delete(schema.tierPricing).where(eq(schema.tierPricing.tierId, id));

    // Insert new prices
    const created = [];
    for (const p of prices) {
      const [price] = await db
        .insert(schema.tierPricing)
        .values({
          tierId: id,
          classType: p.classType,
          mode: p.mode,
          price: p.price !== undefined && p.price !== null ? p.price : null,
          discountPercent: p.discountPercent !== undefined && p.discountPercent !== null ? p.discountPercent : null,
        } as any)
        .returning();
      created.push(price);
    }

    return res.json({ success: true, prices: created });
  } catch (error) {
    console.error('Set tier prices error:', error);
    return res.status(500).json({ error: 'Failed to set tier prices' });
  }
});

// ============================================
// USER MANAGEMENT
// ============================================

// Get users list
router.get('/users', async (req, res) => {
  try {
    const { search, tier, isAdmin, limit = '50', offset = '0' } = req.query;

    let query = db.select().from(schema.users);

    // Build conditions array
    const conditions = [];
    if (search) {
      const searchTerm = `%${search}%`;
      conditions.push(
        or(
          like(schema.users.email, searchTerm),
          like(schema.users.firstName, searchTerm),
          like(schema.users.lastName, searchTerm),
          like(schema.users.phoneNumber, searchTerm)
        )
      );
    }
    if (tier) {
      conditions.push(eq(schema.users.pricingTierId, tier as string));
    }
    if (isAdmin === 'true') {
      conditions.push(eq(schema.users.isAdmin, true));
    } else if (isAdmin === 'false') {
      conditions.push(eq(schema.users.isAdmin, false));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const users = await query
      .orderBy(desc(schema.users.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Enrich with booking counts and tier info
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const bookings = await db
          .select()
          .from(schema.bookings)
          .where(eq(schema.bookings.userId, user.id));

        const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
        const totalSpent = confirmedBookings.reduce((sum, b) => sum + (b.price || 0), 0);

        let tierInfo = null;
        if (user.pricingTierId) {
          const [tier] = await db
            .select()
            .from(schema.pricingTiers)
            .where(eq(schema.pricingTiers.id, user.pricingTierId))
            .limit(1);
          tierInfo = tier || null;
        }

        return {
          ...user,
          bookingsCount: confirmedBookings.length,
          totalSpent,
          tier: tierInfo,
        };
      })
    );

    // Get total count
    const allUsers = await db.select().from(schema.users);
    const total = allUsers.length;

    return res.json({ users: enrichedUsers, total });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user (admin)
router.post('/users', async (req, res) => {
  try {
    const { email, firstName, lastName, phoneNumber, generatePassword } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);

    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate password if requested
    let passwordHash = null;
    let generatedPassword = null;
    if (generatePassword) {
      // Generate a random 8-character password
      generatedPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
      passwordHash = await bcrypt.hash(generatedPassword, 10);
    }

    // Create user
    const [newUser] = await db
      .insert(schema.users)
      .values({
        email: email.toLowerCase(),
        firstName: firstName || null,
        lastName: lastName || null,
        phoneNumber: phoneNumber || null,
        passwordHash,
        isAdmin: false,
      })
      .returning();

    return res.json({
      user: newUser,
      generatedPassword, // Only returned if generatePassword was true
    });
  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get single user with details
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get tier info
    let tierInfo = null;
    if (user.pricingTierId) {
      const [tier] = await db
        .select()
        .from(schema.pricingTiers)
        .where(eq(schema.pricingTiers.id, user.pricingTierId))
        .limit(1);
      tierInfo = tier || null;
    }

    // Get user pricing overrides
    const pricingOverrides = await db
      .select()
      .from(schema.userPricing)
      .where(eq(schema.userPricing.userId, id));

    return res.json({
      user: {
        ...user,
        tier: tierInfo,
        pricingOverrides,
      },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user
router.put('/users/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phoneNumber, email, isAdmin, pricingTierId } = req.body;

    const [updated] = await db
      .update(schema.users)
      .set({
        firstName: firstName ?? undefined,
        lastName: lastName ?? undefined,
        phoneNumber: phoneNumber ?? undefined,
        email: email ?? undefined,
        isAdmin: isAdmin ?? undefined,
        pricingTierId: pricingTierId === '' ? null : pricingTierId ?? undefined,
      })
      .where(eq(schema.users.id, id))
      .returning();

    return res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Update user error:', error);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get user stats
router.get('/users/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const bookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.userId, id));

    const confirmedBookings = bookings.filter((b) => b.status === 'confirmed');
    const cancelledBookings = bookings.filter((b) => b.status === 'cancelled');

    // Get booking details with sessions
    const bookingDetails = await Promise.all(
      confirmedBookings.map(async (b) => {
        const [session] = await db
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, b.sessionId))
          .limit(1);
        return { booking: b, session };
      })
    );

    // Calculate stats
    const totalSpent = confirmedBookings.reduce((sum, b) => sum + (b.price || 0), 0);
    const lastBooking = bookingDetails
      .filter((d) => d.session)
      .sort((a, b) => new Date(b.session!.startTime).getTime() - new Date(a.session!.startTime).getTime())[0];

    // Find favorite class type
    const classTypeCounts: Record<string, number> = {};
    for (const d of bookingDetails) {
      if (d.session) {
        classTypeCounts[d.session.classType] = (classTypeCounts[d.session.classType] || 0) + 1;
      }
    }
    const favoriteClass = Object.entries(classTypeCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return res.json({
      totalBookings: confirmedBookings.length,
      totalSpent,
      cancellations: cancelledBookings.length,
      lastBooking: lastBooking?.session?.startTime || null,
      favoriteClass,
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});

// Get user booking history
router.get('/users/:id/bookings', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = '20', offset = '0' } = req.query;

    const bookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.userId, id))
      .orderBy(desc(schema.bookings.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const enriched = await Promise.all(
      bookings.map(async (b) => {
        const [session] = await db
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, b.sessionId))
          .limit(1);
        return { ...b, session };
      })
    );

    return res.json({ bookings: enriched });
  } catch (error) {
    console.error('Get user bookings error:', error);
    return res.status(500).json({ error: 'Failed to fetch user bookings' });
  }
});

// Get user notes
router.get('/users/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;

    const notes = await db
      .select()
      .from(schema.userNotes)
      .where(eq(schema.userNotes.userId, id))
      .orderBy(desc(schema.userNotes.createdAt));

    // Enrich with admin info
    const enriched = await Promise.all(
      notes.map(async (n) => {
        const [admin] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, n.adminId))
          .limit(1);
        return {
          ...n,
          adminName: admin ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || admin.email : 'Unknown',
        };
      })
    );

    return res.json({ notes: enriched });
  } catch (error) {
    console.error('Get user notes error:', error);
    return res.status(500).json({ error: 'Failed to fetch user notes' });
  }
});

// Add user note
router.post('/users/:id/notes', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const adminId = req.user!.id;

    if (!note) {
      return res.status(400).json({ error: 'Note is required' });
    }

    const [created] = await db
      .insert(schema.userNotes)
      .values({
        userId: id,
        adminId,
        note,
      })
      .returning();

    return res.json({ success: true, note: created });
  } catch (error) {
    console.error('Add user note error:', error);
    return res.status(500).json({ error: 'Failed to add user note' });
  }
});

// Delete user note
router.delete('/user-notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(schema.userNotes).where(eq(schema.userNotes.id, id));
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete user note error:', error);
    return res.status(500).json({ error: 'Failed to delete user note' });
  }
});

// Assign tier to user
router.put('/users/:id/tier', async (req, res) => {
  try {
    const { id } = req.params;
    const { tierId } = req.body;

    const [updated] = await db
      .update(schema.users)
      .set({ pricingTierId: tierId || null })
      .where(eq(schema.users.id, id))
      .returning();

    return res.json({ success: true, user: updated });
  } catch (error) {
    console.error('Assign tier error:', error);
    return res.status(500).json({ error: 'Failed to assign tier' });
  }
});

// ============================================
// USER PRICING OVERRIDES
// ============================================

// Get user pricing overrides
router.get('/users/:id/pricing', async (req, res) => {
  try {
    const { id } = req.params;

    const pricing = await db
      .select()
      .from(schema.userPricing)
      .where(eq(schema.userPricing.userId, id));

    return res.json({ pricing });
  } catch (error) {
    console.error('Get user pricing error:', error);
    return res.status(500).json({ error: 'Failed to fetch user pricing' });
  }
});

// Add user pricing override
router.post('/users/:id/pricing', async (req, res) => {
  try {
    const { id } = req.params;
    const { classType, mode, customPrice, discountPercent } = req.body;

    if (!classType || !mode) {
      return res.status(400).json({ error: 'Class type and mode are required' });
    }

    // Remove existing override for same class/mode
    await db
      .delete(schema.userPricing)
      .where(
        and(
          eq(schema.userPricing.userId, id),
          eq(schema.userPricing.classType, classType),
          eq(schema.userPricing.mode, mode)
        )
      );

    const [pricing] = await db
      .insert(schema.userPricing)
      .values({
        userId: id,
        classType,
        mode,
        customPrice: customPrice || null,
        discountPercent: discountPercent || null,
      })
      .returning();

    return res.json({ success: true, pricing });
  } catch (error) {
    console.error('Add user pricing error:', error);
    return res.status(500).json({ error: 'Failed to add user pricing' });
  }
});

// Delete user pricing override
router.delete('/user-pricing/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(schema.userPricing).where(eq(schema.userPricing.id, id));
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete user pricing error:', error);
    return res.status(500).json({ error: 'Failed to delete user pricing' });
  }
});

// Update booking price
router.put('/bookings/:id/price', async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    if (price === undefined || price === null) {
      return res.status(400).json({ error: 'Price is required' });
    }

    const [updated] = await db
      .update(schema.bookings)
      .set({ price } as any)
      .where(eq(schema.bookings.id, id))
      .returning();

    return res.json({ success: true, booking: updated });
  } catch (error) {
    console.error('Update booking price error:', error);
    return res.status(500).json({ error: 'Failed to update booking price' });
  }
});

// Recalculate prices for user's future bookings
router.post('/users/:id/recalculate-prices', async (req, res) => {
  try {
    const { id } = req.params;

    // Get user's confirmed bookings
    const bookings = await db
      .select()
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.userId, id),
          eq(schema.bookings.status, 'confirmed')
        )
      );

    const updated = [];
    for (const booking of bookings) {
      // Get session details
      const [session] = await db
        .select()
        .from(schema.classSessions)
        .where(eq(schema.classSessions.id, booking.sessionId))
        .limit(1);

      if (!session) continue;

      // Check if session is in the future
      const sessionDate = new Date(session.startTime);
      if (sessionDate <= new Date()) continue;

      // Calculate new price
      const priceResult = await calculatePriceForUser(id, session.classType, session.mode);

      // Update if different
      if (priceResult.price !== booking.price) {
        const [updatedBooking] = await db
          .update(schema.bookings)
          .set({ price: priceResult.price } as any)
          .where(eq(schema.bookings.id, booking.id))
          .returning();

        updated.push({
          bookingId: booking.id,
          oldPrice: booking.price,
          newPrice: priceResult.price,
          classType: session.classType,
          mode: session.mode,
          startTime: session.startTime,
        });
      }
    }

    return res.json({
      success: true,
      updated,
      message: `Updated ${updated.length} booking(s)`
    });
  } catch (error) {
    console.error('Recalculate prices error:', error);
    return res.status(500).json({ error: 'Failed to recalculate prices' });
  }
});

// ============================================
// ADMIN BOOKING
// ============================================

// Helper function to calculate price with tiers and overrides
async function calculatePriceForUser(
  userId: string,
  classType: string,
  mode: string
): Promise<{ price: number; source: string }> {
  // Base prices
  const basePrices: Record<string, Record<string, number>> = {
    HIIT: { Private: 45, Group: 25 },
    'Pilates Reformer': { Private: 50, Group: 50 },
    'Pilates Clinical Rehab': { Private: 75, Group: 75 },
    'Pilates Matte': { Private: 25, Group: 25 },
  };

  const basePrice = basePrices[classType]?.[mode] || 0;

  // 1. Check for user-specific custom price
  const [userPriceOverride] = await db
    .select()
    .from(schema.userPricing)
    .where(
      and(
        eq(schema.userPricing.userId, userId),
        eq(schema.userPricing.classType, classType),
        eq(schema.userPricing.mode, mode)
      )
    )
    .limit(1);

  if (userPriceOverride) {
    if (userPriceOverride.customPrice !== null) {
      return { price: userPriceOverride.customPrice, source: 'user_custom' };
    }
    if (userPriceOverride.discountPercent !== null) {
      const discounted = basePrice * (1 - userPriceOverride.discountPercent / 100);
      return { price: Math.round(discounted * 100) / 100, source: 'user_discount' };
    }
  }

  // 2. Get user's tier
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (user?.pricingTierId) {
    // 3. Check for tier-specific price or discount for this class
    const [tierPriceRecord] = await db
      .select()
      .from(schema.tierPricing)
      .where(
        and(
          eq(schema.tierPricing.tierId, user.pricingTierId),
          eq(schema.tierPricing.classType, classType),
          eq(schema.tierPricing.mode, mode)
        )
      )
      .limit(1);

    if (tierPriceRecord) {
      // Check if it's a fixed price or a discount
      if (tierPriceRecord.price !== null) {
        return { price: tierPriceRecord.price, source: 'tier_price' };
      }
      if ((tierPriceRecord as any).discountPercent !== null) {
        const discounted = basePrice * (1 - (tierPriceRecord as any).discountPercent / 100);
        return { price: Math.round(discounted * 100) / 100, source: 'tier_discount' };
      }
    }
  }

  // 5. Return base price
  return { price: basePrice, source: 'base' };
}

// Get all slots for a day (admin booking - no schedule restrictions)
router.get('/bookings/availability/:date', async (req, res) => {
  try {
    const { date } = req.params; // YYYY-MM-DD
    const timeZone = 'Asia/Nicosia';

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Generate all hourly slots from 6:00 to 22:00
    const slots = [];
    const startHour = 6;
    const endHour = 22;

    // Fetch DB sessions for this date
    const { fromZonedTime } = await import('date-fns-tz');
    const dayStartISO = fromZonedTime(`${date}T00:00:00`, timeZone).toISOString();
    const dayEndISO = fromZonedTime(`${date}T23:59:59`, timeZone).toISOString();

    const dbSessions = await db
      .select()
      .from(schema.classSessions)
      .where(
        and(
          ne(schema.classSessions.status, 'cancelled'),
          gte(schema.classSessions.startTime, dayStartISO),
          lte(schema.classSessions.startTime, dayEndISO)
        )
      );

    for (let hour = startHour; hour < endHour; hour++) {
      const hStr = String(hour).padStart(2, '0');
      const slotTimeString = `${date}T${hStr}:00:00`;
      const slotStartDate = fromZonedTime(slotTimeString, timeZone);
      const { addHours } = await import('date-fns');
      const slotEndDate = addHours(slotStartDate, 1);

      let status: 'available' | 'full' | 'partial' = 'available';
      let details: any = null;

      // Check if there's an existing session at this time
      const existingSession = dbSessions.find((s) => {
        const sTime = new Date(s.startTime);
        return Math.abs(sTime.getTime() - slotStartDate.getTime()) < 1000;
      });

      if (existingSession) {
        const bookingsForSession = await db
          .select()
          .from(schema.bookings)
          .where(
            and(
              eq(schema.bookings.sessionId, existingSession.id),
              eq(schema.bookings.status, 'confirmed')
            )
          );

        const participantCount = bookingsForSession.length;

        // Get participant names
        let participantNames: string[] = [];
        for (const booking of bookingsForSession) {
          const [user] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, booking.userId))
            .limit(1);
          if (user) {
            participantNames.push(`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email);
          }
        }

        details = {
          session_id: existingSession.id,
          class_type: existingSession.classType,
          mode: existingSession.mode,
          participants: participantCount,
          participant_names: participantNames,
        };

        if (existingSession.mode === 'Private' || participantCount >= 4) {
          status = 'full';
        } else {
          status = 'partial';
        }
      }

      slots.push({
        time: `${hStr}:00`,
        start_time: slotStartDate.toISOString(),
        status,
        details,
      });
    }

    return res.json({ slots, timeZone });
  } catch (error) {
    console.error('Admin availability error:', error);
    return res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Get price preview for admin booking
router.get('/bookings/price-preview', async (req, res) => {
  try {
    const { userId, classType, mode } = req.query;

    if (!userId || !classType || !mode) {
      return res.status(400).json({ error: 'userId, classType, and mode are required' });
    }

    const result = await calculatePriceForUser(
      userId as string,
      classType as string,
      mode as string
    );

    return res.json(result);
  } catch (error) {
    console.error('Price preview error:', error);
    return res.status(500).json({ error: 'Failed to calculate price' });
  }
});

// Create booking for user (admin)
router.post('/bookings', async (req: AuthRequest, res) => {
  try {
    const { userId, startTime, classType, mode, customPrice, notes } = req.body;

    if (!userId || !startTime || !classType || !mode) {
      return res.status(400).json({ error: 'userId, startTime, classType, and mode are required' });
    }

    // Verify user exists
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate price
    let price: number;
    if (customPrice !== undefined && customPrice !== null) {
      price = customPrice;
    } else {
      const priceResult = await calculatePriceForUser(userId, classType, mode);
      price = priceResult.price;
    }

    // Find or create session
    const [existingSession] = await db
      .select()
      .from(schema.classSessions)
      .where(
        and(
          eq(schema.classSessions.startTime, startTime),
          ne(schema.classSessions.status, 'cancelled')
        )
      )
      .limit(1);

    let session;

    if (existingSession) {
      session = existingSession;

      // Validation
      if (session.mode === 'Private') {
        return res.status(400).json({ error: 'This slot is already booked for a private session' });
      }

      // Check capacity
      const bookings = await db
        .select()
        .from(schema.bookings)
        .where(
          and(
            eq(schema.bookings.sessionId, session.id),
            eq(schema.bookings.status, 'confirmed')
          )
        );

      if (bookings.length >= 4) {
        return res.status(400).json({ error: 'Class is full' });
      }

      // Check if user already booked
      const userBooking = bookings.find((b) => b.userId === userId);
      if (userBooking) {
        return res.status(400).json({ error: 'User is already booked for this class' });
      }
    } else {
      // Create new session
      const endTime = addHours(parseISO(startTime), 1).toISOString();

      // Create Google Calendar Event if available
      let googleEventId: string | null = null;
      const calendarService = await getCalendarService();
      if (calendarService) {
        try {
          const event = await calendarService.createEvent({
            summary: `Halo Fitness: ${classType} (${mode})`,
            description: `Booked by admin for ${user.firstName || user.email}${notes ? `\n\nNotes: ${notes}` : ''}`,
            startTime,
            endTime,
          });
          googleEventId = event?.id || null;
        } catch (e) {
          console.error('Failed to create calendar event:', e);
        }
      }

      const [newSession] = await db
        .insert(schema.classSessions)
        .values({
          startTime,
          endTime,
          classType,
          mode,
          status: 'scheduled',
          googleEventId,
        })
        .returning();

      session = newSession;
    }

    // Create booking
    const [booking] = await db
      .insert(schema.bookings)
      .values({
        sessionId: session.id,
        userId,
        price,
        status: 'confirmed',
      })
      .returning();

    // Send confirmation email
    try {
      await sendBookingConfirmation({
        to: user.email,
        firstName: user.firstName || 'there',
        classType,
        mode,
        startTime,
        price,
      });
    } catch (e) {
      console.error('Failed to send email:', e);
    }

    // Notify other admins
    try {
      notifyAdminsNewBooking({
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        userEmail: user.email,
        userPhone: user.phoneNumber || undefined,
        classType,
        mode,
        startTime,
        price,
      });
    } catch (e) {
      console.error('Failed to notify admins:', e);
    }

    return res.json({ success: true, booking, session });
  } catch (error) {
    console.error('Admin create booking error:', error);
    return res.status(500).json({ error: 'Failed to create booking' });
  }
});

export default router;
