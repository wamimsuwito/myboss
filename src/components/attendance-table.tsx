
'use client';

import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AttendanceRecord, OvertimeRecord, UserData } from '@/lib/types';
import { format, differenceInMinutes } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';

interface AttendanceTableProps {
  records: AttendanceRecord[];
  overtimeRecords: OvertimeRecord[];
  users: UserData[];
}

const safeFormatTimestamp = (timestamp: any, formatString: string) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') return '-';
    try {
        return format(timestamp.toDate(), formatString, { locale: localeID });
    } catch (error) {
        return '-';
    }
}

const PhotoCell = ({ photoUrl }: { photoUrl?: string | null | undefined }) => {
    if (!photoUrl) return <span className="text-muted-foreground">-</span>;
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Camera className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Foto Absensi</DialogTitle>
                     <DialogClose asChild><Button variant="ghost" size="icon" className="absolute right-4 top-3"><X className="h-4 w-4"/></Button></DialogClose>
                </DialogHeader>
                <img src={photoUrl} alt="Foto Absensi" className="rounded-md w-full h-auto mt-4" data-ai-hint="employee selfie"/>
            </DialogContent>
        </Dialog>
    );
};

const formatTotalOvertime = (checkIn: any, checkOut: any): string => {
    if (!checkIn || !checkOut || typeof checkIn.toDate !== 'function' || typeof checkOut.toDate !== 'function') {
        return '-';
    }

    const checkInDate = checkIn.toDate();
    const checkOutDate = checkOut.toDate();
    const diffMins = differenceInMinutes(checkOutDate, checkInDate);
    
    if (diffMins < 0) return '-';

    const hours = Math.floor(diffMins / 60);
    const minutes = diffMins % 60;

    return `${hours}j ${minutes}m`;
}


export default function AttendanceTable({ records, overtimeRecords, users }: AttendanceTableProps) {
    
    const combinedData = React.useMemo(() => {
        const userMap = new Map<string, any>();

        // Process regular attendance
        records.forEach(record => {
            const user = users.find(u => u.id === record.userId);
            if (user) {
                userMap.set(record.userId, {
                    ...record,
                    nik: user.nik || '-',
                    jabatan: user.jabatan || '-',
                    lokasiKaryawan: user.lokasi || '-',
                });
            }
        });
        
        // Process overtime attendance
        overtimeRecords.forEach(overtime => {
            const existingEntry = userMap.get(overtime.userId);
            if (existingEntry) {
                 userMap.set(overtime.userId, { ...existingEntry, overtimeData: overtime });
            } else {
                 const user = users.find(u => u.id === overtime.userId);
                 if (user) {
                     userMap.set(overtime.userId, {
                         id: overtime.id, // Use overtime id if no regular record
                         userId: overtime.userId,
                         username: overtime.username,
                         nik: user.nik || '-',
                         jabatan: user.jabatan || '-',
                         lokasiKaryawan: user.lokasi || '-',
                         overtimeData: overtime
                     });
                 }
            }
        });

        return Array.from(userMap.values());
    }, [records, overtimeRecords, users]);

    return (
        <div className="border rounded-md overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tgl</TableHead>
                        <TableHead>Nama</TableHead>
                        <TableHead>NIK</TableHead>
                        <TableHead>Jabatan</TableHead>
                        <TableHead>Lokasi Absen</TableHead>
                        <TableHead>Jam Masuk</TableHead>
                        <TableHead>Jam Pulang</TableHead>
                        <TableHead>Terlambat (mnt)</TableHead>
                        <TableHead>Jam Masuk Lembur</TableHead>
                        <TableHead>Jam Pulang Lembur</TableHead>
                        <TableHead>Total Lembur</TableHead>
                        <TableHead>Foto Masuk</TableHead>
                        <TableHead>Foto Pulang</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {combinedData.length > 0 ? (
                        combinedData.map(rec => {
                            const lateMinutes = rec.lateMinutes ?? 0;
                            const overtime = rec.overtimeData;
                            return (
                                <TableRow key={rec.id}>
                                    <TableCell>{safeFormatTimestamp(rec.checkInTime || overtime?.checkInTime, 'dd/MM')}</TableCell>
                                    <TableCell>{rec.username}</TableCell>
                                    <TableCell>{rec.nik}</TableCell>
                                    <TableCell>{rec.jabatan}</TableCell>
                                    <TableCell>{rec.checkInLocationName || overtime?.checkInLocationName}</TableCell>
                                    <TableCell>{safeFormatTimestamp(rec.checkInTime, 'HH:mm:ss')}</TableCell>
                                    <TableCell>{safeFormatTimestamp(rec.checkOutTime, 'HH:mm:ss')}</TableCell>
                                    <TableCell className={lateMinutes > 0 ? 'text-destructive font-bold' : ''}>{lateMinutes}</TableCell>
                                    <TableCell>{safeFormatTimestamp(overtime?.checkInTime, 'HH:mm:ss')}</TableCell>
                                    <TableCell>{safeFormatTimestamp(overtime?.checkOutTime, 'HH:mm:ss')}</TableCell>
                                    <TableCell>{formatTotalOvertime(overtime?.checkInTime, overtime?.checkOutTime)}</TableCell>
                                    <TableCell><PhotoCell photoUrl={rec.checkInPhoto} /></TableCell>
                                    <TableCell><PhotoCell photoUrl={rec.checkOutPhoto} /></TableCell>
                                </TableRow>
                            )
                        })
                    ) : (
                        <TableRow>
                            <TableCell colSpan={13} className="text-center h-24">
                                Tidak ada data absensi untuk hari ini.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
