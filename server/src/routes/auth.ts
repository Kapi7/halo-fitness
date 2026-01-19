import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth.js';
import { google } from 'googleapis';

const router = Router();

// Initialize Google OAuth2 client for user auth (separate from calendar)
function getGoogleAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_AUTH_REDIRECT_URI || 'http://localhost:5173/auth/google/callback';

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phoneNumber } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user exists
    const [existingUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [newUser] = await db
      .insert(schema.users)
      .values({
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName,
        lastName,
        phoneNumber,
      })
      .returning();

    const token = generateToken(newUser.id);

    return res.json({
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        phoneNumber: newUser.phoneNumber,
      },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        isAdmin: user.isAdmin,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, req.user!.id))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      isAdmin: user.isAdmin,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update profile
router.put('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, phoneNumber } = req.body;

    const [updatedUser] = await db
      .update(schema.users)
      .set({
        firstName,
        lastName,
        phoneNumber,
      })
      .where(eq(schema.users.id, req.user!.id))
      .returning();

    return res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      phoneNumber: updatedUser.phoneNumber,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

// User Calendar - Get connection status
router.get('/calendar/status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const [token] = await db
      .select()
      .from(schema.userCalendarTokens)
      .where(eq(schema.userCalendarTokens.userId, req.user!.id))
      .limit(1);

    return res.json({ connected: !!token });
  } catch (error) {
    console.error('Get calendar status error:', error);
    return res.status(500).json({ error: 'Failed to get calendar status' });
  }
});

// User Calendar - Get auth URL
router.get('/calendar/url', authMiddleware, (req, res) => {
  const client = getGoogleAuthClient();
  if (!client) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  // Use a different redirect URI for calendar auth
  const calendarClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:5173/auth/calendar/callback'
  );

  const url = calendarClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
    ],
    prompt: 'consent',
  });

  return res.json({ url });
});

// User Calendar - Handle callback
router.post('/calendar/callback', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const calendarClient = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:5173/auth/calendar/callback'
    );

    const { tokens } = await calendarClient.getToken(code);

    // Check if user already has tokens
    const [existing] = await db
      .select()
      .from(schema.userCalendarTokens)
      .where(eq(schema.userCalendarTokens.userId, req.user!.id))
      .limit(1);

    if (existing) {
      await db
        .update(schema.userCalendarTokens)
        .set({
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || existing.refreshToken,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        })
        .where(eq(schema.userCalendarTokens.id, existing.id));
    } else {
      await db.insert(schema.userCalendarTokens).values({
        userId: req.user!.id,
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Calendar callback error:', error);
    return res.status(500).json({ error: 'Failed to connect calendar' });
  }
});

// User Calendar - Disconnect
router.delete('/calendar', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await db
      .delete(schema.userCalendarTokens)
      .where(eq(schema.userCalendarTokens.userId, req.user!.id));

    return res.json({ success: true });
  } catch (error) {
    console.error('Disconnect calendar error:', error);
    return res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

// Google OAuth - Get authorization URL
router.get('/google/url', (req, res) => {
  const client = getGoogleAuthClient();
  if (!client) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }

  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    prompt: 'consent',
  });

  return res.json({ url });
});

// Google OAuth - Handle callback and login/register user
router.post('/google/callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const client = getGoogleAuthClient();
    if (!client) {
      return res.status(500).json({ error: 'Google OAuth not configured' });
    }

    // Exchange code for tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Get user info from Google
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data: googleUser } = await oauth2.userinfo.get();

    if (!googleUser.email) {
      return res.status(400).json({ error: 'Could not get email from Google' });
    }

    // Check if user exists by email or Google ID
    let [existingUser] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, googleUser.email.toLowerCase()))
      .limit(1);

    let user;

    if (existingUser) {
      // Update Google ID and avatar if not set
      if (!existingUser.googleId || !existingUser.avatarUrl) {
        const [updated] = await db
          .update(schema.users)
          .set({
            googleId: googleUser.id,
            avatarUrl: googleUser.picture,
            firstName: existingUser.firstName || googleUser.given_name,
            lastName: existingUser.lastName || googleUser.family_name,
          })
          .where(eq(schema.users.id, existingUser.id))
          .returning();
        user = updated;
      } else {
        user = existingUser;
      }
    } else {
      // Create new user
      const [newUser] = await db
        .insert(schema.users)
        .values({
          email: googleUser.email.toLowerCase(),
          googleId: googleUser.id,
          firstName: googleUser.given_name,
          lastName: googleUser.family_name,
          avatarUrl: googleUser.picture,
        })
        .returning();
      user = newUser;
    }

    const token = generateToken(user.id);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        avatarUrl: user.avatarUrl,
        isAdmin: user.isAdmin,
      },
      token,
    });
  } catch (error: any) {
    console.error('Google OAuth callback error:', error?.message || error);
    console.error('Full error:', JSON.stringify(error?.response?.data || error, null, 2));
    return res.status(500).json({
      error: 'Google authentication failed',
      details: error?.message || 'Unknown error'
    });
  }
});

export default router;
