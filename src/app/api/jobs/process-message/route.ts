import { NextRequest, NextResponse } from 'next/server';
import { processWebhookMessage } from '@/lib/meta/webhook';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await processWebhookMessage(body);
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Job processing error:', error);
    return NextResponse.json({ status: 'error', message: String(error) }, { status: 500 });
  }
}
