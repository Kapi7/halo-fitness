import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'), // nullable for OAuth-only users
  firstName: text('first_name'),
  lastName: text('last_name'),
  phoneNumber: text('phone_number'),
  isAdmin: integer('is_admin', { mode: 'boolean' }).default(false),
  googleId: text('google_id'), // Google OAuth ID
  avatarUrl: text('avatar_url'), // Profile picture
  pricingTierId: text('pricing_tier_id'), // FK to pricing_tiers (nullable, no default tier)
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Class Sessions table
export const classSessions = sqliteTable('class_sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  startTime: text('start_time').notNull(), // ISO datetime string
  endTime: text('end_time').notNull(),
  classType: text('class_type', {
    enum: ['HIIT', 'Pilates Reformer', 'Pilates Clinical Rehab', 'Pilates Matte']
  }).notNull(),
  mode: text('mode', { enum: ['Private', 'Group'] }).notNull(),
  status: text('status', { enum: ['scheduled', 'cancelled', 'completed'] }).default('scheduled'),
  googleEventId: text('google_event_id'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Bookings table
export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').notNull().references(() => classSessions.id),
  userId: text('user_id').notNull().references(() => users.id),
  price: real('price').notNull(),
  status: text('status', { enum: ['confirmed', 'cancelled'] }).default('confirmed'),
  userCalendarEventId: text('user_calendar_event_id'), // User's personal Google Calendar event ID
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Schedule Configuration table
export const scheduleConfigs = sqliteTable('schedule_configs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type', { enum: ['default', 'override', 'weekly_override'] }).notNull(),
  dayOfWeek: integer('day_of_week'), // 0-6 (Sun-Sat)
  specificDate: text('specific_date'), // YYYY-MM-DD for single day overrides
  weekStartDate: text('week_start_date'), // YYYY-MM-DD of Monday for weekly overrides
  startTime: text('start_time'), // HH:mm format
  slotsCount: integer('slots_count').default(4),
  isClosed: integer('is_closed', { mode: 'boolean' }).default(false),
  classType: text('class_type'), // Preset class type for this slot (null = user chooses)
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Google OAuth tokens (for admin calendar sync)
export const googleTokens = sqliteTable('google_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// User Calendar tokens (for user's personal calendar sync)
export const userCalendarTokens = sqliteTable('user_calendar_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().unique().references(() => users.id),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: text('expires_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Slot Closures - for closing specific hours/slots
export const slotClosures = sqliteTable('slot_closures', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  date: text('date').notNull(), // YYYY-MM-DD
  startTime: text('start_time'), // HH:mm (nullable if using slotIndex)
  endTime: text('end_time'), // HH:mm (nullable if using slotIndex)
  slotIndex: integer('slot_index'), // 0-based (nullable if using time range)
  reason: text('reason'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Pricing Tiers - VIP, Regular, etc.
export const pricingTiers = sqliteTable('pricing_tiers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  discountPercent: real('discount_percent').default(0),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Tier Pricing - class prices per tier
export const tierPricing = sqliteTable('tier_pricing', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  tierId: text('tier_id').notNull().references(() => pricingTiers.id),
  classType: text('class_type', {
    enum: ['HIIT', 'Pilates Reformer', 'Pilates Clinical Rehab', 'Pilates Matte']
  }).notNull(),
  mode: text('mode', { enum: ['Private', 'Group'] }).notNull(),
  price: real('price').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// User Pricing - individual overrides
export const userPricing = sqliteTable('user_pricing', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  classType: text('class_type', {
    enum: ['HIIT', 'Pilates Reformer', 'Pilates Clinical Rehab', 'Pilates Matte']
  }).notNull(),
  mode: text('mode', { enum: ['Private', 'Group'] }).notNull(),
  customPrice: real('custom_price'), // Specific price override
  discountPercent: real('discount_percent'), // OR discount percent
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// User Notes - admin notes about users
export const userNotes = sqliteTable('user_notes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  adminId: text('admin_id').notNull().references(() => users.id),
  note: text('note').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// Types for use in the application
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ClassSession = typeof classSessions.$inferSelect;
export type NewClassSession = typeof classSessions.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type ScheduleConfig = typeof scheduleConfigs.$inferSelect;
export type NewScheduleConfig = typeof scheduleConfigs.$inferInsert;
export type SlotClosure = typeof slotClosures.$inferSelect;
export type NewSlotClosure = typeof slotClosures.$inferInsert;
export type PricingTier = typeof pricingTiers.$inferSelect;
export type NewPricingTier = typeof pricingTiers.$inferInsert;
export type TierPricing = typeof tierPricing.$inferSelect;
export type NewTierPricing = typeof tierPricing.$inferInsert;
export type UserPricing = typeof userPricing.$inferSelect;
export type NewUserPricing = typeof userPricing.$inferInsert;
export type UserNote = typeof userNotes.$inferSelect;
export type NewUserNote = typeof userNotes.$inferInsert;
