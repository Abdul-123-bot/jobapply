// src/modules/memory.js

// This module manages conversation history per user.
// Each user (identified by their WhatsApp number) gets their own
// conversation history stored in memory.
//
// NOTE: This is in-memory storage for now, meaning history resets
// if the server restarts. In a future step we'll persist this to
// Supabase so history survives restarts.

// A simple object that maps phone numbers to their message history.
// Example:
// {
//   "whatsapp:+923001234567": [
//     { role: "user", content: "hi" },
//     { role: "assistant", content: "Hello! How can I help?" }
//   ]
// }
const conversations = {};

/**
 * Returns the conversation history for a user.
 * Creates an empty history if this is their first message.
 *
 * @param {string} userId - the user's WhatsApp number
 * @returns {Array} - array of {role, content} message objects
 */
function getHistory(userId) {
  if (!conversations[userId]) {
    conversations[userId] = [];
  }
  return conversations[userId];
}

/**
 * Adds a new message to a user's conversation history.
 *
 * @param {string} userId  - the user's WhatsApp number
 * @param {string} role    - either "user" or "assistant"
 * @param {string} content - the message text
 */
function addMessage(userId, role, content) {
  const history = getHistory(userId);
  history.push({ role, content });

  // Keep only the last 20 messages to avoid hitting Claude's token limit.
  // This is a simple sliding window — old context drops off naturally.
  if (history.length > 20) {
    conversations[userId] = history.slice(-20);
  }
}

/**
 * Clears a user's conversation history.
 * Useful if the user says "start over" or "reset".
 *
 * @param {string} userId - the user's WhatsApp number
 */
function clearHistory(userId) {
  conversations[userId] = [];
}

module.exports = { getHistory, addMessage, clearHistory };