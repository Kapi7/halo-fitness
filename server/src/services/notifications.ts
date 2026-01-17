import { format, parseISO } from 'date-fns';

interface BookingNotification {
  userName: string;
  userEmail: string;
  userPhone?: string;
  classType: string;
  mode: string;
  startTime: string;
  price: number;
}

// ============================================
// WhatsApp Notifications (via Twilio)
// ============================================

async function sendWhatsAppNotification(
  to: string,
  message: string
): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    console.log('WhatsApp not configured (missing Twilio credentials)');
    return false;
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          From: fromNumber,
          To: `whatsapp:${to}`,
          Body: message,
        }),
      }
    );

    if (response.ok) {
      console.log(`WhatsApp sent to ${to}`);
      return true;
    } else {
      const error = await response.text();
      console.error('WhatsApp send error:', error);
      return false;
    }
  } catch (error) {
    console.error('WhatsApp error:', error);
    return false;
  }
}

// ============================================
// Email Notifications (via SMTP/Gmail)
// ============================================

import nodemailer from 'nodemailer';

let adminTransporter: nodemailer.Transporter | null = null;

function getAdminTransporter() {
  if (!adminTransporter) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      return null;
    }

    adminTransporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: { user, pass },
    });
  }
  return adminTransporter;
}

async function sendEmailNotification(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  const transport = getAdminTransporter();
  if (!transport) {
    console.log('Email not configured (missing SMTP credentials)');
    return false;
  }

  const from = process.env.EMAIL_FROM || 'noreply@halofitness.com';

  try {
    await transport.sendMail({ from, to, subject, html });
    console.log(`Admin email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Email error:', error);
    return false;
  }
}

// ============================================
// Admin Notification Functions
// ============================================

export async function notifyAdminsNewBooking(data: BookingNotification): Promise<void> {
  const formattedDate = format(parseISO(data.startTime), "EEEE, MMM d 'at' HH:mm");

  // Get admin contacts - exclude the user who just booked (they already got their confirmation)
  const adminEmails = (process.env.ADMIN_EMAILS || 'hilada89@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e !== data.userEmail.toLowerCase()); // Don't send admin email to the person who booked

  const adminPhones = (process.env.ADMIN_WHATSAPP_NUMBERS || '').split(',').map(p => p.trim()).filter(Boolean);

  // WhatsApp message for admins
  const whatsappMessage = `🎯 *New Booking at Halo Fitness*

👤 *Client:* ${data.userName}
📧 ${data.userEmail}
${data.userPhone ? `📱 ${data.userPhone}` : ''}

🏋️ *Class:* ${data.classType}
📍 *Mode:* ${data.mode}
📅 *Time:* ${formattedDate}
💰 *Price:* ${data.price}€

Check the admin dashboard for details.`;

  // Fresh Email HTML for admins
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f0f0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f0f0; padding: 30px 20px;">
        <tr>
          <td align="center">
            <table width="500" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                  <p style="margin: 0 0 10px; font-size: 40px;">🎯</p>
                  <h1 style="margin: 0; color: #ffffff; font-family: Arial, sans-serif; font-size: 22px; font-weight: 700;">New Booking!</h1>
                </td>
              </tr>

              <!-- Client Info -->
              <tr>
                <td style="padding: 25px 30px; font-family: Arial, sans-serif;">
                  <p style="margin: 0 0 15px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">👤 Client Details</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 10px; padding: 15px;">
                    <tr>
                      <td style="padding: 15px;">
                        <p style="margin: 0 0 8px; color: #111827; font-size: 18px; font-weight: 700;">${data.userName}</p>
                        <p style="margin: 0 0 5px; color: #6b7280; font-size: 14px;">📧 ${data.userEmail}</p>
                        ${data.userPhone ? `<p style="margin: 0; color: #6b7280; font-size: 14px;">📱 ${data.userPhone}</p>` : ''}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Booking Info -->
              <tr>
                <td style="padding: 0 30px 25px; font-family: Arial, sans-serif;">
                  <p style="margin: 0 0 15px; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">📋 Booking Details</p>
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%); border-radius: 10px; border: 2px solid #f9a8d4;">
                    <tr>
                      <td style="padding: 20px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding-bottom: 12px;">
                              <span style="color: #9ca3af; font-size: 12px;">CLASS</span><br>
                              <span style="color: #111827; font-size: 16px; font-weight: 700;">🏋️ ${data.classType}</span>
                            </td>
                            <td style="padding-bottom: 12px; text-align: right;">
                              <span style="color: #9ca3af; font-size: 12px;">MODE</span><br>
                              <span style="color: #111827; font-size: 16px; font-weight: 700;">${data.mode === 'Private' ? '👤' : '👥'} ${data.mode}</span>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <span style="color: #9ca3af; font-size: 12px;">DATE & TIME</span><br>
                              <span style="color: #111827; font-size: 16px; font-weight: 700;">📅 ${formattedDate}</span>
                            </td>
                            <td style="text-align: right;">
                              <span style="color: #9ca3af; font-size: 12px;">PRICE</span><br>
                              <span style="color: #10b981; font-size: 20px; font-weight: 800;">€${data.price}</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA Button -->
              <tr>
                <td style="padding: 0 30px 30px; text-align: center;">
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin"
                     style="display: inline-block; background: linear-gradient(135deg, #cf448f 0%, #ad1457 100%); color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 50px; font-family: Arial, sans-serif; font-size: 14px; font-weight: 600; box-shadow: 0 4px 15px rgba(207, 68, 143, 0.3);">
                    📊 Open Dashboard
                  </a>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background: #1f2937; padding: 20px; text-align: center; font-family: Arial, sans-serif;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">Halo Fitness Admin Notification</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Send WhatsApp to all admin phones
  for (const phone of adminPhones) {
    sendWhatsAppNotification(phone, whatsappMessage);
  }

  // Send Email to admin emails (excluding the booker)
  for (const email of adminEmails) {
    sendEmailNotification(email, `🎯 New Booking: ${data.classType} - ${data.userName}`, emailHtml);
  }
}

export async function notifyAdminsCancellation(data: BookingNotification): Promise<void> {
  const formattedDate = format(parseISO(data.startTime), "EEEE, MMM d 'at' HH:mm");

  const adminEmails = (process.env.ADMIN_EMAILS || 'hilada89@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e !== data.userEmail.toLowerCase());

  const adminPhones = (process.env.ADMIN_WHATSAPP_NUMBERS || '').split(',').map(p => p.trim()).filter(Boolean);

  const whatsappMessage = `❌ *Booking Cancelled*

👤 *Client:* ${data.userName}
🏋️ *Class:* ${data.classType}
📅 *Time:* ${formattedDate}

The slot is now available for other bookings.`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f0f0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0f0f0; padding: 30px 20px;">
        <tr>
          <td align="center">
            <table width="500" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center;">
                  <p style="margin: 0 0 10px; font-size: 40px;">❌</p>
                  <h1 style="margin: 0; color: #ffffff; font-family: Arial, sans-serif; font-size: 22px; font-weight: 700;">Booking Cancelled</h1>
                </td>
              </tr>

              <!-- Details -->
              <tr>
                <td style="padding: 30px; font-family: Arial, sans-serif;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: #fef2f2; border-radius: 10px; border: 2px solid #fecaca;">
                    <tr>
                      <td style="padding: 20px;">
                        <p style="margin: 0 0 10px; color: #111827; font-size: 16px;"><strong>👤 Client:</strong> ${data.userName}</p>
                        <p style="margin: 0 0 10px; color: #6b7280; font-size: 14px;">📧 ${data.userEmail}</p>
                        <p style="margin: 0 0 10px; color: #111827; font-size: 16px;"><strong>🏋️ Class:</strong> ${data.classType} (${data.mode})</p>
                        <p style="margin: 0; color: #111827; font-size: 16px;"><strong>📅 Time:</strong> ${formattedDate}</p>
                      </td>
                    </tr>
                  </table>
                  <p style="margin: 20px 0 0; color: #059669; font-size: 14px; text-align: center;">✅ This slot is now available for other bookings</p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background: #1f2937; padding: 20px; text-align: center; font-family: Arial, sans-serif;">
                  <p style="margin: 0; color: #9ca3af; font-size: 12px;">Halo Fitness Admin Notification</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  for (const phone of adminPhones) {
    sendWhatsAppNotification(phone, whatsappMessage);
  }

  for (const email of adminEmails) {
    sendEmailNotification(email, `❌ Cancelled: ${data.classType} - ${data.userName}`, emailHtml);
  }
}

// Send reminder to user (can be called by a scheduled job)
export async function sendBookingReminder(
  userPhone: string,
  userName: string,
  classType: string,
  startTime: string
): Promise<boolean> {
  const formattedDate = format(parseISO(startTime), "EEEE, MMM d 'at' HH:mm");

  const message = `⏰ *Reminder: Halo Fitness*

Hi ${userName}!

Your ${classType} session is coming up:
📅 ${formattedDate}

See you soon! 💪`;

  return sendWhatsAppNotification(userPhone, message);
}
