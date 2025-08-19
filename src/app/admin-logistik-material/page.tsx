<<<<<<< HEAD


=======
>>>>>>> 0d128ab (ganti kode scr/app/admin-logistik-material/page.sx dengan ini)
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Scale, JobMix, MaterialName, LoadingOrderSettings, MixerSettings, MoistureSettings, ScheduleRow, PrintData, ProductionData, OperationMode, UserData, CementSiloStock, MaterialUsage, BpUnitStatus } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Loader2, X, SlidersHorizontal, ListOrdered, ToggleRight, FileText, Database, Package, Droplets, CalendarCheck, KeyRound } from 'lucide-react';
import AppHeader from '@/components/app-header';
import WeightIndicator from '@/components/weight-indicator';
import MixingStatus from '@/components/mixing-status';
import OperationControls from '@/components/operation-controls';
import ManualControlsDialog from '@/components/manual-controls-dialog';
import { useToast } from '@/hooks/use-toast';
import PrintTicketLayout from '@/components/print-ticket-layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { printElement } from '@/lib/utils';
import ScheduleTable from '@/components/schedule-table';
import BpSelectionDialog from '@/components/location-selection-dialog';
import UnitSelectionDialog from '@/components/unit-selection-dialog';
import { Sidebar, SidebarProvider, SidebarInset, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import LoadingOrderDialog from '@/components/loading-order-dialog';
import MixerSettingsDialog from '@/components/mixer-settings-dialog';
import MoistureControlDialog from '@/components/moisture-control-dialog';
import { db, collection, getDocs, setDoc, doc, addDoc, updateDoc, onSnapshot, runTransaction, query, where, Timestamp, getDoc } from '@/lib/firebase';

const initialScales: Scale[] = [
  { id: 1, name: 'BATU', weight: 0, unit: 'kg', min: 0, max: 4000, target: 0 },
  { id: 2, name: 'PASIR', weight: 0, unit: 'kg', min: 0, max: 4000, target: 0 },
  { id: 3, name: 'SEMEN 1', weight: 0, unit: 'kg', min: 0, max: 2000, target: 0 },
  { id: 4, name: 'SEMEN 2', weight: 0, unit: 'kg', min: 0, max: 2000, target: 0 },
  { id: 5, name: 'AIR', weight: 0, unit: 'kg', min: 0, max: 500, target: 0 },
];

const SIMULATION_INTERVAL = 50; // ms
const WEIGH_SPEED = 100; // kg per second
const POUR_SPEED = 150; // kg per second

const initialLoadingOrder: LoadingOrderSettings = {
    'Pasir': { urutan: '1', detik: '0' },
    'Batu': { urutan: '2', detik: '0' },
    'Semen': { urutan: '1', detik: '0' },
    'Air': { urutan: '1', detik: '0' },
};

const initialMixerSettings: MixerSettings = {
    opening1: 3,
    opening2: 3,
    opening3: 3,
    tutup: 3,
};

const initialMoistureSettings: MoistureSettings = {
    pasir: 0,
    batu: 0,
    air: 0,
};

export default function DashboardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [scales, setScales] = useState<Scale[]>(initialScales);
  const [isManualControlsOpen, setManualControlsOpen] = useState(false);
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleRow[]>([]);
  const [isScheduleLoading, setIsScheduleLoading] = useState(true);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [loadingOrder, setLoadingOrder] = useState<LoadingOrderSettings>(initialLoadingOrder);
  const [mixerSettings, setMixerSettings] = useState<MixerSettings>(initialMixerSettings);
  const [moistureSettings, setMoistureSettings] = useState<MoistureSettings>(initialMoistureSettings);
  const [countdownTime, setCountdownTime] = useState(15);
  const [initialCountdownTime, setInitialCountdownTime] = useState(15);
  const [isMixing, setIsMixing] = useState(false);
  const [isDoorOperating, setIsDoorOperating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSchedule, setActiveSchedule] = useState<ScheduleRow | null>(null);
  const [activeJobMix, setActiveJobMix] = useState<JobMix | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [productionDataForPrint, setProductionDataForPrint] = useState<PrintData | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [pouringMaterials, setPouringMaterials] = useState<MaterialName[]>([]);
  const [isBpModalOpen, setIsBpModalOpen] = useState(false);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  
  const [namaSopir, setNamaSopir] = useState('');
  const [nomorMobil, setNomorMobil] = useState('');
  const [nomorLambung, setNomorLambung] = useState('');

  const [reqNo, setReqNo] = useState('');
  const [targetVolume, setTargetVolume] = useState('');
  const [jumlahMixing, setJumlahMixing] = useState(1);
  const [selectedSilo, setSelectedSilo] = useState('1');

  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const processAbortedRef = useRef(false);

  const [isMixerSettingsOpen, setMixerSettingsOpen] = useState(false);
  const [isLoadingOrderOpen, setIsLoadingOrderOpen] = useState(false);
  const [isMoistureControlOpen, setMoistureControlOpen] = useState(false);

   const addActivityLog = useCallback((message: string) => {
    setActivityLog(prevLog => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prevLog].slice(0, 10));
  }, []);


  useEffect(() => {
    // Cleanup intervals on unmount
    return () => {
        intervalsRef.current.forEach(intervalId => clearInterval(intervalId));
    };
  }, []);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.push('/login');
      return;
    }
    const userData = JSON.parse(userString);
    if (!userData.jabatan?.toUpperCase().includes('OPRATOR BP')) {
        toast({
            variant: 'destructive',
            title: 'Akses Ditolak',
            description: 'Anda tidak memiliki hak untuk mengakses halaman ini.',
        });
        router.push('/login');
        return;
    }
    setUserInfo(userData);

    if (!userData.lokasi) {
        setIsBpModalOpen(true);
    } else if (userData.jabatan.toUpperCase().includes('OPRATOR BP') && !userData.unitBp) {
        setIsUnitModalOpen(true);
    }
  }, [router, toast]);

  const updateBpStatus = async () => {
    if (!userInfo?.lokasi || !userInfo?.unitBp) return;
    const statusDocId = `${userInfo.lokasi}_${userInfo.unitBp}`;
    const statusDocRef = doc(db, 'bp_unit_status', statusDocId);
    try {
        await setDoc(statusDocRef, {
            lastActivity: Timestamp.now(),
            unit: userInfo.unitBp,
            location: userInfo.lokasi,
        }, { merge: true });
    } catch (error) {
        console.error("Failed to update BP status:", error);
    }
  };

  useEffect(() => {
    if (isMixing) {
        if (intervalsRef.current.has('mixing')) {
            clearInterval(intervalsRef.current.get('mixing')!);
        }
        const mixingInterval = setInterval(() => {
            if (processAbortedRef.current) {
                clearInterval(mixingInterval);
                return;
            }
            setCountdownTime(prev => {
                if (prev <= 1) {
                    clearInterval(mixingInterval);
                    intervalsRef.current.delete('mixing');
                    setIsMixing(false);
                    return 0;
                }
                const newTime = prev - 1;
                addActivityLog(`Proses mixing berjalan... Sisa waktu: ${newTime}s`);
                return newTime;
            });
        }, 1000);
        intervalsRef.current.set('mixing', mixingInterval);
    }
  }, [isMixing, addActivityLog]);

  useEffect(() => {
    if (isDoorOperating) {
        if (intervalsRef.current.has('door')) {
            clearInterval(intervalsRef.current.get('door')!);
        }
        const doorInterval = setInterval(() => {
             if (processAbortedRef.current) {
                clearInterval(doorInterval);
                return;
            }
            setCountdownTime(prev => {
                if (prev <= 1) {
                    clearInterval(doorInterval);
                    intervalsRef.current.delete('door');
                    setIsDoorOperating(false);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        intervalsRef.current.set('door', doorInterval);
    }
  }, [isDoorOperating]);
  
  // -- REALTIME DATA FETCHING --
  useEffect(() => {
    if (!userInfo?.lokasi || !userInfo?.unitBp) return;

    // Listener for Schedules
    setIsScheduleLoading(true);
    const scheduleUnsub = onSnapshot(collection(db, "schedules_today"), (snapshot) => {
        const scheduleList = snapshot.docs.map(d => ({id: d.id, ...d.data()}) as ScheduleRow);
        setScheduleData(scheduleList.sort((a, b) => parseInt(a.NO) - parseInt(b.NO)));
        setIsScheduleLoading(false);
    }, (error) => {
        console.error("Error fetching real-time schedule: ", error);
        setIsScheduleLoading(false);
    });

    return () => {
        scheduleUnsub();
    };

  }, [userInfo?.lokasi, userInfo?.unitBp]);
  // -- END REALTIME DATA FETCHING --
  
   useEffect(() => {
    if (activeSchedule) {
      setActiveSchedule(prev => {
        if (!prev) return null;
        return {
          ...prev,
          'NAMA SOPIR': namaSopir,
          'NOMOR MOBIL': nomorMobil,
          'NOMOR LAMBUNG': nomorLambung,
        };
      });
    }
  }, [namaSopir, nomorMobil, nomorLambung, activeSchedule !== null]);


  const simulateProcess = (material: MaterialName, direction: 'weigh' | 'pour'): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (direction === 'pour') {
            setPouringMaterials(prev => [...prev, material]);
        }
        const speed = direction === 'weigh' ? WEIGH_SPEED : -POUR_SPEED;
        
        if (intervalsRef.current.has(material)) {
            clearInterval(intervalsRef.current.get(material)!);
        }

        const intervalId = setInterval(() => {
            if (processAbortedRef.current) {
                clearInterval(intervalId);
                intervalsRef.current.delete(material);
                reject(new Error('Process aborted by user'));
                return;
            }

            setScales(prevScales => {
                let isProcessFinished = false;
                const newScales = prevScales.map(s => {
                    if (s.name === material) {
                        const newWeight = s.weight + (speed * (SIMULATION_INTERVAL / 1000));
                        
                        if (direction === 'weigh' && newWeight >= (s.target || s.max)) {
                           isProcessFinished = true;
                           return { ...s, weight: s.target || s.max };
                        }
                        if (direction === 'pour' && newWeight <= 0) {
                           isProcessFinished = true;
                           return { ...s, weight: 0 };
                        }
                        return { ...s, weight: newWeight };
                    }
                    return s;
                });

                if (isProcessFinished) {
                    clearInterval(intervalId);
                    intervalsRef.current.delete(material);
                    if (direction === 'pour') {
                        setPouringMaterials(prev => prev.filter(m => m !== material));
                    }
                    resolve();
                }
                return newScales;
            });
        }, SIMULATION_INTERVAL);
        intervalsRef.current.set(material, intervalId);
    });
};


  const startAutoWeighing = async (jobMix: JobMix, targetVolume: number, jumlahMixing: number, selectedSilo: string, mixingTime: number) => {
    if (!selectedSilo) {
        toast({
            variant: 'destructive',
            title: 'Aksi Gagal',
            description: 'Harap pilih silo terlebih dahulu untuk mode auto.',
        });
        return;
    }
    
    await updateBpStatus();
    processAbortedRef.current = false;
    setIsProcessing(true);
    const processStartTime = new Date();
    setStartTime(processStartTime);
    
    const volumePerMix = targetVolume / jumlahMixing;

    try {
        for (let mixCount = 1; mixCount <= jumlahMixing; mixCount++) {
            if (processAbortedRef.current) throw new Error('Process aborted');
            
            addActivityLog(`Memulai mixing ke-${mixCount} dari ${jumlahMixing}...`);
            setCountdownTime(mixingTime);
            setInitialCountdownTime(mixingTime);

            const siloNum = parseInt(selectedSilo, 10);
            
            const pasirBasah = (jobMix.pasir1 + jobMix.pasir2) * volumePerMix;
            const batuBasah = (jobMix.batu1 + jobMix.batu2) * volumePerMix;

            const airDiPasir = pasirBasah * (moistureSettings.pasir / 100);
            const airDiBatu = batuBasah * (moistureSettings.batu / 100);

            const pasirKering = pasirBasah - airDiPasir;
            const batuKering = batuBasah - airDiBatu;

            const totalAirDariAgregat = airDiPasir + airDiBatu;
            const airDariJobMix = jobMix.air * volumePerMix;
            const airDitimbang = Math.max(0, airDariJobMix - totalAirDariAgregat + moistureSettings.air);

            const semenTarget = jobMix.semen * volumePerMix;
            let semen1Target = 0;
            let semen2Target = 0;

            if (siloNum >= 1 && siloNum <= 3) {
                semen1Target = semenTarget;
            } else if (siloNum >= 4 && siloNum <= 6) {
                semen2Target = semenTarget;
            }
            
            const newTargets = {
                'SEMEN 1': semen1Target,
                'SEMEN 2': semen2Target,
                'PASIR': pasirKering + airDiPasir,
                'BATU': batuKering + airDiBatu,
                'AIR': airDitimbang,
            };
            
            setScales(prevScales => prevScales.map(scale => ({
                ...scale,
                target: newTargets[scale.name as keyof typeof newTargets] ?? scale.target,
                weight: 0 
            })));
            
            addActivityLog('Konveyor atas hidup...');
            await new Promise(res => setTimeout(res, 1000)); 

            addActivityLog('Konveyor bawah hidup...');
            await new Promise(res => setTimeout(res, 1000));
            
            addActivityLog('Menimbang semua material...');
            const materialsToWeigh: MaterialName[] = ['PASIR', 'BATU', 'AIR'];
            if (semen1Target > 0) materialsToWeigh.push('SEMEN 1');
            if (semen2Target > 0) materialsToWeigh.push('SEMEN 2');
            
            await Promise.all(materialsToWeigh.map(mat => simulateProcess(mat, 'weigh')));
            
            addActivityLog('Penimbangan selesai. Memulai penuangan...');

            const pourPromises: Promise<void>[] = [];
            
            addActivityLog('Menuang PASIR...');
            const sandPourPromise = simulateProcess('PASIR', 'pour');
            pourPromises.push(sandPourPromise);

            const delayedPour = (name: string, delay: number) => new Promise<void>(resolve => {
                setTimeout(() => {
                    if (processAbortedRef.current) return resolve();
                    addActivityLog(`Menuang ${name}...`);
                    if (name === 'SEMEN') {
                        if (semen1Target > 0) pourPromises.push(simulateProcess('SEMEN 1', 'pour'));
                        if (semen2Target > 0) pourPromises.push(simulateProcess('SEMEN 2', 'pour'));
                    } else {
                        pourPromises.push(simulateProcess(name as MaterialName, 'pour'));
                    }
                    resolve();
                }, delay * 1000);
            });

            if (loadingOrder.Air.urutan === '1') await delayedPour('AIR', parseInt(loadingOrder.Air.detik));
            if (loadingOrder.Semen.urutan === '1') await delayedPour('SEMEN', parseInt(loadingOrder.Semen.detik));

            await sandPourPromise;
            addActivityLog('Penuangan pasir selesai.');

            if (loadingOrder.Batu.urutan !== '1') await delayedPour('BATU', parseInt(loadingOrder.Batu.detik));
            if (loadingOrder.Air.urutan !== '1') await delayedPour('AIR', parseInt(loadingOrder.Air.detik));
            if (loadingOrder.Semen.urutan !== '1') await delayedPour('SEMEN', parseInt(loadingOrder.Semen.detik));

            await Promise.all(pourPromises);
            addActivityLog('Semua material telah dituang. Memulai mixing.');
            
            setIsMixing(true);

            await new Promise<void>(resolve => {
                const checkMixing = setInterval(() => {
                    if (!intervalsRef.current.has('mixing') || processAbortedRef.current) {
                        clearInterval(checkMixing);
                        resolve();
                    }
                }, 100);
            });
            if (processAbortedRef.current) throw new Error('Process aborted');

            addActivityLog('Mixing selesai. Membuka pintu mixer...');
            const totalDoorTime = mixerSettings.opening1 + mixerSettings.opening2 + mixerSettings.opening3 + mixerSettings.tutup;
            setInitialCountdownTime(totalDoorTime);
            setCountdownTime(totalDoorTime);
            setIsDoorOperating(true);

            if (mixerSettings.opening1 > 0) {
                addActivityLog(`Membuka pintu ke 1... (${mixerSettings.opening1}s)`);
                await new Promise(res => setTimeout(res, mixerSettings.opening1 * 1000));
            }
            if (mixerSettings.opening2 > 0) {
                addActivityLog(`Membuka pintu ke 2... (${mixerSettings.opening2}s)`);
                await new Promise(res => setTimeout(res, mixerSettings.opening2 * 1000));
            }
            if (mixerSettings.opening3 > 0) {
                addActivityLog(`Membuka pintu ke 3... (${mixerSettings.opening3}s)`);
                await new Promise(res => setTimeout(res, mixerSettings.opening3 * 1000));
            }

            addActivityLog('Pintu mixer terbuka. Menutup pintu mixer...');
            if (mixerSettings.tutup > 0) {
                addActivityLog(`Menutup Pintu Mixer... (${mixerSettings.tutup}s)`);
                await new Promise(res => setTimeout(res, mixerSettings.tutup * 1000));
            }
            
            await new Promise<void>(resolve => {
                const checkDoor = setInterval(() => {
                    if (!intervalsRef.current.has('door') || processAbortedRef.current) {
                        clearInterval(checkDoor);
                        resolve();
                    }
                }, 100);
            });
            if (processAbortedRef.current) throw new Error('Process aborted');

            if (mixCount < jumlahMixing) {
                addActivityLog(`Mixing ke-${mixCount} selesai. Lanjut ke mixing berikutnya.`);
                await new Promise(res => setTimeout(res, 2000));
            }
        }

        addActivityLog('Klakson berbunyi...');
        await new Promise(res => setTimeout(res, 1000));
        addActivityLog('Siklus otomatis selesai.');
        
        await handleStop({
            schedule: activeSchedule!,
            jobMix: activeJobMix!,
            targetVolume: String(targetVolume),
            jumlahMixing: jumlahMixing,
            startTime: processStartTime,
            endTime: new Date(),
            selectedSilo: selectedSilo,
            unitBp: userInfo?.unitBp,
        }, { isAborted: false, mode: 'auto' });
    } catch (error: any) {
        if (error.message.includes('Process aborted')) {
            addActivityLog('PROSES DIHENTIKAN OLEH PENGGUNA');
        } else {
            console.error("Auto weighing error:", error);
            addActivityLog('Terjadi kesalahan pada proses otomatis.');
        }
        await handleStop(undefined, { isAborted: true, mode: 'auto' });
    }
  };
  
    const stopSimulation = (material: MaterialName) => {
        if (intervalsRef.current.has(material)) {
            clearInterval(intervalsRef.current.get(material)!);
            intervalsRef.current.delete(material);
        }
    };

    const handleManualWeigh = (material: MaterialName, action: 'start' | 'stop') => {
        if (action === 'start') {
            stopSimulation(material); 

            const intervalId = setInterval(() => {
                setScales(prevScales => {
                    return prevScales.map(s => {
                        if (s.name === material) {
                            const newWeight = s.weight + (WEIGH_SPEED * (SIMULATION_INTERVAL / 1000));
                            if (newWeight >= (s.target || s.max)) {
                                stopSimulation(material);
                                return { ...s, weight: s.target || s.max };
                            }
                            return { ...s, weight: newWeight };
                        }
                        return s;
                    });
                });
            }, SIMULATION_INTERVAL);
            intervalsRef.current.set(material, intervalId);
        } else { 
            stopSimulation(material);
        }
    };
    
    const handleManualPour = (material: MaterialName, action: 'start' | 'stop') => {
         if (action === 'start') {
            stopSimulation(material); 
            if (action === 'start') {
                setPouringMaterials(prev => [...prev, material]);
            }

            const intervalId = setInterval(() => {
                setScales(prevScales => {
                    return prevScales.map(s => {
                        if (s.name === material) {
                            const newWeight = s.weight - (POUR_SPEED * (SIMULATION_INTERVAL / 1000));
                            if (newWeight <= 0) {
                                stopSimulation(material);
                                if (action === 'start') {
                                    setPouringMaterials(prev => prev.filter(m => m !== material));
                                }
                                return { ...s, weight: 0 };
                            }
                            return { ...s, weight: newWeight };
                        }
                        return s;
                    });
                });
            }, SIMULATION_INTERVAL);
            intervalsRef.current.set(material, intervalId);
        } else { 
            stopSimulation(material);
            setPouringMaterials(prev => prev.filter(m => m !== material));
        }
    };
    
  const resetAllFields = () => {
    setReqNo('');
    setTargetVolume('');
    setJumlahMixing(1);
    setNamaSopir('');
    setNomorMobil('');
    setNomorLambung('');
    setSelectedSilo('');
    onSetActiveSchedule(null);
    onSetActiveJobMix(null);
  }

  const handleStop = async (data?: PrintData & { selectedSilo?: string }, options: { isAborted?: boolean, mode: OperationMode } = { isAborted: true, mode: 'auto' }) => {
    if (options.isAborted) {
        processAbortedRef.current = true;
        intervalsRef.current.forEach(intervalId => {
            clearInterval(intervalId);
        });
        intervalsRef.current.clear();
        setPouringMaterials([]);
        setIsMixing(false);
        setIsDoorOperating(false);
    }
    
    setIsProcessing(false);
    setStartTime(null);

    if (options.isAborted) {
        if(options.mode === 'auto') {
            toast({ title: "Proses dihentikan.", variant: "destructive" });
        }
        await updateBpStatus();
        return;
    }
    
    if (data && activeSchedule && activeJobMix && userInfo?.lokasi && userInfo?.unitBp) {
      try {
        const currentVolume = parseFloat(data.targetVolume);
        if (isNaN(currentVolume) || currentVolume <= 0) {
            toast({ title: "Error Data", description: "Volume produksi tidak valid.", variant: "destructive" });
            return;
        }

        const usage: MaterialUsage = {
            pasir: (activeJobMix.pasir1 + activeJobMix.pasir2) * currentVolume,
            batu: (activeJobMix.batu1 + activeJobMix.batu2) * currentVolume,
            semen: activeJobMix.semen * currentVolume,
            air: activeJobMix.air * currentVolume,
            sikaVz: 0, sikaNn: 0, visco: 0,
        };
        
        const scheduleDocRef = doc(db, 'schedules_today', activeSchedule.id as string);
        const aggregateStockRef = doc(db, `locations/${userInfo.lokasi}/stock`, 'aggregates');
        const cementStockRef = doc(db, `locations/${userInfo.lokasi}/stock_cement_silo_${userInfo.unitBp}`, 'main');

        const newProductionData = await runTransaction(db, async (transaction) => {
            const scheduleDoc = await transaction.get(scheduleDocRef);
            if (!scheduleDoc.exists()) throw "Jadwal tidak ditemukan!";
            
            const aggregateStockDoc = await transaction.get(aggregateStockRef);
            const cementStockDoc = await transaction.get(cementStockRef);

            const scheduleData = scheduleDoc.data() as ScheduleRow;
            const terkirimSebelumnya = parseFloat(scheduleData['TERKIRIM M³'] || '0');
            const totalTerkirim = terkirimSebelumnya + currentVolume;
            const totalVol = parseFloat(scheduleData['TOTAL M³'] || '0');
            const sisaBaru = totalVol - totalTerkirim;
            const newStatus = (sisaBaru <= 0 ? 'selesai' : 'proses') as ScheduleRow['STATUS'];
            
            transaction.update(scheduleDocRef, {
                'TERKIRIM M³': String(totalTerkirim),
                'SISA M³': String(sisaBaru),
                STATUS: newStatus,
            });

            if (aggregateStockDoc.exists()) {
                const currentAggStock = aggregateStockDoc.data();
                transaction.update(aggregateStockRef, {
                    pasir: (currentAggStock.pasir || 0) - usage.pasir,
                    batu: (currentAggStock.batu || 0) - usage.batu
                });
            }

            if (cementStockDoc.exists() && data.selectedSilo) {
                const currentCementStock = cementStockDoc.data() as CementSiloStock;
                const siloKey = `silo-${data.selectedSilo}`;
                const currentSiloStockData = currentCementStock.silos[siloKey];
                
                if (currentSiloStockData && currentSiloStockData.status === 'aktif') {
                    const newStock = (currentSiloStockData.stock || 0) - usage.semen;
                    transaction.update(cementStockRef, {
                        [`silos.${siloKey}.stock`]: newStock
                    });
                } else {
                   throw new Error(`Silo ${data.selectedSilo} tidak aktif atau tidak ditemukan.`);
                }
            }
            
            const productionsQuery = query(collection(db, 'productions'), where('jobId', '==', scheduleData.NO));
            const scheduleProductionsQuerySnapshot = await getDocs(productionsQuery);
            const nomorRitasi = scheduleProductionsQuerySnapshot.docs.length + 1;

            return {
                nomorRitasi,
                totalVolumeTerkirim: totalTerkirim,
                updatedSchedule: {
                    ...scheduleData,
                    'TERKIRIM M³': String(totalTerkirim),
                    'SISA M³': String(sisaBaru),
                    STATUS: newStatus,
                }
            };
        });
        
        const productionEntry: ProductionData = {
            id: `${activeSchedule.NO}-${new Date().getTime()}`,
            jobId: activeSchedule.NO,
            tanggal: Timestamp.fromDate(data.startTime),
            namaPelanggan: activeSchedule.NAMA,
            lokasiProyek: activeSchedule.LOKASI,
            mutuBeton: activeSchedule.GRADE,
            slump: activeSchedule['SLUMP (CM)'],
            targetVolume: currentVolume,
            jumlahMixing: data.jumlahMixing,
            jamMulai: data.startTime.toISOString(),
            jamSelesai: data.endTime.toISOString(),
            namaSopir: namaSopir,
            nomorMobil: nomorMobil,
            nomorLambung: nomorLambung,
            jobMix: activeJobMix,
            nomorRitasi: newProductionData.nomorRitasi,
            totalVolumeTerkirim: newProductionData.totalVolumeTerkirim,
            lokasiProduksi: userInfo.lokasi,
            unitBp: userInfo.unitBp,
            materialUsage: usage,
        };
        await addDoc(collection(db, 'productions'), productionEntry);
        
        const dataForPrint: PrintData = { 
            ...data, 
            schedule: {
                ...activeSchedule,
                ...newProductionData.updatedSchedule,
                'NAMA SOPIR': namaSopir,
                'NOMOR MOBIL': nomorMobil,
                'NOMOR LAMBUNG': nomorLambung,
            },
            nomorRitasi: newProductionData.nomorRitasi,
            totalVolumeTerkirim: newProductionData.totalVolumeTerkirim,
            unitBp: userInfo.unitBp
        };
        setProductionDataForPrint(dataForPrint);
        setIsPreviewing(true);
        
        toast({
            title: "Proses Selesai",
            description: "Data produksi, jadwal, dan stok telah berhasil diperbarui.",
        });
        
        resetAllFields();

      } catch (error) {
        console.error("Error stopping process:", error);
        toast({
          title: "Gagal Menyimpan Data",
          description: `Terjadi kesalahan saat menyimpan: ${error}`,
          variant: "destructive"
        });
      }
    }
  };


  if (!userInfo) {
    return (
       <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </main>
    )
  }

  const handlePrint = () => {
    printElement('printable-ticket');
  };

  const handleBpSelect = (namaBp: string) => {
    const newUserInfo = { ...userInfo, lokasi: namaBp };
    localStorage.setItem('user', JSON.stringify(newUserInfo));
    setUserInfo(newUserInfo);
    setIsBpModalOpen(false);
     if (userInfo.jabatan.toUpperCase().includes('OPRATOR BP')) {
        setIsUnitModalOpen(true);
    }
  }

  const handleUnitSelect = (unit: string) => {
    const newUserInfo = { ...userInfo, unitBp: unit };
    localStorage.setItem('user', JSON.stringify(newUserInfo));
    setUserInfo(newUserInfo);
    setIsUnitModalOpen(false);
  }

  const menuNavItems = [
    { label: 'Atur Pintu Mixer', icon: SlidersHorizontal, action: () => setMixerSettingsOpen(true) },
    { label: 'Urutan Loading', icon: ListOrdered, action: () => setIsLoadingOrderOpen(true) },
    { label: 'Tombol Manual', icon: ToggleRight, action: () => setManualControlsOpen(true) },
    { label: 'Job Mix Formula', icon: FileText, action: () => router.push('/job-mix-formula') },
    { label: 'Database Produksi', icon: Database, action: () => router.push('/database-produksi') },
    { label: 'Stok Material', icon: Package, action: () => router.push('/stok-material') },
    { label: 'Moisture Control', icon: Droplets, action: () => setMoistureControlOpen(true) },
    { label: 'Absensi & Kegiatan', icon: CalendarCheck, action: () => router.push('/absensi')},
    { label: 'Ubah Password', icon: KeyRound, action: () => router.push('/ubah-password') },
  ];

  return (
    <>
      <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>
      </div>
      <BpSelectionDialog 
        isOpen={isBpModalOpen}
        onBpSelect={handleBpSelect}
      />
       <UnitSelectionDialog 
        isOpen={isUnitModalOpen}
        onUnitSelect={handleUnitSelect}
      />
      <Dialog open={isPreviewing} onOpenChange={setIsPreviewing}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Pratinjau Cetak</DialogTitle>
             <DialogClose asChild>
                <Button variant="ghost" size="icon" className="absolute right-4 top-3">
                  <X className="h-4 w-4" />
                </Button>
            </DialogClose>
          </DialogHeader>
          <div className="p-6 max-h-[70vh] overflow-y-auto" id="printable-ticket">
            {productionDataForPrint && <PrintTicketLayout data={productionDataForPrint} />}
          </div>
          <div className="flex justify-end gap-2 p-4 border-t bg-muted/50">
             <Button variant="outline" onClick={() => setIsPreviewing(false)}>Tutup</Button>
             <Button onClick={handlePrint}>Cetak</Button>
          </div>
        </DialogContent>
      </Dialog>

      <SidebarProvider>
        <Sidebar>
            <SidebarContent>
                <SidebarHeader>
                    <h2 className="text-lg font-semibold text-primary px-2">Operator Menu</h2>
                </SidebarHeader>
                 <SidebarMenu>
                    {menuNavItems.map((item, index) => (
                      <SidebarMenuItem key={index}>
                          <SidebarMenuButton onClick={item.action}>
                              <item.icon />
                              {item.label}
                          </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                 </SidebarMenu>
            </SidebarContent>
        </Sidebar>
        <SidebarInset>
            <div className="flex flex-col h-screen bg-transparent text-foreground no-print">
                <AppHeader 
                userInfo={userInfo}
                />
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {scales.map(scale => (
                    <WeightIndicator 
                        key={scale.id} 
                        scale={scale} 
                        isPouring={pouringMaterials.includes(scale.name as MaterialName)}
                    />
                    ))}
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
                    <div className="lg:col-span-3">
                        <OperationControls 
                            scheduleData={scheduleData} 
                            onStartAuto={startAutoWeighing}
                            mixingTime={initialCountdownTime}
                            isProcessing={isProcessing}
                            onSetIsProcessing={setIsProcessing}
                            onStop={handleStop}
                            onSetActiveSchedule={setActiveSchedule}
                            onSetActiveJobMix={setActiveJobMix}
                            activeSchedule={activeSchedule}
                            activeJobMix={activeJobMix}
                            startTime={startTime}
                            onSetStartTime={setStartTime}
                            namaSopir={namaSopir}
                            setNamaSopir={setNamaSopir}
                            nomorMobil={nomorMobil}
                            setNomorMobil={setNomorMobil}
                            nomorLambung={nomorLambung}
                            setNomorLambung={setNomorLambung}
                            reqNo={reqNo}
                            setReqNo={setReqNo}
                            targetVolume={targetVolume}
                            setTargetVolume={setTargetVolume}
                            jumlahMixing={jumlahMixing}
                            setJumlahMixing={setJumlahMixing}
                            selectedSilo={selectedSilo}
                            setSelectedSilo={setSelectedSilo}
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <MixingStatus 
                            activityLog={activityLog}
                            countdownTime={countdownTime}
                            onMixingTimeChange={setCountdownTime}
                            initialCountdownTime={initialCountdownTime}
                            onInitialMixingTimeChange={setInitialCountdownTime}
                            isProcessing={isMixing || isDoorOperating}
                        />
                    </div>
                </div>

<<<<<<< HEAD
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
                                    <CardTitle className="flex items-center gap-3"><ClipboardList />Pencatatan Pemasukan Material</CardTitle>
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
=======
                <ScheduleTable scheduleData={scheduleData} isLoading={isScheduleLoading}/>
                </main>
                
                <ManualControlsDialog
                isOpen={isManualControlsOpen}
                onOpenChange={setManualControlsOpen}
                onWeigh={handleManualWeigh}
                onPour={handleManualPour}
                />
                 <MixerSettingsDialog 
                    isOpen={isMixerSettingsOpen} 
                    onOpenChange={setMixerSettingsOpen}
                    initialSettings={mixerSettings}
                    onSave={setMixerSettings}
                />
                <LoadingOrderDialog 
                    isOpen={isLoadingOrderOpen} 
                    onOpenChange={setIsLoadingOrderOpen}
                    initialSettings={loadingOrder}
                    onSave={setLoadingOrder}
                />
                <MoistureControlDialog
                    isOpen={isMoistureControlOpen}
                    onOpenChange={setMoistureControlOpen}
                    initialSettings={moistureSettings}
                    onSave={setMoistureSettings}
                />
            </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
>>>>>>> 0d128ab (ganti kode scr/app/admin-logistik-material/page.sx dengan ini)
}

    

    