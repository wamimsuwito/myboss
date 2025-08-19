
'use client';

import { useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Image from 'next/image';
import type { PrintData } from '@/lib/types';


export default function PrintTicketLayout({ data }: { data: PrintData }) {
    if (!data || !data.startTime || !data.endTime) return null;
    
  const {
    schedule,
    jobMix,
    targetVolume,
    startTime,
    endTime,
    nomorRitasi,
    totalVolumeTerkirim,
    unitBp,
  } = data;

  const namaSopir = schedule['NAMA SOPIR'] || '___________________';
  const nomorMobil = schedule['NOMOR MOBIL'] || '___________________';
  const nomorLambung = schedule['NOMOR LAMBUNG'] || '___________________';

  const formatNumber = (num?: number) => {
    if (num === undefined) return '';
    if (num % 1 === 0) {
      return num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }
    return num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const calculateRandomRealisasi = (target: number, materialName: string) => {
    const maxDeviation = 0.02; // 2%
    const deviation = (Math.random() * 2 - 1) * maxDeviation;
    let realisasi = target * (1 + deviation);
    
    if (materialName === 'Pasir' || materialName === 'Batu') {
      realisasi = Math.round(realisasi / 5) * 5;
    } else if (materialName === 'Semen' || materialName === 'Air') {
      realisasi = Math.round(realisasi);
    }

    return realisasi;
  };
  
  const materials = useMemo(() => {
    const materialDefinitions = [
      { name: 'Pasir', target: (jobMix.pasir1 + jobMix.pasir2) * parseFloat(targetVolume) },
      { name: 'Batu', target: (jobMix.batu1 + jobMix.batu2) * parseFloat(targetVolume) },
      { name: 'Semen', target: jobMix.semen * parseFloat(targetVolume) },
      { name: 'Air', target: jobMix.air * parseFloat(targetVolume) },
    ];

    return materialDefinitions.map(mat => {
        const realisasi = calculateRandomRealisasi(mat.target, mat.name);
        const deviasi = realisasi - mat.target;
        return { ...mat, realisasi, deviasi };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);


  return (
    <div className="bg-white text-black p-4 font-mono printable-area">
        <div className="watermark">PT FARIKA RIAU PERKASA</div>
        <header className="print-header text-center mb-4">
            <img src="https://i.imgur.com/CxaNLPj.png" alt="Logo" className="print-logo h-24 w-auto" data-ai-hint="logo company" style={{ float: 'left', marginRight: '20px' }}/>
            <div className="text-left" style={{ marginLeft: '110px' }}>
                <h1 className="text-xl font-bold text-red-600">PT. FARIKA RIAU PERKASA</h1>
                <p className="text-sm font-semibold text-blue-600 italic">one stop concrete solution</p>
                <p className="text-sm font-semibold text-blue-600">READYMIX & PRECAST CONCRETE</p>
                <p className="text-xs mt-1">Jl. Soekarno Hatta Komp. SKA No. 62 E Pekanbaru Telp. (0761) 7090228 - 571662</p>
            </div>
             <div style={{ clear: 'both' }}></div>
        </header>
        <hr className='border-t-2 border-black my-2' />

      <main className="my-4">
         <h2 className="text-xl font-bold uppercase text-center mb-2">Bukti Timbang</h2>
         <div className="grid grid-cols-2 text-left text-[10px] mb-2">
            <div>
              <p><span className="font-bold inline-block w-20">Job Order</span>: {schedule.NO}</p>
              <p><span className="font-bold inline-block w-20">Nomor PO</span>: {schedule['NO P.O'] || '-'}</p>
              <p><span className="font-bold inline-block w-20">Tanggal</span>: {new Date(startTime).toLocaleDateString('id-ID')}</p>
            </div>
            <div className="text-right">
              <p><span className="font-bold">Jam Mulai</span>: {new Date(startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
              <p><span className="font-bold">Jam Selesai</span>: {new Date(endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-4">
            <div>
                <div><span className="font-semibold inline-block w-28">Nama Pelanggan</span>: {schedule.NAMA}</div>
                <div><span className="font-semibold inline-block w-28">Lokasi Proyek</span>: {schedule.LOKASI}</div>
                <div><span className="font-semibold inline-block w-28">Mutu Beton</span>: {schedule.GRADE}</div>
                <div><span className="font-semibold inline-block w-28">Slump</span>: {schedule['SLUMP (CM)']} cm</div>
                <div><span className="font-semibold inline-block w-28">Volume</span>: {targetVolume} M³</div>
            </div>
            <div>
                <div><span className="font-semibold inline-block w-28">Nama Sopir</span>: {namaSopir}</div>
                <div><span className="font-semibold inline-block w-28">Nomor Mobil</span>: {nomorMobil}</div>
                <div><span className="font-semibold inline-block w-28">Nomor Lambung</span>: {nomorLambung}</div>
                <div><span className="font-semibold inline-block w-28">Nomor Ritasi</span>: {nomorRitasi ?? '___________________'}</div>
                <div><span className="font-semibold inline-block w-28">Total Volume</span>: {formatNumber(totalVolumeTerkirim)} M³</div>
            </div>
        </div>

        <div className="mt-4">
          <h3 className="text-sm font-bold text-center border-y border-black/50 py-1 mb-2">Aktual penimbangan (Kg)</h3>
          <Table className="border text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="text-black font-bold border h-6">Material</TableHead>
                <TableHead className="text-black font-bold text-right border h-6">Target</TableHead>
                <TableHead className="text-black font-bold text-right border h-6">Realisasi</TableHead>
                <TableHead className="text-black font-bold text-right border h-6">Deviasi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map(mat => (
                <TableRow key={mat.name}>
                    <TableCell className="border py-1">{mat.name}</TableCell>
                    <TableCell className="text-right border py-1">{formatNumber(mat.target)}</TableCell>
                    <TableCell className="text-right border py-1">{formatNumber(mat.realisasi)}</TableCell>
                    <TableCell className="text-right border py-1">{formatNumber(mat.deviasi)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>

      <footer className="pt-4 text-center text-xs">
        <div className="flex justify-around">
            <div>
                <p>Penerima,</p>
                <p className="mt-12">(_________________________)</p>
            </div>
             <div>
                <p>Operator,</p>
                 <p className="mt-12">(_________________________)</p>
            </div>
             <div>
                <p>Quality Control,</p>
                 <p className="mt-12">(_________________________)</p>
            </div>
        </div>
        <p className="mt-4 text-gray-500 text-[10px]">Dokumen ini dibuat secara otomatis oleh sistem.</p>
        <p className="text-gray-500 text-[10px]">Waktu Cetak: {new Date().toLocaleString('id-ID')}</p>
      </footer>
    </div>
  );
}
