import { readFileSync, writeFileSync } from "fs";
let content = readFileSync("social-reply-ai/supabase/migrations/014_remove_tenants.sql", "utf8");
// Replace 'create or replace function public.get_platform_stats()' with drop + create
content = content.replace(
  "create or replace function public.get_platform_stats()",
  "drop function if exists public.get_platform_stats();\ncreate function public.get_platform_stats()"
);
writeFileSync("social-reply-ai/supabase/migrations/014_remove_tenants.sql", content);
console.log("Fixed get_platform_stats - added DROP before CREATE");
