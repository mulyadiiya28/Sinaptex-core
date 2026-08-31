const nodemailer = require('nodemailer');
const env = require('../config/env');
const logger = require('../core/logger');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (env.SMTP_HOST && env.SMTP_USER) {
      transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: parseInt(env.SMTP_PORT || '587', 10),
        secure: env.SMTP_SECURE === 'true' || env.SMTP_PORT === '465',
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    } else {
      transporter = {
        sendMail: async (mailOptions) => {
          logger.info('[Email Notification - Simulated/Console]', {
            to: mailOptions.to,
            subject: mailOptions.subject,
            text: mailOptions.text,
          });
          return { messageId: `mock-${Date.now()}` };
        },
      };
    }
  }
  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  try {
    const transport = getTransporter();
    const mailOptions = {
      from: env.SMTP_FROM || 'no-reply@sinaptex.com',
      to,
      subject,
      text,
      html: html || text,
    };
    return await transport.sendMail(mailOptions);
  } catch (error) {
    logger.error('Failed to send email notification:', { error: error.message, to, subject });
    return null;
  }
}

module.exports = {
  getTransporter,
  sendEmail,
};
