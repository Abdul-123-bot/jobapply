// src/index.js

const { PORT } = require('./config/env');
const express = require('express');

// Import the real webhook handler
const { handleIncomingMessage } = require('./modules/webhook');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/', (req, res) => {
  res.send('Job Apply Bot is running ✅');
});

// Now using the real handler instead of the placeholder
app.post('/webhook', handleIncomingMessage);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});