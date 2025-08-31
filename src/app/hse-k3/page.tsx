
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, User, LogOut, Fingerprint, Briefcase, LayoutDashboard, Users, Database, History, ClipboardList } from 'lucide-react';
import type { UserData, AttendanceRecord, ActivityLog } from '@/lib/types';
import { db, collection, query, where, getDocs } from '@/lib/firebase';
import { Sidebar, SidebarProvider, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarFooter, SidebarTrigger } from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';

type ActiveMenu = 'Absensi Harian' | 'Database Absensi' | 'Kegiatan Harian' | 'Database Kegiatan';

const menuItems: { name: ActiveMenu; icon: React.ElementType }[] = [
    { name: 'Absensi Harian', icon: Users },
    { name: 'Database Absensi', icon: Database },
    { name: 'Kegiatan Harian', icon: ClipboardList },
    { name: 'Database Kegiatan', icon: History },
];

export default function HseK3Page() {
  const router = useRouter();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('Absensi Harian');

  // Data state
  const [usersInLocation, setUsersInLocation] = useState<UserData[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const userData = JSON.parse(userString);
      if (userData.jabatan?.toUpperCase() !== 'HSE K3') {
        toast({
          variant: 'destructive',
          title: 'Akses Ditolak',
          description: 'Anda tidak memiliki hak untuk mengakses halaman ini.',
        });
        router.push('/login');
      } else {
        setUserInfo(userData);
      }
    } else {
      router.push('/login');
    }
  }, [router, toast]);
  
  useEffect(() => {
    if (!userInfo || !userInfo.lokasi) {
        setIsLoading(false);
        return;
    };

    setIsLoading(true);

    const fetchDataForLocation = async () => {
        try {
            // Fetch users in the same location
            const usersQuery = query(collection(db, 'users'), where('lokasi', '==', userInfo.lokasi));
            const usersSnapshot = await getDocs(usersQuery);
            const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as UserData);
            setUsersInLocation(usersData);

            // Fetch attendance for those users
            const attendanceQuery = query(collection(db, 'absensi'), where('checkInLocationName', '==', userInfo.lokasi));
            const attendanceSnapshot = await getDocs(attendanceQuery);
            setAttendanceRecords(attendanceSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as AttendanceRecord));

            // Fetch activities for those users
            // Note: This requires a composite index in Firestore (userId, createdAt)
            // For now, we fetch all and filter client-side, which is not optimal for large datasets
            const activityQuery = query(collection(db, 'kegiatan_harian'));
            const activitySnapshot = await getDocs(activityQuery);
            const allActivities = activitySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ActivityLog);
            const userIdsInLocation = new Set(usersData.map(u => u.id));
            setActivityLogs(allActivities.filter(log => userIdsInLocation.has(log.userId)));

        } catch (error) {
            console.error("Error fetching data for HSE K3:", error);
            toast({
                title: "Gagal Memuat Data",
                description: "Terjadi kesalahan saat mengambil data untuk lokasi Anda.",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    fetchDataForLocation();

  }, [userInfo, toast]);

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
  
  const renderContent = () => {
    switch (activeMenu) {
        case 'Absensi Harian':
            return <Card><CardHeader><CardTitle>Daftar Karyawan & Absensi Harian</CardTitle><CardDescription>Memantau kehadiran karyawan di lokasi {userInfo.lokasi} hari ini.</CardDescription></CardHeader><CardContent><p>Konten untuk {activeMenu} sedang dalam pengembangan.</p></CardContent></Card>;
        case 'Database Absensi':
             return <Card><CardHeader><CardTitle>Database Absensi</CardTitle><CardDescription>Melihat riwayat kehadiran seluruh karyawan di lokasi {userInfo.lokasi}.</CardDescription></CardHeader><CardContent><p>Konten untuk {activeMenu} sedang dalam pengembangan.</p></CardContent></Card>;
        case 'Kegiatan Harian':
             return <Card><CardHeader><CardTitle>Daftar Karyawan dan Kegiatan Harian</CardTitle><CardDescription>Memantau laporan kegiatan harian dari karyawan di lokasi {userInfo.lokasi}.</CardDescription></CardHeader><CardContent><p>Konten untuk {activeMenu} sedang dalam pengembangan.</p></CardContent></Card>;
        case 'Database Kegiatan':
             return <Card><CardHeader><CardTitle>Database Kegiatan Harian</CardTitle><CardDescription>Melihat semua riwayat laporan kegiatan dari karyawan di lokasi {userInfo.lokasi}.</CardDescription></CardHeader><CardContent><p>Konten untuk {activeMenu} sedang dalam pengembangan.</p></CardContent></Card>;
        default:
            return <p>Pilih menu untuk memulai.</p>;
    }
  }


  return (
    <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background text-foreground">
            <Sidebar>
                <SidebarContent>
                    <SidebarHeader>
                        <h2 className="text-xl font-semibold text-primary">Dasbor HSE K3</h2>
                    </SidebarHeader>
                    <SidebarMenu>
                       {menuItems.map(item => (
                         <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton 
                                isActive={activeMenu === item.name}
                                onClick={() => setActiveMenu(item.name)}
                            >
                                <item.icon/>
                                {item.name}
                            </SidebarMenuButton>
                         </SidebarMenuItem>
                       ))}
                    </SidebarMenu>
                    <SidebarFooter>
                        <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout}>
                            <LogOut />
                            Keluar
                        </Button>
                    </SidebarFooter>
                </SidebarContent>
            </Sidebar>
            <SidebarInset>
                 <main className="flex-1 p-6 lg:p-10">
                    <header className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <SidebarTrigger/>
                             <div className="flex items-center gap-3">
                              <User className="w-8 h-8 text-primary" />
                              <div>
                                  <p className="text-xl font-bold">{userInfo.username}</p>
                                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                      <span className="flex items-center gap-1.5"><Fingerprint size={14}/>{userInfo.nik}</span>
                                      <span className="flex items-center gap-1.5"><Briefcase size={14}/>{userInfo.jabatan}</span>
                                  </div>
                              </div>
                            </div>
                        </div>
                    </header>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        </div>
                    ) : (
                        renderContent()
                    )}
                </main>
            </SidebarInset>
        </div>
    </SidebarProvider>
  );
}
