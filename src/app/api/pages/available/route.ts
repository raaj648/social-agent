import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserPages } from '@/lib/meta/graph';
import { decrypt } from '@/lib/crypto';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase.from('users').select('fb_user_access_token').eq('id', user.id).single();
    if (!userData?.fb_user_access_token) {
      return NextResponse.json({ error: 'No Facebook token found. Please connect via Facebook first.' }, { status: 400 });
    }

    const userAccessToken = decrypt(userData.fb_user_access_token);
    const availablePages = await getUserPages(userAccessToken);

    const { data: connected } = await supabase
      .from('connected_pages')
      .select('page_id')
      .eq('user_id', user.id);

    const connectedIds = new Set((connected || []).map((p: any) => p.page_id));

    const pages = availablePages
      .filter((p) => !connectedIds.has(p.id))
      .map((p) => ({
        page_id: p.id,
        page_name: p.name,
        page_category: p.category,
        picture_url: p.picture?.data?.url,
        access_token: p.access_token,
      }));

    return NextResponse.json({ pages });
  } catch (error) {
    console.error('Available pages error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch available pages' },
      { status: 500 }
    );
  }
}
