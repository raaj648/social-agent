import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/crypto';
import { getMetaAppSecret, getWebhookVerifyToken } from '@/lib/credentials';
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

    const processedInBatch = new Set<string>();

    // Handle Facebook/Instagram webhook payloads
    if (body.object === 'page' || body.object === 'instagram') {
      const platform = body.object === 'instagram' ? 'instagram' : 'messenger';
      for (const entry of body.entry) {
        if (entry.messaging) {
          for (const event of entry.messaging) {
            const msgText = event.message?.text || '';
            const msgAttachments = event.message?.attachments;
            const hasAttachments = msgAttachments && msgAttachments.length > 0;

            if ((!msgText && !hasAttachments) || !event.sender?.id || event.message?.is_echo) continue;

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
              messageText: msgText || '[attachment]',
              platformMsgId: msgId,
              recipientId: event.recipient?.id || entry.id,
              timestamp: event.timestamp || Date.now(),
              hasMedia: msgAttachments?.length > 0,
              messengerAttachments: msgAttachments,
            });
          }
        }
      }
    }

    // Handle WhatsApp webhook payloads
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            const value = change.value;
            if (!value?.messages) continue;

            const recipientId = value.metadata?.phone_number_id || entry.id;
            const senderName = value.contacts?.[0]?.profile?.name;

            for (const msg of value.messages) {
              if (msg.id) {
                if (processedInBatch.has(msg.id)) {
                  console.log(`[webhook] Skipping duplicate wamid ${msg.id} in same batch`);
                  continue;
                }
                processedInBatch.add(msg.id);
              }

              const textBody = msg.text?.body || msg.text_body || '';
              if (!textBody && !msg.from) continue;
              const isMedia = !!(msg.image || msg.video || msg.audio || msg.voice || msg.document);

              const waMediaFields = msg.image || msg.video || msg.audio || msg.voice || msg.document
                ? { image: msg.image, video: msg.video, audio: msg.audio, voice: msg.voice, document: msg.document }
                : undefined;

              await processWebhookMessage({
                platform: 'whatsapp',
                senderId: msg.from,
                messageText: textBody || '[attachment]',
                platformMsgId: msg.id,
                recipientId,
                timestamp: msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now(),
                senderName,
                hasMedia: isMedia,
                whatsappMedia: waMediaFields,
              });
            }
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
