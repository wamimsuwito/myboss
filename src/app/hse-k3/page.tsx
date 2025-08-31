
'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, User, LogOut, Fingerprint, Briefcase, LayoutDashboard, Users, Database, History, ClipboardList, AlertTriangle, Printer } from 'lucide-react';
import type { UserData, AttendanceRecord, ActivityLog, OvertimeRecord } from '@/lib/types';
import { db, collection, query, where, getDocs, onSnapshot, doc, updateDoc, Timestamp } from '@/lib/firebase';
import { Sidebar, SidebarProvider, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarFooter, SidebarTrigger } from '@/components/ui/sidebar';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, startOfToday } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { differenceInMinutes } from 'date-fns';
import { printElement } from '@/lib/utils';
import HseAttendancePrintLayout from '@/components/hse-attendance-print-layout';


type ActiveMenu = 'Absensi Harian' | 'Database Absensi' | 'Kegiatan Harian' | 'Database Kegiatan';
type CombinedRecord = UserData & { attendance?: AttendanceRecord; overtime?: OvertimeRecord; activities?: ActivityLog[] };


const menuItems: { name: ActiveMenu; icon: React.ElementType }[] = [
    { name: 'Absensi Harian', icon: Users },
    { name: 'Database Absensi', icon: Database },
    { name: 'Kegiatan Harian', icon: ClipboardList },
    { name: 'Database Kegiatan', icon: History },
];

const CHECK_IN_DEADLINE = { hours: 7, minutes: 30 };

const safeFormatTimestamp = (timestamp: any, formatString: string) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return format(date, formatString, { locale: localeID });
};


