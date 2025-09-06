
'use client';

import * as React from 'react';
import type { ActivityLog } from '@/lib/types';
import { format, formatDistanceStrict } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface HseActivityHistoryPrintLayoutProps {
  data: ActivityLog[];
  location: string;
  dateRange: DateRange | undefined;
}

const safeFormatTimestamp = (timestamp: any, formatString: string) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    return format(date, formatString, { locale: localeID });
};

const calculateDuration = (start: any, end: any): string => {
    if (!start || !end) return '-';
    const startDate = start.toDate ? start.toDate() : new Date(start);
    const endDate = end.toDate ? end.toDate() : new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return '-';
    return formatDistanceStrict(endDate, startDate, { locale: localeID });
};

export default function HseActivityHistoryPrintLayout({ data, location, dateRange }: HseActivityHistoryPrintLayoutProps) {
  const periodTitle = dateRange?.from 
    ? format(dateRange.from, "d MMMM yyyy", { locale: localeID }) + (dateRange.to ? " - " + format(dateRange.to, "d MMMM yyyy", { locale: localeID }) : "") 
    : "Semua Waktu";
    
  const allPhotos = data.flatMap(activity => 
    [
      { src: activity.photoInitial, label: 'Awal', timestamp: activity.createdAt },
      { src: activity.photoInProgress, label: 'Proses', timestamp: activity.timestampInProgress },
      { src: activity.photoCompleted, label: 'Selesai', timestamp: activity.timestampCompleted }
    ].filter(p => p.src)
  );

  return (
    <div className="bg-white text-black p-4 font-sans printable-area">
        <div className="watermark">PT FARIKA RIAU PERKASA</div>
        <header className="print-header text-center mb-8">
            <img src="https://i.imgur.com/CxaNLPj.png" alt="Logo" className="print-logo h-24 w-auto" data-ai-hint="logo company" style={{ float: 'left', marginRight: '20px' }}/>
            <div className="text-left" style={{ marginLeft: '110px' }}>
                <h1 className="text-xl font-bold text-red-600">PT. FARIKA RIAU PERKASA</h1>
                <p className="text-sm font-semibold text-blue-600 italic">one stop concrete solution</p>
                <p className="text-sm font-semibold text-blue-600">READYMIX & PRECAST CONCRETE</p>
                <p className="text-xs mt-1">Jl. Soekarno Hatta Komp. SKA No. 62 E Pekanbaru Telp. (0761) 7090228 - 571662</p>
            </div>
            <div style={{ clear: 'both' }}></div>
        </header>
        <hr className="border-t-2 border-black my-2" />
        <h2 className="text-center font-bold text-lg uppercase my-4">LAPORAN RIWAYAT KEGIATAN KARYAWAN</h2>
        <p className="report-date text-center text-sm mb-4">
          Lokasi: {location} - Periode: {periodTitle}
        </p>

      <main>
        <table className="material-table w-full">
          <thead>
            <tr className="material-table">
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[15%]">Tanggal</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[15%]">Nama Karyawan</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs w-[40%]">Deskripsi Kegiatan</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Status</th>
              <th className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Durasi</th>
            </tr>
          </thead>
          <tbody>
            {data.length > 0 ? data.map((activity) => (
                <tr key={activity.id}>
                    <td className="border border-black p-1 text-center text-xs">{safeFormatTimestamp(activity.createdAt, 'dd/MM/yy HH:mm')}</td>
                    <td className="border border-black p-1 text-left text-xs font-semibold">{activity.username}</td>
                    <td className="border border-black p-1 text-left text-xs">{activity.description}</td>
                    <td className="border border-black p-1 text-center text-xs capitalize">{activity.status}</td>
                    <td className="border border-black p-1 text-center text-xs">{calculateDuration(activity.createdAt, activity.timestampCompleted)}</td>
                </tr>
            )) : (
                <tr><td colSpan={5} className="h-24 text-center">Tidak ada data untuk dicetak.</td></tr>
            )}
          </tbody>
        </table>

        {allPhotos.length > 0 && (
          <div className="mt-8" style={{ pageBreakInside: 'avoid' }}>
            <h3 className="font-bold text-center border-t-2 border-black pt-2 mb-4">LAMPIRAN FOTO KEGIATAN</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              {data.flatMap(activity => 
                [
                  { activity, photo: activity.photoInitial, label: 'Awal', timestamp: activity.createdAt },
                  { activity, photo: activity.photoInProgress, label: 'Proses', timestamp: activity.timestampInProgress },
                  { activity, photo: activity.photoCompleted, label: 'Selesai', timestamp: activity.timestampCompleted }
                ]
                .filter(p => p.photo)
                .map((p, index) => (
                  <div key={`${p.activity.id}-${p.label}`} className="text-center" style={{ breakInside: 'avoid' }}>
                    <img src={p.photo || ''} alt={`${p.activity.description} - ${p.label}`} className="border border-black w-full" data-ai-hint="activity evidence" />
                    <p className="text-xs mt-1">
                      <strong>{p.activity.username} - {p.label}</strong>
                      <br />
                      <span>{safeFormatTimestamp(p.timestamp, 'dd MMM, HH:mm')}</span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
