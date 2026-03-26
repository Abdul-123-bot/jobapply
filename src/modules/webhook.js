// src/modules/webhook.js

const twilio = require('twilio');
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER } = require('../config/env');
const { askClaude } = require('./claude');
const { getHistory, addMessage, clearHistory } = require('./memory');

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

function parseIncomingMessage(req) {
  const from = req.body.From;
  const body = req.body.Body;
  return { from, body };
}

async function sendMessage(to, text) {
  await client.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to,
    body: text,
  });
}

async function handleIncomingMessage(req, res) {
  // Respond to Twilio immediately
  res.sendStatus(200);

  const { from, body } = parseIncomingMessage(req);
  console.log(`📩 Message from ${from}: ${body}`);

  // Handle a "reset" command — clears conversation history
  if (body.trim().toLowerCase() === 'reset') {
    clearHistory(from);
    await sendMessage(from, 'Conversation reset! How can I help you? 👋');
    return;
  }

  // Add the user's message to their history
  addMessage(from, 'user', body);

  // Get the full conversation history and send it to Claude
  const history = getHistory(from);

  console.log('🔄 Calling Claude...'); 
  const reply = await askClaude(history);

  // Add Claude's reply to history so future messages have full context
  addMessage(from, 'assistant', reply);

  console.log(`🤖 Claude replied: ${reply}`);

  // Send Claude's reply back to the user on WhatsApp
  await sendMessage(from, reply);
}

module.exports = {
  handleIncomingMessage,
  sendMessage,
  parseIncomingMessage,
};