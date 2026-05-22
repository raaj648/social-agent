import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/crypto';
import { getMetaAppSecret, getWebhookVerifyToken, getAppUrl } from '@/lib/credentials';
import { processWebhookMessage } from '@/lib/meta/webhook';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = await getWebhookVerifyToken();

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Verification failed', { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-hub-signature-256') || '';
    const rawBody = await request.text();

    if (signature) {
      const appSecret = await getMetaAppSecret();
      if (!appSecret) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
      }
      const sig = signature.replace('sha256=', '');
      if (!verifyWebhookSignature(sig, rawBody, appSecret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);

    if (body.object === 'page' || body.object === 'instagram' || body.object === 'whatsapp_business_account') {
      const processedInBatch = new Set<string>();
      for (const entry of body.entry) {
        if (entry.messaging) {
          for (const event of entry.messaging) {
            if (!event.message?.text || !event.sender?.id) continue;

            const platform = body.object === 'instagram'
              ? 'instagram'
              : body.object === 'whatsapp_business_account'
                ? 'whatsapp'
                : 'messenger';

            const msgId = event.message?.mid;
            if (msgId) {
              if (processedInBatch.has(msgId)) {
                console.log(`[webhook] Skipping duplicate mid ${msgId} in same batch`);
                continue;
              }
              processedInBatch.add(msgId);
            }

            await processWebhookMessage({
              platform,
              senderId: event.sender.id,
              messageText: event.message.text,
              platformMsgId: msgId,
              recipientId: event.recipient?.id || entry.id,
              timestamp: event.timestamp || Date.now(),
            });
          }
        }
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }
}
