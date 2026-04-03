// src/modules/profile.js
// Stores personal info used to fill job application forms.
//
// Supabase table required:
//   user_profile (
//     user_id        TEXT PRIMARY KEY,
//     full_name      TEXT,
//     first_name     TEXT,
//     last_name      TEXT,
//     email          TEXT,
//     phone          TEXT,
//     location       TEXT,         -- e.g. "Austin, TX"
//     work_auth      TEXT,         -- e.g. "US Citizen", "Need sponsorship", "OPT/EAD"
//     linkedin_url   TEXT,
//     portfolio_url  TEXT,
//     linkedin_email TEXT,         -- for LinkedIn Easy Apply login
//     linkedin_pass  TEXT,         -- stored plaintext — encrypt in production
//     indeed_email   TEXT,
//     indeed_pass    TEXT,
//     updated_at     TIMESTAMPTZ
//   )

const supabase = require('../config/supabase');

const REQUIRED_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'location', 'work_auth'];

async function getProfile(userId) {
  const { data, error } = await supabase
    .from('user_profile')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data;
}

async function setProfileField(userId, field, value) {
  const update = { user_id: userId, [field]: value, updated_at: new Date().toISOString() };

  // Auto-split full_name into first/last
  if (field === 'full_name') {
    const parts = value.trim().split(' ');
    update.first_name = parts[0];
    update.last_name = parts.slice(1).join(' ') || '';
  }

  const { error } = await supabase
    .from('user_profile')
    .upsert(update, { onConflict: 'user_id' });

  if (error) throw new Error(`Failed to save profile field: ${error.message}`);
}

function isProfileComplete(profile) {
  if (!profile) return false;
  return REQUIRED_FIELDS.every(f => profile[f] && profile[f].trim() !== '');
}

function getMissingFields(profile) {
  if (!profile) return REQUIRED_FIELDS;
  return REQUIRED_FIELDS.filter(f => !profile[f] || profile[f].trim() === '');
}

module.exports = { getProfile, setProfileField, isProfileComplete, getMissingFields };
