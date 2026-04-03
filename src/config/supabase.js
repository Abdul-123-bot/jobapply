// src/config/supabase.js
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_KEY } = require('./env');

console.log('🔌 Supabase URL:', SUPABASE_URL ? 'loaded ✅' : 'MISSING ❌');
console.log('🔑 Supabase Key:', SUPABASE_KEY ? 'loaded ✅' : 'MISSING ❌');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('Supabase credentials missing! Check SUPABASE_URL and SUPABASE_KEY in Railway variables.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;