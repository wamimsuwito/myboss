
'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogOut, User, FlaskConical, ClipboardCheck, FileSearch, Loader2, Camera, Check, Ban, AlertTriangle, Wind, CircleDot, TestTube, Fingerprint, Briefcase, MinusCircle, History, Save, MoreVertical, Printer, X } from 'lucide-react';
import type { UserData, RencanaPemasukan, QCInspectionData, ProductionData } from '@/lib/types';
import { format, isSameDay, addDays, differenceInDays, startOfDay, isAfter } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { db, collection, getDocs, doc, setDoc, query, where, onSnapshot, updateDoc, Timestamp, addDoc } from '@/lib/firebase';
import { resizeImage } from '@/lib/utils';
import { Sidebar, SidebarProvider, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarFooter } from '@/components/ui/sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose, DialogFooter } from '@/components/ui/dialog';
import TestReportPrintLayout from '@/components/test-report-print-layout';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { printElement } from '@/lib/utils';


const PhotoInput = ({ label, onFileChange, photoPreview }: { label: string; onFileChange: (file: string | null) => void; photoPreview: string | null; }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const compressedImage = await resizeImage(file, 800, 800, 0.7);
                onFileChange(compressedImage);
            } catch (err) {
                console.error(err);
                toast({
                  variant: "destructive",
                  title: "Gagal memproses gambar",
                  description: "Silakan coba unggah gambar lain.",
                });
                onFileChange(null);
            }
        }
    };
    
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" capture="environment" />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
                <Camera className="mr-2 h-4 w-4" /> Ambil Foto
            </Button>
            {photoPreview && <img src={photoPreview} alt="Preview" className="rounded-md border p-1 w-full" data-ai-hint="material sample"/>}
        </div>
    );
};

