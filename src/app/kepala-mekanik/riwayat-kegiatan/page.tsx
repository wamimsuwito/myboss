'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogOut, User, ChevronDown, Loader2, PackagePlus, Ship, Warehouse, Droplets, Wind, CircleDot, Printer, X, Replace, History, Search, FilterX, Calendar as CalendarIconLucide, Anchor, Clock, ListOrdered, FileClock, Edit, ListChecks, Package, Play, Pause, AlertTriangle, Check, Archive, ActivitySquare, CheckCircle, Truck, ClipboardList, Info, Briefcase, Fingerprint, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import type { UserData, CementSiloStock, PemasukanLogEntry, BufferSiloStock, BufferTankStock, TransferLogEntry, RencanaPemasukan, Job, TripLog, ArchivedJob, CementActivity, CementBongkarState, AlatData, LocationData } from '@/lib/types';
import { Sidebar, SidebarProvider, SidebarTrigger, SidebarInset, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter } from '@/components/ui/sidebar';
import { format, startOfDay, endOfDay, isWithinInterval, formatDistanceStrict, isAfter, subDays, differenceInMilliseconds } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { id as localeID } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import LaporanPemasukanPrintLayout from '@/components/laporan-pemasukan-print-layout';
import { printElement, cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { db, collection, getDocs, doc, setDoc, deleteDoc, addDoc, onSnapshot, updateDoc, query, where } from '@/lib/firebase';


const materialConfig: { key: string; name: string; unit: string; icon: React.ElementType }[] = [
    { key: 'semen', name: 'SEMEN', unit: 'KG', icon: Warehouse },
    { key: 'pasir', name: 'PASIR', unit: 'M3', icon: CircleDot },
    { key: 'batu', name: 'BATU', unit: 'M3', icon: Wind },
    { key: 'air', name: 'AIR', unit: 'KG', icon: Droplets },
    { key: 'sikaVz', name: 'SIKA VZ', unit: 'LT', icon: Droplets },
    { key: 'sikaNn', 'name': 'SIKA NN', 'unit': 'LT', icon: Droplets },
    { key: 'visco', name: 'VISCO', 'unit': 'LT', icon: Droplets },
];

const SHIP_TANK_COUNT = 6;
const MUATAN_PER_RIT = 20; // m3

export default function AdminLogistikMaterialPage() {
    const router = useRouter();
    const [userInfo, setUserInfo] = useState<UserData | null>(null);
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [activeMenu, setActiveMenu] = useState('status');

    // Pemasukan Material States
    const [dailyLog, setDailyLog] = useState<PemasukanLogEntry[]>([]);
    
    // Print Laporan States
    const [isPrintPreviewing, setIsPrintPreviewing] = useState(false);
    const [reportData, setReportData] = useState<PemasukanLogEntry[]>([]);
    const [reportTitle, setReportTitle] = useState('Laporan Harian Pemasukan Material');
    
    // Riwayat Pemasukan States
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [allPemasukan, setAllPemasukan] = useState<PemasukanLogEntry[]>([]);
    const [filteredPemasukan, setFilteredPemasukan] = useState<PemasukanLogEntry[]>([]);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);

    // Rencana Pemasukan States
    const [rencanaPemasukan, setRencanaPemasukan] = useState<RencanaPemasukan[]>([]);
    const [isSubmittingRencana, setIsSubmittingRencana] = useState(false);
    const [newRencana, setNewRencana] = useState<Partial<RencanaPemasukan>>({
        namaKapal: '',
        jenisMaterial: '',
        estimasiMuatan: 0,
        eta: new Date(),
        namaSopir: '',
        keterangan: '',
        noSpb: '',
        tankLoads: Object.fromEntries(Array.from({ length: SHIP_TANK_COUNT }, (_, i) => [`tank-${i + 1}`, 0])),
        spbPerTank: Object.fromEntries(Array.from({ length: SHIP_TANK_COUNT }, (_, i) => [`tank-${i + 1}`, ''])),
    });
    const [isConfirmArrivalOpen, setIsConfirmArrivalOpen] = useState(false);
    const [selectedRencana, setSelectedRencana] = useState<RencanaPemasukan | null>(null);

    // Bongkar Material (Job) States
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isSubmittingJob, setIsSubmittingJob] = useState(false);
    const [isDelayDialogOpen, setIsDelayDialogOpen] = useState(false);
    const [selectedJobForDelay, setSelectedJobForDelay] = useState<Job | null>(null);
    const [delayReasonInput, setDelayReasonInput] = useState('');

    // New state for Bongkar Material from Rencana
    const [isCreateJobDialogOpen, setIsCreateJobDialogOpen] = useState(false);
    const [selectedRencanaForJob, setSelectedRencanaForJob] = useState<RencanaPemasukan | null>(null);
    const [jobCreationData, setJobCreationData] = useState({ bbmPerRit: 5, totalVolume: 0 });

    // Riwayat Bongkar States
    const [isFetchingArchive, setIsFetchingArchive] = useState(false);
    const [archivedJobs, setArchivedJobs] = useState<ArchivedJob[]>([]);
    const [filteredArchivedJobs, setFilteredArchivedJobs] = useState<ArchivedJob[]>([]);
    const [archiveDateRange, setArchiveDateRange] = useState<DateRange | undefined>();
    const [isArchiveDetailOpen, setIsArchiveDetailOpen] = useState(false);
    const [selectedArchivedJob, setSelectedArchivedJob] = useState<ArchivedJob | null>(null);
    const [archivedCementJobs, setArchivedCementJobs] = useState<RencanaPemasukan[]>([]);
    
    // Status Bongkaran States
    const [allTripHistories, setAllTripHistories] = useState<{[jobId: string]: TripLog[]}>({});
    const [cementUnloadingStates, setCementUnloadingStates] = useState<{[jobId: string]: CementBongkarState}>({});
    const [currentTime, setCurrentTime] = useState(new Date());

    // Daftar Kendaraan States
    const [alat, setAlat] = useState<AlatData[]>([]);
    const [locations, setLocations] = useState<LocationData[]>([]);
    const [isMutasiDialogOpen, setIsMutasiDialogOpen] = useState(false);
    const [mutasiTarget, setMutasiTarget] = useState<AlatData | null>(null);
    const [newLocationForMutasi, setNewLocationForMutasi] = useState('');
    const [isMutating, setIsMutating] = useState(false);
    const [isQuarantineConfirmOpen, setIsQuarantineConfirmOpen] = useState(false);
    const [quarantineTarget, setQuarantineTarget] = useState<AlatData | null>(null);


    const fetchDailyLog = useCallback(async () => {
        const todayKey = `pemasukan_log_${format(new Date(), 'yyyy-MM-dd')}`;
        const querySnapshot = await getDocs(collection(db, todayKey));
        const logData = querySnapshot.docs.map(doc => doc.data() as PemasukanLogEntry);
        setDailyLog(logData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }, []);

    const fetchAllData = useCallback(async () => {
        setIsFetching(true);
        try {
            const [rencanaSnap, archivedJobsSnap, archivedCementSnap, pemasukanSnap, alatSnap, locationsSnap] = await Promise.all([
                getDocs(collection(db, 'rencana_pemasukan')),
                getDocs(collection(db, 'archived_jobs')),
                getDocs(collection(db, 'archived_cement_jobs')),
                getDocs(collection(db, 'arsip_pemasukan_material_semua')),
                getDocs(collection(db, 'alat')),
                getDocs(collection(db, 'locations')),
            ]);

            setRencanaPemasukan(rencanaSnap.docs.map(d => ({id: d.id, ...d.data()}) as RencanaPemasukan));
            setArchivedJobs(archivedJobsSnap.docs.map(d => ({id: d.id, ...d.data()}) as ArchivedJob));
            setArchivedCementJobs(archivedCementSnap.docs.map(d => ({id: d.id, ...d.data()}) as RencanaPemasukan));
            setAllPemasukan(pemasukanSnap.docs.map(d => ({id: d.id, ...d.data()}) as PemasukanLogEntry));
            setAlat(alatSnap.docs.map(d => ({id: d.id, ...d.data()}) as AlatData));
            setLocations(locationsSnap.docs.map(d => ({id: d.id, ...d.data()}) as LocationData));


            await fetchDailyLog();
        } catch (e) {
            toast({ variant: "destructive", title: "Gagal memuat data", description: "Tidak dapat mengambil data dari Firestore." });
        } finally {
            setIsFetching(false);
        }
    }, [fetchDailyLog, toast]);

    useEffect(() => {
        const userString = localStorage.getItem('user');
        if (!userString) {
          router.push('/login');
          return;
        }
        const userData = JSON.parse(userString);
        if (userData.jabatan !== 'ADMIN LOGISTIK MATERIAL') {
            toast({
                variant: 'destructive',
                title: 'Akses Ditolak',
                description: 'Anda tidak memiliki hak untuk mengakses halaman ini.',
            });
            router.push('/login');
            return;
        }
        setUserInfo(userData);
        
        fetchAllData();

        // Realtime listener for available jobs
        const jobsUnsubscribe = onSnapshot(collection(db, 'available_jobs'), (snapshot) => {
            setJobs(snapshot.docs.map(d => ({id: d.id, ...d.data()}) as Job));
        });
        
        // Realtime listener for trip histories
        const tripsUnsubscribe = onSnapshot(collection(db, 'all_trip_histories'), (snapshot) => {
            const trips = snapshot.docs.map(d => d.data() as TripLog);
            const groupedByJob = trips.reduce((acc, trip) => {
                if (!acc[trip.jobId]) {
                    acc[trip.jobId] = [];
                }
                acc[trip.jobId].push(trip);
                return acc;
            }, {} as Record<string, TripLog[]>);
            setAllTripHistories(groupedByJob);
        });

        // Realtime listener for cement unloading states
        const cementStateUnsubscribe = onSnapshot(collection(db, 'bongkar_state'), (snapshot) => {
            const states: Record<string, CementBongkarState> = {};
            snapshot.forEach(doc => {
                states[doc.id] = doc.data() as CementBongkarState;
            });
            setCementUnloadingStates(states);
        });
        
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        
        return () => { 
            clearInterval(timer); 
            jobsUnsubscribe();
            tripsUnsubscribe();
            cementStateUnsubscribe();
        };
    }, [router, fetchAllData, toast]);

    const handleLogout = () => { router.push('/login'); };
    
    const archivePemasukanEntry = async (logEntry: PemasukanLogEntry) => {
        await addDoc(collection(db, 'arsip_pemasukan_material_semua'), logEntry);
    }

    const handleLogPemasukan = async (rencana: RencanaPemasukan) => {
        if (!userInfo?.lokasi) { toast({ title: "Data tidak lengkap", variant: "destructive" }); return; }
        const materialInfo = materialConfig.find(m => m.name === rencana.jenisMaterial);
        if (!materialInfo) { toast({ title: "Material tidak valid", variant: "destructive" }); return; }
        
        const totalAmount = rencana.jenisMaterial === 'SEMEN' ? Object.values(rencana.tankLoads || {}).reduce((s, a) => s + a, 0) : rencana.estimasiMuatan;

        const entriesToLog: Omit<PemasukanLogEntry, 'id'>[] = [];
        
        if (rencana.jenisMaterial === 'SEMEN' && rencana.spbPerTank) {
            Object.entries(rencana.spbPerTank).forEach(([tankId, spb]) => {
                const amount = rencana.tankLoads?.[tankId] || 0;
                if(spb && amount > 0) {
                     entriesToLog.push({ 
                         timestamp: new Date().toISOString(),
                         material: materialInfo.name, noSpb: spb, namaKapal: rencana.namaKapal,
                         namaSopir: rencana.namaSopir, jumlah: amount, unit: materialInfo.unit,
                         keterangan: `Dari ${tankId.replace('-', ' ')}`,
                     });
                }
            });
        } else {
             entriesToLog.push({ 
                timestamp: new Date().toISOString(),
                material: materialInfo.name, noSpb: rencana.noSpb || '', namaKapal: rencana.namaKapal,
                namaSopir: rencana.namaSopir, jumlah: totalAmount, unit: materialInfo.unit,
            });
        }
        
        const todayLogKey = `pemasukan_log_${format(new Date(), 'yyyy-MM-dd')}`;
        for (const entry of entriesToLog) {
            const docRef = await addDoc(collection(db, todayLogKey), entry);
            await archivePemasukanEntry({ ...entry, id: docRef.id });
        }
        
        await fetchDailyLog();
        
        toast({ title: `Pemasukan ${materialInfo.name} Dicatat`, description: `Stok akan diperbarui setelah bongkar selesai.` });
    };

    const handleCreateJobFromRencana = async () => {
        if (!selectedRencanaForJob) return;
        
        const { bbmPerRit, totalVolume } = jobCreationData;

        const newJob: Omit<Job, 'id'> = {
            namaKapal: selectedRencanaForJob.namaKapal,
            material: selectedRencanaForJob.jenisMaterial as 'Batu' | 'Pasir',
            totalVolume: totalVolume,
            bbmPerRit: bbmPerRit,
            status: 'Menunggu',
            volumeTerbongkar: 0,
            sisaVolume: totalVolume,
            totalWaktuTunda: 0,
            riwayatTunda: [],
            rencanaId: selectedRencanaForJob.id,
        };
        
        const docRef = await addDoc(collection(db, 'available_jobs'), newJob);
        setJobs(prev => [{...newJob, id: docRef.id}, ...prev]);

        // Update Rencana status
        const rencanaDocRef = doc(db, 'rencana_pemasukan', selectedRencanaForJob.id);
        await setDoc(rencanaDocRef, { status: 'Siap Untuk Dibongkar' }, { merge: true });
        setRencanaPemasukan(prev => prev.map(r => r.id === selectedRencanaForJob.id ? { ...r, status: 'Siap Untuk Dibongkar' } : r));


        toast({ title: 'Perintah Bongkar Diterbitkan' });
        setIsCreateJobDialogOpen(false);
        setSelectedRencanaForJob(null);
    };

    const handlePrintReport = async (source: 'today' | 'history' = 'today') => {
        let dataToPrint: PemasukanLogEntry[] = [];
        if (source === 'today') {
            dataToPrint = dailyLog;
            setReportTitle('Laporan Harian Pemasukan Material');
        } else {
            dataToPrint = filteredPemasukan; const from = dateRange?.from ? format(dateRange.from, 'dd/MM/yy') : ''; const to = dateRange?.to ? format(dateRange.to, 'dd/MM/yy') : from;
            setReportTitle(`Laporan Pemasukan Material (${from} - ${to})`);
        }
        if (dataToPrint.length === 0) { toast({ title: "Tidak Ada Data", description: "Tidak ada data pemasukan untuk periode ini."}); return; }
        setReportData(dataToPrint); setIsPrintPreviewing(true);
    };
    
    const handleSearchHistory = () => {
        setIsFetchingHistory(true);
        if (!dateRange?.from) { toast({ title: 'Tanggal diperlukan', variant: 'destructive'}); setIsFetchingHistory(false); return; }
        const fromDate = startOfDay(dateRange.from), toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
        const results = allPemasukan.filter(entry => entry.timestamp && isWithinInterval(new Date(entry.timestamp), { start: fromDate, end: toDate }));
        setTimeout(() => { setFilteredPemasukan(results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())); setIsFetchingHistory(false); }, 500);
    }
    
    const clearHistoryFilter = () => { setDateRange(undefined); setFilteredPemasukan([]); }

    const handleNewRencanaChange = (field: keyof Partial<RencanaPemasukan>, value: any) => { setNewRencana(prev => ({ ...prev, [field]: value })); };
    const handleRencanaSpbChange = (tankId: string, spb: string) => { setNewRencana(prev => ({ ...prev, spbPerTank: { ...prev.spbPerTank, [tankId]: spb.toUpperCase() } })); };
    const handleRencanaMuatanChange = (tankId: string, muatan: string) => { setNewRencana(prev => ({ ...prev, tankLoads: { ...prev.tankLoads, [tankId]: Number(muatan) } })); };
    
    const handleSaveRencana = async () => {
        if (!newRencana.namaKapal || !newRencana.jenisMaterial) { toast({ title: "Data Rencana Tidak Lengkap", variant: "destructive" }); return; }
        
        if (newRencana.jenisMaterial === 'SEMEN') {
            const filledTanks = Object.keys(newRencana.tankLoads || {}).filter(key => (newRencana.tankLoads?.[key] || 0) > 0 && (newRencana.spbPerTank?.[key] || ''));
            if (filledTanks.length !== SHIP_TANK_COUNT) {
                 toast({ title: "Data Tangki tidak lengkap", description: `Harap isi muatan dan SPB untuk semua ${SHIP_TANK_COUNT} tangki.`, variant: "destructive" }); return;
            }

            const spbs = Object.values(newRencana.spbPerTank || {}).filter(spb => spb !== '');
            if (new Set(spbs).size !== spbs.length) {
                toast({ title: "Nomor SPB Duplikat", description: "Pastikan semua Nomor SPB unik.", variant: "destructive" }); return;
            }
        } else {
            if (!newRencana.noSpb) {
                toast({ title: "Nomor SPB Wajib Diisi", description: `Harap isi Nomor SPB untuk ${newRencana.jenisMaterial}.`, variant: "destructive" }); return;
            }
        }

        setIsSubmittingRencana(true);
        const newEntry: Omit<RencanaPemasukan, 'id'> = { status: 'Dalam Perjalanan', ...newRencana, arrivalConfirmedAt: null } as Omit<RencanaPemasukan, 'id'>;
        const docRef = await addDoc(collection(db, 'rencana_pemasukan'), newEntry);
        setRencanaPemasukan(prev => [{...newEntry, id: docRef.id}, ...prev]);
        setNewRencana({ namaKapal: '', jenisMaterial: '', estimasiMuatan: 0, eta: new Date(), namaSopir: '', keterangan: '', tankLoads: {}, spbPerTank: {}, noSpb: '' });
        toast({ title: "Rencana Ditambahkan" }); setIsSubmittingRencana(false);
    };

    const handleConfirmArrival = async (rencana: RencanaPemasukan) => {
        let updatedStatus: RencanaPemasukan['status'];

        if (rencana.jenisMaterial === 'SEMEN') {
            updatedStatus = 'Siap Untuk Dibongkar';
        } else {
            updatedStatus = 'Menunggu Inspeksi QC';
        }

        const rencanaDocRef = doc(db, 'rencana_pemasukan', rencana.id);
        await setDoc(rencanaDocRef, { status: updatedStatus, arrivalConfirmedAt: new Date().toISOString() }, { merge: true });

        setRencanaPemasukan(prev => prev.map(r => r.id === rencana.id ? { ...r, status: updatedStatus, arrivalConfirmedAt: new Date().toISOString() } : r));
        
        toast({ title: "Konfirmasi Berhasil", description: `${rencana.namaKapal} telah tiba dan status diperbarui.` });
        setIsConfirmArrivalOpen(false); setSelectedRencana(null);
    };

    const handleJobStatusChange = async (jobId: string, newStatus: Job['status']) => {
        const jobToUpdate = jobs.find(j => j.id === jobId);
        if (!jobToUpdate || jobToUpdate.status === 'Selesai') return;
    
        const jobDocRef = doc(db, 'available_jobs', jobId);
    
        try {
            if (newStatus === 'Tunda') {
                setSelectedJobForDelay(jobToUpdate);
                setIsDelayDialogOpen(true);
                return; 
            }
    
            let updateData: Partial<Job> = { status: newStatus };
    
            if (newStatus === 'Proses' && jobToUpdate.status === 'Menunggu') {
                updateData.jamMulai = new Date().toISOString();
            } else if (newStatus === 'Selesai') {
                updateData.jamSelesai = new Date().toISOString();
                
                // Archive the job
                const tripHistorySnapshot = await getDocs(query(collection(db, 'all_trip_histories'), where('jobId', '==', jobId)));
                const tripLogs = tripHistorySnapshot.docs.map(d => d.data() as TripLog);
                
                const archivedJobData: ArchivedJob = {
                    ...jobToUpdate,
                    ...updateData,
                    tripLogs,
                    archivedAt: new Date().toISOString()
                };
                
                await setDoc(doc(db, 'archived_jobs', jobId), archivedJobData);
                await deleteDoc(jobDocRef);
                
                // Update Rencana
                if (jobToUpdate.rencanaId) {
                    const rencanaDocRef = doc(db, 'rencana_pemasukan', jobToUpdate.rencanaId);
                    await updateDoc(rencanaDocRef, { status: 'Selesai Bongkar' });
                }
    
                toast({ title: 'Pekerjaan Selesai', description: 'Pekerjaan telah diarsipkan.' });
                setJobs(prev => prev.filter(j => j.id !== jobId));
                return;
            }
    
            await updateDoc(jobDocRef, updateData);
            setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...updateData } : j));
            toast({ title: `Status Diperbarui: ${newStatus}` });
    
        } catch (error) {
            console.error("Error updating job status:", error);
            toast({ title: 'Gagal Memperbarui Status', variant: 'destructive' });
        }
    };

    const handleConfirmDelay = () => {
        if (!selectedJobForDelay || !delayReasonInput.trim()) { toast({ title: 'Alasan penundaan harus diisi.', variant: 'destructive'}); return; }
        // Logic to update Firestore document for the job
        setIsDelayDialogOpen(false); setDelayReasonInput(''); setSelectedJobForDelay(null);
    };
    
    const calculateEffectiveTime = (job: Job | RencanaPemasukan) => {
        if ('jamMulai' in job && job.jamMulai) { // It's an aggregate Job
            const endTime = job.jamSelesai ? new Date(job.jamSelesai) : currentTime;
            const totalDuration = endTime.getTime() - new Date(job.jamMulai).getTime();
            const effectiveDuration = totalDuration - (job.totalWaktuTunda || 0);
            return formatDistanceStrict(0, Math.max(0, effectiveDuration), { locale: localeID });
        } else if ('arrivalConfirmedAt' in job && job.arrivalConfirmedAt) { // It's a cement job
            const state = cementUnloadingStates[job.id];
            if (!state || !state.activities) return '0 menit';
            const allActivities = [...state.activities, ...state.completedActivities];
            if(allActivities.length === 0) return '0 menit';

            const firstStart = allActivities.reduce((earliest, act) => new Date(act.startTime) < earliest ? new Date(act.startTime) : earliest, new Date());
            const lastEnd = allActivities.reduce((latest, act) => act.endTime && new Date(act.endTime) > latest ? new Date(act.endTime) : latest, new Date(0));
            
            const effectiveEnd = lastEnd.getTime() > 0 ? lastEnd : currentTime;
            
            return formatDistanceStrict(firstStart, effectiveEnd, { locale: localeID });
        }
        return '0j 0m';
    };

    const getRencanaStatusBadge = (status: RencanaPemasukan['status']) => {
        switch(status) {
            case 'Dalam Perjalanan': return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Dalam Perjalanan</Badge>;
            case 'Telah Tiba': return <Badge variant="secondary" className="bg-indigo-100 text-indigo-800">Telah Tiba</Badge>;
            case 'Menunggu Inspeksi QC': return <Badge variant="secondary" className="bg-orange-100 text-orange-800">Menunggu Inspeksi QC</Badge>;
            case 'Memenuhi Syarat': return <Badge variant="secondary" className="bg-cyan-100 text-cyan-800">Memenuhi Syarat</Badge>;
            case 'Ditolak': return <Badge variant="destructive">Ditolak</Badge>;
            case 'Siap Untuk Dibongkar': return <Badge variant="secondary" className="bg-green-100 text-green-800">Siap Untuk Dibongkar</Badge>;
            case 'Selesai Bongkar': return <Badge variant="secondary" className="bg-gray-100 text-gray-800">Selesai Bongkar</Badge>;
            default: return <Badge>{status}</Badge>;
        }
    };

    const handleSearchArchive = () => {
        setIsFetchingArchive(true);
        if (!archiveDateRange?.from) { setFilteredArchivedJobs(archivedJobs); setIsFetchingArchive(false); return; }
        const fromDate = startOfDay(archiveDateRange.from); const toDate = archiveDateRange.to ? endOfDay(archiveDateRange.to) : endOfDay(archiveDateRange.from);
        const results = archivedJobs.filter(job => { if (!job.jamSelesai) return false; const jobDate = new Date(job.jamSelesai); return isWithinInterval(jobDate, { start: fromDate, end: toDate }); });
        setFilteredArchivedJobs(results); setIsFetchingArchive(false);
    };
    
    const handleRencanaKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
        const target = e.target as HTMLElement;
        const row = parseInt(target.dataset.row || '0', 10);
        const col = parseInt(target.dataset.col || '0', 10);

        let nextRow = row, nextCol = col;

        switch (e.key) {
            case 'ArrowUp': nextRow = Math.max(0, row - 1); break;
            case 'ArrowDown': nextRow = Math.min(SHIP_TANK_COUNT - 1, row + 1); break;
            case 'ArrowLeft': nextCol = Math.max(0, col - 1); break;
            case 'ArrowRight': nextCol = Math.min(1, col + 1); break;
            case 'Enter':
                e.preventDefault();
                nextRow = Math.min(SHIP_TANK_COUNT - 1, row + 1);
                break;
            default: return;
        }

        const nextInput = document.querySelector(`[data-row="${nextRow}"][data-col="${nextCol}"]`) as HTMLElement;
        if (nextInput) {
            nextInput.focus();
        }
    };

    const safeFormatDate = (dateInput: any, formatString: string) => {
        if (!dateInput) return '-';
        try {
            const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
            if (isNaN(date.getTime())) return '-';
            return format(date, formatString, { locale: localeID });
        } catch (error) {
            return '-';
        }
    };

    const handleMutasiRequest = (alatToMutate: AlatData) => {
        setMutasiTarget(alatToMutate);
        setIsMutasiDialogOpen(true);
    };
    
    const handleConfirmMutasi = async () => {
        if (!mutasiTarget || !newLocationForMutasi) {
            toast({ title: 'Lokasi Tujuan Diperlukan', variant: 'destructive' });
            return;
        }
        setIsMutating(true);
        try {
            const alatDocRef = doc(db, 'alat', mutasiTarget.id);
            await updateDoc(alatDocRef, { lokasi: newLocationForMutasi });
            toast({ title: 'Mutasi Berhasil' });
            await fetchAllData();
        } catch (error) {
            toast({ title: 'Mutasi Gagal', variant: 'destructive' });
        } finally {
            setIsMutating(false);
            setIsMutasiDialogOpen(false);
            setMutasiTarget(null);
            setNewLocationForMutasi('');
        }
    };
    
    const handleQuarantineRequest = (item: AlatData) => {
        setQuarantineTarget(item);
        setIsQuarantineConfirmOpen(true);
    };
    
    const handleConfirmQuarantine = async () => {
        if (!quarantineTarget) return;
        setIsLoading(true);
        try {
            const alatDocRef = doc(db, 'alat', quarantineTarget.id);
            await updateDoc(alatDocRef, { statusKarantina: true });
            toast({ title: 'Alat Dikarantina' });
            await fetchAllData();
        } catch (error) {
            toast({ title: 'Gagal Karantina', variant: 'destructive' });
        } finally {
            setIsLoading(false);
            setIsQuarantineConfirmOpen(false);
            setQuarantineTarget(null);
        }
    };

    const handleManualQCPass = async (rencana: RencanaPemasukan) => {
        const rencanaDocRef = doc(db, 'rencana_pemasukan', rencana.id);
        try {
            await updateDoc(rencanaDocRef, { status: 'Siap Untuk Dibongkar' });
            setRencanaPemasukan(prev => prev.map(r => r.id === rencana.id ? { ...r, status: 'Siap Untuk Dibongkar' } : r));
            toast({ title: 'Status Diperbarui', description: `Semen ${rencana.namaKapal} kini siap untuk dibongkar.` });
        } catch (error) {
            toast({ title: 'Gagal Memperbarui Status', variant: 'destructive' });
        }
    };

    const activeJobs = useMemo(() => {
        return jobs.filter(job => job.status === 'Menunggu' || job.status === 'Proses');
    }, [jobs]);

    if (isFetching || !userInfo) { return <div className="flex h-screen w-full items-center justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div>; }

    return (
        <>
            <AlertDialog open={isConfirmArrivalOpen} onOpenChange={setIsConfirmArrivalOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Kedatangan?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Apakah Anda yakin kapal/truk <strong>{selectedRencana?.namaKapal}</strong> telah tiba? Status akan diperbarui.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => selectedRencana && handleConfirmArrival(selectedRencana)}>Ya, Konfirmasi</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
           
            <Dialog open={isPrintPreviewing} onOpenChange={setIsPrintPreviewing}>
                <DialogContent className="max-w-4xl p-0">
                    <DialogHeader className="p-4 border-b">
                        <DialogTitle>Pratinjau Cetak Laporan Pemasukan</DialogTitle>
                        <DialogClose asChild><Button variant="ghost" size="icon" className="absolute right-4 top-3"><X className="h-4 w-4" /></Button></DialogClose>
                    </DialogHeader>
                    <div className="p-6 max-h-[80vh] overflow-y-auto" id="printable-report">
                        <LaporanPemasukanPrintLayout data={reportData} location={userInfo.lokasi || ''} title={reportTitle} />
                    </div>
                    <DialogFooter className="p-4 border-t bg-muted">
                        <Button variant="outline" onClick={() => setIsPrintPreviewing(false)}>Tutup</Button>
                        <Button onClick={() => printElement('printable-report')}>Cetak</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDelayDialogOpen} onOpenChange={setIsDelayDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Alasan Penundaan Bongkar</DialogTitle>
                        <DialogDescription>Jelaskan mengapa pekerjaan untuk kapal/truk <strong>{selectedJobForDelay?.namaKapal}</strong> ditunda.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Textarea placeholder="Contoh: Menunggu spare part rem tiba..." value={delayReasonInput} onChange={(e) => setDelayReasonInput(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDelayDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleConfirmDelay}>Simpan & Tunda</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isArchiveDetailOpen} onOpenChange={setIsArchiveDetailOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Detail Riwayat Bongkar: {selectedArchivedJob?.namaKapal}</DialogTitle>
                        <DialogDescription>
                            Diarsipkan pada {selectedArchivedJob && selectedArchivedJob.archivedAt ? format(new Date(selectedArchivedJob.archivedAt), "dd MMMM yyyy, HH:mm", {locale: localeID}) : '-'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 max-h-[70vh] overflow-y-auto p-1 pr-4">
                        {selectedArchivedJob && (
                            <>
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-base">Ringkasan Pekerjaan</CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        <div><p className="text-muted-foreground">Material</p><p className="font-semibold">{selectedArchivedJob.material}</p></div>
                                        <div><p className="text-muted-foreground">Volume Dibongkar</p><p className="font-semibold">{selectedArchivedJob.volumeTerbongkar} M³</p></div>
                                        <div><p className="text-muted-foreground">Waktu Efektif</p><p className="font-semibold">{calculateEffectiveTime(selectedArchivedJob)}</p></div>
                                        <div><p className="text-muted-foreground">Total Tunda</p><p className="font-semibold">{selectedArchivedJob.totalWaktuTunda ? formatDistanceStrict(0, selectedArchivedJob.totalWaktuTunda, { locale: localeID }) : '-'}</p></div>
                                    </CardContent>
                                </Card>

                                {selectedArchivedJob.tripLogs && selectedArchivedJob.tripLogs.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-base">Rincian Ritase Bongkar</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Rit</TableHead>
                                                    <TableHead>Sopir</TableHead>
                                                    <TableHead>Durasi Siklus</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedArchivedJob.tripLogs.map(trip => (
                                                    <TableRow key={trip.tripNumber}>
                                                        <TableCell>{trip.tripNumber}</TableCell>
                                                        <TableCell>{trip.sopirName}</TableCell>
                                                        <TableCell>{trip.departFromBp && trip.arriveAtBp ? formatDistanceStrict(new Date(trip.arriveAtBp), new Date(trip.departFromBp), { locale: localeID }) : '-'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                                )}
                            </>
                        )}
                    </div>
                    <DialogFooter className="pt-4 border-t">
                        <Button variant="outline" onClick={() => setIsArchiveDetailOpen(false)}>Tutup</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isCreateJobDialogOpen} onOpenChange={setIsCreateJobDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Terbitkan Perintah Bongkar untuk {selectedRencanaForJob?.namaKapal}</DialogTitle>
                        <DialogDescription>Konfirmasi detail untuk pekerjaan bongkar. Data diambil dari rencana pemasukan.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1">
                            <Label>Nama Kapal / Truk</Label>
                            <Input value={selectedRencanaForJob?.namaKapal} disabled />
                        </div>
                        <div className="space-y-1">
                            <Label>Material</Label>
                            <Input value={selectedRencanaForJob?.jenisMaterial} disabled />
                        </div>
                         <div className="space-y-1">
                            <Label htmlFor="totalVolume">Volume Muatan (Estimasi M³)</Label>
                            <Input id="totalVolume" name="totalVolume" type="number" value={jobCreationData.totalVolume} onChange={e => setJobCreationData(d => ({...d, totalVolume: Number(e.target.value)}))} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="bbmPerRit">BBM / Rit (Liter)</Label>
                            <Input id="bbmPerRit" name="bbmPerRit" type="number" value={jobCreationData.bbmPerRit} onChange={e => setJobCreationData(d => ({...d, bbmPerRit: Number(e.target.value)}))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateJobDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleCreateJobFromRencana}>Ya, Terbitkan</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
             <Dialog open={isMutasiDialogOpen} onOpenChange={setIsMutasiDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <AlertDialogTitle>Konfirmasi Mutasi Alat: {mutasiTarget?.nomorLambung}</AlertDialogTitle>
                        <AlertDialogDescription>
                            Pindahkan alat dari lokasi <strong>{mutasiTarget?.lokasi}</strong> ke lokasi baru. Pastikan Anda yakin sebelum melanjutkan.
                        </AlertDialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label htmlFor="mutasi-location">Pilih Lokasi Tujuan</Label>
                        <Select value={newLocationForMutasi} onValueChange={setNewLocationForMutasi}>
                            <SelectTrigger id="mutasi-location"><SelectValue placeholder="Pilih lokasi..." /></SelectTrigger>
                            <SelectContent>
                                {locations.filter(l => l.name !== mutasiTarget?.lokasi).map(loc => (
                                    <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMutasiDialogOpen(false)}>Batal</Button>
                        <Button onClick={handleConfirmMutasi} disabled={isMutating}>
                            {isMutating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Konfirmasi & Pindahkan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <AlertDialog open={isQuarantineConfirmOpen} onOpenChange={setIsQuarantineConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Karantina</AlertDialogTitle>
                        <AlertDialogDescription>
                            Anda yakin ingin memindahkan kendaraan <strong>{quarantineTarget?.nomorLambung}</strong> ke daftar "Alat Rusak Berat" (Karantina)?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmQuarantine} className="bg-destructive hover:bg-destructive/90">
                            Ya, Karantina
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <SidebarProvider><Sidebar><SidebarContent><SidebarHeader><h2 className="text-xl font-semibold text-foreground">Admin Logistik</h2></SidebarHeader><SidebarMenu className="flex-1">
                <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'status'} onClick={() => setActiveMenu('status')}><ActivitySquare />Status Bongkaran Hari Ini</SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'rencana'} onClick={() => setActiveMenu('rencana')}><FileClock />Rencana Pemasukan Material</SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'bongkar'} onClick={() => setActiveMenu('bongkar')}><Anchor />Bongkar Batu &amp; Pasir Hari Ini (WO-Sopir DT)</SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'riwayat-bongkar'} onClick={() => setActiveMenu('riwayat-bongkar')}><Archive />Riwayat Bongkar</SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'pemasukan'} onClick={() => setActiveMenu('pemasukan')}><PackagePlus />Pemasukan Material</SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'riwayat'} onClick={() => setActiveMenu('riwayat')}><History />Riwayat Pemasukan</SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'daftar-kendaraan'} onClick={() => setActiveMenu('daftar-kendaraan')}><Truck />Daftar Kendaraan</SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton isActive={activeMenu === 'stok'} onClick={() => router.push('/stok-material-logistik')}><Package />Stok Material</SidebarMenuButton></SidebarMenuItem>
            </SidebarMenu><SidebarFooter>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2">
                            <User className="h-8 w-8" />
                            <div className='text-left'>
                                <p className='text-sm font-semibold'>{userInfo.username}</p>
                                <p className='text-xs text-muted-foreground flex items-center gap-1.5'><Fingerprint size={12}/>{userInfo.nik}</p>
                                <p className='text-xs text-muted-foreground flex items-center gap-1.5'><Briefcase size={12}/>{userInfo.jabatan}</p>
                            </div>
                            <ChevronDown className="h-4 w-4 ml-auto" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className='w-56'>
                        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Keluar</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarFooter></SidebarContent></Sidebar>
                <SidebarInset><main className="flex-1 p-6 lg:p-10">
                        <header className="flex items-center justify-between gap-4 mb-8"><div className='flex items-center gap-4'><SidebarTrigger /><div><h1 className="text-2xl font-bold tracking-wider">{activeMenu === 'pemasukan' ? 'Pemasukan Material' : activeMenu === 'riwayat' ? 'Riwayat Pemasukan Material' : activeMenu === 'rencana' ? 'Rencana Pemasukan Material' : activeMenu === 'riwayat-bongkar' ? 'Riwayat Bongkar Material' : activeMenu === 'status' ? 'Status Bongkaran Hari Ini' : activeMenu === 'daftar-kendaraan' ? 'Daftar Kendaraan Aktif' : 'Bongkar Batu & Pasir Hari Ini (WO-Sopir DT)'}</h1><p className="text-muted-foreground">Lokasi: <span className='font-semibold text-primary'>{userInfo.lokasi}</span></p></div></div>{activeMenu === 'pemasukan' && (<Button variant="outline" onClick={() => handlePrintReport('today')}><Printer className="mr-2 h-4 w-4" /> Cetak Laporan Hari Ini</Button>)}</header>
                        
                        {activeMenu === 'status' && (<div className='space-y-6'>
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-3">
                                            <Ship className="text-primary"/>Bongkaran Semen Sedang Berjalan
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                                        {rencanaPemasukan.filter(r => r.status === 'Siap Untuk Dibongkar' && r.jenisMaterial === 'SEMEN').length > 0 ? rencanaPemasukan.filter(r => r.status === 'Siap Untuk Dibongkar' && r.jenisMaterial === 'SEMEN').map(job => {
                                            const state = cementUnloadingStates[job.id] || { activities: [], completedActivities: [] };
                                            const activeTransfers = state.activities.length;
                                            const completedTransfers = state.completedActivities.length;
                                            const totalTanks = Object.values(job.tankLoads || {}).filter(v => v > 0).length;
                                            const duration = calculateEffectiveTime(job);
                                            
                                            return (
                                                <Card key={job.id} className="bg-card/50">
                                                    <CardHeader className="pb-2">
                                                        <CardTitle className="truncate">{job.namaKapal}</CardTitle>
                                                    </CardHeader>
                                                    <CardContent className='space-y-2 text-sm'>
                                                        <p><strong>Transfer Aktif:</strong> {activeTransfers} tangki</p>
                                                        <p><strong>Selesai:</strong> {completedTransfers} / {totalTanks} tangki</p>
                                                        <p><strong>Durasi Total:</strong> {duration}</p>
                                                    </CardContent>
                                                </Card>
                                            )
                                        }) : <p className='text-muted-foreground col-span-full text-center py-4'>Tidak ada aktivitas bongkar semen saat ini.</p>}
                                    </CardContent>
                                </Card>
                                <Card><CardHeader><CardTitle className="flex items-center gap-3"><Anchor className="text-primary"/>Bongkaran Batu/Pasir Sedang Berjalan</CardTitle></CardHeader><CardContent className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                                    {jobs.filter(j => j.status === 'Proses').length > 0 ? jobs.filter(j => j.status === 'Proses').map(job => {
                                        const trips = allTripHistories[job.id] || []; const ritasi = trips.length; const volumeTerbongkar = ritasi * MUATAN_PER_RIT; const activeSopir = new Set(trips.map(t => t.sopirId)).size; const duration = job.jamMulai ? formatDistanceStrict(currentTime, new Date(job.jamMulai), { locale: localeID }) : '0 menit';
                                        return (<Card key={job.id} className="bg-card/50"><CardHeader className="pb-2"><CardTitle className="truncate">{job.namaKapal} ({job.material})</CardTitle></CardHeader><CardContent className='space-y-2 text-sm'><p><strong>Volume:</strong> {volumeTerbongkar} / {job.totalVolume} M³</p><p><strong>Ritasi:</strong> {ritasi} Rit</p><p><strong>Jumlah DT:</strong> {activeSopir} Kendaraan</p><p><strong>Waktu Berjalan:</strong> {duration}</p></CardContent></Card>)
                                    }) : <p className='text-muted-foreground col-span-full text-center py-4'>Tidak ada aktivitas bongkar batu/pasir saat ini.</p>}
                                </CardContent></Card>
                            </div>
                        )}
                        
                        {activeMenu === 'daftar-kendaraan' && (
                             <Card>
                                <CardHeader>
                                    <CardTitle>Daftar Kendaraan di {userInfo.lokasi}</CardTitle>
                                    <CardDescription>Menampilkan semua kendaraan jenis DT yang terdaftar di lokasi ini, kecuali yang sedang dikarantina.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="border rounded-md overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>No. Lambung</TableHead>
                                                    <TableHead>No. Polisi</TableHead>
                                                    <TableHead>Jenis Kendaraan</TableHead>
                                                    <TableHead className="text-right">Aksi</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {alat.filter(a => a.lokasi === userInfo.lokasi && !a.statusKarantina && a.jenisKendaraan.toUpperCase() === 'DT').length > 0 ? 
                                                 alat.filter(a => a.lokasi === userInfo.lokasi && !a.statusKarantina && a.jenisKendaraan.toUpperCase() === 'DT').map(item => (
                                                    <TableRow key={item.id}>
                                                        <TableCell className="font-semibold">{item.nomorLambung}</TableCell>
                                                        <TableCell>{item.nomorPolisi}</TableCell>
                                                        <TableCell>{item.jenisKendaraan}</TableCell>
                                                        <TableCell className="text-right space-x-2">
                                                            <Button size="sm" variant="outline" onClick={() => handleMutasiRequest(item)}><ArrowRightLeft className="mr-2 h-4 w-4"/> Mutasi</Button>
                                                            <Button size="sm" variant="destructive" onClick={() => handleQuarantineRequest(item)}><ShieldAlert className="mr-2 h-4 w-4"/> Karantina</Button>
                                                        </TableCell>
                                                    </TableRow>
                                                 )) : (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center h-24">Tidak ada kendaraan jenis DT di lokasi ini.</TableCell>
                                                    </TableRow>
                                                 )
                                                }
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                             </Card>
                        )}


                        {activeMenu === 'rencana' && (<div className="space-y-8">
                                <Card><CardHeader><CardTitle className="flex items-center gap-3"><Edit />Input Rencana Pemasukan Material</CardTitle></CardHeader><CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                                        <div className="space-y-1"><Label>Nama Kapal / Truk</Label><Input value={newRencana.namaKapal} onChange={e => handleNewRencanaChange('namaKapal', e.target.value.toUpperCase())} placeholder="KM. MAKMUR" /></div>
                                        <div className="space-y-1"><Label>Jenis Material</Label><Select value={newRencana.jenisMaterial} onValueChange={val => handleNewRencanaChange('jenisMaterial', val)}><SelectTrigger><SelectValue placeholder="Pilih material..." /></SelectTrigger><SelectContent>{materialConfig.map(m => <SelectItem key={m.key} value={m.name}>{m.name}</SelectItem>)}</SelectContent></Select></div>
                                        
                                        {newRencana.jenisMaterial !== 'SEMEN' && (
                                            <>
                                                <div className="space-y-1"><Label>Volume Estimasi</Label><Input type="number" value={newRencana.estimasiMuatan || ''} onChange={e => handleNewRencanaChange('estimasiMuatan', Number(e.target.value))} placeholder="0" /></div>
                                                <div className="space-y-1"><Label>Nomor SPB</Label><Input value={newRencana.noSpb || ''} onChange={e => handleNewRencanaChange('noSpb', e.target.value.toUpperCase())} placeholder="Nomor Surat Jalan" /></div>
                                            </>
                                        )}
                                        
                                        <div className="space-y-1"><Label>Nama Kapten / Sopir</Label><Input value={newRencana.namaSopir} onChange={e => handleNewRencanaChange('namaSopir', e.target.value.toUpperCase())} placeholder="Joko" /></div>
                                        <div className="lg:col-span-2 space-y-1"><Label>Estimasi Tiba</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start text-left font-normal"><CalendarIconLucide className="mr-2 h-4 w-4" />{newRencana.eta ? format(newRencana.eta, "PPP HH:mm") : <span>Pilih tanggal & waktu</span>}</Button></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={newRencana.eta} onSelect={date => handleNewRencanaChange('eta', date || new Date())} /><div className="p-2 border-t"><Input type="time" value={newRencana.eta ? format(newRencana.eta, "HH:mm") : "00:00"} onChange={e => {const [h,m] = e.target.value.split(':'); const newDate = new Date(newRencana.eta || new Date()); newDate.setHours(Number(h)); newDate.setMinutes(Number(m)); handleNewRencanaChange('eta', newDate)}}/></div></PopoverContent></Popover></div>
                                    </div>
                                    {newRencana.jenisMaterial === 'SEMEN' && <div className="pt-4 mt-4 border-t"><Label className="font-semibold">Rincian Muatan & SPB per Tangki Kapal</Label><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-2">{Array.from({length: SHIP_TANK_COUNT}).map((_, i) => { const tankId = `tank-${i + 1}`; return (<div key={tankId} className="space-y-2 p-3 border rounded-md bg-muted/30"><Label htmlFor={tankId} className="flex items-center gap-2 text-xs"><Anchor size={14} />{tankId.replace('-', ' ')}</Label><Input data-row={i} data-col={0} onKeyDown={handleRencanaKeyDown} id={`${tankId}-spb`} value={newRencana.spbPerTank?.[tankId] || ''} onChange={(e) => handleRencanaSpbChange(tankId, e.target.value)} placeholder="Nomor SPB..." /><Input data-row={i} data-col={1} onKeyDown={handleRencanaKeyDown} id={`${tankId}-muatan`} type="number" value={newRencana.tankLoads?.[tankId] || ''} onChange={(e) => handleRencanaMuatanChange(tankId, e.target.value)} placeholder="Jumlah (KG)..." /></div>)})}</div></div>}
                                    <div className="flex justify-end pt-4"><Button onClick={handleSaveRencana} disabled={isSubmittingRencana}>{isSubmittingRencana ? <Loader2 className="animate-spin" /> : 'Simpan Rencana'}</Button></div>
                                </CardContent></Card>
                                <Card><CardHeader><CardTitle className="flex items-center gap-3"><ListOrdered />List Rencana Pemasukan Material</CardTitle></CardHeader><CardContent><div className="border rounded-md overflow-auto"><Table><TableHeader><TableRow><TableHead>ETA</TableHead><TableHead>Kapal/Truk</TableHead><TableHead>Material</TableHead><TableHead>SPB</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{rencanaPemasukan.length > 0 ? rencanaPemasukan.map(r => (<TableRow key={r.id}><TableCell>{safeFormatDate(r.eta, "dd MMM, HH:mm")}</TableCell><TableCell>{r.namaKapal}</TableCell><TableCell>{r.jenisMaterial}</TableCell><TableCell>{r.noSpb || 'Lihat Rincian'}</TableCell><TableCell>{getRencanaStatusBadge(r.status as any)}</TableCell><TableCell className="text-right">{r.status === 'Dalam Perjalanan' && (<Button variant="outline" size="sm" onClick={() => { setSelectedRencana(r); setIsConfirmArrivalOpen(true); }}>Konfirmasi Tiba</Button>)}{r.status === 'Memenuhi Syarat' && (<Button size="sm" onClick={() => { setSelectedRencanaForJob(r); setJobCreationData({ bbmPerRit: 5, totalVolume: r.estimasiMuatan || 0 }); setIsCreateJobDialogOpen(true); }}>Terbitkan WO</Button>)}{r.jenisMaterial === 'SEMEN' && r.status === 'Menunggu Inspeksi QC' && <Button variant="secondary" size="sm" onClick={() => handleManualQCPass(r)}>Luluskan QC Manual</Button>}{r.status === 'Menunggu Inspeksi QC' && r.jenisMaterial !== 'SEMEN' && <span className='text-xs text-muted-foreground'>Menunggu QC...</span>}{r.status === 'Siap Untuk Dibongkar' && r.jenisMaterial !== 'SEMEN' && <span className='text-xs text-muted-foreground'>Menunggu Sopir...</span>}{r.status === 'Siap Untuk Dibongkar' && r.jenisMaterial === 'SEMEN' && <span className='text-xs text-muted-foreground'>Menunggu Pekerja...</span>}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Tidak ada rencana pemasukan.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
                            </div>
                        )}

                        {activeMenu === 'bongkar' && (<div className="space-y-8">
                            <Card>
                                <CardHeader><CardTitle>Daftar Perintah Bongkar Aktif</CardTitle><CardDescription>Monitor dan ubah status pekerjaan bongkar yang sedang berjalan.</CardDescription></CardHeader>
                                <CardContent><div className="border rounded-md overflow-auto"><Table><TableHeader><TableRow><TableHead>Kapal/Truk</TableHead><TableHead>Status</TableHead><TableHead>Rit</TableHead><TableHead>Vol. Total</TableHead><TableHead>Vol. Terbongkar</TableHead><TableHead>Sisa Volume</TableHead><TableHead>Jam Mulai</TableHead><TableHead>Jam Selesai</TableHead><TableHead>Waktu Tunda</TableHead><TableHead>Waktu Efektif</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{activeJobs.length > 0 ? activeJobs.map(job => { 
                                    const ritasiBerjalan = (allTripHistories[job.id] || []).length;
                                    const volumeTerbongkar = ritasiBerjalan * MUATAN_PER_RIT;
                                    const sisaVolume = Math.max(0, job.totalVolume - volumeTerbongkar);
                                    
                                    return (<TableRow key={job.id}><TableCell className="font-semibold">{job.namaKapal} <span className="text-muted-foreground">({job.material})</span>{job.riwayatTunda && job.riwayatTunda.length > 0 && (<ol className="text-xs text-orange-500 list-decimal list-inside mt-1 italic">{job.riwayatTunda.map((tunda, index) => <li key={index}>{tunda.alasan}</li>)}</ol>)}</TableCell><TableCell><Select value={job.status} onValueChange={(newStatus) => handleJobStatusChange(job.id, newStatus as Job['status'])} disabled={job.status === 'Selesai'}><SelectTrigger className='w-32'><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Menunggu"><Play className="inline-block mr-2 h-4 w-4 text-gray-500" />Menunggu</SelectItem><SelectItem value="Proses"><Play className="inline-block mr-2 h-4 w-4 text-blue-500" />Proses</SelectItem><SelectItem value="Tunda"><Pause className="inline-block mr-2 h-4 w-4 text-yellow-500" />Tunda</SelectItem><SelectItem value="Selesai"><Check className="inline-block mr-2 h-4 w-4 text-green-500" />Selesai</SelectItem></SelectContent></Select></TableCell><TableCell>{ritasiBerjalan}</TableCell><TableCell>{job.totalVolume} M³</TableCell><TableCell>{volumeTerbongkar} M³</TableCell><TableCell>{sisaVolume} M³</TableCell><TableCell>{safeFormatDate(job.jamMulai, 'dd MMM, HH:mm')}</TableCell><TableCell>{safeFormatDate(job.jamSelesai, 'dd MMM, HH:mm')}</TableCell><TableCell>{job.totalWaktuTunda ? formatDistanceStrict(0, job.totalWaktuTunda, { locale: localeID }) : '-'}</TableCell><TableCell>{calculateEffectiveTime(job)}</TableCell><TableCell className="text-right">Aksi</TableCell></TableRow>)}) : <TableRow><TableCell colSpan={11} className="text-center h-24 text-muted-foreground">Belum ada perintah bongkar yang diterbitkan.</TableCell></TableRow>}</TableBody></Table></div></CardContent>
                            </Card>
                        </div>
                        )}

                        {activeMenu === 'riwayat-bongkar' && (
                            <div className="space-y-6">
                                <Card>
                                    <CardHeader><CardTitle>Riwayat Bongkar Batu & Pasir</CardTitle><CardDescription>Cari dan lihat detail pekerjaan bongkar agregat yang telah selesai.</CardDescription></CardHeader>
                                    <CardContent className="space-y-4"><div className="flex flex-col md:flex-row gap-2 items-start md:items-center"><Popover><PopoverTrigger asChild><Button id="archiveDate" variant={"outline"} className={cn("w-full md:w-[300px] justify-start text-left font-normal", !archiveDateRange && "text-muted-foreground")}><CalendarIconLucide className="mr-2 h-4 w-4" />{archiveDateRange?.from ? (archiveDateRange.to ? (<>{format(archiveDateRange.from, "LLL dd, y")} - {format(archiveDateRange.to, "LLL dd, y")}</>) : (format(archiveDateRange.from, "LLL dd, y"))) : (<span>Pilih rentang tanggal</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={archiveDateRange?.from} selected={archiveDateRange} onSelect={setArchiveDateRange} numberOfMonths={2}/></PopoverContent></Popover><Button onClick={handleSearchArchive} disabled={isFetchingArchive}>{isFetchingArchive ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>}Cari Riwayat</Button><Button variant="ghost" onClick={()=>{ setFilteredArchivedJobs(archivedJobs); setArchiveDateRange(undefined); }}><FilterX className="mr-2 h-4 w-4"/>Reset</Button></div><div className="border rounded-md overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Kapal/Truk</TableHead><TableHead>Material</TableHead><TableHead>Volume Total</TableHead><TableHead>Tgl Selesai</TableHead><TableHead>Waktu Efektif</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{isFetchingArchive ? (<TableRow><TableCell colSpan={6} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></TableCell></TableRow>) : filteredArchivedJobs.length > 0 ? (filteredArchivedJobs.map(job => (<TableRow key={job.id}><TableCell>{job.namaKapal}</TableCell><TableCell>{job.material}</TableCell><TableCell>{job.totalVolume} M³</TableCell><TableCell>{safeFormatDate(job.jamSelesai, 'dd MMM yyyy')}</TableCell><TableCell>{calculateEffectiveTime(job)}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => { setSelectedArchivedJob(job); setIsArchiveDetailOpen(true); }}>Lihat Detail</Button></TableCell></TableRow>))) : (<TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground">Tidak ada arsip bongkar untuk filter yang dipilih.</TableCell></TableRow>)}</TableBody></Table></div></CardContent>
                                </Card>
                                 <Card>
                                    <CardHeader><CardTitle>Riwayat Bongkar Semen</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="border rounded-md overflow-x-auto">
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Kapal</TableHead><TableHead>Tgl Tiba</TableHead><TableHead>Total Muatan (KG)</TableHead><TableHead>Waktu Bongkar Efektif</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {archivedCementJobs.length > 0 ? archivedCementJobs.map(job => (
                                                        <TableRow key={job.id}>
                                                            <TableCell>{job.namaKapal}</TableCell>
                                                            <TableCell>{safeFormatDate(job.arrivalConfirmedAt, 'dd MMM yyyy, HH:mm')}</TableCell>
                                                            <TableCell>{(Object.values(job.tankLoads || {}).reduce((s, a) => s + a, 0)).toLocaleString('id-ID')}</TableCell>
                                                            <TableCell>{calculateEffectiveTime(job)}</TableCell>
                                                        </TableRow>
                                                    )) : (<TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Belum ada riwayat bongkar semen.</TableCell></TableRow>)}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {activeMenu === 'pemasukan' && (<div className="space-y-8">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-3"><PackagePlus />Pencatatan Pemasukan Material</CardTitle>
                                    <CardDescription>
                                        <p className='text-sm text-muted-foreground flex items-center gap-2'><Info size={14}/>Pencatatan pemasukan material kini dilakukan secara otomatis setelah proses bongkar selesai. Menu ini hanya untuk melihat log harian.</p>
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                            <Card><CardHeader><CardTitle className="flex items-center gap-3"><ListChecks /> Log Pemasukan Hari Ini</CardTitle><CardDescription>Daftar semua material yang dicatat masuk pada hari ini.</CardDescription></CardHeader><CardContent><div className="border rounded-md max-h-96 overflow-auto"><Table><TableHeader className="sticky top-0 bg-muted"><TableRow><TableHead>Waktu</TableHead><TableHead>Material</TableHead><TableHead>No. SPB</TableHead><TableHead>Kapal/Truk</TableHead><TableHead>Jumlah</TableHead><TableHead>Keterangan</TableHead></TableRow></TableHeader><TableBody>{dailyLog.length > 0 ? (dailyLog.map(entry => (<TableRow key={entry.id}><TableCell>{safeFormatDate(entry.timestamp, 'HH:mm:ss')}</TableCell><TableCell>{entry.material}</TableCell><TableCell>{entry.noSpb}</TableCell><TableCell>{entry.namaKapal}</TableCell><TableCell>{entry.jumlah.toLocaleString('id-ID')} {entry.unit}</TableCell><TableCell>{entry.keterangan || '-'}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">Belum ada pemasukan material hari ini.</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card></div>
                        )}
                        
                        {activeMenu === 'riwayat' && (<Card><CardHeader><CardTitle>Filter Riwayat Pemasukan</CardTitle><CardDescription>Cari data pemasukan material berdasarkan rentang tanggal.</CardDescription></CardHeader><CardContent className="flex flex-col md:flex-row items-center gap-4"><Popover><PopoverTrigger asChild><Button id="date" variant={"outline"} className={cn("w-[300px] justify-start text-left font-normal", !dateRange && "text-muted-foreground")}><CalendarIconLucide className="mr-2 h-4 w-4" />{dateRange?.from ? (dateRange.to ? (<>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>) : (format(dateRange.from, "LLL dd, y"))) : (<span>Pilih rentang tanggal</span>)}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/></PopoverContent></Popover><Button onClick={handleSearchHistory} disabled={isFetchingHistory}>{isFetchingHistory ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Search className="mr-2 h-4 w-4"/>}Cari Riwayat</Button><Button variant="ghost" onClick={clearHistoryFilter}><FilterX className="mr-2 h-4 w-4"/>Reset</Button></CardContent><CardContent><CardHeader className="px-0 flex-row items-center justify-between"><div><CardTitle>Hasil Pencarian</CardTitle><CardDescription>Menampilkan {filteredPemasukan.length} dari {allPemasukan.length} total data riwayat.</CardDescription></div><Button variant="outline" onClick={() => handlePrintReport('history')} disabled={filteredPemasukan.length === 0}><Printer className="mr-2 h-4 w-4"/>Cetak Hasil</Button></CardHeader><div className="border rounded-md max-h-96 overflow-auto"><Table><TableHeader className="sticky top-0 bg-muted"><TableRow><TableHead>Waktu</TableHead><TableHead>Material</TableHead><TableHead>No. SPB</TableHead><TableHead>Kapal/Truk</TableHead><TableHead>Jumlah</TableHead><TableHead>Keterangan</TableHead></TableRow></TableHeader><TableBody>{isFetchingHistory ? (<TableRow><TableCell colSpan={6} className="h-48 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto"/></TableCell></TableRow>) : filteredPemasukan.length > 0 ? (filteredPemasukan.map(entry => (<TableRow key={entry.id}><TableCell>{safeFormatDate(entry.timestamp, 'dd/MM/yy HH:mm')}</TableCell><TableCell>{entry.material}</TableCell><TableCell>{entry.noSpb}</TableCell><TableCell>{entry.namaKapal}</TableCell><TableCell>{entry.jumlah.toLocaleString('id-ID')} {entry.unit}</TableCell><TableCell>{entry.keterangan || '-'}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={6} className="h-48 text-center text-muted-foreground">Tidak ada data untuk filter yang dipilih.</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
                        )}

                    </main>
                </SidebarInset>
            </SidebarProvider>
        </>
    );
}
