
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

interface TestReportPrintLayoutProps {
  sessionData: any;
}

export default function TestReportPrintLayout({ sessionData }: TestReportPrintLayoutProps) {
  if (!sessionData || !sessionData.results || sessionData.results.length === 0) {
    return <p>Data tidak lengkap untuk dicetak.</p>;
  }
  
  const { testerName, testDate, results } = sessionData;
  
  const getDate = (timestamp: any): Date => {
      if (!timestamp) return new Date();
      if (timestamp && typeof timestamp.toDate === 'function') {
        return timestamp.toDate();
      }
      return new Date(timestamp);
  }

  const groupedResults = results.reduce((acc: Record<string, any[]>, item: any) => {
    const key = `${item.pelanggan}|${item.lokasi}|${item.mutu}|${item.umurUji}|${format(getDate(item.tanggalPembuatan), 'dd/MM/yy')}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});

  const specimenType = results[0]?.jenisBendaUji || 'Tidak diketahui';
  const resultUnit = results[0]?.unit || (specimenType === 'kubus' ? 'kg/cm²' : 'MPa');

  return (
    <>
      <style>
        {`
          @media print {
            @page {
              size: landscape;
            }
          }
        `}
      </style>
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
        <h2 className="text-center font-bold text-lg uppercase my-4">Laporan Hasil Uji Kuat Tekan Beton</h2>
        
        <main>
          <table className="info-table text-xs mb-4">
              <tbody>
                  <tr>
                      <td className="font-bold w-36">Tanggal Pengujian</td>
                      <td>: {format(getDate(testDate), 'dd MMMM yyyy, HH:mm', { locale: localeID })}</td>
                  </tr>
                   <tr>
                      <td className="font-bold w-36">Jenis Benda Uji</td>
                      <td className="capitalize">: {specimenType}</td>
                  </tr>
                  <tr>
                      <td className="font-bold w-36">Diuji Oleh</td>
                      <td>: {testerName}</td>
                  </tr>
              </tbody>
          </table>

          <div className="mb-6" style={{pageBreakInside: 'avoid'}}>
            <table className="w-full material-table">
              <thead className="material-table">
                <tr className="material-table">
                  <th className="text-black font-bold border border-black px-1 py-1 text-center text-[9px]" style={{ width: '3%' }}>No</th>
                  <th className="text-black font-bold border border-black px-1 py-1 text-center text-[9px]" style={{ width: '15%' }}>Pelanggan</th>
                  <th className="text-black font-bold border border-black px-1 py-1 text-center text-[9px]" style={{ width: '15%' }}>Lokasi Proyek</th>
                  <th className="text-black font-bold border border-black px-1 py-1 text-center text-[9px]" style={{ width: '5%' }}>Mutu</th>
                  <th className="text-black font-bold border border-black px-1 py-1 text-center text-[9px]" style={{ width: '5%' }}>Umur</th>
                  <th className="text-black font-bold border border-black px-1 py-1 text-center text-[9px]" style={{ width: '7%' }}>Tgl Prod</th>
                  <th className="text-black font-bold border border-black px-1 py-1 text-center text-[9px]" style={{ width: '5%' }}>Slump</th>
                  <th className="text-black font-bold border border-black px-1 py-1 text-center text-[9px]" style={{ width: '7%' }}>Berat (kg)</th>
                  <th className="text-black font-bold border border-black px-1 py-1 text-center text-[9px]" style={{ width: '7%' }}>KN</th>
                  <th className="text-black font-bold border border-black px-1 py-1 text-center text-[9px]" style={{ width: '10%' }}><div className='leading-tight'>Hasil Uji</div><div className='leading-tight font-normal'>({resultUnit})</div></th>
                  <th className="text-black font-bold border border-black px-1 py-1 text-center text-[9px]" style={{ width: '11%' }}><div className='leading-tight'>Prediksi 28 Hari</div><div className='leading-tight font-normal'>({resultUnit})</div></th>
                  <th className="text-black font-bold border border-black px-1 py-1 text-center text-[9px]" style={{ width: '10%' }}><div className='leading-tight'>Target thd Mutu</div><div className='leading-tight font-normal'>(%)</div></th>
                </tr>
              </thead>
              <tbody className="material-table">
                {Object.keys(groupedResults).flatMap((key) => {
                  const group = groupedResults[key];
                  const totalStrength = group.reduce((sum: number, item: any) => sum + (item.actualStrength || 0), 0);
                  const averageStrength = group.length > 0 ? totalStrength / group.length : 0;

                  const rows = group.map((item: any, index: number) => (
                    <tr key={`${key}-${index}`} className="material-table">
                      <td className="border border-black p-1 text-center text-[9px]">{index + 1}</td>
                      <td className="border border-black p-1 text-left text-[9px]">{item.pelanggan}</td>
                      <td className="border border-black p-1 text-left text-[9px]">{item.lokasi}</td>
                      <td className="border border-black p-1 text-center text-[9px]">{item.mutu}</td>
                      <td className="border border-black p-1 text-center text-[9px]">{item.umurUji}</td>
                      <td className="border border-black p-1 text-center text-[9px]">{format(getDate(item.tanggalPembuatan), 'dd/MM/yy')}</td>
                      <td className="border border-black p-1 text-center text-[9px]">{item.slump}</td>
                      <td className="border border-black p-1 text-right text-[9px]">{typeof item.beratBendaUji === 'number' ? item.beratBendaUji.toFixed(2) : '0.00'}</td>
                      <td className="border border-black p-1 text-right text-[9px]">{typeof item.kn === 'number' ? item.kn.toFixed(2) : '0.00'}</td>
                      <td className="border border-black p-1 text-right text-[9px]">{typeof item.actualStrength === 'number' ? item.actualStrength.toFixed(2) : '0.00'}</td>
                      <td className="border border-black p-1 text-right text-[9px]">{typeof item.predictedStrength === 'number' ? item.predictedStrength.toFixed(2) : '0.00'}</td>
                      <td className="border border-black p-1 text-right text-[9px]">{typeof item.targetAchievement === 'number' ? item.targetAchievement.toFixed(2) : '0.00'}</td>
                    </tr>
                  ));

                  rows.push(
                    <tr key={`summary-${key}`} className='bg-gray-200 font-bold material-table'>
                      <td colSpan={9} className="border border-black p-1 text-center text-[9px]">
                        Kuat Tekan Rata-rata
                      </td>
                      <td className="border border-black p-1 text-right text-[9px]">
                        {averageStrength.toFixed(2)}
                      </td>
                      <td colSpan={2} className="border border-black p-1"></td>
                    </tr>
                  );

                  return rows;
                })}
              </tbody>
            </table>
          </div>
        </main>
        <footer className="signature-section mt-16 text-xs">
            <div>
                <p>Diuji oleh,</p>
                <div className="signature-box"></div>
                <p className="font-bold underline">({testerName || '....................'})</p>
                <p>Quality Control</p>
            </div>
             <div>
                <p>Diketahui oleh,</p>
                <div className="signature-box"></div>
                <p>(Pimpinan)</p>
            </div>
        </footer>
      </div>
    </>
  );
}