// --- RFI Component (Mobile View) ---
const RFIComponent = () => {
    const [rfiList, setRfiList] = useState<RencanaPemasukan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeInspectionId, setActiveInspectionId] = useState<string | null>(null);
    const [inspectionData, setInspectionData] = useState<Partial<QCInspectionData>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirmingRejection, setIsConfirmingRejection] = useState(false);
    const { toast } = useToast();
    const userInfo = JSON.parse(localStorage.getItem('user') || '{}');

    useEffect(() => {
        const q = query(
            collection(db, "rencana_pemasukan"),
            where('status', 'in', ['Menunggu Inspeksi QC', 'Sedang Dilakukan Inspeksi QC'])
        );
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const pendingInspections = querySnapshot.docs.map(d => ({ ...d.data(), id: d.id }) as RencanaPemasukan);
            setRfiList(pendingInspections);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching RFI list:", error);
            toast({ variant: 'destructive', title: 'Gagal Memuat Data RFI' });
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [toast]);
    
    const handleStartInspection = async (rencanaId: string) => {
        setActiveInspectionId(rencanaId);
        setInspectionData({}); 
        const rencanaDocRef = doc(db, 'rencana_pemasukan', rencanaId);
        await updateDoc(rencanaDocRef, { status: 'Sedang Dilakukan Inspeksi QC' });
    };

    const handlePhotoChange = (field: keyof QCInspectionData, file: string | null) => {
        setInspectionData(prev => ({...prev, [field]: file }));
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setInspectionData(prev => ({ ...prev, [name]: name === 'mudContent' || name === 'sandZone' ? Number(value) : value }));
    };

     const handleSubmitInspection = async (isApproved: boolean) => {
        if (!activeInspectionId || !userInfo) return;

        const rencanaToUpdate = rfiList.find(r => r.id === activeInspectionId);
        if (!rencanaToUpdate) {
            toast({ title: 'Error', description: 'Data rencana tidak ditemukan.', variant: 'destructive'});
            return;
        }

        if (isApproved && !inspectionData.description) {
            toast({ title: "Deskripsi Wajib Diisi", variant: "destructive" });
            return;
        }

        setIsSubmitting(true);
        const newStatus = isApproved ? 'Memenuhi Syarat' : 'Ditolak';

        const updateData: Partial<RencanaPemasukan> = {
            status: newStatus,
            inspection: {
                inspectedBy: userInfo.username,
                inspectionDate: new Date().toISOString(),
                description: inspectionData.description || 'Ditolak tanpa deskripsi.',
                materialPhoto: inspectionData.materialPhoto || undefined,
                mudContent: inspectionData.mudContent || undefined,
                mudContentPhoto: inspectionData.mudContentPhoto || undefined,
                sandZone: inspectionData.sandZone || undefined,
                sandZonePhoto: inspectionData.sandZonePhoto || undefined,
            }
        };

        try {
            const rencanaDocRef = doc(db, 'rencana_pemasukan', activeInspectionId);
            await updateDoc(rencanaDocRef, updateData);

            toast({ title: `Inspeksi Selesai`, description: `Material ditandai sebagai "${newStatus}".` });
            setActiveInspectionId(null);
            setIsConfirmingRejection(false);
            setInspectionData({});

        } catch (error) {
            console.error("Error submitting inspection:", error);
            toast({ title: 'Gagal Menyimpan', variant: 'destructive', description: `Gagal memperbarui status inspeksi. ${error}` });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const renderInspectionForm = () => (
        <div className="space-y-6 pt-4">
            <div className="space-y-2">
                <Label htmlFor="description">Deskripsikan hasil pengecekan material ini</Label>
                <Textarea id="description" name="description" rows={3} placeholder="Contoh: Material bersih, ukuran agregat sesuai..." onChange={handleInputChange} />
            </div>
            <PhotoInput label="Foto Material" photoPreview={inspectionData.materialPhoto || null} onFileChange={(file) => handlePhotoChange('materialPhoto', file)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="mudContent">Hasil Test Kadar Lumpur (%)</Label>
                    <Input id="mudContent" name="mudContent" type="number" placeholder="0.0" onChange={handleInputChange} />
                </div>
                 <PhotoInput label="Foto Test Lumpur" photoPreview={inspectionData.mudContentPhoto || null} onFileChange={(file) => handlePhotoChange('mudContentPhoto', file)} />
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="sandZone">Zona Pasir</Label>
                    <Input id="sandZone" name="sandZone" type="number" placeholder="0.0" onChange={handleInputChange} />
                </div>
                 <PhotoInput label="Foto Zona Pasir" photoPreview={inspectionData.sandZonePhoto || null} onFileChange={(file) => handlePhotoChange('sandZonePhoto', file)} />
            </div>
            <div className="flex gap-4 pt-4">
                <Button variant="destructive" className="w-full" onClick={() => setIsConfirmingRejection(true)} disabled={isSubmitting}><Ban className="mr-2"/> Tolak Material</Button>
                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleSubmitInspection(true)} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Check className="mr-2"/>} Memenuhi Syarat</Button>
            </div>
        </div>
    );

    const renderRfiItem = (rencana: RencanaPemasukan) => {
        const isInspecting = activeInspectionId === rencana.id;
        const etaDate = rencana.arrivalConfirmedAt ? (typeof rencana.arrivalConfirmedAt === 'string' ? new Date(rencana.arrivalConfirmedAt) : (rencana.arrivalConfirmedAt as any).toDate ? (rencana.arrivalConfirmedAt as any).toDate() : null) : null;
        return (
            <Card key={rencana.id} className="bg-muted/30">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-base">{rencana.jenisMaterial === 'BATU' ? <Wind /> : <CircleDot />}{rencana.namaKapal}</CardTitle>
                            <CardDescription>Tiba: {etaDate ? format(etaDate, 'dd MMM, HH:mm', { locale: localeID }) : 'N/A'}</CardDescription>
                        </div>
                        <Badge variant={rencana.status === 'Sedang Dilakukan Inspeksi QC' ? 'default' : 'secondary'} className={rencana.status === 'Sedang Dilakukan Inspeksi QC' ? 'bg-yellow-500 text-yellow-900' : ''}>{rencana.status}</Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {isInspecting ? renderInspectionForm() : rencana.status === 'Menunggu Inspeksi QC' ? (<Button className="w-full" onClick={() => handleStartInspection(rencana.id)}>Lakukan Inspeksi</Button>) : (<Button className="w-full" variant="secondary" onClick={() => setActiveInspectionId(rencana.id)}>Lanjutkan Inspeksi</Button>)}
                </CardContent>
            </Card>
        )
    };

    return (
        <div className="min-h-screen w-full max-w-md mx-auto flex flex-col p-4">
             <AlertDialog open={isConfirmingRejection} onOpenChange={setIsConfirmingRejection}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive"/>Konfirmasi Penolakan</AlertDialogTitle><AlertDialogDescription>Apakah Anda yakin ingin menolak material ini? Tindakan ini akan menghentikan proses bongkar dan tidak dapat diurungkan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => handleSubmitInspection(false)} className="bg-destructive hover:bg-destructive/90">Ya, Tolak Material</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
            <main className="flex-1 flex-col space-y-6">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-3"><FileSearch />REQUEST FOR INSPECTION (RFI)</CardTitle><CardDescription>Daftar material yang telah tiba dan menunggu inspeksi kualitas Anda.</CardDescription></CardHeader>
                    <CardContent>
                        {isLoading ? (<div className="flex justify-center items-center h-40"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>) : rfiList.length > 0 ? (<div className="space-y-4">{rfiList.map(renderRfiItem)}</div>) : (<p className="text-muted-foreground text-center py-8">Tidak ada permintaan inspeksi saat ini.</p>)}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

// --- Uji Tekan Component (Desktop View) ---
const UjiTekanComponent = () => {
    const [testSchedule, setTestSchedule] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [allTestResults, setAllTestResults] = useState<any[]>([]);
    const [activeTestItem, setActiveTestItem] = useState<any | null>(null);
    const [knValue, setKnValue] = useState<string>('');
    const [beratBendaUji, setBeratBendaUji] = useState<string>('');
    const [specimenType, setSpecimenType] = useState<'kubus' | 'silinder'>('kubus');
    
    const [sessionTestResults, setSessionTestResults] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const {toast} = useToast();
    const userInfo = JSON.parse(localStorage.getItem('user') || '{}');

    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
    const [sessionForPrint, setSessionForPrint] = useState<any>(null);

    const TOTAL_INITIAL_SPECIMENS = 9;

    const getDate = (timestamp: any): Date => {
        if (timestamp && typeof timestamp.toDate === 'function') {
          return timestamp.toDate();
        }
        return new Date(timestamp);
    }

    const fetchTestSchedule = useCallback(async () => {
        setIsLoading(true);
        try {
            const productionsRef = collection(db, "productions");
            const testsRef = collection(db, "test_sessions");
            const completedTestsRef = collection(db, "completed_qc_tests");

            const [productionsSnapshot, testsSnapshot, completedTestsSnapshot] = await Promise.all([
                getDocs(productionsRef),
                getDocs(testsRef),
                getDocs(completedTestsRef)
            ]);
            
            const completedTests = completedTestsSnapshot.docs.map(doc => doc.data());

            const productions = productionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as ProductionData);
            const resultsFromSessions = testsSnapshot.docs.flatMap(doc => (doc.data().results || []).map((r: any) => ({ ...r, sessionId: doc.id })));
            setAllTestResults(resultsFromSessions);
            
            const today = startOfDay(new Date());
            const testAges = [7, 14, 28];

            const potentialTests = productions.flatMap(prod => {
                if (!prod.tanggal || typeof (prod.tanggal as any).toDate !== 'function') return [];
                
                let prodDate = (prod.tanggal as any).toDate();
                if (isNaN(prodDate.getTime())) return [];
                prodDate = startOfDay(prodDate);
                
                return testAges.map(age => {
                    const testDate = addDays(prodDate, age);
                    if (isAfter(today, testDate) || isSameDay(today, testDate)) {
                        const isTestCompletedForThisAge = completedTests.some(ct => 
                            ct.productionId === prod.id && ct.mutuBeton === prod.mutuBeton && ct.age === age
                        );

                        if(isTestCompletedForThisAge) return null;

                        return { ...prod, tanggal: prodDate, targetAge: age };
                    }
                    return null;
                }).filter(Boolean);
            });

            const grouped = potentialTests.reduce((acc, test) => {
                if (!test) return acc;
                const prodDateStr = format(test.tanggal, 'yyyy-MM-dd');
                const key = `${prodDateStr}|${test.lokasiProyek}|${test.mutuBeton}`;

                if (!acc[key]) {
                    acc[key] = {
                        ...test,
                        productionIds: new Set([test.id]),
                        totalSpecimens: TOTAL_INITIAL_SPECIMENS
                    };
                } else {
                    if (!acc[key].productionIds.has(test.id)) {
                        acc[key].productionIds.add(test.id);
                        acc[key].totalSpecimens += TOTAL_INITIAL_SPECIMENS;
                    }
                }
                return acc;
            }, {} as Record<string, any>);

            const finalSchedule = Object.values(grouped).map(group => {
                 const testsDoneForGroup = resultsFromSessions.filter(r => group.productionIds.has(r.productionId)).length;
                 const remainingSpecimens = group.totalSpecimens - testsDoneForGroup;
                 const ageInDays = differenceInDays(today, group.tanggal);

                 if (remainingSpecimens > 0) {
                     return { ...group, productionIds: Array.from(group.productionIds), jumlahBendaUji: remainingSpecimens, umurUji: ageInDays };
                 }
                 return null;
            }).filter(Boolean);

            setTestSchedule(finalSchedule);

        } catch (error) {
            console.error("Error fetching initial data:", error);
            toast({ title: "Gagal Memuat Jadwal Uji", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        fetchTestSchedule();
    }, [fetchTestSchedule]);

    useEffect(() => {
      if (isPrintPreviewOpen) {
        document.body.classList.add('print-active');
      } else {
        document.body.classList.remove('print-active');
      }
      return () => {
        document.body.classList.remove('print-active');
      };
    }, [isPrintPreviewOpen]);

    const handleUjiSekarang = (item: any) => {
        setActiveTestItem(item);
    };

    const handleSelesai = async (item: any) => {
        if (!userInfo?.id) return;
        try {
            await addDoc(collection(db, 'completed_qc_tests'), {
                markedBy: userInfo.id,
                markedAt: Timestamp.now(),
                productionId: item.productionIds[0], // Representative ID
                mutuBeton: item.mutuBeton,
                age: item.targetAge,
            });
            toast({ title: "Jadwal Selesai", description: `${item.mutuBeton} umur ${item.targetAge} hari telah ditandai selesai.` });
            fetchTestSchedule(); // Refresh list
        } catch (error) {
            console.error("Error marking test as complete:", error);
            toast({ title: "Gagal Menyimpan", variant: "destructive" });
        }
    };
    
    const calculateStrength = useCallback((kn: number, type: 'kubus' | 'silinder') => {
        if (isNaN(kn) || kn <= 0) return { actualStrength: 0, unit: type === 'kubus' ? 'kg/cm²' : 'MPa' };
        
        let area, strength;
        
        if (type === 'kubus') {
            const sisiCm = 15;
            area = sisiCm * sisiCm;
            const forceInKgf = kn * 101.972;
            strength = forceInKgf / area;
            return { actualStrength: strength, unit: 'kg/cm²' };
        } else {
            const diameterMm = 150;
            area = Math.PI * Math.pow(diameterMm / 2, 2);
            const forceInN = kn * 1000;
            strength = forceInN / area;
            return { actualStrength: strength, unit: 'MPa' };
        }
    }, []);

    const handleKnSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!activeTestItem || !knValue || !beratBendaUji) {
            toast({ title: "Data Kurang", description: "Berat dan KN harus diisi.", variant: "destructive" });
            return;
        }

        const testsPerformedInSession = sessionTestResults.filter(r => r.lokasi === activeTestItem.lokasiProyek && r.mutu === activeTestItem.mutuBeton).length;
        const remainingForActiveItem = testSchedule.find(item => item.lokasiProyek === activeTestItem.lokasiProyek && item.mutuBeton === activeTestItem.mutuBeton)?.jumlahBendaUji || 0;

        if ((testsPerformedInSession) >= remainingForActiveItem) {
            toast({
                title: "Batas Tercapai",
                description: `Anda sudah menguji semua ${remainingForActiveItem} benda uji yang tersisa untuk sampel ini.`,
                variant: "destructive"
            });
            return;
        }

        const kn = parseFloat(knValue);
        const berat = parseFloat(beratBendaUji);
        const { actualStrength, unit } = calculateStrength(kn, specimenType);
        
        let correctionFactor = 1.0;
        const currentAge = activeTestItem.umurUji;
        if (currentAge >= 7 && currentAge < 14) correctionFactor = 0.70;
        else if (currentAge >= 14 && currentAge < 28) correctionFactor = 0.90;

        const predictedStrength = actualStrength / correctionFactor;
        const targetStrengthValue = parseFloat(activeTestItem.mutuBeton.replace(/[^0-9.]/g, ''));
        let targetAchievement = 0;
        
        let targetValueInCurrentUnit = targetStrengthValue;
        if (unit === 'MPa' && activeTestItem.mutuBeton.startsWith('K-')) targetValueInCurrentUnit /= 10.2;
        else if (unit === 'kg/cm²' && activeTestItem.mutuBeton.startsWith('FC')) targetValueInCurrentUnit *= 10.2;
        if (!isNaN(targetValueInCurrentUnit) && targetValueInCurrentUnit > 0) targetAchievement = (predictedStrength / targetValueInCurrentUnit) * 100;

        const newTestResultEntry = {
            productionId: activeTestItem.productionIds[0],
            tanggalPembuatan: activeTestItem.tanggal,
            pelanggan: activeTestItem.namaPelanggan,
            lokasi: activeTestItem.lokasiProyek,
            mutu: activeTestItem.mutuBeton,
            slump: activeTestItem.slump || '-',
            tanggalUji: new Date(),
            umurUji: `${currentAge} Hari`,
            jenisBendaUji: specimenType,
            beratBendaUji: berat,
            kn, actualStrength, predictedStrength, targetAchievement, unit, keterangan: ''
        };
        
        setSessionTestResults(prev => [...prev, newTestResultEntry]);
        setKnValue('');
        setBeratBendaUji('');
    };

    const handleSaveAllResults = async () => {
        if (sessionTestResults.length === 0) {
            toast({ title: "Tidak ada data", description: "Tidak ada hasil uji untuk disimpan.", variant: "destructive" });
            return;
        }
        
        setIsSaving(true);
        const sessionData = {
            testerName: userInfo.username,
            testerId: userInfo.id,
            testDate: Timestamp.now(),
            results: sessionTestResults,
        };

        try {
            await addDoc(collection(db, "test_sessions"), sessionData);
            toast({title: "Hasil Uji Disimpan", description: `Sebanyak ${sessionTestResults.length} hasil pengujian telah disimpan.`});
            setActiveTestItem(null);
            setSessionTestResults([]);
            fetchTestSchedule();
        } catch (error) {
            console.error("Error saving test results:", error);
            toast({ title: 'Gagal Menyimpan Hasil', variant: 'destructive' });
        } finally { setIsSaving(false); }
    };
    
    const handlePrintRequest = () => {
        if (sessionTestResults.length === 0) {
            toast({ title: "Tidak ada data untuk dicetak", variant: "destructive"});
            return;
        }
        const sessionData = { 
            results: sessionTestResults, 
            testerName: userInfo.username, 
            testDate: new Date()
        };
        setSessionForPrint(sessionData);
        setIsPrintPreviewOpen(true);
    };

    const getTestsPerformedCountForSession = (item: any) => {
         return sessionTestResults.filter(r => r.lokasi === item.lokasiProyek && r.mutu === item.mutuBeton).length;
    };
    
    const groupedSessionResults = useMemo(() => {
        return sessionTestResults.reduce((acc, result) => {
            const key = `${result.lokasi}|${result.mutu}|${result.umurUji}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(result);
            return acc;
        }, {} as Record<string, any[]>);
    }, [sessionTestResults]);
    
    const getResultUnit = (result: any) => {
        if (!result) return '';
        return result.jenisBendaUji === 'kubus' ? 'kg/cm²' : 'MPa';
    };


    return (
        <div className="space-y-8">
            <Dialog open={isPrintPreviewOpen} onOpenChange={setIsPrintPreviewOpen}>
              <DialogContent className="max-w-4xl p-0">
                <DialogHeader className="p-4 border-b no-print">
                  <DialogTitle>Pratinjau Laporan Uji Tekan</DialogTitle>
                  <DialogClose asChild><Button variant="ghost" size="icon" className="absolute right-4 top-3"><X /></Button></DialogClose>
                </DialogHeader>
                <div id="printable-test-report" className="p-6 max-h-[80vh] overflow-y-auto">
                    <TestReportPrintLayout sessionData={sessionForPrint} />
                </div>
                <DialogFooter className="p-4 border-t bg-muted no-print">
                    <Button variant="outline" onClick={() => setIsPrintPreviewOpen(false)}>Tutup</Button>
                    <Button onClick={() => printElement('printable-test-report')}>Cetak</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Card>
                <CardHeader><CardTitle>Jadwal Uji Tekan Hari Ini</CardTitle><CardDescription>Daftar sampel beton yang jatuh tempo untuk diuji hari ini.</CardDescription></CardHeader>
                <CardContent>
                    <div className="border rounded-md overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tgl Produksi</TableHead>
                                    <TableHead>Pelanggan</TableHead>
                                    <TableHead>Lokasi</TableHead>
                                    <TableHead>Mutu Beton</TableHead>
                                    <TableHead>Umur (Hari)</TableHead>
                                    <TableHead>Benda Uji Tersisa</TableHead>
                                    <TableHead>Diuji Sesi Ini</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (<TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="animate-spin"/></TableCell></TableRow>) : testSchedule.length > 0 ? (
                                    testSchedule.map((item, index) => (
                                        <TableRow key={index} className={activeTestItem?.lokasiProyek === item.lokasiProyek && activeTestItem.mutuBeton === item.mutuBeton ? 'bg-accent/50' : ''}>
                                            <TableCell>{format(getDate(item.tanggal), 'dd MMM yyyy')}</TableCell>
                                            <TableCell>{item.namaPelanggan}</TableCell>
                                            <TableCell>{item.lokasiProyek}</TableCell>
                                            <TableCell>{item.mutuBeton}</TableCell>
                                            <TableCell><Badge>{item.umurUji}</Badge></TableCell>
                                            <TableCell>{item.jumlahBendaUji}</TableCell>
                                            <TableCell>{getTestsPerformedCountForSession(item)}</TableCell>
                                            <TableCell className="text-right">
                                                 <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => handleUjiSekarang(item)}>Uji Sekarang</DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => handleSelesai(item)} className="text-destructive focus:text-destructive">Tandai Selesai</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (<TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Tidak ada jadwal uji tekan untuk hari ini.</TableCell></TableRow>)}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {activeTestItem && (
                <Card>
                    <CardHeader>
                        <CardTitle>Input Hasil Uji: {activeTestItem.pelanggan}</CardTitle>
                        <CardDescription>Mutu: {activeTestItem.mutuBeton} | Lokasi: {activeTestItem.lokasiProyek} | Umur Aktual: {activeTestItem.umurUji} Hari</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleKnSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 border rounded-md bg-muted/30">
                           <div className="space-y-1"><Label htmlFor="specimenType">Jenis Benda Uji</Label><Select value={specimenType} onValueChange={(v) => setSpecimenType(v as 'kubus' | 'silinder')}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="kubus">Kubus (15x15 cm)</SelectItem><SelectItem value="silinder">Silinder (15x30 cm)</SelectItem></SelectContent></Select></div>
                           <div className="space-y-1"><Label htmlFor="beratBendaUji">Berat (kg)</Label><Input id="beratBendaUji" type="number" step="any" placeholder="Contoh: 8.5" value={beratBendaUji} onChange={(e) => setBeratBendaUji(e.target.value)} required/></div>
                           <div className="space-y-1"><Label htmlFor="knValue">Kuat Tekan (KN)</Label><Input id="knValue" type="number" step="any" placeholder="Contoh: 550.5" value={knValue} onChange={(e) => setKnValue(e.target.value)} required/></div>
                           <Button type="submit">Tambah Hasil (Enter)</Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader className='flex flex-row justify-between items-center'>
                    <div>
                        <CardTitle>Hasil Pengujian Sesi Ini</CardTitle>
                        <CardDescription>Total {sessionTestResults.length} hasil pengujian baru siap untuk disimpan dan dicetak.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handlePrintRequest} disabled={sessionTestResults.length === 0}>Cetak Laporan</Button>
                        <Button onClick={handleSaveAllResults} disabled={sessionTestResults.length === 0 || isSaving}>
                            {isSaving && <Loader2 className="animate-spin mr-2" />} 
                            <Save className="mr-2"/>Simpan Semua Hasil
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                {Object.keys(groupedSessionResults).length > 0 ? (
                    <div className="space-y-6">
                    {Object.keys(groupedSessionResults).map((key) => {
                        const groupResults = groupedSessionResults[key];
                        const [lokasi, mutu, umur] = key.split('|');
                        const resultUnit = getResultUnit(groupResults[0]);
                        return (
                            <div key={key}>
                                <h4 className="font-semibold text-muted-foreground mb-2">{`${lokasi} - Mutu ${mutu} - Umur ${umur}`}</h4>
                                <div className="border rounded-md overflow-x-auto">
                                <Table>
                                    <TableHeader><TableRow className="whitespace-nowrap"><TableHead>Tgl Prod</TableHead><TableHead>Berat (kg)</TableHead><TableHead>KN</TableHead><TableHead>Hasil Uji ({resultUnit})</TableHead><TableHead>Prediksi 28 Hari ({resultUnit})</TableHead><TableHead>Target (%)</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                    {(groupResults as any[]).map((data, index) => (
                                        <TableRow key={index} className="whitespace-nowrap"><TableCell>{format(getDate(data.tanggalPembuatan), 'dd/MM/yy')}</TableCell><TableCell>{data.beratBendaUji.toFixed(2)}</TableCell><TableCell>{data.kn.toFixed(2)}</TableCell><TableCell>{data.actualStrength.toFixed(2)}</TableCell><TableCell>{data.predictedStrength.toFixed(2)}</TableCell><TableCell>{data.targetAchievement.toFixed(2)} %</TableCell></TableRow>
                                    ))}
                                    </TableBody>
                                </Table>
                                </div>
                            </div>
                        )
                    })}
                    </div>
                ) : (
                    <div className="text-center py-10 text-muted-foreground">Belum ada hasil pengujian yang ditambahkan pada sesi ini.</div>
                )}
                </CardContent>
            </Card>
        </div>
    );
};


// --- Main QC Page ---
export default function QCPage() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [activeMenu, setActiveMenu] = useState('Jadwal Uji Tekan Hari Ini');

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.replace('/login');
    } else {
      const userData = JSON.parse(userString);
      if (userData.jabatan !== 'QC') {
        router.replace('/login');
      } else {
        setUserInfo(userData);
      }
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  const getDate = (timestamp: any): Date => {
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    return new Date(timestamp);
}

  if (!userInfo) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-16 w-16 animate-spin text-primary" /></div>;
  }
  
  const menuItems = [
    { name: 'Inspeksi Material Masuk', icon: FileSearch, href: '/qc' },
    { name: 'Jadwal Uji Tekan Hari Ini', icon: TestTube, href: '/qc' },
    { name: 'Riwayat Uji Tekan', icon: History, href: '/riwayat-uji-tekan' }
  ];

  const isMobileLayout = activeMenu === 'Inspeksi Material Masuk';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar>
          <SidebarContent>
            <SidebarHeader>
              <div className="flex items-center gap-2 p-2">
                 <FlaskConical className="h-8 w-8 text-primary" />
                 <div>
                    <h2 className="text-xl font-bold tracking-wider">Dasbor QC</h2>
                    <p className="text-xs text-muted-foreground">{userInfo.username}</p>
                 </div>
              </div>
            </SidebarHeader>
            <SidebarMenu>
                {menuItems.map(item => (
                    <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton 
                            isActive={activeMenu === item.name} 
                            onClick={() => item.href === '/qc' ? setActiveMenu(item.name) : router.push(item.href)}
                        >
                            <item.icon/>{item.name}
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
            <SidebarFooter>
                <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-muted-foreground"><LogOut className="mr-2 h-4 w-4" />Keluar</Button>
            </SidebarFooter>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
            <main className={isMobileLayout ? 'no-print' : 'p-4 sm:p-6 lg:p-10 no-print'}>
               <div className={isMobileLayout ? 'no-print' : 'flex items-center gap-4 mb-8'}>
                    <SidebarTrigger className="md:hidden" />
                    {!isMobileLayout && (<div>
                        <h1 className="text-2xl font-bold text-foreground">{activeMenu}</h1>
                        <div className="text-xs text-muted-foreground flex items-center gap-3">
                          <span className='flex items-center gap-1.5'><Fingerprint size={12}/>{userInfo.nik}</span>
                          <span className='flex items-center gap-1.5'><Briefcase size={12}/>{userInfo.jabatan}</span>
                        </div>
                    </div>)}
                </div>
                
                {activeMenu === 'Inspeksi Material Masuk' && <RFIComponent />}
                {activeMenu === 'Jadwal Uji Tekan Hari Ini' && <UjiTekanComponent />}

            </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
