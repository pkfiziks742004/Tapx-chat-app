const nodemailer = require("nodemailer");

function getSmtpConfig() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const secure = process.env.SMTP_SECURE === "1" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  const senderName = process.env.SMTP_SENDER_NAME || "Chat App";

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

function createTransport() {
  const { host, port, secure, user, pass } = getSmtpConfig();
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

async function sendOtpEmail({ to, otp, expiresMinutes = 10, subject, text } = {}) {
  const { from, senderName } = getSmtpConfig();
  const transporter = createTransport();

  const mailSubject = subject || `${senderName} verification code`;
  const mailText =
    text ||
    `Your verification code is: ${otp}\n\nThis code expires in ${expiresMinutes} minutes.\n\nIf you did not request this, you can ignore this email.`;

  await transporter.sendMail({
    from: `${senderName} <${from}>`,
    to,
    subject: mailSubject,
    text: mailText
  });
}

module.exports = { sendOtpEmail };

