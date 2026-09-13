const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { sendOtpEmail } = require("../utils/mailer");

async function main() {
  const to = process.argv[2] || process.env.SMTP_USER;
  if (!to) {
    // eslint-disable-next-line no-console
    console.error("Usage: node scripts/test-smtp.js you@example.com");
    process.exitCode = 1;
    return;
  }

  const otp = "123456";
  await sendOtpEmail({ to, otp, expiresMinutes: 10 });
  // eslint-disable-next-line no-console
  console.log(`Sent test OTP to ${to}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
