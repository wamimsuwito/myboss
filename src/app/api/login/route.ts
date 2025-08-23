
import { sessionOptions, type SessionData } from '@/lib/session';
import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { db, collection, query, where, getDocs } from '@/lib/firebase';
import type { UserData } from '@/lib/types';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json({ message: 'Username and password are required.' }, { status: 400 });
  }

  try {
    const q = query(collection(db, "users"), where("username", "==", username.toUpperCase()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({ message: 'Username tidak ditemukan.' }, { status: 404 });
    }

    const userDoc = querySnapshot.docs[0];
    const userData = { id: userDoc.id, ...userDoc.data() } as UserData;

    if (userData.password !== password) {
      return NextResponse.json({ message: 'Password yang Anda masukkan salah.' }, { status: 401 });
    }

    // Get the session
    const session = await getIronSession<SessionData>(cookies(), sessionOptions);

    // Save user data to the session
    session.isLoggedIn = true;
    session.user = {
        id: userData.id,
        username: userData.username,
        nik: userData.nik,
        jabatan: userData.jabatan,
        lokasi: userData.lokasi,
        unitBp: userData.unitBp,
    };
    await session.save();

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = userData;

    return NextResponse.json({ user: userWithoutPassword });

  } catch (error) {
    console.error("Login API Error:", error);
    return NextResponse.json({ message: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
