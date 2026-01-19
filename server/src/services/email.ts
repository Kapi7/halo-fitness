import nodemailer from 'nodemailer';
import { format, parseISO, addHours } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const CYPRUS_TIMEZONE = 'Asia/Nicosia';

function formatInTimezone(date: Date | string, formatStr: string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  const zonedDate = toZonedTime(d, CYPRUS_TIMEZONE);
  return format(zonedDate, formatStr);
}

interface BookingEmailData {
  to: string;
  firstName: string;
  classType: string;
  mode: string;
  startTime: string;
  price?: number;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.log('Email not configured (missing SMTP credentials)');
      return null;
    }

    transporter = nodemailer.createTransport({
      host,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: { user, pass },
    });
  }
  return transporter;
}

function generateGoogleCalendarLink(data: BookingEmailData): string {
  const startDate = parseISO(data.startTime);
  const endDate = addHours(startDate, 1);

  const formatForCalendar = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `🏋️ Halo Fitness: ${data.classType} (${data.mode})`,
    dates: `${formatForCalendar(startDate)}/${formatForCalendar(endDate)}`,
    details: `Your ${data.mode.toLowerCase()} ${data.classType} session at Halo Fitness.${data.price ? `\n\nPrice: €${data.price}` : ''}\n\nCancellation policy: Free cancellation up to 24 hours before the class.\n\nManage your booking: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile`,
    location: 'Halo Fitness, Limassol, Cyprus',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export async function sendBookingConfirmation(data: BookingEmailData): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.log('Skipping email - SMTP not configured');
    return false;
  }

  const formattedDate = formatInTimezone(data.startTime, "EEEE, MMMM d");
  const formattedTime = formatInTimezone(data.startTime, "HH:mm");
  const from = process.env.EMAIL_FROM || 'noreply@halofitness.com';
  const calendarLink = generateGoogleCalendarLink(data);
  const profileUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8f4f6;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f4f6; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 8px 40px rgba(207, 68, 143, 0.15);">

              <!-- Header with Emoji -->
              <tr>
                <td style="background: linear-gradient(135deg, #cf448f 0%, #9c27b0 50%, #ad1457 100%); padding: 50px 30px; text-align: center;">
                  <p style="margin: 0 0 15px; font-size: 50px;">🎉</p>
                  <h1 style="margin: 0; color: #ffffff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 32px; font-weight: 300; letter-spacing: 4px;">HALO FITNESS</h1>
                  <p style="margin: 15px 0 0; color: rgba(255,255,255,0.9); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; letter-spacing: 2px;">LIMASSOL, CYPRUS</p>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="padding: 40px 40px 20px; text-align: center; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                  <h2 style="margin: 0 0 10px; color: #333333; font-size: 28px; font-weight: 700;">
                    Hey ${data.firstName}! 👋
                  </h2>
                  <p style="margin: 0; color: #666666; font-size: 18px; line-height: 1.6;">
                    Your spot is <span style="color: #cf448f; font-weight: 600;">secured</span>! ✅
                  </p>
                  <p style="margin: 10px 0 0; color: #888888; font-size: 15px;">
                    Get ready to crush it! 💪
                  </p>
                </td>
              </tr>

              <!-- Booking Details Card -->
              <tr>
                <td style="padding: 20px 30px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(145deg, #fff5f8 0%, #fce4ec 100%); border-radius: 16px; overflow: hidden; border: 2px solid #f8bbd9;">
                    <tr>
                      <td style="padding: 30px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">

                        <!-- Class Type -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                          <tr>
                            <td width="50" style="vertical-align: top;">
                              <span style="font-size: 28px;">🏋️</span>
                            </td>
                            <td style="vertical-align: top;">
                              <p style="margin: 0; color: #cf448f; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Your Class</p>
                              <p style="margin: 6px 0 0; color: #333333; font-size: 20px; font-weight: 700;">${data.classType}</p>
                            </td>
                          </tr>
                        </table>

                        <!-- Mode -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                          <tr>
                            <td width="50" style="vertical-align: top;">
                              <span style="font-size: 28px;">${data.mode === 'Private' ? '👤' : '👥'}</span>
                            </td>
                            <td style="vertical-align: top;">
                              <p style="margin: 0; color: #cf448f; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Session Type</p>
                              <p style="margin: 6px 0 0; color: #333333; font-size: 20px; font-weight: 700;">${data.mode} Session</p>
                            </td>
                          </tr>
                        </table>

                        <!-- Date & Time -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: ${data.price ? '20px' : '0'};">
                          <tr>
                            <td width="50" style="vertical-align: top;">
                              <span style="font-size: 28px;">📅</span>
                            </td>
                            <td style="vertical-align: top;">
                              <p style="margin: 0; color: #cf448f; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Date & Time</p>
                              <p style="margin: 6px 0 0; color: #333333; font-size: 18px; font-weight: 600;">${formattedDate}</p>
                              <p style="margin: 4px 0 0; color: #cf448f; font-size: 24px; font-weight: 800;">⏰ ${formattedTime}</p>
                            </td>
                          </tr>
                        </table>

                        ${data.price ? `
                        <!-- Price -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="50" style="vertical-align: top;">
                              <span style="font-size: 28px;">💰</span>
                            </td>
                            <td style="vertical-align: top;">
                              <p style="margin: 0; color: #cf448f; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 600;">Investment</p>
                              <p style="margin: 6px 0 0; color: #333333; font-size: 22px; font-weight: 700;">€${data.price}</p>
                            </td>
                          </tr>
                        </table>
                        ` : ''}

                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Action Buttons -->
              <tr>
                <td style="padding: 0 30px 30px; text-align: center;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-bottom: 15px;">
                        <a href="${calendarLink}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #4285f4 0%, #1a73e8 100%); color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; box-shadow: 0 4px 15px rgba(66, 133, 244, 0.3);">
                          📅 Add to Calendar
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <a href="${profileUrl}" style="display: inline-block; background: linear-gradient(135deg, #cf448f 0%, #ad1457 100%); color: #ffffff; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; box-shadow: 0 4px 15px rgba(207, 68, 143, 0.3);">
                          👀 View My Bookings
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Quick Tips -->
              <tr>
                <td style="padding: 0 30px 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); border-radius: 12px;">
                    <tr>
                      <td style="padding: 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                        <p style="margin: 0 0 10px; color: #1565c0; font-size: 15px; font-weight: 700;">💡 Before You Arrive:</p>
                        <p style="margin: 0; color: #37474f; font-size: 14px; line-height: 1.8;">
                          ✓ Wear comfortable workout clothes<br>
                          ✓ Bring a water bottle<br>
                          ✓ Arrive 5-10 minutes early
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Cancellation Notice -->
              <tr>
                <td style="padding: 0 30px 30px; text-align: center; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                  <p style="margin: 0; padding: 15px 20px; background-color: #fff8e1; border-radius: 10px; color: #f57c00; font-size: 13px; line-height: 1.6;">
                    ⚠️ Need to reschedule? Cancel up to <strong>24 hours</strong> before your session for free!
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; text-align: center; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                  <p style="margin: 0 0 8px; font-size: 24px;">✨</p>
                  <p style="margin: 0 0 5px; color: #ffffff; font-size: 16px; font-weight: 300; letter-spacing: 3px;">HALO FITNESS</p>
                  <p style="margin: 0 0 15px; color: #cf448f; font-size: 12px; letter-spacing: 1px;">Elevate Your Wellness Journey</p>
                  <p style="margin: 0; color: #666666; font-size: 11px;">
                    📍 Limassol, Cyprus &nbsp;|&nbsp; 📱 WhatsApp: +357 96 326140
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    await transport.sendMail({
      from,
      to: data.to,
      subject: `🎉 You're In! ${data.classType} Booked for ${formattedDate}`,
      html,
    });
    console.log(`Confirmation email sent to ${data.to}`);
    return true;
  } catch (error) {
    console.error('Send email error:', error);
    return false;
  }
}
