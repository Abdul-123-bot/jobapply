// src/modules/preferences.js
// Manages per-user job search preferences stored in Supabase.
//
// Supabase table required:
//   user_preferences (
//     user_id   TEXT PRIMARY KEY,
//     job_title TEXT,
//     location  TEXT,
//     keywords  TEXT,
//     active    BOOLEAN DEFAULT false,
//     updated_at TIMESTAMPTZ
//   )

const supabase = require('../config/supabase');

async function getPreferences(userId) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return null;
  return data;
}

async function setPreference(userId, field, value) {
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, [field]: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) throw new Error(`Failed to save preference: ${error.message}`);
}

async function getActiveUsers() {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('active', true);

  if (error || !data) return [];
  return data;
}

module.exports = { getPreferences, setPreference, getActiveUsers };
