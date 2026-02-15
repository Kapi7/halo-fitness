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
