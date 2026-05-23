import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';
import { getInstagramBusinessAccount } from '@/lib/meta/graph';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: connectedPages } = await supabase
      .from('connected_pages')
      .select('id, page_id, page_name, page_access_token')
      .eq('user_id', user.id);

    if (!connectedPages || connectedPages.length === 0) {
      return NextResponse.json({ pages: [] });
    }

    const { data: existingIgAccounts } = await supabase
      .from('instagram_accounts')
      .select('page_id')
      .eq('user_id', user.id);

    const connectedPageIds = new Set((existingIgAccounts || []).map((ig) => ig.page_id));

    const availablePages: Array<{
      page_id: string;
      page_name: string;
      id: string;
      ig_id: string;
      ig_username: string;
      ig_name: string;
      ig_profile_pic: string | null;
    }> = [];

    for (const cp of connectedPages) {
      if (connectedPageIds.has(cp.id)) continue;

      try {
        const pageAccessToken = decrypt(cp.page_access_token);
        const igAccount = await getInstagramBusinessAccount(cp.page_id, pageAccessToken);
        if (igAccount) {
          availablePages.push({
            page_id: cp.page_id,
            page_name: cp.page_name,
            id: igAccount.id,
            ig_id: String(igAccount.ig_id),
            ig_username: igAccount.username,
            ig_name: igAccount.name,
            ig_profile_pic: igAccount.profile_picture_url || null,
          });
        }
      } catch {
        // skip pages where token is invalid or IG check fails
      }
    }

    return NextResponse.json({ pages: availablePages });
  } catch (error) {
    console.error('Available Instagram pages error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch available Instagram accounts' },
      { status: 500 }
    );
  }
}
