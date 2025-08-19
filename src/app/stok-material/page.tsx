

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Package, Loader2, Wind, Droplets, CircleDot, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db, doc, onSnapshot } from '@/lib/firebase';
import type { UserData, CementSiloStock, StockValues, SiloData } from '@/lib/types';
import { cn } from '@/lib/utils';


// --- Constants ---
const SAND_CAPACITY_M3 = 10000;
const STONE_CAPACITY_M3 = 15000;
const SAND_DENSITY_KG_PER_M3 = 1600;
const STONE_DENSITY_KG_PER_M3 = 1550;

const ALL_UNITS = ['BP-1', 'BP-2', 'BP-3'];

// --- Sub-Components ---

const Silo = ({ name, data }: { name: string; data: SiloData; }) => {
  const level = data?.stock || 0;
  const status = data?.status || 'non-aktif';
  const capacity = data?.capacity || 90000; // default capacity
  
  const percentage = capacity > 0 ? Math.min(100, Math.round((level / capacity) * 100)) : 0;
  const isSiloActive = status === 'aktif';

  return (
    <div className={cn(
        "flex flex-col items-center gap-2 p-2 rounded-lg bg-card/60 backdrop-blur-sm flex-1 min-w-[120px] shadow-md transition-all",
        !isSiloActive && "opacity-50 bg-destructive/10"
    )}>
        {/* Silo Visual */}
        <div className="w-24 h-48 border-2 border-white/20 rounded-lg overflow-hidden relative bg-white/10">
            {/* Fill Level with Animation */}
            <div 
                className="absolute bottom-0 left-0 w-full bg-primary/80 transition-all duration-1000 ease-in-out" 
                style={{ height: `${percentage}%` }}
            ></div>
            {/* Percentage Text Overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-white drop-shadow-md">{percentage}%</span>
            </div>
             {!isSiloActive && (
             <div className="absolute inset-0 bg-destructive/50 z-10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive-foreground"/>
             </div>
            )}
        </div>
        
        {/* Label and Weight Info */}
        <div className="text-center -mt-1">
            <p className="font-semibold text-muted-foreground text-sm">{name}</p>
            <p className='text-lg font-bold text-foreground'>{level.toLocaleString('id-ID')} kg</p>
            <p className='text-xs text-muted-foreground'>/ {capacity.toLocaleString('id-ID')} kg</p>
        </div>
    </div>
  );
};

