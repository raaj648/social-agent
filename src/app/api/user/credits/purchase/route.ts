import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { pack_id, payment_method, reference_id } = body;

    if (!pack_id) {
      return NextResponse.json({ error: 'Pack ID is required' }, { status: 400 });
    }

    const { data: pack, error: packError } = await supabase
      .from('credit_packs')
      .select('*')
      .eq('id', pack_id)
      .eq('is_active', true)
      .single();

    if (packError || !pack) {
      return NextResponse.json({ error: 'Invalid or inactive credit pack' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('credit_purchases')
      .insert({
        user_id: user.id,
        pack_id: pack.id,
        credits_allocated: pack.credits_amount,
        amount_paid_cents: pack.price_cents,
        status: 'pending',
        payment_method: payment_method || null,
        reference_id: reference_id || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ purchase: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
