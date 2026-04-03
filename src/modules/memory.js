// src/modules/memory.js

// Conversation history is now persisted in Supabase.
// Each user has one row in the conversations table,
// with their full messages array stored as JSONB.

const supabase = require('../config/supabase');

/**
 * Retrieves conversation history for a user from Supabase.
 * Returns empty array if no history exists yet.
 */
async function getHistory(userId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('messages')
    .eq('user_id', userId)
    .single();

  if (error || !data) return [];
  return data.messages || [];
}

/**
 * Adds a message to a user's conversation history in Supabase.
 * Uses upsert so it creates a new row or updates the existing one.
 */
async function addMessage(userId, role, content) {
  // First get existing history
  const history = await getHistory(userId);

  // Add the new message
  history.push({ role, content });

  // Keep last 20 messages only
  const trimmed = history.slice(-20);

  // Upsert — insert if not exists, update if exists
  await supabase
    .from('conversations')
    .upsert({
      user_id: userId,
      messages: trimmed,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
}

/**
 * Clears conversation history for a user.
 */
async function clearHistory(userId) {
  await supabase
    .from('conversations')
    .upsert({
      user_id: userId,
      messages: [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
}

module.exports = { getHistory, addMessage, clearHistory };