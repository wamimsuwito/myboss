
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  LayoutDashboard,
  ClipboardList,
  History,
  Users,
  ShieldAlert,
  LogOut,
  Wrench,
  Loader2,
  Calendar as CalendarIcon,
  Plus,
  Copy,
  CheckCircle,
  XCircle,
  AlertTriangle,
  WrenchIcon,
  UserX,
  Pencil,
  Trash2,
  Save,
  ArrowRightLeft,
  PlusCircle,
  Camera,
  ActivitySquare,
  Check,
  Printer,
  FilterX,
  MessageSquareWarning,
  Lightbulb,
  Mail,
  Truck,
  Fingerprint,
  Briefcase,
  ShieldX,
  Star,
  FileText,
  ClipboardCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { UserData, Report, LocationData, SopirBatanganData, AlatData, MechanicTask } from '@/lib/types';
import { cn, printElement } from '@/lib/utils';
import { format, startOfToday, isSameDay, isBefore, subDays, startOfDay, endOfDay, isAfter, formatDistanceStrict, differenceInMinutes, differenceInMilliseconds, formatRelative } from 'date-fns';
import { id as localeID } from 'date-fns/locale';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateRange } from 'react-day-picker';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { db, collection, getDocs, doc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, addDoc, query, where, Timestamp } from '@/lib/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sidebar, SidebarProvider, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarInset, SidebarTrigger, SidebarSeparator } from '@/components/ui/sidebar';
import HistoryPrintLayout from '@/components/history-print-layout';


type ActiveMenu = 
  | 'Dashboard' 
  | 'Manajemen Work Order'
  | 'Histori Perbaikan Alat' 
  | 'Anggota Mekanik'
  | 'Absensi'
  | 'Kegiatan'
  | 'Riwayat Kegiatan'
  | 'Riwayat Penalti'
  | 'Riwayat Reward'
  | 'Pesan Masuk';

const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Manajemen Work Order', icon: ClipboardList },
    { name: 'Histori Perbaikan Alat', icon: History },
    { name: 'Anggota Mekanik', icon: Users },
];

const secondaryMenuItems = [
    { name: 'Absensi', icon: ClipboardCheck, href: '/absensi' },
    { name: 'Kegiatan', icon: FileText, href: '/kegiatan' },
    { name: 'Riwayat Kegiatan', icon: History, href: '/riwayat-kegiatan' },
    { name: 'Riwayat Penalti', icon: ShieldX, href: '/riwayat-saya?type=penalty' },
    { name: 'Riwayat Reward', icon: Star, href: '/riwayat-saya?type=reward' },
    { name: 'Pesan Masuk', icon: Mail, href: '#' },
];


