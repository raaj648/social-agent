import { NextRequest, NextResponse } from 'next/server';
import { processTelegramUpdate } from '@/lib/telegram/webhook';

export async function POST(request: NextRequest) {
  try {
    const botId = request.nextUrl.pathname.split('/').pop();
    if (!botId || botId === 'telegram') {
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }
    const update = await request.json();
    await processTelegramUpdate(update, botId);
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }
}
