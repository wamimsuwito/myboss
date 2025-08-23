
import { sessionOptions, type SessionData } from '@/lib/session';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  
  // Destroy the session
  session.destroy();

  return NextResponse.json({ message: 'Logged out successfully' });
}
