import { Router } from 'express';
import { db, schema } from '../db/index.js';
import { eq, and, ne, gte, lte } from 'drizzle-orm';
import { addHours, parseISO, format } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { getCalendarService } from '../services/calendar.js';

const router = Router();

interface SlotDetails {
  session_id?: string;
  class_type: string;
  mode: string;
  participants: number;
  participant_names?: string[];
  is_preset?: boolean;
  preset_class_type?: string; // Preset class type from schedule config
}

interface Slot {
  time: string;
  start_time: string;
  status: 'available' | 'busy' | 'full' | 'partial' | 'empty' | 'closed';
  details: SlotDetails | null;
  closureReason?: string;
}

router.get('/:date', async (req, res) => {
  try {
    const { date } = req.params; // YYYY-MM-DD
    const timeZone = 'Asia/Nicosia'; // Cyprus timezone

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Check if user is admin (from optional auth header)
    let isAdmin = false;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken');
        const token = authHeader.substring(7);
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'halo-secret-key') as any;
        if (decoded?.userId) {
          const [authUser] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, decoded.userId))
            .limit(1);
          if (authUser?.isAdmin) isAdmin = true;
        }
      } catch (e) {
        // Invalid token, not admin
      }
    }

    // Registration gate: check if next week's slots should be hidden
    if (!isAdmin) {
      const settings = await db.select().from(schema.appSettings);
      const settingsMap: Record<string, string> = {};
      for (const s of settings) settingsMap[s.key] = s.value;

      const registrationEnabled = settingsMap['registration_open_enabled'] === 'true';
      if (registrationEnabled) {
        const openDay = parseInt(settingsMap['registration_open_day'] || '5'); // Friday = 5
        const openTime = settingsMap['registration_open_time'] || '08:00';
        const [openH, openM] = openTime.split(':').map(Number);

        const { toZonedTime: toZoned } = await import('date-fns-tz');
        const nowInCyprus = toZoned(new Date(), timeZone);
        const currentDay = nowInCyprus.getDay();
        const currentHour = nowInCyprus.getHours();
        const currentMinute = nowInCyprus.getMinutes();

        // Calculate the Monday of the current week
        const nowDate = new Date(nowInCyprus);
        const daysSinceMonday = (currentDay === 0 ? 6 : currentDay - 1);
        const currentWeekMonday = new Date(nowDate);
        currentWeekMonday.setDate(nowDate.getDate() - daysSinceMonday);
        currentWeekMonday.setHours(0, 0, 0, 0);

        // Calculate next week Monday
        const nextWeekMonday = new Date(currentWeekMonday);
        nextWeekMonday.setDate(currentWeekMonday.getDate() + 7);

        // Check if requested date is in next week or later
        const [reqYear, reqMonth, reqDay] = date.split('-').map(Number);
        const requestedDate = new Date(reqYear, reqMonth - 1, reqDay);
        requestedDate.setHours(0, 0, 0, 0);

        if (requestedDate >= nextWeekMonday) {
          // Check if we've passed the opening time this week
          const hasOpeningPassed = currentDay > openDay ||
            (currentDay === openDay && (currentHour > openH || (currentHour === openH && currentMinute >= openM)));

          if (!hasOpeningPassed) {
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return res.json({
              slots: [],
              registrationLocked: true,
              message: `Registration for next week opens on ${dayNames[openDay]} at ${openTime}`,
            });
          }
        }
      }
    }

    // Get day of week - parse the date string directly to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day); // month is 0-indexed
    const dayOfWeek = localDate.getDay();

    // Fetch schedule configuration
    // 1. Check for specific date override
    const [override] = await db
      .select()
      .from(schema.scheduleConfigs)
      .where(
        and(
          eq(schema.scheduleConfigs.type, 'override'),
          eq(schema.scheduleConfigs.specificDate, date)
        )
      )
      .limit(1);

    let scheduleConfig = override;

    if (!scheduleConfig) {
      // 2. Check for weekly override
      const targetDate = new Date(date);
      const day = targetDate.getDay();
      const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);
      const mondayDate = new Date(targetDate);
      mondayDate.setDate(diff);
      const mondayStr = mondayDate.toISOString().split('T')[0];

      const [weeklyOverride] = await db
        .select()
        .from(schema.scheduleConfigs)
        .where(
          and(
            eq(schema.scheduleConfigs.type, 'weekly_override'),
            eq(schema.scheduleConfigs.weekStartDate, mondayStr),
            eq(schema.scheduleConfigs.dayOfWeek, dayOfWeek)
          )
        )
        .limit(1);

      scheduleConfig = weeklyOverride;
    }

    if (!scheduleConfig) {
      // 3. Get default config for this day
      const [defaultConfig] = await db
        .select()
        .from(schema.scheduleConfigs)
        .where(
          and(
            eq(schema.scheduleConfigs.type, 'default'),
            eq(schema.scheduleConfigs.dayOfWeek, dayOfWeek)
          )
        )
        .limit(1);

      scheduleConfig = defaultConfig;
    }

    // Fallback defaults if no config exists
    if (!scheduleConfig) {
      switch (dayOfWeek) {
        case 1: // Mon
        case 2: // Tue
          scheduleConfig = { startTime: '08:15', slotsCount: 4, isClosed: false } as any;
          break;
        case 3: // Wed
          scheduleConfig = { startTime: '08:00', slotsCount: 4, isClosed: false } as any;
          break;
        case 4: // Thu
          scheduleConfig = { startTime: '09:30', slotsCount: 4, isClosed: false } as any;
          break;
        case 5: // Fri
          scheduleConfig = { startTime: '09:00', slotsCount: 4, isClosed: false } as any;
          break;
        default:
          scheduleConfig = { isClosed: true, slotsCount: 0 } as any;
      }
    }

    if (scheduleConfig.isClosed) {
      return res.json({ slots: [], message: 'Gym is closed' });
    }

    // Parse start time
    const [startH, startM] = (scheduleConfig.startTime || '08:00').split(':').map(Number);

    // Fetch Google Calendar events if available
    let busyEvents: any[] = [];
    const calendarService = await getCalendarService();
    if (calendarService) {
      try {
        const timeMin = fromZonedTime(`${date}T00:00:00`, timeZone);
        const timeMax = fromZonedTime(`${date}T23:59:59`, timeZone);
        busyEvents = await calendarService.getEvents(timeMin, timeMax);
      } catch (e) {
        console.error('Failed to fetch calendar events:', e);
      }
    }

    // Fetch DB sessions for this date
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

    // Fetch slot closures for this date
    const slotClosures = await db
      .select()
      .from(schema.slotClosures)
      .where(eq(schema.slotClosures.date, date));

    // Generate slots
    const slots: Slot[] = [];
    const slotsToGenerate = scheduleConfig.slotsCount || 4;

    for (let i = 0; i < slotsToGenerate; i++) {
      const slotHour = startH + i;
      const slotMinute = startM;

      const hStr = String(slotHour).padStart(2, '0');
      const mStr = String(slotMinute).padStart(2, '0');
      const slotTimeString = `${date}T${hStr}:${mStr}:00`;

      const slotStartDate = fromZonedTime(slotTimeString, timeZone);
      const slotEndDate = addHours(slotStartDate, 1);

      let slotStatus: Slot = {
        time: `${hStr}:${mStr}`,
        start_time: slotStartDate.toISOString(),
        status: 'available',
        details: null,
      };

      // Check for slot closures
      const slotClosure = slotClosures.find((c) => {
        // Check by slot index
        if (c.slotIndex !== null && c.slotIndex === i) {
          return true;
        }
        // Check by time range
        if (c.startTime && c.endTime) {
          const slotTime = `${hStr}:${mStr}`;
          return slotTime >= c.startTime && slotTime < c.endTime;
        }
        return false;
      });

      if (slotClosure) {
        slotStatus.status = 'closed';
        slotStatus.closureReason = slotClosure.reason || undefined;
        slots.push(slotStatus);
        continue;
      }

      // Check calendar busy
      const isBusyInCalendar = busyEvents.some((event) => {
        if (!event.start || !event.end) return false;
        let eventStart: Date, eventEnd: Date;

        if (event.start.dateTime) {
          eventStart = new Date(event.start.dateTime);
        } else if (event.start.date) {
          eventStart = fromZonedTime(event.start.date, timeZone);
        } else {
          return false;
        }

        if (event.end.dateTime) {
          eventEnd = new Date(event.end.dateTime);
        } else if (event.end.date) {
          eventEnd = fromZonedTime(event.end.date, timeZone);
        } else {
          return false;
        }

        return eventStart < slotEndDate && eventEnd > slotStartDate;
      });

      // Check DB sessions
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
        if (existingSession.mode === 'Group' && participantCount > 0) {
          for (const booking of bookingsForSession) {
            const [user] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, booking.userId))
              .limit(1);
            if (user) {
              participantNames.push(user.firstName || 'Member');
            }
          }
        }

        slotStatus.details = {
          session_id: existingSession.id,
          class_type: existingSession.classType,
          mode: existingSession.mode,
          participants: participantCount,
          participant_names: participantNames,
        };

        if (existingSession.mode === 'Private' || participantCount >= 4) {
          slotStatus.status = 'full';
        } else {
          slotStatus.status = 'partial';
        }
      } else {
        if (isBusyInCalendar) {
          slotStatus.status = 'busy';
        } else {
          slotStatus.status = 'empty';
        }
      }

      // Check for preset class type from schedule config
      if (scheduleConfig.classType && slotStatus.status === 'empty') {
        slotStatus.details = {
          class_type: scheduleConfig.classType,
          mode: 'Group',
          participants: 0,
          is_preset: true,
          preset_class_type: scheduleConfig.classType,
        };
        slotStatus.status = 'partial';
      } else if (scheduleConfig.classType && slotStatus.status === 'available') {
        // For available slots with preset, include the preset info
        slotStatus.details = {
          class_type: scheduleConfig.classType,
          mode: 'Group',
          participants: 0,
          is_preset: true,
          preset_class_type: scheduleConfig.classType,
        };
      }

      slots.push(slotStatus);
    }

    return res.json({ slots, timeZone });
  } catch (error) {
    console.error('Availability error:', error);
    return res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

export default router;
