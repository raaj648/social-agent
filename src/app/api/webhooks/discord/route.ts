import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { verifyDiscordKey } from '@/lib/discord/bot';
import { processDiscordInteraction } from '@/lib/discord/webhook';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-signature-ed25519') || '';
    const timestamp = request.headers.get('x-signature-timestamp') || '';

    if (signature && timestamp) {
      const isValid = await verifyDiscordKey(rawBody, signature, timestamp);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const interaction = JSON.parse(rawBody);

    if (interaction.type === 1) {
      return NextResponse.json({ type: 1 }, { status: 200 });
    }

    if (interaction.type === 2) {
      waitUntil(processDiscordInteraction(interaction));
      return NextResponse.json({ type: 5 }, { status: 200 });
    }

    return NextResponse.json({ type: 4, data: { content: 'Unknown interaction type.' } }, { status: 200 });
  } catch (error) {
    console.error('Discord webhook error:', error);
    return NextResponse.json({ type: 4, data: { content: 'An error occurred.' } }, { status: 200 });
  }
}
