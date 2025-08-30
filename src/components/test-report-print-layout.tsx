
'use client';

import { format } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import styles from './test-report-print.module.css'; // Import the CSS module

interface TestReportPrintLayoutProps {
  sessionData: any;
}

export default function TestReportPrintLayout({ sessionData }: TestReportPrintLayoutProps) {
  if (!sessionData || !sessionData.results || sessionData.results.length === 0) {
    return <div className="p-4">Data tidak lengkap untuk dicetak.</div>;
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
    // Use the class from the CSS module
    <div className={styles.printableArea}>
        <header className={styles.printHeader}>
            <img src="https://i.imgur.com/CxaNLPj.png" alt="Logo" className={styles.printLogo} data-ai-hint="logo company"/>
            <div className={styles.companyInfo}>
                <h1 className={styles.companyName}>PT. FARIKA RIAU PERKASA</h1>
                <p className={styles.companyTagline}>one stop concrete solution</p>
                <p className={styles.companyServices}>READYMIX & PRECAST CONCRETE</p>
                <p className={styles.companyAddress}>Jl. Soekarno Hatta Komp. SKA No. 62 E Pekanbaru Telp. (0761) 7090228 - 571662</p>
            </div>
        </header>
        <hr className={styles.headerDivider} />
        <h2 className={styles.reportTitle}>LAPORAN HASIL UJI KUAT TEKAN BETON</h2>
        
        <main>
          <table className={styles.infoTable}>
              <tbody>
                  <tr>
                      <td className={styles.label}>Tanggal Pengujian</td>
                      <td>: {format(getDate(testDate), 'dd MMMM yyyy, HH:mm', { locale: localeID })}</td>
                  </tr>
                   <tr>
                      <td className={styles.label}>Jenis Benda Uji</td>
                      <td className="capitalize">: {specimenType}</td>
                  </tr>
                  <tr>
                      <td className={styles.label}>Diuji Oleh</td>
                      <td>: {testerName}</td>
                  </tr>
              </tbody>
          </table>

          <div className="mb-6">
            <table className={styles.printTable}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Pelanggan</th>
                  <th>Lokasi Proyek</th>
                  <th>Mutu</th>
                  <th>Umur</th>
                  <th>Tgl Prod</th>
                  <th>Slump</th>
                  <th>Berat (kg)</th>
                  <th>KN</th>
                  <th>Hasil Uji ({resultUnit})</th>
                  <th>Prediksi 28 Hari ({resultUnit})</th>
                  <th>Target thd Mutu (%)</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(groupedResults).flatMap((key, groupIndex) => {
                  const group = groupedResults[key];
                  const totalStrength = group.reduce((sum: number, item: any) => sum + (item.actualStrength || 0), 0);
                  const averageStrength = group.length > 0 ? totalStrength / group.length : 0;

                  const groupRows = group.map((item: any, index: number) => (
                    <tr key={`${key}-${index}`}>
                      <td>{index + 1}</td>
                      <td className={styles.textLeft}>{item.pelanggan}</td>
                      <td className={styles.textLeft}>{item.lokasi}</td>
                      <td>{item.mutu}</td>
                      <td>{item.umurUji}</td>
                      <td>{format(getDate(item.tanggalPembuatan), 'dd/MM/yy')}</td>
                      <td>{item.slump}</td>
                      <td className={styles.textRight}>{typeof item.beratBendaUji === 'number' ? item.beratBendaUji.toFixed(2) : '0.00'}</td>
                      <td className={styles.textRight}>{typeof item.kn === 'number' ? item.kn.toFixed(2) : '0.00'}</td>
                      <td className={styles.textRight}>{typeof item.actualStrength === 'number' ? item.actualStrength.toFixed(2) : '0.00'}</td>
                      <td className={styles.textRight}>{typeof item.predictedStrength === 'number' ? item.predictedStrength.toFixed(2) : '0.00'}</td>
                      <td className={styles.textRight}>{typeof item.targetAchievement === 'number' ? item.targetAchievement.toFixed(2) : '0.00'}</td>
                    </tr>
                  ));

                  const summaryRow = (
                    <tr key={`summary-${key}`} className={styles.summaryRow}>
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
        <footer className={styles.signatureSection}>
            <div className={styles.signatureCol}>
                <p>Diuji oleh,</p>
                <div className={styles.signatureBox}></div>
                <p className="font-bold underline">({testerName || '....................'})</p>
                <p>Quality Control</p>
            </div>
             <div className={styles.signatureCol}>
                <p>Diketahui oleh,</p>
                <div className={styles.signatureBox}></div>
                <p>(Pimpinan)</p>
            </div>
        </footer>
      <div className={styles.watermark}>PT FARIKA RIAU PERKASA</div>
    </div>
  );
}
