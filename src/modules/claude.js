// src/modules/claude.js

// This module is the AI brain of the app.
// Its only job is to take a conversation history and return
// Claude's response. It knows nothing about WhatsApp or Twilio —
// that separation is intentional so we can test it independently
// or swap it with another AI model later without touching other files.

const Anthropic = require('@anthropic-ai/sdk');
const { ANTHROPIC_API_KEY } = require('../config/env');

// Initialize the Anthropic client once
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// The system prompt defines who Claude is in this app.
// This is the single most important string in the whole project.
// As you add more modules (resume, cover letter, job tracker),
// you'll update this prompt to tell Claude about those capabilities.
const SYSTEM_PROMPT = `
You are a smart, friendly job application assistant accessible via WhatsApp.

You help users with the following tasks:
1. Tailoring their resume to a specific job description
2. Writing personalized cover letters
3. Finding relevant job listings
4. Tracking the status of their job applications

Keep your responses concise and WhatsApp-friendly — avoid long walls of text.
Use short paragraphs, bullet points where helpful, and a conversational tone.

If the user asks something unrelated to job applications, politely redirect them.
`;

/**
 * Sends a conversation to Claude and returns its response.
 *
 * @param {Array} messages - array of {role, content} objects representing
 *                           the full conversation so far. Example:
 *                           [
 *                             { role: 'user', content: 'Help me write a cover letter' },
 *                             { role: 'assistant', content: 'Sure! What is the job?' },
 *                             { role: 'user', content: 'Software Engineer at Google' }
 *                           ]
 * @returns {string} - Claude's reply as a plain string
 */
async function askClaude(messages) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',  // always use this model
    max_tokens: 1024,                    // max length of Claude's reply
    system: SYSTEM_PROMPT,
    messages,                            // the full conversation history
  });

  // The response contains an array of content blocks.
  // We grab the first text block which is Claude's reply.
  return response.content[0].text;
}

module.exports = { askClaude };