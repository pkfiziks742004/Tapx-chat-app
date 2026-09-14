const nodemailer = require("nodemailer");

let cachedTransporter = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
  const secure = process.env.SMTP_SECURE === "1" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const senderName = process.env.SMTP_SENDER_NAME || "Tapx";

  if (!user || !pass) {
    const err = new Error("Server misconfigured: SMTP_USER/SMTP_PASS are missing.");
    err.code = "SERVER_MISCONFIG";
    throw err;
  }

  if (!from) {
    const err = new Error("Server misconfigured: SMTP_FROM is missing.");
    err.code = "SERVER_MISCONFIG";
    throw err;
  }

  return { host, port, secure, user, pass, from, senderName };
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const { host, port, secure, user, pass } = getSmtpConfig();

  const isGmail = host.includes("gmail.com") || String(user).endsWith("@gmail.com");

  if (isGmail) {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: { user, pass },
      connectionTimeout: 6000,
      greetingTimeout: 5000,
      socketTimeout: 8000
    });
  } else {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: { user, pass },
      connectionTimeout: 6000,
      greetingTimeout: 5000,
      socketTimeout: 8000
    });
  }

  return cachedTransporter;
}

async function sendOtpEmail({ to, otp, expiresMinutes = 10, subject, text } = {}) {
  const { from, senderName } = getSmtpConfig();
  const transporter = getTransporter();

  const mailSubject = subject || `${senderName} Verification Code: ${otp}`;
  const mailText =
    text ||
    `Your Tapx verification code is: ${otp}\n\nThis code expires in ${expiresMinutes} minutes.\n\nIf you did not request this, you can ignore this email.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #6366f1; margin: 0; font-size: 24px;">Tapx</h2>
        <p style="color: #64748b; font-size: 14px; margin: 4px 0 0 0;">Real-time chat & calls</p>
      </div>
      <p style="font-size: 15px; color: #334155; line-height: 1.5;">Use the following 6-digit verification code:</p>
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 16px 20px; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #1e293b; text-align: center; border-radius: 8px; margin: 18px 0;">
        ${otp}
      </div>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">This code expires in <b>${expiresMinutes} minutes</b>. Do not share this code with anyone.</p>
    </div>
  `;

  return transporter.sendMail({
    from: `${senderName} <${from}>`,
    to,
    subject: mailSubject,
    text: mailText,
    html
  });
}

module.exports = { sendOtpEmail };

