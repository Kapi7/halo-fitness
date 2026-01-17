import 'dotenv/config';
import { db } from './index.js';
import { scheduleConfigs, users } from './schema.js';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('Seeding database...');

  // Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'hilada89@gmail.com';
  const hashedPassword = await bcrypt.hash('admin123', 10);

  try {
    await db.insert(users).values({
      email: adminEmail,
      passwordHash: hashedPassword,
      firstName: 'Hila',
      lastName: 'Admin',
      isAdmin: true,
    }).onConflictDoNothing();
    console.log(`Admin user created: ${adminEmail}`);
  } catch (e) {
    console.log('Admin user already exists');
  }

  // Default schedule config (Mon-Fri)
  const defaultSchedule = [
    { dayOfWeek: 0, startTime: '08:00', slotsCount: 4, isClosed: true },  // Sunday - closed
    { dayOfWeek: 1, startTime: '08:15', slotsCount: 4, isClosed: false }, // Monday
    { dayOfWeek: 2, startTime: '08:15', slotsCount: 4, isClosed: false }, // Tuesday
    { dayOfWeek: 3, startTime: '08:00', slotsCount: 4, isClosed: false }, // Wednesday
    { dayOfWeek: 4, startTime: '09:30', slotsCount: 4, isClosed: false }, // Thursday
    { dayOfWeek: 5, startTime: '09:00', slotsCount: 4, isClosed: false }, // Friday
    { dayOfWeek: 6, startTime: '08:00', slotsCount: 4, isClosed: true },  // Saturday - closed
  ];

  for (const config of defaultSchedule) {
    try {
      await db.insert(scheduleConfigs).values({
        type: 'default',
        dayOfWeek: config.dayOfWeek,
        startTime: config.startTime,
        slotsCount: config.slotsCount,
        isClosed: config.isClosed,
      }).onConflictDoNothing();
    } catch (e) {
      // Already exists
    }
  }

  console.log('Default schedule seeded');
  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
