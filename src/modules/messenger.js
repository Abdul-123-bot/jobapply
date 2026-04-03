// src/modules/messenger.js
// Handles all outbound WhatsApp messages via Twilio.
// Extracted so both webhook.js and autoApplier.js can send messages
// without creating a circular dependency.

const twilio = require('twilio');
const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER } = require('../config/env');

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function sendMessage(to, text) {
  await client.messages.create({
    from: TWILIO_WHATSAPP_NUMBER,
    to,
    body: text,
  });
}

module.exports = { sendMessage };
