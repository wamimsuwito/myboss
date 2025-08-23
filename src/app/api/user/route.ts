
import { NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, type SessionData } from '@/lib/session';

export async function GET() {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);

  if (!session.isLoggedIn || !session.user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: session.user,
  });
}

export async function POST(request: Request) {
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);
    const body = await request.json();
    
    session.user = {
        ...session.user,
        ...body.user,
    };
    await session.save();
    
    return NextResponse.json({ ok: true });
}
