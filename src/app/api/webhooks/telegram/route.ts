import { NextRequest, NextResponse } from 'next/server';
import { processTelegramUpdate } from '@/lib/telegram/webhook';

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();
    await processTelegramUpdate(update);
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }
}
