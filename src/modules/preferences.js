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

const validFields = ['job_title', 'location', 'keywords', 'active'];

/**
 * Retrieves preference data for a given user.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<Object>} - User preferences object.
 * @throws {Error} if user ID is invalid or retrieval fails.
 */
async function getPreferences(userId) {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('Invalid user ID: must be a non-empty string');
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error(`Error retrieving preferences for user ${userId}: ${error.message}`);
    throw new Error(`Failed to retrieve preferences: ${error.message}`);
  }

  return data;
}

/**
 * Updates or sets a specific preference for a user.
 * @param {string} userId - ID of the user.
 * @param {string} field - The field to update (e.g., "job_title", "location", "keywords", "active").
 * @param {*} value - The new value for the field.
 * @throws {Error} if parameters are invalid or update fails.
 */
async function setPreference(userId, field, value) {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('Invalid user ID: must be a non-empty string');
  }

  if (!validFields.includes(field)) {
    throw new Error(
      `Invalid field: ${field}. Must be one of: ${validFields.join(', ')}`
    );
  }

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, [field]: value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) {
    console.error(`Error saving preference for user ${userId}: ${error.message}`);
    throw new Error(`Failed to save preference: ${error.message}`);
  }
}

/**
 * Retrieves all active users.
 * @returns {Promise<Array>} - List of active user preference objects.
 * @throws {Error} if retrieval fails.
 */
async function getActiveUsers() {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('active', true);

  if (error) {
    console.error(`Error retrieving active users: ${error.message}`);
    throw new Error(`Failed to retrieve active users: ${error.message}`);
  }

  return data || [];
}

module.exports = { getPreferences, setPreference, getActiveUsers };