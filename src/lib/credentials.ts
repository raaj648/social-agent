import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt, decrypt } from '@/lib/crypto';

interface SettingsCache {
  meta_app_id?: string;
  meta_app_secret_encrypted?: string;
  openrouter_key_encrypted?: string;
  meta_webhook_verify_token_encrypted?: string;
  app_url?: string;
}

let cache: SettingsCache | null = null;

function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && /^[0-9a-f]+$/.test(parts[0]) && /^[0-9a-f]+$/.test(parts[1]);
}

function readEncrypted(value: string): string {
  if (isEncrypted(value)) {
    try { return decrypt(value); } catch { /* fall through */ }
  }
  return value;
}

async function loadSettings(): Promise<SettingsCache> {
  if (cache) return cache;

  try {
    const supabase = await createAdminClient();
    const { data } = await supabase
      .from('platform_settings')
      .select('key, value')
      .in('key', ['meta_app_id', 'meta_app_secret', 'openrouter_key', 'meta_webhook_verify_token', 'app_url']);

    cache = {};
    if (data) {
      for (const s of data) {
        const raw = String(s.value);
        if (s.key === 'meta_app_id') cache.meta_app_id = raw;
        else if (s.key === 'meta_app_secret') cache.meta_app_secret_encrypted = raw;
        else if (s.key === 'openrouter_key') cache.openrouter_key_encrypted = raw;
        else if (s.key === 'meta_webhook_verify_token') cache.meta_webhook_verify_token_encrypted = raw;
        else if (s.key === 'app_url') cache.app_url = raw;
      }
    }
  } catch {
    cache = {};
  }

  return cache;
}

export async function getMetaAppId(): Promise<string> {
  const settings = await loadSettings();
  return settings.meta_app_id || '';
}

export async function getMetaAppSecret(): Promise<string> {
  const settings = await loadSettings();
  if (settings.meta_app_secret_encrypted) {
    return readEncrypted(settings.meta_app_secret_encrypted);
  }
  return '';
}

export async function getOpenRouterKey(): Promise<string> {
  const settings = await loadSettings();
  if (settings.openrouter_key_encrypted) {
    return readEncrypted(settings.openrouter_key_encrypted);
  }
  return '';
}

export async function getWebhookVerifyToken(): Promise<string> {
  const settings = await loadSettings();
  if (settings.meta_webhook_verify_token_encrypted) {
    return readEncrypted(settings.meta_webhook_verify_token_encrypted);
  }
  return '';
}

export async function getAppUrl(): Promise<string> {
  const settings = await loadSettings();
  return settings.app_url || 'http://localhost:3000';
}

export function clearCredentialsCache(): void {
  cache = null;
}
