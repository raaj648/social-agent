import { readFileSync, writeFileSync } from "fs";
let content = readFileSync("social-reply-ai/supabase/migrations/014_remove_tenants.sql", "utf8");
content = content.replace("''full_name''", "'full_name'");
content = content.replace("''username''", "'username'");
content = content.replace("''avatar_url''", "'avatar_url'");
writeFileSync("social-reply-ai/supabase/migrations/014_remove_tenants.sql", content);
console.log("Fixed single-quote escaping");
