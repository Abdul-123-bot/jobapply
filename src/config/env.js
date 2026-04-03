// src/config/env.js
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER: process.env.TWILIO_WHATSAPP_NUMBER,
  RAPIDAPI_KEY: process.env.RAPIDAPI_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL, // NEW
  SUPABASE_KEY: process.env.SUPABASE_KEY, // NEW
};