const DailyAttendanceComponent = ({ location }: { location: string }) => {
    const { toast } = useToast();
    const [combinedData, setCombinedData] = useState<CombinedRecord[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);

    useEffect(() => {
        if (!location) return;

        setIsDataLoading(true);
        const todayStart = startOfToday();

        const usersQuery = query(collection(db, 'users'), where('lokasi', '==', location));

        const unsubUsers = onSnapshot(usersQuery, (usersSnapshot) => {
            const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as UserData);
            const userIds = usersData.map(u => u.id);

            if (userIds.length === 0) {
                setCombinedData([]);
                setIsDataLoading(false);
                return;
            }
            
            const unsubscribers: (() => void)[] = [];
            
            const fetchData = () => {
                const attendanceQuery = query(collection(db, 'absensi'), where('userId', 'in', userIds));
                unsubscribers.push(onSnapshot(attendanceQuery, (attSnapshot) => {
                    const attendanceData = attSnapshot.docs
                        .map(d => d.data() as AttendanceRecord)
                        .filter(r => r.checkInTime && isSameDay(r.checkInTime.toDate(), todayStart));

                    const overtimeQuery = query(collection(db, 'overtime_absensi'), where('userId', 'in', userIds));
                    unsubscribers.push(onSnapshot(overtimeQuery, (ovtSnapshot) => {
                        const overtimeData = ovtSnapshot.docs
                            .map(d => d.data() as OvertimeRecord)
                            .filter(r => r.checkInTime && isSameDay(r.checkInTime.toDate(), todayStart));
                        
                        const activitiesQuery = query(collection(db, 'kegiatan_harian'), where('userId', 'in', userIds));
                        unsubscribers.push(onSnapshot(activitiesQuery, (actSnapshot) => {
                             const activitiesData = actSnapshot.docs
                                .map(d => d.data() as ActivityLog)
                                .filter(r => r.createdAt && isSameDay(r.createdAt.toDate(), todayStart));
                            
                            const finalData = usersData.map(user => {
                                const attendance = attendanceData.find(a => a.userId === user.id);
                                const overtime = overtimeData.find(o => o.userId === user.id);
                                const activities = activitiesData.filter(a => a.userId === user.id).sort((a,b) => a.createdAt.toDate().getTime() - b.createdAt.toDate().getTime());
                                return { ...user, attendance, overtime, activities };
                            });
                            
                            setCombinedData(finalData);
                            setIsDataLoading(false);
                        }));
                    }));
                }));
            };

            fetchData();
            
            return () => unsubscribers.forEach(unsub => unsub());

        });
        
        return () => unsubUsers();
        
    }, [location]);
    
    const calculateLateMinutes = (checkInTime: any): number => {
        if (!checkInTime) return 0;
        const date = checkInTime.toDate();
        const deadline = new Date(date).setHours(CHECK_IN_DEADLINE.hours, CHECK_IN_DEADLINE.minutes, 0, 0);
        const late = differenceInMinutes(date, deadline);
        return late > 0 ? late : 0;
    };
    
    const calculateTotalOvertime = (overtime: OvertimeRecord | undefined): string => {
        if (!overtime || !overtime.checkInTime || !overtime.checkOutTime) return '-';
        const start = overtime.checkInTime.toDate();
        const end = overtime.checkOutTime.toDate();
        const diff = differenceInMinutes(end, start);
        if (diff <= 0) return '-';
        const hours = Math.floor(diff / 60);
        const minutes = diff % 60;
        return `${hours}j ${minutes}m`;
    };


    return (
        <>
            <div className="hidden">
              <div id="hse-print-area">
                <HseAttendancePrintLayout data={combinedData} location={location} />
              </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className='flex justify-between items-center'>
                        <span>Daftar Absensi & Kegiatan Harian</span>
                        <div className="flex items-center gap-4">
                            <Badge variant="outline">{format(new Date(), "EEEE, dd MMMM yyyy", { locale: localeID })}</Badge>
                            <Button variant="outline" onClick={() => printElement('hse-print-area')}>
                                <Printer className="mr-2 h-4 w-4" />
                                Cetak
                            </Button>
                        </div>
                    </CardTitle>
                    <CardDescription>Memantau kehadiran dan aktivitas karyawan di lokasi {location} hari ini.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isDataLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        </div>
                    ) : (
                    <div className="overflow-x-auto border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className='w-8'>No</TableHead>
                                    <TableHead className='w-48'>Nama/NIK</TableHead>
                                    <TableHead>Jabatan</TableHead>
                                    <TableHead className='text-center'>Absen Masuk</TableHead>
                                    <TableHead className='text-center'>Absen Pulang</TableHead>
                                    <TableHead className='text-center'>Terlambat</TableHead>
                                    <TableHead className='w-64'>Deskripsi Kegiatan</TableHead>
                                    <TableHead className='text-center'>Masuk Lembur</TableHead>
                                    <TableHead className='text-center'>Pulang Lembur</TableHead>
                                    <TableHead className='text-center'>Total Lembur</TableHead>
                                    <TableHead className='w-56'>Deskripsi Lembur</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                            {combinedData.length > 0 ? combinedData.map((user, index) => (
                                <TableRow key={user.id}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                        <p className='font-semibold'>{user.username}</p>
                                        <p className='text-xs text-muted-foreground'>{user.nik}</p>
                                    </TableCell>
                                    <TableCell>{user.jabatan}</TableCell>
                                    <TableCell className='text-center'>{safeFormatTimestamp(user.attendance?.checkInTime, 'HH:mm')}</TableCell>
                                    <TableCell className='text-center'>{safeFormatTimestamp(user.attendance?.checkOutTime, 'HH:mm')}</TableCell>
                                    <TableCell className={`text-center font-bold ${calculateLateMinutes(user.attendance?.checkInTime) > 0 ? 'text-destructive' : ''}`}>{calculateLateMinutes(user.attendance?.checkInTime)} mnt</TableCell>
                                    <TableCell className='text-xs whitespace-pre-wrap'>
                                        {(user.activities || []).map((act, i) => (
                                            <React.Fragment key={act.id}>
                                                <p>{act.description}</p>
                                                {i < (user.activities || []).length - 1 && <hr className="my-1"/>}
                                            </React.Fragment>
                                        ))}
                                    </TableCell>
                                    <TableCell className='text-center'>{safeFormatTimestamp(user.overtime?.checkInTime, 'HH:mm')}</TableCell>
                                    <TableCell className='text-center'>{safeFormatTimestamp(user.overtime?.checkOutTime, 'HH:mm')}</TableCell>
                                    <TableCell className='text-center'>{calculateTotalOvertime(user.overtime)}</TableCell>
                                    <TableCell className="text-xs whitespace-pre-wrap">
                                        {user.overtime?.description || '-'}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={11} className="h-48 text-center text-muted-foreground">Tidak ada data karyawan di lokasi ini.</TableCell></TableRow>
                            )}
                            </TableBody>
                        </Table>
                    </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
};


export default function HseK3Page() {
  const router = useRouter();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('Absensi Harian');

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
    setIsLoading(false);
  }, [router, toast]);


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
            return <DailyAttendanceComponent location={userInfo.lokasi} />;
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
