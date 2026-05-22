import { NextResponse } from 'next/server';
import { getMetaAppId } from '@/lib/credentials';

export const dynamic = 'force-dynamic';

export async function GET() {
  const appId = await getMetaAppId();
  return NextResponse.json({ appId });
}
