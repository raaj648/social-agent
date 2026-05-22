import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authToken = request.nextUrl.searchParams.get('token');
    const expectedToken = process.env.CRON_SECRET;
    if (expectedToken && authToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createAdminClient();

    const { data: settings } = await supabase
      .from('platform_settings')
      .select('key, value');

    if (!settings) {
      return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
    }

    const settingMap = Object.fromEntries(settings.map(s => [s.key, s.value]));

    const retentionDays = (settingMap as any).message_retention_days ?? 3;
    const cleanupIntervalMin = (settingMap as any).cleanup_cron_interval ?? 60;
    const lastCleanupStr = (settingMap as any).last_message_cleanup_at as string | undefined;

    const now = Date.now();

    if (lastCleanupStr) {
      const lastCleanupMs = new Date(lastCleanupStr).getTime();
      const elapsedMin = (now - lastCleanupMs) / 60000;
      if (elapsedMin < cleanupIntervalMin) {
        return NextResponse.json({
          skipped: true,
          reason: 'interval_not_elapsed',
          last_cleanup_at: lastCleanupStr,
          interval_minutes: cleanupIntervalMin,
          elapsed_minutes: Math.round(elapsedMin * 10) / 10,
        });
      }
    }

    const cutoff = new Date(now - retentionDays * 86400000).toISOString();

    const { data: deleted, error } = await supabase
      .from('messages')
      .delete()
      .lt('created_at', cutoff)
      .select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase
      .from('platform_settings')
      .upsert(
        { key: 'last_message_cleanup_at', value: new Date().toISOString() },
        { onConflict: 'key' }
      );

    return NextResponse.json({
      success: true,
      deleted_count: deleted?.length || 0,
      retention_days: retentionDays,
      cutoff,
    });
  } catch (error) {
    console.error('Message cleanup error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
