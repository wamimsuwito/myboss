
'use client';

import type { AttendanceRecord, OvertimeRecord, UserData } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, differenceInMinutes, isSameDay } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface AttendanceHistoryPrintLayoutProps {
  records: any[];
  period: DateRange;
  summary: {
    totalHariKerja: number;
    totalJamLembur: number;
    totalMenitTerlambat: number;
    totalHariAbsen: number;
  };
}

const safeFormatTimestamp = (timestamp: any, formatString: string) => {
    if (!timestamp || typeof timestamp.toDate !== 'function') return '-';
    try {
        return format(timestamp.toDate(), formatString, { locale: localeID });
    } catch (error) {
        return '-';
    }
}

export default function AttendanceHistoryPrintLayout({ records, period, summary }: AttendanceHistoryPrintLayoutProps) {
    
  const periodTitle = period.from 
    ? format(period.from, "d MMMM yyyy", { locale: localeID }) + (period.to ? " - " + format(period.to, "d MMMM yyyy", { locale: localeID }) : "") 
    : "Semua Waktu";

  const isSingleUser = records.length === 1;
  const singleUserData = isSingleUser ? records[0] : null;

  return (
    <div className="bg-white text-black p-4 font-sans printable-area">
        <header className="print-header text-center mb-8">
            <img src="https://i.imgur.com/CxaNLPj.png" alt="Logo" className="print-logo h-24 w-auto" data-ai-hint="logo company" style={{ float: 'left', marginRight: '20px' }}/>
            <div className="text-left" style={{ marginLeft: '110px' }}>
                <h1 className="text-xl font-bold text-red-600">PT. FARIKA RIAU PERKASA</h1>
                <p className="text-sm font-semibold text-blue-600 italic">one stop concrete solution</p>
                <p className="text-sm font-semibold text-blue-600">READYMIX & PRECAST CONCRETE</p>
                <p className="text-xs mt-1">Jl. Soekarno Hatta Komp. SKA No. 62 E Pekanbaru Telp. (0761) 7090228 - 571662</p>
            </div>
            <div style={{ clear: 'both' }}></div>
            <div className="watermark">PT FARIKA RIAU PERKASA</div>
        </header>
         <hr className="border-t-2 border-black my-2" />
        <h2 className="text-center font-bold text-lg uppercase my-4">{isSingleUser ? `LAPORAN DETAIL KEHADIRAN` : `LAPORAN RINGKASAN KEHADIRAN`}</h2>

      <main>
        <table className="info-table">
          <tbody>
            <tr>
              <td className='label'>PERIODE</td>
              <td>: {periodTitle}</td>
            </tr>
            {isSingleUser && (
              <>
                <tr>
                  <td className='label'>NAMA</td>
                  <td>: {singleUserData?.username}</td>
                </tr>
                <tr>
                  <td className='label'>NIK</td>
                  <td>: {singleUserData?.nik}</td>
                </tr>
                <tr>
                  <td className='label'>JABATAN</td>
                  <td>: {singleUserData?.jabatan}</td>
                </tr>
                 <tr>
                  <td className='label'>LOKASI</td>
                  <td>: {singleUserData?.lokasi}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>

        <table className='material-table w-full'>
          <thead>
            <TableRow>
              <TableHead>Tanggal</TableHead>
              {!isSingleUser && <TableHead>Nama</TableHead>}
              <TableHead>Jam Masuk</TableHead>
              <TableHead>Jam Pulang</TableHead>
              <TableHead>Terlambat</TableHead>
              <TableHead>Masuk Lembur</TableHead>
              <TableHead>Pulang Lembur</TableHead>
              <TableHead>Total Lembur</TableHead>
            </TableRow>
          </thead>
          <tbody>
            {records.flatMap(user => 
              user.attendance.map((att: AttendanceRecord) => {
                const overtime = user.overtime.find((ovt: OvertimeRecord) => ovt.checkInTime && att.checkInTime && isSameDay(ovt.checkInTime.toDate(), att.checkInTime.toDate()));
                return (
                  <TableRow key={att.id}>
                    <TableCell>{safeFormatTimestamp(att.checkInTime, 'dd/MM/yy')}</TableCell>
                    {!isSingleUser && <TableCell className="text-left">{user.username}</TableCell>}
                    <TableCell>{safeFormatTimestamp(att.checkInTime, 'HH:mm')}</TableCell>
                    <TableCell>{safeFormatTimestamp(att.checkOutTime, 'HH:mm')}</TableCell>
                    <TableCell>{(att.lateMinutes ?? 0) > 0 ? `${att.lateMinutes} mnt` : '-'}</TableCell>
                    <TableCell>{safeFormatTimestamp(overtime?.checkInTime, 'HH:mm')}</TableCell>
                    <TableCell>{safeFormatTimestamp(overtime?.checkOutTime, 'HH:mm')}</TableCell>
                    <TableCell>{overtime && overtime.checkOutTime ? `${differenceInMinutes(overtime.checkOutTime.toDate(), overtime.checkInTime.toDate())} mnt` : '-'}</TableCell>
                  </TableRow>
                )
              })
            )}
            {records.length === 0 && (
                <TableRow><TableCell colSpan={isSingleUser ? 7 : 8} className="h-24 text-center">Tidak ada data absensi pada periode ini.</TableCell></TableRow>
            )}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
            <table className="summary-table">
                 <thead>
                    <TableRow>
                        <TableCell colSpan={2} className="font-bold text-center">RINGKASAN PERIODE</TableCell>
                    </TableRow>
                 </thead>
                 <tbody>
                    <TableRow><TableCell className="font-semibold">Total Hari Kerja</TableCell><TableCell className="text-right">{summary.totalHariKerja} Hari</TableCell></TableRow>
                    <TableRow><TableCell className="font-semibold">Total Jam Lembur</TableCell><TableCell className="text-right">{summary.totalJamLembur} Jam</TableCell></TableRow>
                    <TableRow><TableCell className="font-semibold">Total Keterlambatan</TableCell><TableCell className="text-right">{summary.totalMenitTerlambat} Menit</TableCell></TableRow>
                    <TableRow><TableCell className="font-semibold">Total Hari Absen</TableCell><TableCell className="text-right">{summary.totalHariAbsen} Hari</TableCell></TableRow>
                 </tbody>
            </table>
        </div>

      </main>

      <footer className="signature-section mt-16">
          <div>
              <p>Mengetahui,</p>
              <div className="signature-box"></div>
              <p>(Pimpinan)</p>
          </div>
          <div>
              <p>Disiapkan oleh,</p>
              <div className="signature-box"></div>
              <p>(HRD Pusat)</p>
          </div>
      </footer>
    </div>
  );
}
