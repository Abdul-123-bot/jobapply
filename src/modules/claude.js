// src/modules/claude.js

const Anthropic = require('@anthropic-ai/sdk');
const { ANTHROPIC_API_KEY } = require('../config/env');

// Log whether the key is being picked up (we won't log the full key for security)
console.log('🔑 Anthropic API Key loaded:', ANTHROPIC_API_KEY ? `yes (starts with ${ANTHROPIC_API_KEY.slice(0, 7)}...)` : 'MISSING ❌');

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

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

async function askClaude(messages) {
  try {
    console.log('📤 Sending to Claude, message count:', messages.length);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    console.log('📥 Claude response received');
    return response.content[0].text;

  } catch (error) {
    console.error('❌ Claude API error:', error.message);
    console.error('❌ Full error:', JSON.stringify(error, null, 2));
    throw error; // re-throw so webhook.js catch block handles it
  }
}

module.exports = { askClaude };