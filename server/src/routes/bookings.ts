import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, ne } from 'drizzle-orm';
import { addHours, parseISO, format, differenceInHours } from 'date-fns';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { getCalendarService } from '../services/calendar.js';
import { sendBookingConfirmation } from '../services/email.js';
import { notifyAdminsNewBooking, notifyAdminsCancellation } from '../services/notifications.js';
import { google } from 'googleapis';

const router = Router();

// Helper to add event to user's personal Google Calendar
async function addToUserCalendar(userId: string, event: {
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
}): Promise<string | null> {
  try {
    const [token] = await db
      .select()
      .from(schema.userCalendarTokens)
      .where(eq(schema.userCalendarTokens.userId, userId))
      .limit(1);

    if (!token) return null;

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Check if token is expired and refresh if needed
    const expiresAt = token.expiresAt ? new Date(token.expiresAt) : null;
    let accessToken = token.accessToken;

    if (expiresAt && expiresAt < new Date() && token.refreshToken) {
      client.setCredentials({ refresh_token: token.refreshToken });
      const { credentials } = await client.refreshAccessToken();
      accessToken = credentials.access_token!;

      await db
        .update(schema.userCalendarTokens)
        .set({
          accessToken,
          expiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
        })
        .where(eq(schema.userCalendarTokens.id, token.id));
    }

    client.setCredentials({ access_token: accessToken });
    const calendar = google.calendar({ version: 'v3', auth: client });

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startTime, timeZone: 'Europe/Berlin' },
        end: { dateTime: event.endTime, timeZone: 'Europe/Berlin' },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 1440 }, // 24 hours
          ],
        },
      },
    });

    return response.data.id || null;
  } catch (error) {
    console.error('Failed to add to user calendar:', error);
    return null;
  }
}

// Calculate price based on class type and mode
function calculatePrice(classType: string, mode: string): number {
  if (classType === 'HIIT') return mode === 'Private' ? 45 : 25;
  if (classType === 'Pilates Reformer') return 50;
  if (classType === 'Pilates Clinical Rehab') return 75;
  if (classType === 'Pilates Matte') return 25;
  return 0;
}

// Create booking
router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { start_time, class_type, mode, user_info } = req.body;
    const userId = req.user!.id;

    // Update user profile if provided
    if (user_info) {
      await db
        .update(schema.users)
        .set({
          firstName: user_info.first_name,
          lastName: user_info.last_name,
          phoneNumber: user_info.phone_number,
        })
        .where(eq(schema.users.id, userId));
    }

    // Find or create session
    const [existingSession] = await db
      .select()
      .from(schema.classSessions)
      .where(
        and(
          eq(schema.classSessions.startTime, start_time),
          ne(schema.classSessions.status, 'cancelled')
        )
      )
      .limit(1);

    let session;
    const price = calculatePrice(class_type, mode);

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
        return res.status(400).json({ error: 'You are already booked for this class' });
      }
    } else {
      // Create new session
      const endTime = addHours(parseISO(start_time), 1).toISOString();

      // Create Google Calendar Event if available
      let googleEventId: string | null = null;
      const calendarService = await getCalendarService();
      if (calendarService) {
        try {
          const [user] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .limit(1);

          const event = await calendarService.createEvent({
            summary: `Halo Fitness: ${class_type} (${mode})`,
            description: `Booked by ${user?.firstName || 'User'}`,
            startTime: start_time,
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
          startTime: start_time,
          endTime,
          classType: class_type,
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
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      if (user) {
        await sendBookingConfirmation({
          to: user.email,
          firstName: user.firstName || 'there',
          classType: class_type,
          mode,
          startTime: start_time,
          price,
        });
      }
    } catch (e) {
      console.error('Failed to send email:', e);
    }

    // Add to user's Google Calendar if connected
    let userCalendarEventId: string | null = null;
    try {
      const endTime = addHours(parseISO(start_time), 1).toISOString();
      userCalendarEventId = await addToUserCalendar(userId, {
        summary: `Halo Fitness: ${class_type} (${mode})`,
        description: `Your ${mode.toLowerCase()} ${class_type} session at Halo Fitness.\n\nPrice: ${price}€\n\nCancellation policy: Free cancellation up to 24 hours before the class.`,
        startTime: start_time,
        endTime,
      });
    } catch (e) {
      console.error('Failed to add to user calendar:', e);
    }

    // Notify admins about new booking
    try {
      const [bookedUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      if (bookedUser) {
        notifyAdminsNewBooking({
          userName: `${bookedUser.firstName || ''} ${bookedUser.lastName || ''}`.trim() || bookedUser.email,
          userEmail: bookedUser.email,
          userPhone: bookedUser.phoneNumber || undefined,
          classType: class_type,
          mode,
          startTime: start_time,
          price,
        });
      }
    } catch (e) {
      console.error('Failed to notify admins:', e);
    }

    return res.json({ success: true, booking, calendarAdded: !!userCalendarEventId });
  } catch (error) {
    console.error('Booking error:', error);
    return res.status(500).json({ error: 'Booking failed' });
  }
});

// Get user's bookings
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    const bookings = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.userId, userId))
      .orderBy(schema.bookings.createdAt);

    // Enrich with session details
    const enrichedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const [session] = await db
          .select()
          .from(schema.classSessions)
          .where(eq(schema.classSessions.id, booking.sessionId))
          .limit(1);
        return { ...booking, session };
      })
    );

    return res.json({ bookings: enrichedBookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    return res.status(500).json({ error: 'Failed to get bookings' });
  }
});

// Cancel booking
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    // Fetch booking
    const [booking] = await db
      .select()
      .from(schema.bookings)
      .where(eq(schema.bookings.id, id))
      .limit(1);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Verify ownership
    if (booking.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Get session
    const [session] = await db
      .select()
      .from(schema.classSessions)
      .where(eq(schema.classSessions.id, booking.sessionId))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check 24h rule
    const sessionStart = new Date(session.startTime);
    const now = new Date();
    const diffHours = differenceInHours(sessionStart, now);

    if (diffHours < 24) {
      return res.status(400).json({
        error: 'Cancellations are only allowed up to 24 hours before the class.',
      });
    }

    // Cancel booking
    await db
      .update(schema.bookings)
      .set({ status: 'cancelled' })
      .where(eq(schema.bookings.id, id));

    // Notify admins about cancellation
    try {
      const [cancelledUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1);

      if (cancelledUser) {
        notifyAdminsCancellation({
          userName: `${cancelledUser.firstName || ''} ${cancelledUser.lastName || ''}`.trim() || cancelledUser.email,
          userEmail: cancelledUser.email,
          userPhone: cancelledUser.phoneNumber || undefined,
          classType: session.classType || 'Class',
          mode: session.mode || 'Session',
          startTime: session.startTime,
          price: booking.price || 0,
        });
      }
    } catch (e) {
      console.error('Failed to notify admins about cancellation:', e);
    }

    // Check if remaining active participants
    const remainingBookings = await db
      .select()
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.sessionId, session.id),
          eq(schema.bookings.status, 'confirmed')
        )
      );

    if (remainingBookings.length === 0) {
      // Session is empty -> Cancel session & GCal event
      await db
        .update(schema.classSessions)
        .set({ status: 'cancelled' })
        .where(eq(schema.classSessions.id, session.id));

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
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Cancel booking error:', error);
    return res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

export default router;
