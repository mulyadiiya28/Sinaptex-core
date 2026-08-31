const {
  sendMembershipExpiryReminders,
} = require('../modules/membership/membershipReminder.service');

/** Job harian: pengingat membership H-3 dan H-1. */
module.exports = async function membershipReminderJob() {
  return sendMembershipExpiryReminders();
};
