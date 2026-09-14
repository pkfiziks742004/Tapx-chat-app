const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");

let cachedTransporter = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const secure = process.env.SMTP_SECURE === "1" || port === 465;
  const user = process.env.SMTP_USER || "supreetmc2003@gmail.com";
  const rawPass = process.env.SMTP_PASS || "qssu mbcc yite isnh";
  const pass = String(rawPass).replace(/\s+/g, "").trim();
  const from = process.env.SMTP_FROM || user;
  const senderName = process.env.SMTP_SENDER_NAME || "Tapx";

  return { host, port, secure, user, pass, from, senderName };
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const { host, port, secure, user, pass } = getSmtpConfig();

  cachedTransporter = nodemailer.createTransport({
    host,
    port: port || 587,
    secure: Boolean(secure),
    auth: { user, pass },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: false
    }
  });

  return cachedTransporter;
}

async function sendOtpEmail({ to, otp, expiresMinutes = 10, subject, text } = {}) {
  try {
    const { from, senderName } = getSmtpConfig();
    const transporter = getTransporter();

    const mailSubject = subject || `Tapx verification code: ${otp}`;
    const mailText =
      text ||
      `Your Tapx verification code is: ${otp}\n\nThis code expires in ${expiresMinutes} minutes.\n\nIf you did not request this, you can ignore this email.`;

    const logoUrl = "https://res.cloudinary.com/dxje0ndk6/image/upload/v1789408424/tapx-logo.png";

    const html = `
      <div style="background-color: #f1f5f9; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 480px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 24px;">
            <img src="${logoUrl}" alt="Tapx" width="180" style="max-width: 180px; width: 100%; height: auto; display: block; margin: 0 auto; border: 0; outline: none;" />
          </div>
          <div style="background: #ffffff; border-radius: 12px; padding: 32px 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);">
            <h3 style="margin: 0 0 12px; color: #0f172a; font-size: 18px; font-weight: 600;">Verification Code</h3>
            <p style="font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 20px;">Use the following 6-digit OTP to complete your verification on Tapx:</p>
            <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 18px 24px; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1e293b; text-align: center; border-radius: 8px; margin: 0 0 20px;">
              ${otp}
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">This code is valid for <b>${expiresMinutes} minutes</b>. Do not share this code with anyone.</p>
          </div>
          <div style="text-align: center; margin-top: 20px; font-size: 12px; color: #94a3b8;">
            &copy; 2026 Tapx. Real-time chat &amp; calls.
          </div>
        </div>
      </div>
    `;

    return await transporter.sendMail({
      from: `"${senderName}" <${from}>`,
      to,
      subject: mailSubject,
      text: mailText,
      html,
      headers: {
        "X-Priority": "1",
        "X-MSMail-Priority": "High",
        Importance: "high"
      }
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Nodemailer sendMail failed:", err?.message || err);
    throw err;
  }
}

function warmupMailer() {
  try {
    const transporter = getTransporter();
    transporter.verify((err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.warn("SMTP warmup check:", err?.message || err);
      } else {
        // eslint-disable-next-line no-console
        console.log("SMTP mailer pool ready and verified.");
      }
    });
  } catch (_e) {}
}

module.exports = { sendOtpEmail, warmupMailer, getSmtpConfig };
