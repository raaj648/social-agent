import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto';
import { getWAPhoneNumbers } from '@/lib/meta/graph';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { phoneNumberId, phoneNumber, businessName, wabaId, accessToken } = await request.json();

    if (!phoneNumberId || !phoneNumber || !accessToken || !wabaId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate WhatsApp credentials by fetching phone number info
    const phoneNumbers = await getWAPhoneNumbers(wabaId, accessToken);

    const validPhoneNumber = phoneNumbers.find(pn => pn.id === phoneNumberId);
    if (!validPhoneNumber) {
      return NextResponse.json(
        { error: 'Invalid WhatsApp credentials: Phone Number ID not found for the provided WABA ID and Access Token' },
        { status: 400 }
      );
    }

    const encryptedToken = encrypt(accessToken);

    const { data: existing } = await supabase
      .from('whatsapp_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('phone_number_id', phoneNumberId)
      .single();

    if (existing) {
      await supabase
        .from('whatsapp_accounts')
        .update({
          phone_number: phoneNumber,
          business_name: businessName || null,
          waba_id: wabaId || null,
          access_token: encryptedToken,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('whatsapp_accounts').insert({
        user_id: user.id,
        phone_number_id: phoneNumberId,
        phone_number: phoneNumber,
        business_name: businessName || null,
        waba_id: wabaId || null,
        access_token: encryptedToken,
      });
    }

    await supabase.from('usage_logs').insert({
      user_id: user.id,
      action: 'whatsapp_connect',
      platform: 'whatsapp',
      metadata: { phone_number: phoneNumber, business_name: businessName },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('WhatsApp connect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect WhatsApp' },
      { status: 500 }
    );
  }
}
