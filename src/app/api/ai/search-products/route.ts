import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const { userId, platform, query, platformRefId } = await req.json();

    if (!userId || !query) {
      return NextResponse.json({ error: 'userId and query are required' }, { status: 400 });
    }

    const supabase = await createAdminClient();

    let dbQuery = supabase
      .from('products')
      .select('id, name, description, price, category, image_url')
      .eq('user_id', userId)
      .eq('is_active', true)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`);

    if (platform) {
      dbQuery = dbQuery.eq('platform', platform);
    }

    if (platformRefId) {
      dbQuery = dbQuery.or(`platform_ref_id.eq.${platformRefId},platform_ref_id.is.null`);
    }

    const { data: products } = await dbQuery
      .order('sort_order')
      .limit(10);

    return NextResponse.json({ products: products || [] });
  } catch (error) {
    console.error('Product search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
