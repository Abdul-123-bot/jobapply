// src/config/env.js
require('dotenv').config();

// We centralize all environment variables here.
// Any module that needs a key imports it from this file,
// not directly from process.env. This makes it easy to
// see all config in one place and rename keys without
// hunting through files.

module.exports = {
  PORT: process.env.PORT || 3000,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
};