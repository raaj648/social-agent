import { NextRequest, NextResponse } from 'next/server';
import { verifyDiscordKey, processDiscordInteraction } from '@/lib/discord/webhook';

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-signature-ed25519') || '';
    const timestamp = request.headers.get('x-signature-timestamp') || '';
    const rawBody = await request.text();

    // Verify Discord signature
    if (signature && timestamp) {
      const isValid = verifyDiscordKey(rawBody, signature, timestamp);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const interaction = JSON.parse(rawBody);
    const response = await processDiscordInteraction(interaction);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Discord webhook error:', error);
    return NextResponse.json({ type: 4, data: { content: 'An error occurred.' } }, { status: 200 });
  }
}
