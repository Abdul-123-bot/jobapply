// src/modules/tracker.js

const supabase = require('../config/supabase');

const VALID_STATUSES = ['applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];

/**
 * Saves a new job application to Supabase.
 */
async function addApplication(userId, company, role, link = '') {
  const { data, error } = await supabase
    .from('applications')
    .insert({
      user_id: userId,
      company,
      role,
      link,
      status: 'Applied',
      date: new Date().toISOString().split('T')[0],
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save application: ${error.message}`);
  return data;
}

/**
 * Retrieves all applications for a user from Supabase.
 */
async function getApplications(userId) {
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data;
}

/**
 * Updates the status of an application by company name.
 */
async function updateStatus(userId, company, newStatus) {
  // First find the application
  const { data: existing } = await supabase
    .from('applications')
    .select('*')
    .eq('user_id', userId)
    .ilike('company', company) // ilike = case-insensitive match
    .single();

  if (!existing) return null;

  // Update its status
  const { data, error } = await supabase
    .from('applications')
    .update({ status: newStatus.charAt(0).toUpperCase() + newStatus.slice(1).toLowerCase() })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update status: ${error.message}`);
  return data;
}

/**
 * Formats all applications into a WhatsApp-friendly summary.
 */
async function formatApplications(userId) {
  const userApps = await getApplications(userId);

  if (userApps.length === 0) {
    return "You haven't tracked any applications yet!\n\nTo add one say:\n\"applied to Google Senior React Engineer careers.google.com\"";
  }

  const grouped = {};
  userApps.forEach((app) => {
    if (!grouped[app.status]) grouped[app.status] = [];
    grouped[app.status].push(app);
  });

  const statusEmoji = {
    Applied: '📤',
    Interviewing: '🔄',
    Offer: '🎉',
    Rejected: '❌',
    Withdrawn: '↩️',
  };

  let summary = `📊 *Your Applications (${userApps.length} total)*\n\n`;

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