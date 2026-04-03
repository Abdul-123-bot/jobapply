// src/modules/tracker.js

// This module tracks job applications per user.
// Each user has a list of applications they've saved,
// each with a company, role, link, status, and date.
//
// Statuses follow a natural job hunt progression:
// Applied → Interviewing → Offer → Rejected → Withdrawn

// In-memory store per user.
// Example:
// {
//   "whatsapp:+923001234567": [
//     {
//       id: 1,
//       company: "Google",
//       role: "Senior React Engineer",
//       link: "careers.google.com",
//       status: "Applied",
//       date: "2026-03-25"
//     }
//   ]
// }
const applications = {};

// Valid statuses — used for validation when updating
const VALID_STATUSES = ['applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];

/**
 * Adds a new job application for a user.
 *
 * @param {string} userId  - the user's WhatsApp number
 * @param {string} company - company name
 * @param {string} role    - job title
 * @param {string} link    - application link (optional)
 * @returns {object}       - the saved application
 */
function addApplication(userId, company, role, link = '') {
  if (!applications[userId]) {
    applications[userId] = [];
  }

  const app = {
    // Use length + 1 as a simple auto-increment ID
    id: applications[userId].length + 1,
    company,
    role,
    link,
    status: 'Applied', // default status
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  };

  applications[userId].push(app);
  return app;
}

/**
 * Returns all applications for a user.
 *
 * @param {string} userId - the user's WhatsApp number
 * @returns {Array}       - array of application objects
 */
function getApplications(userId) {
  return applications[userId] || [];
}

/**
 * Updates the status of an application by company name.
 * Matches case-insensitively so "google" matches "Google".
 *
 * @param {string} userId     - the user's WhatsApp number
 * @param {string} company    - company name to search for
 * @param {string} newStatus  - the new status to set
 * @returns {object|null}     - updated application or null if not found
 */
function updateStatus(userId, company, newStatus) {
  const userApps = applications[userId] || [];

  const app = userApps.find(
    (a) => a.company.toLowerCase() === company.toLowerCase()
  );

  if (!app) return null;

  // Capitalize first letter for consistent display
  app.status = newStatus.charAt(0).toUpperCase() + newStatus.slice(1).toLowerCase();
  return app;
}

/**
 * Formats all applications into a WhatsApp-friendly summary.
 *
 * @param {string} userId - the user's WhatsApp number
 * @returns {string}      - formatted summary string
 */
function formatApplications(userId) {
  const userApps = getApplications(userId);

  if (userApps.length === 0) {
    return "You haven't tracked any applications yet!\n\nTo add one, say:\n\"applied to Google Senior React Engineer careers.google.com\"";
  }

  // Group by status for a cleaner overview
  const grouped = {};
  userApps.forEach((app) => {
    if (!grouped[app.status]) grouped[app.status] = [];
    grouped[app.status].push(app);
  });

  // Status emoji map
  const statusEmoji = {
    Applied: '📤',
    Interviewing: '🔄',
    Offer: '🎉',
    Rejected: '❌',
    Withdrawn: '↩️',
  };

  // Build the summary header
  let summary = `📊 *Your Applications (${userApps.length} total)*\n\n`;

  // List apps grouped by status
  Object.entries(grouped).forEach(([status, apps]) => {
    const emoji = statusEmoji[status] || '📌';
    summary += `${emoji} *${status}* (${apps.length})\n`;
    apps.forEach((app) => {
      summary += `  • ${app.company} — ${app.role}\n`;
      if (app.link) summary += `    🔗 ${app.link}\n`;
    });
    summary += '\n';
  });

  return summary.trim();
}

module.exports = {
  addApplication,
  getApplications,
  updateStatus,
  formatApplications,
  VALID_STATUSES,
};