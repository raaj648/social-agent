import { readFileSync } from 'fs';

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'nsppwrfzmvaiyeaqfryt';
const sql = readFileSync('social-reply-ai/supabase/migrations/014_final.sql', 'utf8');

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

const text = await response.text();
if (!response.ok) {
  console.error('Migration failed:', text);
  process.exit(1);
}
console.log('Migration applied successfully!');
console.log(text || '(no output)');

