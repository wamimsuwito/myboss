'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, User, LogOut, Fingerprint, Briefcase } from 'lucide-react';
import type { UserData } from '@/lib/types';

export default function HseK3Page() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const userData = JSON.parse(userString);
      if (userData.jabatan?.toUpperCase() !== 'HSE K3') {
        router.push('/login');
      } else {
        setUserInfo(userData);
      }
    } else {
      router.push('/login');
    }
    setIsLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  if (isLoading || !userInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-4xl mx-auto flex flex-col bg-background text-foreground p-4 md:p-8">
      <header className="flex justify-between items-center py-4 mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dasbor HSE K3</h1>
        <Button variant="ghost" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" /> Keluar
        </Button>
      </header>

      <main className="flex-1 flex flex-col">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <User className="w-8 h-8 text-primary" />
              <div>
                  <p className="text-xl font-bold">{userInfo.username}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1.5"><Fingerprint size={14}/>{userInfo.nik}</span>
                      <span className="flex items-center gap-1.5"><Briefcase size={14}/>{userInfo.jabatan}</span>
                  </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Selamat datang di dasbor Health, Safety, and Environment (HSE). Fitur untuk Anda sedang dalam pengembangan.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
