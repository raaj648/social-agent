import { NextRequest, NextResponse } from 'next/server';
import { verifyDiscordKey, processDiscordInteraction } from '@/lib/discord/webhook';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const interaction = JSON.parse(rawBody);

    // Handle PING immediately — no signature needed
    // This is required so Discord can verify the endpoint URL before
    // the admin has configured the public key in settings.
    if (interaction.type === 1) {
      return NextResponse.json({ type: 1 }, { status: 200 });
    }

    const signature = request.headers.get('x-signature-ed25519') || '';
    const timestamp = request.headers.get('x-signature-timestamp') || '';

    if (signature && timestamp) {
      const isValid = await verifyDiscordKey(rawBody, signature, timestamp);
      if (!isValid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const response = await processDiscordInteraction(interaction);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Discord webhook error:', error);
    return NextResponse.json({ type: 4, data: { content: 'An error occurred.' } }, { status: 200 });
  }
}
