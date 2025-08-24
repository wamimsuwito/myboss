
'use client';

import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AttendanceRecord, OvertimeRecord, UserData, TripLog } from '@/lib/types';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, X } from 'lucide-react';

interface AttendanceTableProps {
  records: AttendanceRecord[];
  overtimeRecords: OvertimeRecord[];
  users: UserData[];
  tripLogs: TripLog[];
}

const safeFormatTimestamp = (timestamp: any, formatString: string) => {
    if (!timestamp) return '-';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : (typeof timestamp === 'string' ? parseISO(timestamp) : new Date(timestamp));
        if (isNaN(date.getTime())) return '-';
        return format(date, formatString, { locale: localeID });
    } catch (error) {
        console.error("Error formatting date:", error, "Input was:", timestamp);
        return '-';
    }
}

const PhotoCell = ({ photoUrl }: { photoUrl?: string | null | undefined }) => {
    if (!photoUrl) return null;
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 ml-2">
                    <Camera className="h-4 w-4" />
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


export default function AttendanceTable({ records, overtimeRecords, users, tripLogs }: AttendanceTableProps) {
    
    const combinedData = React.useMemo(() => {
        const userMap = new Map<string, any>();

        const allUserIds = new Set(users.map(u => u.id));
        records.forEach(rec => allUserIds.add(rec.userId));
        overtimeRecords.forEach(rec => allUserIds.add(rec.userId));

        allUserIds.forEach(userId => {
            const user = users.find(u => u.id === userId);
            if (!user) return;
            
            const regularRecord = records.find(r => r.userId === userId);
            const overtimeRecord = overtimeRecords.find(o => o.userId === userId);
            const userTripLogs = tripLogs.filter(t => t.sopirId === userId).sort((a,b) => new Date(a.departFromBp!).getTime() - new Date(b.departFromBp!).getTime());

            userMap.set(userId, {
                id: regularRecord?.id || overtimeRecord?.id || userId,
                userId: userId,
                username: user.username,
                nik: user.nik || '-',
                jabatan: user.jabatan || '-',
                lokasiKaryawan: user.lokasi || '-',
                regularData: regularRecord,
                overtimeData: overtimeRecord,
                tripData: {
                    first: userTripLogs[0],
                    last: userTripLogs[userTripLogs.length - 1],
                }
            })
        });

        return Array.from(userMap.values());
    }, [records, overtimeRecords, users, tripLogs]);

    return (
        <div className="border rounded-md overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Karyawan</TableHead>
                        <TableHead>Jabatan</TableHead>
                        <TableHead>Lokasi Absen</TableHead>
                        <TableHead>Jam Masuk</TableHead>
                        <TableHead>Jam Pulang</TableHead>
                        <TableHead>Terlambat (mnt)</TableHead>
                        <TableHead>Jam Masuk Lembur</TableHead>
                        <TableHead>Jam Pulang Lembur</TableHead>
                        <TableHead>Total Lembur</TableHead>
                        <TableHead>Rit Pertama</TableHead>
                        <TableHead>Rit Terakhir</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {combinedData.length > 0 ? (
                        combinedData.map(rec => {
                            const regular = rec.regularData;
                            const overtime = rec.overtimeData;
                            const trip = rec.tripData;
                            const lateMinutes = regular?.lateMinutes ?? 0;
                            return (
                                <TableRow key={rec.id}>
                                    <TableCell>
                                        <div className="font-medium">{rec.username}</div>
                                        <div className="text-xs text-muted-foreground">{rec.nik}</div>
                                    </TableCell>
                                    <TableCell>{rec.jabatan}</TableCell>
                                    <TableCell>{regular?.checkInLocationName || overtime?.checkInLocationName || rec.lokasiKaryawan}</TableCell>
                                    <TableCell className="flex items-center">
                                        <span>{safeFormatTimestamp(regular?.checkInTime, 'HH:mm:ss')}</span>
                                        <PhotoCell photoUrl={regular?.checkInPhoto} />
                                    </TableCell>
                                    <TableCell className="flex items-center">
                                        <span>{safeFormatTimestamp(regular?.checkOutTime, 'HH:mm:ss')}</span>
                                        <PhotoCell photoUrl={regular?.checkOutPhoto} />
                                    </TableCell>
                                    <TableCell className={lateMinutes > 0 ? 'text-destructive font-bold' : ''}>{lateMinutes}</TableCell>
                                    <TableCell className="flex items-center">
                                        <span>{safeFormatTimestamp(overtime?.checkInTime, 'HH:mm:ss')}</span>
                                        <PhotoCell photoUrl={overtime?.checkInPhoto} />
                                    </TableCell>
                                    <TableCell className="flex items-center">
                                        <span>{safeFormatTimestamp(overtime?.checkOutTime, 'HH:mm:ss')}</span>
                                        <PhotoCell photoUrl={overtime?.checkOutPhoto} />
                                    </TableCell>
                                    <TableCell>{formatTotalOvertime(overtime?.checkInTime, overtime?.checkOutTime)}</TableCell>
                                    <TableCell>{safeFormatTimestamp(trip?.first?.departFromBp, 'HH:mm:ss')}</TableCell>
                                    <TableCell>{safeFormatTimestamp(trip?.last?.arriveAtBp, 'HH:mm:ss')}</TableCell>
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
