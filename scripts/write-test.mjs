import { writeFileSync } from "fs";
const lines = [
  "-- ============================================================",
  "-- Migration 014: Remove tenants table, use user_id everywhere",
  "-- ============================================================",
  "",
  "-- 1. Add order/business columns to users",
  "alter table public.users",
  "  add column if not exists business_name text,",
  "  add column if not exists order_method text not null default " + "'" + "direct_chat" + "'" + " check (order_method in (" + "'" + "website" + "'" + ", " + "'" + "form" + "'" + ", " + "'" + "direct_chat" + "'" + ")),",
  "  add column if not exists order_link text,",
  "  add column if not exists is_active boolean not null default true;",
  "",
  "-- 2. Migrate tenant data to users",
  "update public.users u",
  "set",
  "  business_name = t.name,",
  "  order_method  = coalesce(t.order_method, " + "'" + "direct_chat" + "'" + "),",
  "  order_link    = t.order_link,",
  "  is_active     = t.is_active",
  "from public.tenants t",
  "where t.owner_id = u.id;",
];
writeFileSync("social-reply-ai/supabase/migrations/014_remove_tenants_test.sql", lines.join("\n"));
console.log("Test file written");
