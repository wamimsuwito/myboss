
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { PemasukanLogEntry } from '@/lib/types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface LaporanPemasukanPrintLayoutProps {
  data: PemasukanLogEntry[];
  location: string;
  title?: string;
}

export default function LaporanPemasukanPrintLayout({ data, location, title = 'Laporan Harian Pemasukan Material' }: LaporanPemasukanPrintLayoutProps) {
  const reportDate = data.length > 0 ? format(new Date(data[0].timestamp), 'dd MMMM yyyy', { locale: id }) : format(new Date(), 'dd MMMM yyyy', { locale: id });
  
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
        <h2 className="text-center font-bold text-lg uppercase my-4">{title}</h2>
        <p className="report-date text-center text-sm mb-4">
          Lokasi: {location} - Tanggal: {title.includes('Harian') ? reportDate : ''}
        </p>

      <main>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Waktu</TableHead>
              <TableHead className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Material</TableHead>
              <TableHead className="text-black font-bold border border-black px-2 py-1 text-center text-xs">No. SPB</TableHead>
              <TableHead className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Kapal/Truk</TableHead>
              <TableHead className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Sopir/Kapten</TableHead>
              <TableHead className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Jumlah</TableHead>
              <TableHead className="text-black font-bold border border-black px-2 py-1 text-center text-xs">Keterangan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((entry, index) => (
              <TableRow key={entry.id || index}>
                <TableCell className="border border-black p-1 text-center text-xs">{format(new Date(entry.timestamp), 'dd/MM/yy HH:mm')}</TableCell>
                <TableCell className="border border-black p-1 text-center text-xs">{entry.material}</TableCell>
                <TableCell className="border border-black p-1 text-center text-xs">{entry.noSpb}</TableCell>
                <TableCell className="border border-black p-1 text-center text-xs">{entry.namaKapal}</TableCell>
                <TableCell className="border border-black p-1 text-center text-xs">{entry.namaSopir}</TableCell>
                <TableCell className="border border-black p-1 text-center text-xs">{entry.jumlah.toLocaleString('id-ID')} {entry.unit}</TableCell>
                <TableCell className="border border-black p-1 text-center text-xs">{entry.keterangan || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </main>
      <footer className="signature-section">
          <div>
              <p>Disiapkan oleh,</p>
              <div className="signature-box"></div>
              <p>(Admin Logistik)</p>
          </div>
           <div>
              <p>Diketahui oleh,</p>
              <div className="signature-box"></div>
              <p>(Kepala Workshop)</p>
          </div>
      </footer>
    </div>
  );
}
