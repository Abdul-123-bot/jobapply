// src/index.js

// Load config first — always at the top
const { PORT } = require('./config/env');
const express = require('express');

// Create the Express app
const app = express();

// This middleware lets Express read incoming POST request bodies
// Twilio sends data as URL-encoded form data, so we need both:
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// A simple health check route — useful to confirm your server is running
app.get('/', (req, res) => {
  res.send('Job Apply Bot is running ✅');
});

// Placeholder for the WhatsApp webhook — we'll build this in Step 2
app.post('/webhook', (req, res) => {
  res.send('Webhook received');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});