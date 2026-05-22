import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';
import { subscribePageToWebhook } from '@/lib/meta/graph';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pages }: { pages: Array<{ page_id: string; page_name: string; page_category?: string; picture_url?: string; access_token: string }> } = await request.json();
    if (!pages || pages.length === 0) {
      return NextResponse.json({ error: 'No pages provided' }, { status: 400 });
    }

    const results: Array<{ page_id: string; page_name: string; status: string }> = [];
    let connected = 0;
    let errors = 0;

    for (const page of pages) {
      try {
        if (!page.access_token) {
          errors++;
          continue;
        }
        const encryptedToken = encrypt(page.access_token);

        const { data: existing } = await supabase
          .from('connected_pages')
          .select('id')
          .eq('user_id', user.id)
          .eq('page_id', page.page_id)
          .single();

        if (existing) {
          await supabase
            .from('connected_pages')
            .update({
              page_name: page.page_name,
              page_category: page.page_category || null,
              picture_url: page.picture_url || null,
              page_access_token: encryptedToken,
            })
            .eq('id', existing.id);
          connected++;
        } else {
          const { error: insertErr } = await supabase.from('connected_pages').insert({
            user_id: user.id,
            page_id: page.page_id,
            page_name: page.page_name,
            page_category: page.page_category || null,
            picture_url: page.picture_url || null,
            page_access_token: encryptedToken,
          });
          if (insertErr) {
            errors++;
            continue;
          }
          connected++;

          const { data: saved } = await supabase
            .from('connected_pages')
            .select('id')
            .eq('user_id', user.id)
            .eq('page_id', page.page_id)
            .single();

          if (saved) {
            const subscribed = await subscribePageToWebhook(page.page_id, page.access_token);
            if (subscribed) {
              await supabase
                .from('connected_pages')
                .update({ subscribed: true })
                .eq('id', saved.id);
            }
          }
        }

        results.push({ page_id: page.page_id, page_name: page.page_name, status: 'connected' });
      } catch {
        errors++;
        results.push({ page_id: page.page_id, page_name: page.page_name, status: 'error' });
      }
    }

    await supabase.from('usage_logs').insert({
      user_id: user.id,
      action: 'page_connect_more',
      metadata: { pages_count: pages.length, connected, errors },
    });

    return NextResponse.json({ success: true, results, connected, errors });
  } catch (error) {
    console.error('Connect more pages error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect pages' },
      { status: 500 }
    );
  }
}