const taskFormSchema = z.object({
  mechanics: z.array(z.object({ id: z.string(), name: z.string() })).min(1, "Pilih minimal satu mekanik."),
  targetDate: z.date({ required_error: "Tanggal target harus diisi." }),
  targetTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Format waktu tidak valid (HH:MM)."),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

const StatCard = ({ title, value, description, icon: Icon, color, onClick }: { title: string, value: string, description: string, icon: React.ElementType, color: string, onClick?: () => void }) => (
    <Card className="hover:bg-accent/50 transition-colors cursor-pointer" onClick={onClick}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">{title}</CardTitle>
            <Icon className={cn("h-6 w-6", color)} />
        </CardHeader>
        <CardContent>
            <div className="text-5xl font-bold">{value}</div>
            <p className="text-sm text-muted-foreground">{description}</p>
        </CardContent>
    </Card>
);

const CreateWorkOrderDialog = ({ vehicle, report, mechanics, onTaskCreated }: { vehicle: AlatData, report: Report, mechanics: UserData[], onTaskCreated: (newTask: MechanicTask) => void }) => {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<TaskFormData>({
        resolver: zodResolver(taskFormSchema),
        defaultValues: {
            mechanics: [],
            targetTime: "17:00",
            targetDate: new Date(),
        },
    });

    const onSubmit = async (data: TaskFormData) => {
        setIsSubmitting(true);
        const targetTimestamp = new Date(data.targetDate);
        const [hours, minutes] = data.targetTime.split(':').map(Number);
        targetTimestamp.setHours(hours, minutes);

        const newTaskData: Omit<MechanicTask, 'id'> = {
            status: 'PENDING',
            vehicle: {
                hullNumber: vehicle.nomorLambung,
                licensePlate: vehicle.nomorPolisi,
                repairDescription: report.description || 'Tidak ada deskripsi kerusakan.',
                targetDate: format(data.targetDate, 'yyyy-MM-dd'),
                targetTime: data.targetTime,
                triggeringReportId: report.id,
            },
            mechanics: data.mechanics,
            createdAt: new Date().getTime(),
            riwayatTunda: [],
            totalDelayDuration: 0,
        };

        try {
            const docRef = await addDoc(collection(db, 'mechanic_tasks'), newTaskData);
            const finalTask: MechanicTask = { ...newTaskData, id: docRef.id };
            toast({ title: "Work Order Berhasil Dibuat" });
            form.reset();
            onTaskCreated(finalTask);
            setIsOpen(false);
        } catch (error) {
            console.error("Error creating task:", error);
            toast({ title: "Gagal Membuat WO", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button size="sm">
                    <Wrench className="mr-2" /> Buat Work Order
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Buat Work Order untuk {vehicle.nomorLambung}</DialogTitle>
                    <DialogDescription>
                        Pilih mekanik dan tentukan target penyelesaian perbaikan.
                    </DialogDescription>
                </DialogHeader>
                   <Form {...form}>
                     <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                       <FormField
                       control={form.control}
                       name="mechanics"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>Pilih Mekanik</FormLabel>
                             <Popover>
                                 <PopoverTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start">
                                       <PlusCircle className="mr-2"/>
                                       {field.value.length > 0 ? field.value.map(m => m.name).join(', ') : "Pilih mekanik"}
                                    </Button>
                                 </PopoverTrigger>
                                 <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                     <Command>
                                       <CommandInput placeholder="Cari mekanik..." />
                                       <CommandList>
                                         <CommandEmpty>Tidak ada mekanik.</CommandEmpty>
                                         <CommandGroup>
                                             {mechanics.filter(m => m.jabatan?.toUpperCase().includes('MEKANIK')).map((mechanic) => {
                                                 const isSelected = field.value.some(m => m.id === mechanic.id);
                                                 return (
                                                     <CommandItem
                                                         key={mechanic.id}
                                                         onSelect={() => {
                                                             const currentMechanics = field.value;
                                                             if (isSelected) {
                                                                 form.setValue("mechanics", currentMechanics.filter(m => m.id !== mechanic.id));
                                                             } else {
                                                                 form.setValue("mechanics", [...currentMechanics, { id: mechanic.id, name: mechanic.username }]);
                                                             }
                                                         }}
                                                     >
                                                         <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", isSelected ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                                             <Check className="h-4 w-4" />
                                                         </div>
                                                         <span>{mechanic.username}</span>
                                                     </CommandItem>
                                                 )
                                             })}
                                         </CommandGroup>
                                       </CommandList>
                                     </Command>
                                 </PopoverContent>
                             </Popover>
                           <FormMessage />
                         </FormItem>
                       )}
                       />
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <FormField
                               control={form.control}
                               name="targetDate"
                               render={({ field }) => (
                               <FormItem className="flex flex-col">
                                   <FormLabel>Target Selesai</FormLabel>
                                   <Popover>
                                   <PopoverTrigger asChild>
                                       <FormControl>
                                       <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                           {field.value ? format(field.value, "PPP", { locale: localeID }) : <span>Pilih tanggal</span>}
                                           <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                       </Button>
                                       </FormControl>
                                   </PopoverTrigger>
                                   <PopoverContent className="w-auto p-0" align="start">
                                       <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                   </PopoverContent>
                                   </Popover>
                                   <FormMessage />
                               </FormItem>
                               )}
                           />
                             <FormField
                               control={form.control}
                               name="targetTime"
                               render={({ field }) => (
                               <FormItem className="flex flex-col">
                                   <FormLabel>Waktu Target</FormLabel>
                                   <Input type="time" {...field} />
                                   <FormMessage />
                               </FormItem>
                               )}
                           />
                       </div>
                       <DialogFooter>
                           <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
                           <Button type="submit" disabled={isSubmitting}>
                               {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2" />}
                                 Buat Work Order
                           </Button>
                       </DialogFooter>
                     </form>
                   </Form>
            </DialogContent>
        </Dialog>
    );
};

const CompletionStatusBadge = ({ task }: { task: MechanicTask }) => {
    if (!task.vehicle?.targetDate || !task.vehicle?.targetTime || !task.completedAt) return <Badge variant="secondary">N/A</Badge>;

    const targetDateTime = new Date(`${task.vehicle.targetDate}T${task.vehicle.targetTime}`);
    const completedDateTime = new Date(task.completedAt);
    
    let totalDelayDuration = task.totalDelayDuration || 0;

    const diffMinutes = differenceInMinutes(completedDateTime, targetDateTime) - (totalDelayDuration / 60000);
    const diffAbs = Math.abs(diffMinutes);
    const hours = Math.floor(diffAbs / 60);
    const minutes = Math.round(diffAbs % 60);
    
    let timeText = '';
    if (hours > 0) timeText += `${hours}j `;
    if (minutes > 0) timeText += `${minutes}m`;
    if (timeText.trim() === '') timeText = '0m';

    if (diffMinutes <= 5) {
        return <Badge className="bg-green-100 text-green-800">Tepat Waktu {diffMinutes <= 0 ? `(Lebih Cepat ${timeText})` : ''}</Badge>;
    } else {
        return <Badge variant="destructive">Terlambat {timeText}</Badge>;
    }
};

const HistoriContent = ({ user, mechanicTasks, users, alat, allReports }: { user: UserData | null; mechanicTasks: MechanicTask[]; users: UserData[]; alat: AlatData[], allReports: Report[] }) => {
    const [selectedOperatorId, setSelectedOperatorId] = useState<string>("all");
    const [searchNoPol, setSearchNoPol] = useState('');
    const [date, setDate] = useState<DateRange | undefined>({
      from: subDays(new Date(), 29),
      to: new Date(),
    });

    const sopirOptions = useMemo(() => {
        return users.filter(u => u.jabatan?.toUpperCase().includes('SOPIR') || u.jabatan?.toUpperCase().includes('OPRATOR'))
            .filter(u => user?.lokasi ? u.lokasi === user.lokasi : true)
            .sort((a,b) => a.username.localeCompare(b.username));
    }, [users, user]);
  
    const filteredTasks = useMemo(() => {
      const fromDate = date?.from ? startOfDay(date.from) : null;
      const toDate = date?.to ? endOfDay(date.to) : null;
  
      return mechanicTasks
        .filter((task) => {
          if (task.status !== 'COMPLETED' || !task.completedAt) return false;
          
          if (user?.lokasi) {
            const taskLocation = alat.find(v => v.nomorLambung === task.vehicle?.hullNumber)?.lokasi;
            if (taskLocation !== user.lokasi) return false;
          }
  
          if (fromDate && toDate) {
            const completedDate = new Date(task.completedAt);
            if (isBefore(completedDate, fromDate) || isAfter(completedDate, toDate)) {
              return false;
            }
          }
          
          if (selectedOperatorId !== "all") {
              const reportForTask = allReports.find(r => r.id === task.vehicle?.triggeringReportId);
              if (!reportForTask || reportForTask.operatorId !== selectedOperatorId) {
                  return false;
              }
          }

          if (searchNoPol && task.vehicle?.licensePlate) {
              if (!task.vehicle.licensePlate.toUpperCase().includes(searchNoPol.toUpperCase())) {
                  return false;
              }
          }
          
          return true;
        })
        .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
    }, [mechanicTasks, date, selectedOperatorId, user, alat, allReports, searchNoPol]);

    return (
        <>
            <div className='hidden'>
                <div id="history-print-area">
                    <HistoryPrintLayout data={filteredTasks} allReports={allReports} users={users} location={user?.lokasi} />
                </div>
            </div>
            <Card>
                <CardHeader>
                <CardTitle>Histori Perbaikan Alat</CardTitle>
                <CardDescription>
                    Tinjau riwayat pekerjaan perbaikan yang telah diselesaikan.
                </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 items-center">
                    <Input
                        placeholder="Cari No. Polisi..."
                        value={searchNoPol}
                        onChange={e => setSearchNoPol(e.target.value)}
                        className="w-full sm:w-auto sm:flex-1"
                    />
                    <Select value={selectedOperatorId} onValueChange={setSelectedOperatorId}>
                    <SelectTrigger className="w-full sm:w-auto sm:flex-1">
                        <SelectValue placeholder="Pilih Operator/Sopir" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Operator/Sopir</SelectItem>
                        {sopirOptions.map((sopir) => (
                        <SelectItem key={sopir.id} value={sopir.id}>
                            {sopir.username}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                    <Popover>
                    <PopoverTrigger asChild>
                        <Button id="date" variant={"outline"} className={cn("w-full sm:w-auto sm:flex-1 justify-start text-left font-normal", !date && "text-muted-foreground" )}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? ( date.to ? (<>{format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}</>) : (format(date.from, "LLL dd, y"))) : (<span>Pilih rentang tanggal</span>)}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date} onSelect={setDate} numberOfMonths={2}/>
                    </PopoverContent>
                    </Popover>
                    <Button variant="ghost" onClick={() => { setSearchNoPol(''); setSelectedOperatorId('all'); setDate({ from: subDays(new Date(), 29), to: new Date() }); }}><FilterX className="mr-2 h-4 w-4"/>Reset</Button>
                    <Button variant="outline" className="ml-auto" onClick={() => printElement('history-print-area')}><Printer className="mr-2 h-4 w-4"/>Cetak</Button>
                </div>
                <div className="border rounded-md overflow-x-auto">
                    <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Kendaraan/Sopir</TableHead>
                            <TableHead>Deskripsi Perbaikan</TableHead>
                            <TableHead>Mekanik</TableHead>
                            <TableHead>Waktu Pengerjaan</TableHead>
                            <TableHead>Total Waktu Tunda</TableHead>
                            <TableHead>Waktu Efektif</TableHead>
                            <TableHead>Penyelesaian</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredTasks.length > 0 ? (
                        filteredTasks.map((task) => {
                            const triggeringReport = allReports.find(r => r.id === task.vehicle?.triggeringReportId);
                            const sopir = users.find(u => u.id === triggeringReport?.operatorId);
                            const calculateEffectiveDuration = (task: MechanicTask) => {
                                if (!task.startedAt || !task.completedAt) return '-';
                                const duration = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime() - (task.totalDelayDuration || 0);
                                return formatDistanceStrict(0, Math.max(0, duration), { locale: localeID });
                            }
                        
                            const calculateTotalDelay = (task: MechanicTask) => {
                                if (!task.riwayatTunda || task.riwayatTunda.length === 0) return '-';
                                let totalMs = 0;
                                task.riwayatTunda.forEach(tunda => {
                                    if (tunda.waktuMulai && tunda.waktuSelesai) {
                                        const start = typeof tunda.waktuMulai === 'number' ? new Date(tunda.waktuMulai) : tunda.waktuMulai;
                                        const end = typeof tunda.waktuSelesai === 'number' ? new Date(tunda.waktuSelesai) : tunda.waktuSelesai;
                                        totalMs += end.getTime() - start.getTime();
                                    }
                                });
                                return formatDistanceStrict(0, totalMs, { locale: localeID });
                            };

                            return (
                            <TableRow key={task.id}>
                                <TableCell>
                                    <p className="font-semibold">{task.vehicle.hullNumber} ({task.vehicle.licensePlate})</p>
                                    <p className="text-xs text-muted-foreground">{sopir?.username || 'N/A'}</p>
                                    <p className="text-xs text-muted-foreground">NIK: {sopir?.nik || '-'}</p>
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">{task.mechanicRepairDescription || "(Belum ada deskripsi)"}</TableCell>
                                <TableCell>{task.mechanics.map(m => m.name).join(', ')}</TableCell>
                                <TableCell>
                                    <div className="text-xs space-y-1">
                                        <p><span className="font-semibold">Mulai:</span> {task.startedAt ? format(new Date(task.startedAt), 'dd/MM HH:mm') : '-'}</p>
                                        <p><span className="font-semibold">Target:</span> {format(new Date(task.vehicle.targetDate), 'dd/MM')} @ {task.vehicle.targetTime}</p>
                                        <p><span className="font-semibold">Selesai:</span> {task.completedAt ? format(new Date(task.completedAt), 'dd/MM HH:mm') : '-'}</p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span>{calculateTotalDelay(task)}</span>
                                        {task.riwayatTunda && task.riwayatTunda.length > 0 && (
                                            <ol className="text-xs text-orange-500 mt-1 italic list-decimal list-inside">
                                                {task.riwayatTunda.map((tunda, index) => (
                                                  <li key={index}>{tunda.alasan}</li>
                                                ))}
                                            </ol>
                                          )}
                                    </div>
                                </TableCell>
                                <TableCell>{calculateEffectiveDuration(task)}</TableCell>
                                <TableCell><CompletionStatusBadge task={task} /></TableCell>
                            </TableRow>
                            )
                        })
                        ) : (
                        <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center">
                            Tidak ada riwayat perbaikan ditemukan untuk filter yang dipilih.
                            </TableCell>
                        </TableRow>
                        )}
                    </TableBody>
                    </Table>
                </div>
                </CardContent>
            </Card>
        </>
    );
};

const EditDescriptionDialog = ({ task, onSave }: { task: MechanicTask | null, onSave: (taskId: string, description: string) => Promise<void> }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [description, setDescription] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (task) {
            setDescription(task.mechanicRepairDescription || '');
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    }, [task]);

    const handleSave = async () => {
        if (!task) return;
        setIsSaving(true);
        await onSave(task.id, description);
        setIsSaving(false);
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onSave('', '')}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Deskripsi Perbaikan Mekanik</DialogTitle>
                    <DialogDescription>
                        Tambahkan atau ubah deskripsi perbaikan untuk kendaraan {task?.vehicle.hullNumber}.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Textarea 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Contoh: Ganti oli, perbaikan rem, las sasis bagian..."
                        rows={5}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onSave('', '')}>Batal</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        Simpan Deskripsi
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function KepalaMekanikPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('Dashboard');
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [alat, setAlat] = useState<AlatData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [mechanicTasks, setMechanicTasks] = useState<MechanicTask[]>([]);
  const [pairings, setPairings] = useState<SopirBatanganData[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [isQuarantineConfirmOpen, setIsQuarantineConfirmOpen] = useState(false);
  const [quarantineTarget, setQuarantineTarget] = useState<AlatData | null>(null);

  // Delay Dialog State
  const [isDelayDialogOpen, setIsDelayDialogOpen] = useState(false);
  const [delayReason, setDelayReason] = useState('');
  const [taskToDelay, setTaskToDelay] = useState<MechanicTask | null>(null);

  // Description Dialog State
  const [taskToDescribe, setTaskToDescribe] = useState<MechanicTask | null>(null);

  // Detail List Dialog state
  const [detailListTitle, setDetailListTitle] = useState('');
  const [detailListData, setDetailListData] = useState<any[]>([]);
  const [isDetailListOpen, setIsDetailListOpen] = useState(false);

  // Notification state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [seenDamagedReports, setSeenDamagedReports] = useState<Set<string>>(new Set());
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const isInitialLoad = useRef(true);
  
  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.replace('/login');
      return;
    }
    const userData = JSON.parse(userString);
    if (userData.jabatan.toUpperCase() !== 'KEPALA MEKANIK') {
      toast({
        variant: 'destructive',
        title: 'Akses Ditolak',
        description: 'Anda tidak memiliki hak untuk mengakses halaman ini.',
      });
      router.replace('/login');
      return;
    }
    setUserInfo(userData);
    setIsLoading(false);
  }, [router, toast]);
  
  const dataTransformer = useCallback((docData: any) => {
    const transformedData = { ...docData };
  
    const timestampFields = ['timestamp', 'createdAt', 'startedAt', 'completedAt'];
      timestampFields.forEach(field => {
        if (transformedData[field] && typeof transformedData[field]?.toDate === 'function') {
          transformedData[field] = transformedData[field].toDate().getTime();
        }
      });
  
    if (transformedData.riwayatTunda && Array.isArray(transformedData.riwayatTunda)) {
      transformedData.riwayatTunda = transformedData.riwayatTunda.map((tundaItem: any) => {
        const newTundaItem = { ...tundaItem };
        if (newTundaItem.waktuMulai && typeof newTundaItem.waktuMulai.toDate === 'function') {
          newTundaItem.waktuMulai = newTundaItem.waktuMulai.toDate();
        }
        if (newTundaItem.waktuSelesai && typeof newTundaItem.waktuSelesai.toDate === 'function') {
          newTundaItem.waktuSelesai = newTundaItem.waktuSelesai.toDate();
        }
        return newTundaItem;
      });
    }
  
    return transformedData;
  }, []);
  
  const setupListener = useCallback((collectionName: string, setter: React.Dispatch<React.SetStateAction<any[]>>) => {
        const q = query(collection(db, collectionName));
        return onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(d => dataTransformer({ id: d.id, ...d.data() }));
            setter(data);
        }, (error) => {
            console.error(`Error fetching ${collectionName}:`, error);
            toast({ variant: 'destructive', title: `Gagal Memuat ${collectionName}` });
        });
    }, [dataTransformer, toast]);

    useEffect(() => {
    if (!userInfo) return;
    setIsFetchingData(true);
    
    const collectionsToListen: { name: string; setter: React.Dispatch<React.SetStateAction<any[]>> }[] = [
      { name: 'users', setter: setUsers },
      { name: 'alat', setter: setAlat },
      { name: 'sopir_batangan', setter: setPairings },
      { name: 'mechanic_tasks', setter: setMechanicTasks },
    ];
  
    const unsubscribers = collectionsToListen.map(({ name, setter }) => setupListener(name, setter));

    const reportsUnsub = onSnapshot(query(collection(db, 'checklist_reports')), (snapshot) => {
        const data = snapshot.docs.map(d => dataTransformer({ id: d.id, ...d.data() })) as Report[];
        
        if (isInitialLoad.current) {
            const initialDamaged = new Set(data.filter(r => r.overallStatus === 'rusak').map(r => r.id));
            setSeenDamagedReports(initialDamaged);
            isInitialLoad.current = false;
        } else {
            const newDamagedReports = data.filter(r => r.overallStatus === 'rusak' && !seenDamagedReports.has(r.id));
            if (newDamagedReports.length > 0) {
                audioRef.current?.play().catch(e => console.error("Audio play failed:", e));
                setHasNewMessage(true);
                setSeenDamagedReports(prev => new Set([...Array.from(prev), ...newDamagedReports.map(r => r.id)]));
            }
        }
        setReports(data);
    }, (error) => {
        console.error(`Error fetching checklist_reports:`, error);
        toast({ variant: 'destructive', title: `Gagal Memuat Laporan` });
    });
    unsubscribers.push(reportsUnsub);
    
    const timer = setTimeout(() => {
        setIsFetchingData(false);
    }, 2000);
    unsubscribers.push(() => clearTimeout(timer));
  
    return () => unsubscribers.forEach(unsub => unsub());
  }, [userInfo, toast, setupListener, dataTransformer]);
  
  const getLatestReport = (vehicleId: string, allReports: Report[]): Report | undefined => {
    if (!Array.isArray(allReports)) return undefined;
    return allReports
      .filter(r => r.vehicleId === vehicleId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: MechanicTask['status']) => {
        const task = mechanicTasks.find(t => t.id === taskId);
        if (!task) return;

        if (newStatus === 'DELAYED') {
            setTaskToDelay(task);
            setIsDelayDialogOpen(true);
            return;
        }
        
        if (newStatus === 'IN_PROGRESS' && task.status === 'PENDING') {
            setTaskToDescribe(task); // Show description dialog when starting
            return; // Will be handled by the dialog save function
        }

        const taskDocRef = doc(db, 'mechanic_tasks', taskId);
        let updateData: Partial<MechanicTask> = { status: newStatus };

        if (newStatus === 'COMPLETED') {
            updateData.completedAt = new Date().getTime();
        }
        
        if (task.status === 'DELAYED' && newStatus === 'IN_PROGRESS') {
             const lastDelay = task.riwayatTunda?.[task.riwayatTunda.length - 1];
             if (lastDelay && !lastDelay.waktuSelesai) {
                 const updatedRiwayat = [...(task.riwayatTunda || [])];
                 updatedRiwayat[updatedRiwayat.length - 1] = { ...lastDelay, waktuSelesai: new Date() };
                 updateData.riwayatTunda = updatedRiwayat;
             }
        }

        try {
            await updateDoc(taskDocRef, updateData);
            // State update will be handled by the onSnapshot listener
            toast({ title: 'Status Tugas Diperbarui' });
        } catch (error) {
            toast({ title: 'Gagal Memperbarui Status', variant: 'destructive' });
        }
    };

    const handleConfirmDelay = async () => {
        if (!taskToDelay || !delayReason) {
            toast({ title: 'Alasan harus diisi.', variant: 'destructive' });
            return;
        }

        const taskDocRef = doc(db, 'mechanic_tasks', taskToDelay.id);
        const newRiwayat = [...(taskToDelay.riwayatTunda || []), { alasan: delayReason, waktuMulai: new Date(), waktuSelesai: null as any }];
        const updateData: Partial<MechanicTask> = {
            status: 'DELAYED',
            riwayatTunda: newRiwayat,
        };

        try {
            await updateDoc(taskDocRef, updateData);
            toast({ title: 'Tugas Ditunda' });
            setIsDelayDialogOpen(false);
            setDelayReason('');
            setTaskToDelay(null);
        } catch (error) {
            toast({ title: 'Gagal Menunda Tugas', variant: 'destructive' });
        }
    };

    const handleSaveDescription = async (taskId: string, description: string) => {
        if (!taskId) { // Handle cancel from dialog
            setTaskToDescribe(null);
            return;
        }
        const taskDocRef = doc(db, 'mechanic_tasks', taskId);
        try {
            const updateData: Partial<MechanicTask> = { 
                mechanicRepairDescription: description,
                status: 'IN_PROGRESS',
            };
            if (!mechanicTasks.find(t => t.id === taskId)?.startedAt) {
                 updateData.startedAt = new Date().getTime();
            }

            await updateDoc(taskDocRef, updateData);
            toast({ title: 'Deskripsi Disimpan & Tugas Dimulai' });
            setTaskToDescribe(null);
        } catch (error) {
            toast({ title: 'Gagal Menyimpan Deskripsi', variant: 'destructive' });
            console.error("Error saving description: ", error);
        }
    };

  const handleMenuClick = (menuName: ActiveMenu) => {
    if (menuName === 'Pesan Masuk') {
      setHasNewMessage(false);
    }
    setActiveMenu(menuName);
  };
  
  const damagedVehicleReports = useMemo(() => {
    return alat
      .map(vehicle => {
        const latestReport = getLatestReport(vehicle.id, reports);
        if (latestReport && (latestReport.overallStatus === 'rusak' || latestReport.overallStatus === 'perlu perhatian')) {
          const hasActiveTask = mechanicTasks.some(
            (task) => task.vehicle?.triggeringReportId === latestReport.id && task.status !== 'COMPLETED'
          );
          if (!hasActiveTask) {
            return latestReport;
          }
        }
        return null;
      })
      .filter((r): r is Report => r !== null)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [alat, reports, mechanicTasks]);

  
  const renderContent = () => {
    switch (activeMenu) {
        case 'Dashboard':
          return (
            <Card>
              <CardHeader>
                <CardTitle>Alat Rusak Hari Ini</CardTitle>
                <CardDescription>
                  Daftar semua alat yang dilaporkan rusak atau perlu perhatian oleh operator dan belum dibuatkan WO.
                  {userInfo?.lokasi && ` Menampilkan laporan untuk lokasi: ${userInfo.lokasi}.`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Waktu Laporan</TableHead>
                        <TableHead>Kendaraan</TableHead>
                        <TableHead>Pelapor</TableHead>
                        <TableHead>Deskripsi Kerusakan</TableHead>
                        <TableHead>Foto</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                       {isFetchingData ? <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow> 
                                    : damagedVehicleReports.length > 0 ? (damagedVehicleReports
                                        .map(report => {
                                        const vehicle = alat.find(a => a.nomorLambung === report.vehicleId);
                                        const photos = Array.isArray(report.photo) ? report.photo : (report.photo ? [report.photo] : []);
                                        const date = report.timestamp ? new Date(report.timestamp) : null;
                                        
                                        return (
                                            <TableRow key={report.id}>
                                                <TableCell>{date ? format(date, 'dd MMM, HH:mm') : 'N/A'}</TableCell>
                                                <TableCell>{report.vehicleId}</TableCell>
                                                <TableCell>{report.operatorName}</TableCell>
                                                <TableCell className="max-w-xs truncate">{report.description}</TableCell>
                                                <TableCell>
                                                  {photos.length > 0 && (
                                                    <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon"><Camera/></Button></DialogTrigger>
                                                      <DialogContent className="max-w-4xl">
                                                        <DialogHeader><DialogTitle>Foto Kerusakan: {report.vehicleId}</DialogTitle></DialogHeader>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                                                          {photos.map((p, i) => <img key={i} src={p} alt={`Damage photo ${i+1}`} className="rounded-md" data-ai-hint="machine damage" />)}
                                                        </div>
                                                      </DialogContent>
                                                    </Dialog>
                                                  )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {vehicle ? (<CreateWorkOrderDialog vehicle={vehicle} report={report} mechanics={users} onTaskCreated={(newTask: any) => setMechanicTasks(prev => [newTask, ...prev])}/>) : (<Badge variant="destructive">Alat Tidak Ditemukan</Badge>)}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })) : <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Tidak ada laporan kerusakan baru.</TableCell></TableRow>}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )
        case 'Manajemen Work Order':
          return (
             <Card>
                  <CardHeader>
                      <CardTitle>Daftar Work Order Aktif</CardTitle>
                      <CardDescription>Pekerjaan yang sedang ditangani atau menunggu untuk ditangani oleh tim mekanik.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="overflow-x-auto border rounded-lg">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>Kendaraan</TableHead>
                                      <TableHead>Deskripsi</TableHead>
                                      <TableHead>Mekanik</TableHead>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Target</TableHead>
                                      <TableHead className="text-right">Aksi</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {isFetchingData ? <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                                      : mechanicTasks.filter(t => t.status !== 'COMPLETED').length > 0 ? (mechanicTasks.filter(t => t.status !== 'COMPLETED').map(task => (
                                          <TableRow key={task.id}>
                                              <TableCell className="font-semibold">{task.vehicle.hullNumber}</TableCell>
                                              <TableCell className="max-w-[200px] truncate">{task.mechanicRepairDescription || task.vehicle.repairDescription}</TableCell>
                                              <TableCell>{task.mechanics.map(m => m.name).join(', ')}</TableCell>
                                              <TableCell><Badge variant={task.status === 'PENDING' ? 'secondary' : task.status === 'DELAYED' ? 'destructive' : 'default'}>{task.status}</Badge></TableCell>
                                              <TableCell>{format(new Date(task.vehicle.targetDate), 'dd MMM')} @ {task.vehicle.targetTime}</TableCell>
                                              <TableCell className="text-right">
                                                  <DropdownMenu>
                                                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                      <DropdownMenuContent align="end">
                                                          {task.status === 'PENDING' && <DropdownMenuItem onSelect={() => handleTaskStatusChange(task.id, 'IN_PROGRESS')}>Mulai Perbaikan</DropdownMenuItem>}
                                                          {task.status === 'IN_PROGRESS' && <DropdownMenuItem onSelect={() => handleTaskStatusChange(task.id, 'DELAYED')}>Tunda Perbaikan</DropdownMenuItem>}
                                                          {task.status === 'DELAYED' && <DropdownMenuItem onSelect={() => handleTaskStatusChange(task.id, 'IN_PROGRESS')}>Lanjutkan Perbaikan</DropdownMenuItem>}
                                                          {task.status !== 'PENDING' && <DropdownMenuItem onSelect={() => handleTaskStatusChange(task.id, 'COMPLETED')}>Selesaikan Perbaikan</DropdownMenuItem>}
                                                          <DropdownMenuSeparator />
                                                          <DropdownMenuItem onSelect={() => setTaskToDescribe(task)}>Edit Deskripsi</DropdownMenuItem>
                                                      </DropdownMenuContent>
                                                  </DropdownMenu>
                                              </TableCell>
                                          </TableRow>
                                      ))) : (<TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Tidak ada work order yang aktif.</TableCell></TableRow>)}
                              </TableBody>
                          </Table>
                      </div>
                  </CardContent>
              </Card>
          );
        case 'Anggota Mekanik': {
          const mekanikUsers = users.filter(u => u.jabatan?.toUpperCase().includes("MEKANIK") && u.lokasi === userInfo?.lokasi);
          return (
            <Card>
              <CardHeader>
                <CardTitle>Daftar Anggota Tim Mekanik</CardTitle>
                <CardDescription>Berikut adalah daftar mekanik yang terdaftar di lokasi Anda ({userInfo?.lokasi}).</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Lengkap</TableHead>
                        <TableHead>NIK</TableHead>
                        <TableHead>Tugas Aktif</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isFetchingData ? (
                        <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                      ) : mekanikUsers.length > 0 ? (
                        mekanikUsers.map(mekanik => {
                          const activeTaskCount = mechanicTasks.filter(t => t.mechanics.some(m => m.id === mekanik.id) && t.status !== 'COMPLETED').length;
                          return (
                            <TableRow key={mekanik.id}>
                              <TableCell className="font-medium">{mekanik.username}</TableCell>
                              <TableCell>{mekanik.nik}</TableCell>
                              <TableCell>{activeTaskCount} Tugas</TableCell>
                              <TableCell>
                                {activeTaskCount > 0 ? <Badge>Sedang Bertugas</Badge> : <Badge variant="secondary">Standby</Badge>}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Tidak ada mekanik yang terdaftar di lokasi ini.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        }
        case 'Histori Perbaikan Alat':
             return <HistoriContent user={userInfo} mechanicTasks={mechanicTasks} users={users} alat={alat} allReports={reports} />;
        case 'Pesan Masuk':
            const unreadReports = reports.filter(r => r.overallStatus === 'rusak' && !mechanicTasks.some(t => t.vehicle?.triggeringReportId === r.id))
                                       .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return (
              <Card>
                <CardHeader>
                  <CardTitle>Pesan Masuk (Laporan Kerusakan)</CardTitle>
                  <CardDescription>
                    Laporan kerusakan baru dari sopir/operator akan muncul di sini.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isFetchingData ? (
                    <div className="flex justify-center items-center h-40">
                      <Loader2 className="animate-spin h-8 w-8 text-primary" />
                    </div>
                  ) : unreadReports.length > 0 ? (
                    unreadReports.map(report => (
                      <div key={report.id} className="border p-4 rounded-lg bg-muted/30">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold">{report.vehicleId}</p>
                            <p className="text-sm text-muted-foreground">
                              Dilaporkan oleh: {report.operatorName}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatRelative(new Date(report.timestamp), new Date(), { locale: localeID })}
                          </p>
                        </div>
                        <p className="mt-2 text-sm italic">"{report.description}"</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      Tidak ada pesan baru.
                    </div>
                  )}
                </CardContent>
              </Card>
            );
        default:
            return <Card><CardContent className="p-10 text-center"><h2 className="text-xl font-semibold text-muted-foreground">Fitur Dalam Pengembangan</h2><p>Halaman untuk {activeMenu} akan segera tersedia.</p></CardContent></Card>
    }
  }

  if (isLoading || !userInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
    <audio ref={audioRef} src="/sounds/notification.mp3" preload="auto" />
    <EditDescriptionDialog 
        task={taskToDescribe}
        onSave={handleSaveDescription}
    />
    <AlertDialog open={isDelayDialogOpen} onOpenChange={setIsDelayDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Tunda Pekerjaan</AlertDialogTitle>
                <AlertDialogDescription>Masukkan alasan mengapa pekerjaan untuk <strong>{taskToDelay?.vehicle.hullNumber}</strong> ditunda. Ini akan menjeda penghitungan waktu kerja efektif.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
                <Textarea 
                    placeholder="Contoh: Menunggu spare part, istirahat, dll." 
                    value={delayReason} 
                    onChange={(e) => setDelayReason(e.target.value)} 
                />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDelayReason('')}>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelay}>Simpan & Tunda</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    <Dialog open={isDetailListOpen} onOpenChange={setIsDetailListOpen}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Detail: {detailListTitle}</DialogTitle>
                <DialogDescription>
                    Berikut adalah daftar alat yang termasuk dalam kategori ini di lokasi Anda.
                </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto mt-4 pr-2">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>No. Polisi</TableHead>
                            <TableHead>No. Lambung</TableHead>
                            <TableHead>Sopir (Batangan)</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {detailListData.length > 0 ? (
                            detailListData.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.nomorPolisi}</TableCell>
                                    <TableCell>{item.nomorLambung}</TableCell>
                                    <TableCell>{item.operatorPelapor}</TableCell>
                                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">
                                    Tidak ada alat dalam kategori ini.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <DialogFooter className="mt-4">
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Tutup</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
        <AlertDialog open={isQuarantineConfirmOpen} onOpenChange={setIsQuarantineConfirmOpen}>
         <AlertDialogContent>
             <AlertDialogHeader>
                 <AlertDialogTitle>Konfirmasi Status Karantina</AlertDialogTitle>
                 <AlertDialogDescription>
                    Anda yakin ingin {quarantineTarget?.statusKarantina ? 'mengeluarkan' : 'memasukkan'} kendaraan <strong>{quarantineTarget?.nomorLambung}</strong> {quarantineTarget?.statusKarantina ? 'dari' : 'ke dalam'} karantina?
                 </AlertDialogDescription>
             </AlertDialogHeader>
             <AlertDialogFooter>
                 <AlertDialogCancel>Batal</AlertDialogCancel>
                 <AlertDialogAction>
                     Ya, Konfirmasi
                 </AlertDialogAction>
             </AlertDialogFooter>
         </AlertDialogContent>
     </AlertDialog>


    <SidebarProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar>
          <SidebarContent className="flex flex-col">
            <SidebarHeader>
              <h2 className="text-lg font-semibold text-primary px-2">Kepala Mekanik</h2>
            </SidebarHeader>
            <SidebarMenu className="flex-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                        isActive={activeMenu === item.name}
                        onClick={() => setActiveMenu(item.name as ActiveMenu)}
                        className="h-9"
                    >
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm">{item.name}</span>
                    </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
                <SidebarSeparator className="my-2" />
                {secondaryMenuItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                    <Link href={item.href} passHref>
                        <SidebarMenuButton className="h-9 relative" onClick={() => handleMenuClick(item.name as ActiveMenu)}>
                               <item.icon className="h-4 w-4" />
                             <span className="text-sm">{item.name}</span>
                               {item.name === 'Pesan Masuk' && hasNewMessage && (
                                 <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-destructive animate-pulse"></span>
                               )}
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                ))}
            </SidebarMenu>
            <SidebarFooter>
                <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-muted-foreground">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                </Button>
            </SidebarFooter>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <div className="flex-1 p-6 lg:p-10">
            <header className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-4">
                    <SidebarTrigger/>
                    <div>
                          <h1 className="text-3xl font-bold text-foreground">
                             {activeMenu}
                          </h1>
                          <p className="text-sm text-muted-foreground flex items-center gap-4">
                               <span>{userInfo.username}</span>
                               <span className='flex items-center gap-1.5'><Fingerprint size={12}/>{userInfo.nik}</span>
                               <span className='flex items-center gap-1.5'><Briefcase size={12}/>{userInfo.jabatan}</span>
                               <span>Lokasi: {userInfo.lokasi}</span>
                          </p>
                    </div>
                </div>
            </header>
            
            {renderContent()}

          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
    </>
  );
}