const AggregateStock = ({ name, levelInKg, density, capacityInM3, colorClass, unit, icon: Icon }: { name: string; levelInKg: number; density: number; capacityInM3: number; colorClass: string; unit: string; icon: React.ElementType }) => {
  const levelInM3 = levelInKg / density;
  const displayLevel = capacityInM3 > 0 ? Math.max(0, Math.min(100, Math.round((levelInM3 / capacityInM3) * 100))) : 0;
  
  const clipId = `clip-pile-${name.replace(/[^a-zA-Z0-9-]/g, '')}`;

  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-lg bg-card/60 backdrop-blur-sm flex-1 min-w-[200px] md:min-w-[240px] shadow-md">
      <h3 className="font-semibold text-lg text-muted-foreground tracking-wider flex items-center gap-2"><Icon />{name}</h3>
      <div className="relative w-48 h-24">
        <svg width="192" height="96" viewBox="0 0 192 96" className="absolute bottom-0 left-0">
          <defs><clipPath id={clipId}><rect x="0" y={96 - (96 * (displayLevel / 100))} width="192" height={96 * (displayLevel / 100)} /></clipPath></defs>
          <polygon points="0,96 192,96 96,0" className="fill-current text-muted/50" />
          <polygon points="0,96 192,96 96,0" className={`fill-current ${colorClass} transition-all duration-500`} clipPath={`url(#${clipId})`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center -mt-4">
          <span className="text-2xl font-bold text-white drop-shadow-lg">{displayLevel}%</span>
        </div>
      </div>
      <div className='text-center my-1'>
        <p className='text-xl font-bold text-foreground'>{levelInM3.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {unit}</p>
        <p className='text-xs text-muted-foreground'>/ {capacityInM3.toLocaleString('id-ID')} {unit}</p>
      </div>
    </div>
  );
};


// --- Main Page Component ---

export default function StokMaterialPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [aggregateStock, setAggregateStock] = useState<StockValues | null>(null);
  const [bpUnitStocks, setBpUnitStocks] = useState<Record<string, CementSiloStock>>({});

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (userString) {
      const userData: UserData = JSON.parse(userString);
      setUserInfo(userData);
      if (userData.lokasi) {
        setSelectedLocation(userData.lokasi);
      } else {
        setIsLoading(false);
        toast({ title: 'Lokasi Tidak Ditemukan', description: 'Silakan kembali dan pilih lokasi di halaman utama.', variant: 'destructive' });
      }
    } else {
      router.push('/login');
    }
  }, [router, toast]);
  
  useEffect(() => {
    if (!selectedLocation) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribers: (() => void)[] = [];

    const setupListener = (path: string, setter: (data: any) => void, failureMsg: string) => {
      const unsub = onSnapshot(doc(db, path), 
        (docSnap) => {
          setter(docSnap.exists() ? docSnap.data() : null);
        }, 
        (error) => {
          console.error(`Error fetching ${path}:`, error);
          toast({ title: failureMsg, variant: "destructive" });
        }
      );
      unsubscribers.push(unsub);
    };

    // Listener for Aggregate Stock
    setupListener(
      `locations/${selectedLocation}/stock/aggregates`,
      (data) => setAggregateStock(data as StockValues | null),
      "Gagal memuat stok agregat"
    );

    // Listeners for BP Unit Cement Stocks
    ALL_UNITS.forEach(unit => {
      setupListener(
        `locations/${selectedLocation}/stock_cement_silo_${unit}/main`,
        (data) => {
          const stockData = (data as CementSiloStock) || { silos: {} };
          setBpUnitStocks(prev => ({ ...prev, [unit]: stockData }));
        },
        `Gagal memuat stok semen ${unit}`
      );
    });

    const timer = setTimeout(() => setIsLoading(false), 1500); // Give time for listeners to fetch
    unsubscribers.push(() => clearTimeout(timer));

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [selectedLocation, toast]);
  
  const getSiloCountForUnit = useCallback((unit: string) => {
      if (selectedLocation.toUpperCase().includes('BAUNG') && unit === 'BP-1') {
          return 4;
      }
      return 6; // Default for other units
  }, [selectedLocation]);


  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8">
       <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]">
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-primary/20 opacity-20 blur-[100px]"></div>
      </div>
      <header className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={() => router.back()}><ArrowLeft /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-wider text-primary flex items-center gap-3"><Package />Visualisasi Stok Material</h1>
          <div className="text-muted-foreground flex items-center gap-4 mt-1">
             <p>Lokasi: <span className="font-semibold">{selectedLocation || 'Belum Dipilih'}</span></p>
          </div>
        </div>
      </header>

      <main className='space-y-8'>
         {isLoading ? (
            <div className="flex justify-center items-center h-96"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
         ) : !selectedLocation ? (
            <div className="flex justify-center items-center h-96"><p className='text-muted-foreground'>Pilih lokasi di halaman utama untuk melihat stok.</p></div>
         ) : (
            <>
              <Card className="bg-transparent border-border/20">
                <CardHeader><CardTitle>Stok Agregat (Lokasi: {selectedLocation})</CardTitle></CardHeader>
                  <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-wrap justify-center items-start gap-8 p-6 rounded-lg bg-muted/30">
                          <AggregateStock
                              name="STOK PASIR"
                              levelInKg={Number(aggregateStock?.pasir || 0)}
                              density={SAND_DENSITY_KG_PER_M3}
                              capacityInM3={SAND_CAPACITY_M3}
                              unit="M³"
                              colorClass="text-yellow-400"
                              icon={CircleDot}
                          />
                          <AggregateStock
                              name="STOK BATU"
                              levelInKg={Number(aggregateStock?.batu || 0)}
                              density={STONE_DENSITY_KG_PER_M3}
                              capacityInM3={STONE_CAPACITY_M3}
                              unit="M³"
                              colorClass="text-gray-400"
                              icon={Wind}
                          />
                      </div>
                  </CardContent>
              </Card>

              {ALL_UNITS.map(unit => {
                  const stock = bpUnitStocks[unit];
                  if (!stock || !stock.silos) return null;
                  
                  const siloCount = getSiloCountForUnit(unit);
                  const siloEntries = Array.from({ length: siloCount }, (_, i) => {
                      const siloId = `silo-${i + 1}`;
                      return {
                          id: siloId,
                          data: stock.silos[siloId] || { stock: 0, status: 'non-aktif', capacity: 90000 }
                      };
                  });
                  
                  const totalInUnit = siloEntries.reduce((a, b) => a + (b.data.stock || 0), 0);

                  return (
                      <Card key={unit} className="bg-transparent border-border/20">
                        <CardHeader>
                            <CardTitle>Stok Semen (Unit: {unit})</CardTitle>
                            <CardDescription>Total di unit ini: {totalInUnit.toLocaleString('id-ID')} KG</CardDescription>
                        </CardHeader>
                          <CardContent className="p-4 sm:p-6">
                          <div className="flex flex-wrap justify-center items-start gap-4 p-6 rounded-lg bg-muted/30">
                              {siloEntries.map((silo) => (
                                  <Silo
                                      key={silo.id}
                                      name={`Silo ${silo.id.split('-')[1]}`}
                                      data={silo.data}
                                  />
                              ))}
                          </div>
                      </CardContent>
                      </Card>
                  );
              })}
            </>
         )}
      </main>
    </div>
  );
}
