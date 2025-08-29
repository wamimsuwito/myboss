
'use client';

import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';

interface TestReportPrintLayoutProps {
  sessionData: any;
}

export default function TestReportPrintLayout({ sessionData }: TestReportPrintLayoutProps) {
  if (!sessionData || !sessionData.results || sessionData.results.length === 0) {
    return <p className="p-4">Data tidak lengkap untuk dicetak.</p>;
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
    const key = `${item.pelanggan}|${item.lokasi}|${item.mutu}|${item.umurUji}`;
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
      <div className="print-report-container">
        <header className="print-header">
            <img src="https://i.imgur.com/CxaNLPj.png" alt="Logo" className="print-logo" data-ai-hint="logo company"/>
            <div className="company-info">
                <h1 className="company-name">PT. FARIKA RIAU PERKASA</h1>
                <p className="company-tagline">one stop concrete solution</p>
                <p className="company-services">READYMIX & PRECAST CONCRETE</p>
                <p className="company-address">Jl. Soekarno Hatta Komp. SKA No. 62 E Pekanbaru Telp. (0761) 7090228 - 571662</p>
            </div>
        </header>
        <hr className="header-divider" />
        <h2 className="report-title">LAPORAN HASIL UJI KUAT TEKAN BETON</h2>
        
        <main>
          <table className="info-table">
              <tbody>
                  <tr>
                      <td className="label">Tanggal Pengujian</td>
                      <td>: {format(getDate(testDate), 'dd MMMM yyyy, HH:mm', { locale: localeID })}</td>
                  </tr>
                   <tr>
                      <td className="label">Jenis Benda Uji</td>
                      <td className="capitalize">: {specimenType}</td>
                  </tr>
                  <tr>
                      <td className="label">Diuji Oleh</td>
                      <td>: {testerName}</td>
                  </tr>
              </tbody>
          </table>

          <div className="mb-6">
            <table className="print-table">
              <thead>
                <tr>
                  <th style={{ width: '3%' }}>No</th>
                  <th style={{ width: '13%' }}>Pelanggan</th>
                  <th style={{ width: '15%' }}>Lokasi Proyek</th>
                  <th style={{ width: '5%' }}>Mutu</th>
                  <th style={{ width: '5%' }}>Umur</th>
                  <th style={{ width: '7%' }}>Tgl Prod</th>
                  <th style={{ width: '5%' }}>Slump</th>
                  <th style={{ width: '7%' }}>Berat (kg)</th>
                  <th style={{ width: '7%' }}>KN</th>
                  <th style={{ width: '10%' }}>Hasil Uji ({resultUnit})</th>
                  <th style={{ width: '11%' }}>Prediksi 28 Hari ({resultUnit})</th>
                  <th style={{ width: '10%' }}>Target thd Mutu (%)</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(groupedResults).map((key) => {
                  const group = groupedResults[key];
                  const totalStrength = group.reduce((sum: number, item: any) => sum + (item.actualStrength || 0), 0);
                  const averageStrength = group.length > 0 ? totalStrength / group.length : 0;

                  const groupRows = group.map((item: any, index: number) => (
                    <tr key={`${key}-${index}`}>
                      <td>{index + 1}</td>
                      <td className="text-left">{item.pelanggan}</td>
                      <td className="text-left">{item.lokasi}</td>
                      <td>{item.mutu}</td>
                      <td>{item.umurUji}</td>
                      <td>{format(getDate(item.tanggalPembuatan), 'dd/MM/yy')}</td>
                      <td>{item.slump}</td>
                      <td className="text-right">{typeof item.beratBendaUji === 'number' ? item.beratBendaUji.toFixed(2) : '0.00'}</td>
                      <td className="text-right">{typeof item.kn === 'number' ? item.kn.toFixed(2) : '0.00'}</td>
                      <td className="text-right">{typeof item.actualStrength === 'number' ? item.actualStrength.toFixed(2) : '0.00'}</td>
                      <td className="text-right">{typeof item.predictedStrength === 'number' ? item.predictedStrength.toFixed(2) : '0.00'}</td>
                      <td className="text-right">{typeof item.targetAchievement === 'number' ? item.targetAchievement.toFixed(2) : '0.00'}</td>
                    </tr>
                  ));

                  const summaryRow = (
                    <tr key={`summary-${key}`} className='summary-row'>
                      <td colSpan={9} className="text-center font-bold">Kuat Tekan Rata-rata</td>
                      <td className="text-center font-bold">{averageStrength.toFixed(2)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  );

                  return [...groupRows, summaryRow];
                })}
              </tbody>
            </table>
          </div>
        </main>
        <footer className="signature-section">
            <div className="signature-col">
                <p>Diuji oleh,</p>
                <div className="signature-box"></div>
                <p className="font-bold underline">({testerName || '....................'})</p>
                <p>Quality Control</p>
            </div>
             <div className="signature-col">
                <p>Diketahui oleh,</p>
                <div className="signature-box"></div>
                <p>(Pimpinan)</p>
            </div>
        </footer>
      </div>
    </>
  );
}
