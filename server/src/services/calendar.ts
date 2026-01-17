import { google } from 'googleapis';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  startTime: string;
  endTime: string;
}

interface CalendarService {
  getEvents: (timeMin: Date, timeMax: Date) => Promise<any[]>;
  createEvent: (event: CalendarEvent) => Promise<any>;
  updateEvent: (eventId: string, event: Partial<CalendarEvent>) => Promise<any>;
  deleteEvent: (eventId: string) => Promise<void>;
}

let oauth2Client: any = null;

function getOAuth2Client() {
  if (!oauth2Client) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret) {
      return null;
    }

    oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }
  return oauth2Client;
}

export function getAuthUrl(): string | null {
  const client = getOAuth2Client();
  if (!client) return null;

  return client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
}

export async function handleOAuthCallback(code: string, userId: string): Promise<boolean> {
  try {
    const client = getOAuth2Client();
    if (!client) return false;

    const { tokens } = await client.getToken(code);

    // Store tokens in database
    await db.insert(schema.googleTokens).values({
      userId,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
    });

    return true;
  } catch (error) {
    console.error('OAuth callback error:', error);
    return false;
  }
}

async function getValidAccessToken(): Promise<string | null> {
  try {
    // Get the admin user's tokens (assuming admin is the calendar owner)
    const adminEmail = process.env.ADMIN_EMAIL || 'hilada89@gmail.com';
    const [adminUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, adminEmail.toLowerCase()))
      .limit(1);

    if (!adminUser) return null;

    const [token] = await db
      .select()
      .from(schema.googleTokens)
      .where(eq(schema.googleTokens.userId, adminUser.id))
      .limit(1);

    if (!token) return null;

    // Check if token is expired
    const expiresAt = token.expiresAt ? new Date(token.expiresAt) : null;
    if (expiresAt && expiresAt < new Date()) {
      // Token expired, try to refresh
      if (token.refreshToken) {
        const client = getOAuth2Client();
        if (client) {
          client.setCredentials({ refresh_token: token.refreshToken });
          const { credentials } = await client.refreshAccessToken();

          // Update stored token
          await db
            .update(schema.googleTokens)
            .set({
              accessToken: credentials.access_token!,
              expiresAt: credentials.expiry_date
                ? new Date(credentials.expiry_date).toISOString()
                : null,
            })
            .where(eq(schema.googleTokens.id, token.id));

          return credentials.access_token!;
        }
      }
      return null;
    }

    return token.accessToken;
  } catch (error) {
    console.error('Get access token error:', error);
    return null;
  }
}

export async function getCalendarService(): Promise<CalendarService | null> {
  const client = getOAuth2Client();
  if (!client) {
    console.log('Google Calendar not configured (missing credentials)');
    return null;
  }

  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    console.log('No valid Google Calendar access token');
    return null;
  }

  client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: 'v3', auth: client });

  return {
    async getEvents(timeMin: Date, timeMax: Date) {
      try {
        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin: timeMin.toISOString(),
          timeMax: timeMax.toISOString(),
          singleEvents: true,
        });
        return response.data.items || [];
      } catch (error) {
        console.error('Get events error:', error);
        return [];
      }
    },

    async createEvent(event: CalendarEvent) {
      try {
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: event.summary,
            description: event.description,
            start: { dateTime: event.startTime },
            end: { dateTime: event.endTime },
          },
        });
        return response.data;
      } catch (error) {
        console.error('Create event error:', error);
        return null;
      }
    },

    async updateEvent(eventId: string, event: Partial<CalendarEvent>) {
      try {
        const response = await calendar.events.patch({
          calendarId: 'primary',
          eventId,
          requestBody: {
            ...(event.summary && { summary: event.summary }),
            ...(event.description && { description: event.description }),
            ...(event.startTime && { start: { dateTime: event.startTime } }),
            ...(event.endTime && { end: { dateTime: event.endTime } }),
          },
        });
        return response.data;
      } catch (error) {
        console.error('Update event error:', error);
        return null;
      }
    },

    async deleteEvent(eventId: string) {
      try {
        await calendar.events.delete({
          calendarId: 'primary',
          eventId,
        });
      } catch (error) {
        console.error('Delete event error:', error);
      }
    },
  };
}
