const nodemailer = require("nodemailer");

let cachedTransporter = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
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

  const isGmail = host.includes("gmail.com") || String(user).endsWith("@gmail.com");

  if (isGmail) {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
      pool: true,
      maxConnections: 3,
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 15000
    });
  } else {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 15000
    });
  }

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

module.exports = { sendOtpEmail };


