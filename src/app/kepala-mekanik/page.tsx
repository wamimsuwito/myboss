
"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { UserData, Report, AlatData, MechanicTask, SopirBatanganData, LocationData } from '@/lib/types';
import { cn, printElement } from '@/lib/utils';
import { db, collection, doc, updateDoc, onSnapshot, addDoc, query, where, Timestamp, deleteDoc, getDocs } from '@/lib/firebase';
import { format, subDays, startOfDay, endOfDay, isAfter, isBefore, isSameDay, formatDistanceStrict, differenceInMinutes } from "date-fns";
import { id as localeID } from 'date-fns/locale';
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  History,
  Users,
  LogOut,
  Wrench,
  Loader2,
  CalendarIcon,
  PlusCircle,
  Copy,
  CheckCircle,
  AlertTriangle,
  WrenchIcon,
  UserX,
  Pencil,
  Save,
  ShieldAlert,
  ShieldX,
  Star,
  FileText,
  ClipboardCheck,
  Mail,
  Fingerprint,
  Briefcase,
  Printer,
  FilterX,
  Camera,
  ArrowRightLeft,
  Trash2,
  MessageSquareWarning,
  Lightbulb,
  Inbox,
  Truck,
  Eye,
  Play,
  Pause,
  Check,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateRange } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Sidebar, SidebarProvider, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarInset, SidebarTrigger, SidebarSeparator } from '@/components/ui/sidebar';
import HistoryPrintLayout from "@/components/history-print-layout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";


type ActiveMenu = 
  | 'Dashboard' 
  | 'Manajemen Work Order'
  | 'Histori Perbaikan Alat' 
  | 'Anggota Mekanik'
  | 'Alat Rusak Berat/Karantina'
  | 'Laporan Logistik'
  | 'Manajemen Pengguna'
  | 'Riwayat Penalti'
  | 'Komplain dari Sopir'
  | 'Usulan / Saran dari Sopir'
  | 'Pesan Masuk'
  | 'Absensi'
  | 'Kegiatan'
  | 'Riwayat Kegiatan';

const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Manajemen Work Order', icon: ClipboardList },
    { name: 'Histori Perbaikan Alat', icon: History },
    { name: 'Anggota Mekanik', icon: Users },
    { name: 'Sopir & Batangan', icon: Truck },
    { name: 'Alat Rusak Berat/Karantina', icon: ShieldAlert }
];

const secondaryMenuItems = [
    { name: 'Absensi', icon: ClipboardCheck, href: '/kepala-mekanik/absensi' },
    { name: 'Kegiatan', icon: FileText, href: '/kepala-mekanik/kegiatan' },
    { name: 'Riwayat Kegiatan', icon: History, href: '/kepala-mekanik/riwayat-kegiatan' },
    { name: 'Riwayat Penalti', icon: ShieldX, href: '/riwayat-saya?type=penalty' },
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

const CreateWorkOrderDialog = ({ vehicle, report, mechanics, onTaskCreated }: { vehicle: AlatData, report: Report, mechanics: UserData[], onTaskCreated: () => void }) => {
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
            await addDoc(collection(db, 'mechanic_tasks'), newTaskData);
            toast({ title: "Work Order Berhasil Dibuat" });
            form.reset();
            onTaskCreated();
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
    
    const totalDelayDuration = task.totalDelayDuration || 0;
    const diffMinutesWithDelay = differenceInMinutes(completedDateTime, targetDateTime) - (totalDelayDuration / 60000);

    
    const diffAbs = Math.abs(diffMinutesWithDelay);
    const hours = Math.floor(diffAbs / 60);
    const minutes = Math.round(diffAbs % 60);
    
    let timeText = '';
    if (hours > 0) timeText += `${hours}j `;
    if (minutes > 0) timeText += `${minutes}m`;
    if (timeText.trim() === '') timeText = '0m';

    if (diffMinutesWithDelay <= 5) {
        return <Badge className="bg-green-100 text-green-800">Tepat Waktu {diffMinutesWithDelay <= 0 ? `(Lebih Cepat ${timeText})` : ''}</Badge>;
    } else {
        return <Badge variant="destructive">Terlambat ${timeText}</Badge>;
    }
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
                        Tambahkan atau ubah deskripsi perbaikan untuk kendaraan ${`"`}${task?.vehicle.hullNumber}${`"`}.
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

const calculateDelayDetails = (task: MechanicTask) => {
    if (!task.riwayatTunda || task.riwayatTunda.length === 0) {
        return { details: [], total: '-' };
    }

    const details = task.riwayatTunda.map((delay, index) => {
        const duration = delay.waktuSelesai
            ? formatDistanceStrict(new Date(delay.waktuSelesai), new Date(delay.waktuMulai), { locale: localeID })
            : 'berlangsung';
        return {
            text: `Tunda #${index + 1}: ${duration}`,
            reason: delay.alasan,
        };
    });

    const totalMs = task.totalDelayDuration || task.riwayatTunda.reduce((acc, curr) => {
        if (curr.waktuMulai && curr.waktuSelesai) {
            const start = curr.waktuMulai instanceof Date ? curr.waktuMulai.getTime() : new Date(curr.waktuMulai).getTime();
            const end = curr.waktuSelesai instanceof Date ? curr.waktuSelesai.getTime() : new Date(curr.waktuSelesai).getTime();
            return acc + (end - start);
        }
        return acc;
    }, 0);

    const total = totalMs > 0 ? formatDistanceStrict(0, totalMs, { locale: localeID }) : '-';

    return { details, total };
};

const HistoryComponent = ({ user, allTasks, allUsers, allAlat, allReports }: { user: UserData | null, allTasks: MechanicTask[], allUsers: UserData[], allAlat: AlatData[], allReports: Report[] }) => {
    const [tasks, setTasks] = useState<MechanicTask[]>([]);
    const [selectedOperatorId, setSelectedOperatorId] = useState<string>("all");
    const [searchNoPol, setSearchNoPol] = useState('');
    const [date, setDate] = useState<DateRange | undefined>({
      from: subDays(new Date(), 29),
      to: new Date(),
    });

    useEffect(() => {
        setTasks(allTasks.filter(t => t.status === 'COMPLETED'));
    }, [allTasks]);
    
    const sopirOptions = useMemo(() => {
        return allUsers.filter(u => u.jabatan?.toUpperCase().includes('SOPIR') || u.jabatan?.toUpperCase().includes('OPRATOR'))
            .filter(u => user?.lokasi ? u.lokasi === user.lokasi : true)
            .sort((a,b) => a.username.localeCompare(b.username));
    }, [allUsers, user]);

    const filteredTasks = useMemo(() => {
        const fromDate = date?.from ? startOfDay(date.from) : null;
        const toDate = date?.to ? endOfDay(date.to) : null;

        return tasks
        .filter((task) => {
            if (task.status !== 'COMPLETED' || !task.completedAt) return false;
            
            if (user?.lokasi) {
            const taskLocation = allAlat.find(v => v.nomorLambung === task.vehicle?.hullNumber)?.lokasi;
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
        .sort((a, b) => (b.completedAt || 0) - (b.completedAt || 0));
    }, [tasks, date, selectedOperatorId, user, allAlat, allReports, searchNoPol]);
    
    const calculateEffectiveDuration = (task: MechanicTask) => {
      if (!task.startedAt || !task.completedAt) return '-';
      const duration = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime() - (task.totalDelayDuration || 0);
      return formatDistanceStrict(0, Math.max(0, duration), { locale: localeID });
    }
    
    const groupedTasks = useMemo(() => {
        return filteredTasks.reduce((acc, task) => {
            if (!task.completedAt) return acc;
            const dateStr = format(new Date(task.completedAt), 'yyyy-MM-dd');
            if (!acc[dateStr]) {
                acc[dateStr] = [];
            }
            acc[dateStr].push(task);
            return acc;
        }, {} as Record<string, MechanicTask[]>);
    }, [filteredTasks]);

    return (
      <>
        <div className='hidden'>
            <div id="history-print-area">
                <HistoryPrintLayout data={filteredTasks} allReports={allReports} users={allUsers} location={user?.lokasi} />
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
             <Accordion type="single" collapsible className="w-full">
               {Object.keys(groupedTasks).length > 0 ? (
                Object.entries(groupedTasks).map(([dateStr, tasksOnDate]) => (
                    <AccordionItem value={dateStr} key={dateStr}>
                        <AccordionTrigger>
                            <div className="flex justify-between w-full pr-4">
                                <span className="font-semibold text-base">{format(new Date(dateStr), 'EEEE, dd MMMM yyyy', { locale: localeID })}</span>
                                <Badge variant="secondary">{tasksOnDate.length} Pekerjaan</Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                           <div className="border rounded-md overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                      <TableHead>Waktu Lapor</TableHead>
                                      <TableHead>Kendaraan</TableHead>
                                      <TableHead>Deskripsi</TableHead>
                                      <TableHead>Foto</TableHead>
                                      <TableHead>Mekanik</TableHead>
                                      <TableHead>Target</TableHead>
                                      <TableHead>Tunda</TableHead>
                                      <TableHead>Waktu Efektif</TableHead>
                                      <TableHead>Penyelesaian</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tasksOnDate.map((task) => {
                                        const triggeringReport = allReports.find(r => r.id === task.vehicle?.triggeringReportId);
                                        const reportDate = triggeringReport?.timestamp ? new Date(triggeringReport.timestamp) : null;
                                        const sopir = allUsers.find(u => u.id === triggeringReport?.operatorId);
                                        const { details: delayDetails, total: totalDelay } = calculateDelayDetails(task);
                                        const photos = Array.isArray(triggeringReport?.photo) ? triggeringReport?.photo : (triggeringReport?.photo ? [triggeringReport.photo] : []);
                                        
                                        return (
                                        <TableRow key={task.id}>
                                            <TableCell>{reportDate ? format(reportDate, 'dd MMM, HH:mm') : '-'}</TableCell>
                                            <TableCell>
                                                <p className="font-semibold">{task.vehicle.licensePlate} ({task.vehicle.hullNumber})</p>
                                                <p className="text-xs text-muted-foreground">{sopir?.username || 'N/A'}</p>
                                            </TableCell>
                                            <TableCell className="whitespace-pre-wrap max-w-[200px]">{task.mechanicRepairDescription || triggeringReport?.description}</TableCell>
                                            <TableCell>
                                                {photos.length > 0 && (
                                                    <Dialog><DialogTrigger asChild><Button variant="ghost" size="icon"><Eye/></Button></DialogTrigger>
                                                        <DialogContent className="max-w-4xl">
                                                            <DialogHeader><DialogTitle>Foto Kerusakan: {task.vehicle.hullNumber}</DialogTitle></DialogHeader>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                                                                {photos.map((p, i) => <img key={i} src={p} alt={`Damage photo ${i + 1}`} className="rounded-md" data-ai-hint="machine damage" />)}
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>
                                                )}
                                            </TableCell>
                                            <TableCell>{task.mechanics.map(m => m.name).join(', ')}</TableCell>
                                            <TableCell>
                                                <div className="text-xs space-y-1">
                                                   {task.startedAt && <p><b>Mulai:</b> {format(new Date(task.startedAt), 'dd/MM HH:mm')}</p>}
                                                   <p><b>Target:</b> {format(new Date(`${task.vehicle.targetDate}T${task.vehicle.targetTime}`), 'dd/MM HH:mm')}</p>
                                                   {task.completedAt && <p><b>Realisasi:</b> {format(new Date(task.completedAt), 'dd/MM HH:mm')}</p>}
                                                </div>
                                            </TableCell>
                                             <TableCell>
                                                {delayDetails.length > 0 && (
                                                    <div className="flex flex-col">
                                                        <ol className="text-xs space-y-1 list-decimal list-inside">
                                                        {delayDetails.map((delay, index) => (
                                                            <li key={index} title={delay.reason}>
                                                            {delay.text} <span className="italic text-muted-foreground">({delay.reason})</span>
                                                            </li>
                                                        ))}
                                                        </ol>
                                                        {task.status === 'COMPLETED' && totalDelay !== '-' && (
                                                            <p className="font-bold border-t mt-1 pt-1 text-xs">
                                                                Total: {totalDelay}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>{calculateEffectiveDuration(task)}</TableCell>
                                            <TableCell><CompletionStatusBadge task={task} /></TableCell>
                                        </TableRow>
                                        )
                                    })}
                                </TableBody>
                              </Table>
                           </div>
                        </AccordionContent>
                    </AccordionItem>
                ))
               ) : (
                <div className="text-center text-muted-foreground py-10">Tidak ada riwayat perbaikan ditemukan untuk filter yang dipilih.</div>
               )}
            </Accordion>
          </CardContent>
        </Card>
      </>
    );
}

export default function KepalaMekanikPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('Dashboard');
  const [userInfo, setUserInfo] = useState<UserData | null>(null);
  
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [alat, setAlat] = useState<AlatData[]>([]);
  const [users, setAllUsers] = useState<UserData[]>([]);
  const [allReports, setReports] = useState<Report[]>([]);
  const [mechanicTasks, setMechanicTasks] = useState<MechanicTask[]>([]);
  const [pairings, setPairings] = useState<SopirBatanganData[]>([]);
  const [isFetchingPairings, setIsFetchingPairings] = useState(true);
  
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
  const [isQuarantineConfirmOpen, setIsQuarantineConfirmOpen] = useState(false);
  const [quarantineTarget, setQuarantineTarget] = useState<AlatData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Notification state
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const isInitialLoad = useRef(true);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [isMutasiDialogOpen, setIsMutasiDialogOpen] = useState(false);
  const [mutasiTarget, setMutasiTarget] = useState<AlatData | null>(null);
  const [newLocationForMutasi, setNewLocationForMutasi] = useState('');
  const [isMutating, setIsMutating] = useState(false);
  const [seenDamagedReports, setSeenDamagedReports] = useState<Set<string>>(new Set());
  
  const dataTransformer = useCallback((docData: any) => {
    if (Array.isArray(docData)) {
        return docData.map(item => dataTransformer(item));
    }

    const transformedData = { ...docData };
  
    const timestampFieldsToMillis = ['createdAt', 'startedAt', 'completedAt'];
    timestampFieldsToMillis.forEach(field => {
        if (transformedData[field] && typeof transformedData[field].toDate === 'function') {
          transformedData[field] = transformedData[field].toDate().getTime();
        }
    });

    const timestampFieldsToDate = ['timestamp'];
    timestampFieldsToDate.forEach(field => {
        if (transformedData[field] && typeof transformedData[field].toDate === 'function') {
          transformedData[field] = transformedData[field].toDate();
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

    const damagedVehicleReports = useMemo(() => {
        return allReports
            .filter(report => {
                if (report.overallStatus !== 'rusak' && report.overallStatus !== 'perlu perhatian') {
                    return false;
                }
                const hasOpenWO = mechanicTasks.some(task => task.vehicle.triggeringReportId === report.id);
                if (hasOpenWO) {
                    return false;
                }
                const hasBeenFixed = allReports.some(fixReport =>
                    fixReport.vehicleId === report.vehicleId &&
                    fixReport.overallStatus === 'baik' &&
                    isAfter(new Date(fixReport.timestamp), new Date(report.timestamp))
                );
                if (hasBeenFixed) {
                    return false;
                }
                const vehicle = alat.find(a => a.nomorLambung === report.vehicleId);
                return !!vehicle && (!userInfo?.lokasi || vehicle.lokasi === userInfo.lokasi);
            })
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }, [allReports, mechanicTasks, alat, userInfo?.lokasi]);
    

    const activeTasks = useMemo(() => {
        return mechanicTasks
            .filter(task => {
                const vehicle = alat.find(a => a.nomorLambung === task.vehicle?.hullNumber);
                if (!vehicle || (userInfo?.lokasi && vehicle.lokasi !== userInfo.lokasi)) {
                    return false;
                }
    
                if (task.status === 'COMPLETED') {
                    // Only show if completed today
                    return task.completedAt ? isSameDay(new Date(task.completedAt), new Date()) : false;
                }
                return true; // Show all other statuses (PENDING, IN_PROGRESS, DELAYED)
            })
            .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    }, [mechanicTasks, alat, userInfo?.lokasi]);
    
 const statsData = useMemo(() => {
    const defaultStats = { count: '0', list: [] };
    if (isFetchingData || !userInfo?.lokasi) {
        return { totalAlat: defaultStats, sudahChecklist: defaultStats, belumChecklist: defaultStats, alatBaik: defaultStats, perluPerhatian: defaultStats, alatRusak: defaultStats, alatRusakBerat: defaultStats, alatTdkAdaOperator: defaultStats };
    }
    const alatInLocation = alat.filter(a => a.lokasi === userInfo.lokasi);
    const existingAlatIds = new Set(alatInLocation.map(a => a.nomorLambung));

    const validReports = allReports.filter(r => r.vehicleId && existingAlatIds.has(r.vehicleId));

    const reportsToday = validReports.filter(r => r.timestamp && isSameDay(new Date(r.timestamp), new Date()));
    const checkedVehicleIdsToday = new Set(reportsToday.map(r => r.vehicleId));
    
    const getLatestReportForAlat = (vehicleId: string) => {
        return validReports
            .filter(r => r.vehicleId === vehicleId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    };
    const mapToDetailFormat = (items: AlatData[], statusSource: 'latest' | 'belum') => {
      return items.map(item => {
        const report = getLatestReportForAlat(item.nomorLambung);
        const reporter = users.find(u => u.id === report?.operatorId);
        
        let status: Report['overallStatus'] | 'Belum Checklist' = 'Belum Checklist';
        if (statusSource === 'latest' && report) {
            status = report.overallStatus;
        }

        return { 
            id: item.id, 
            nomorPolisi: item.nomorPolisi || 'N/A', 
            nomorLambung: item.nomorLambung, 
            operatorPelapor: reporter?.username || 'Belum Ada Laporan',
            status: status
        };
      });
    };
    const mapToDetailFormatSpecial = (items: AlatData[], status: 'Karantina' | 'Tanpa Operator') => {
        return items.map(item => {
            const pairing = pairings.find(p => p.nomorLambung === item.nomorLambung);
            return {
                id: item.id,
                nomorPolisi: item.nomorPolisi || 'N/A',
                nomorLambung: item.nomorLambung,
                operatorPelapor: pairing?.namaSopir || 'Belum Ada Sopir',
                status: status,
            };
        });
    };

    const alatNonKarantina = alatInLocation.filter(a => !a.statusKarantina);
    const alatDenganSopir = alatNonKarantina.filter(a => pairings.some(p => p.nomorLambung === a.nomorLambung));
    const alatBelumChecklistList = alatDenganSopir.filter(a => !checkedVehicleIdsToday.has(a.nomorLambung));
    
    const alatBaikList = alatInLocation.filter(a => getLatestReportForAlat(a.nomorLambung)?.overallStatus === 'baik');
    const perluPerhatianList = alatInLocation.filter(a => getLatestReportForAlat(a.nomorLambung)?.overallStatus === 'perlu perhatian');
    const alatRusakList = alatInLocation.filter(a => getLatestReportForAlat(a.nomorLambung)?.overallStatus === 'rusak');

    const alatRusakBeratList = alatInLocation.filter(a => a.statusKarantina === true);
    const alatTdkAdaOperatorList = alatNonKarantina.filter(a => !pairings.some(p => p.nomorLambung === a.nomorLambung) && !a.statusKarantina);


    return {
      totalAlat: { count: String(alatInLocation.length), list: mapToDetailFormat(alatInLocation, 'latest') },
      sudahChecklist: { count: String(checkedVehicleIdsToday.size), list: mapToDetailFormat(alatInLocation.filter(a => checkedVehicleIdsToday.has(a.nomorLambung)), 'latest') },
      belumChecklist: { count: String(alatBelumChecklistList.length), list: mapToDetailFormat(alatBelumChecklistList, 'belum') },
      alatBaik: { count: String(alatBaikList.length), list: mapToDetailFormat(alatBaikList, 'latest') },
      perluPerhatian: { count: String(perluPerhatianList.length), list: mapToDetailFormat(perluPerhatianList, 'latest') },
      alatRusak: { count: String(alatRusakList.length), list: mapToDetailFormat(alatRusakList, 'latest') },
      alatRusakBerat: { count: String(alatRusakBeratList.length), list: mapToDetailFormatSpecial(alatRusakBeratList, 'Karantina') },
      alatTdkAdaOperator: { count: String(alatTdkAdaOperatorList.length), list: mapToDetailFormatSpecial(alatTdkAdaOperatorList, 'Tanpa Operator') },
    };
}, [alat, users, allReports, userInfo?.lokasi, isFetchingData, pairings]);
  
  const statCards = useMemo(() => {
    return [
      { title: 'Total Alat', value: statsData.totalAlat.count, description: 'Total alat di lokasi Anda', icon: Copy, color: 'text-blue-400' },
      { title: 'Alat Sudah Checklist', value: statsData.sudahChecklist.count, description: 'Alat yang sudah dicek hari ini', icon: CheckCircle, color: 'text-green-400' },
      { title: 'Alat Belum Checklist', value: statsData.belumChecklist.count, description: 'Alat (dengan sopir) yang belum dicek', icon: AlertTriangle, color: 'text-yellow-400' },
      { title: 'Alat Baik', value: statsData.alatBaik.count, description: 'Status terakhir "Baik"', icon: CheckCircle, color: 'text-green-400' },
      { title: 'Perlu Perhatian', value: statsData.perluPerhatian.count, description: "Status terakhir 'Perlu Perhatian'", icon: AlertTriangle, color: 'text-yellow-400' },
      { title: 'Alat Rusak', value: statsData.alatRusak.count, description: "Status terakhir 'Rusak'", icon: WrenchIcon, color: 'text-red-400' },
      { title: 'Alat Rusak Berat', value: statsData.alatRusakBerat.count, description: 'Alat yang dikarantina', icon: ShieldAlert, color: 'text-destructive' },
      { title: 'Alat Tdk Ada Operator', value: statsData.alatTdkAdaOperator.count, description: 'Alat tanpa sopir/operator', icon: UserX, color: 'text-orange-400' },
    ];
  }, [statsData]);

  useEffect(() => {
    const userString = localStorage.getItem('user');
    if (!userString) {
      router.replace('/login');
      return;
    }
    const userData = JSON.parse(userString);
     if (userData.jabatan.toUpperCase() !== 'KEPALA WORKSHOP') {
      toast({
        variant: 'destructive',
        title: 'Akses Ditolak',
        description: 'Anda tidak memiliki hak untuk mengakses halaman ini.',
      });
      router.replace('/login');
      return;
    }
    setUserInfo(userData);
  }, [router, toast]);
  
    useEffect(() => {
        if (!userInfo) return;
    
        isInitialLoad.current = true;
        const unsubscribers: (() => void)[] = [];
        
        ['users', 'alat', 'locations', 'mechanic_tasks'].forEach(col => {
            let setter: React.Dispatch<React.SetStateAction<any[]>> | null = null;
            if (col === 'users') setter = setAllUsers;
            else if (col === 'alat') setter = setAlat;
            else if (col === 'locations') setter = setLocations;
            else if (col === 'mechanic_tasks') setter = setMechanicTasks;

            if (setter) {
                unsubscribers.push(setupListener(col, setter));
            }
        });
        
        const reportsUnsub = onSnapshot(query(collection(db, 'checklist_reports')), (snapshot) => {
            const data = snapshot.docs.map(d => dataTransformer({ id: d.id, ...d.data() })) as Report[];
            
            if (isInitialLoad.current) {
                const initialDamaged = new Set(data.filter(r => r.overallStatus === 'rusak').map(r => r.id));
                setSeenDamagedReports(initialDamaged);
            } else {
                const newDamagedReports = data.filter(r => r.overallStatus === 'rusak' && !seenDamagedReports.has(r.id));
                if (newDamagedReports.length > 0) {
                    audioRef.current?.play().catch(e => console.error("Audio play failed:", e));
                    setHasNewMessage(true);
                    setSeenDamagedReports(prev => new Set([...Array.from(prev), ...newDamagedReports.map(r => r.id)]));
                }
            }
            setReports(data);
        });
        unsubscribers.push(reportsUnsub);
        
        const pairingUnsub = onSnapshot(query(collection(db, "sopir_batangan")), (snapshot) => {
            const data = snapshot.docs.map(d => dataTransformer({ id: d.id, ...d.data() }));
            setPairings(data);
            setIsFetchingPairings(false);
        }, (error) => {
            console.error(`Error fetching sopir_batangan:`, error);
            toast({ variant: 'destructive', title: `Gagal Memuat sopir_batangan` });
            setIsFetchingPairings(false);
        });
        unsubscribers.push(pairingUnsub);

        const timer = setTimeout(() => {
            setIsFetchingData(false);
            isInitialLoad.current = false;
        }, 2000);
        unsubscribers.push(() => clearTimeout(timer));
    
        return () => unsubscribers.forEach(unsub => unsub());
    }, [userInfo, setupListener, dataTransformer, toast]);

  const handleStatCardClick = (title: string) => {
    if (isFetchingData || !userInfo?.lokasi) return;

    setDetailListTitle(title);
    
    switch (title) {
        case 'Total Alat': setDetailListData(statsData.totalAlat.list); break;
        case 'Alat Sudah Checklist': setDetailListData(statsData.sudahChecklist.list); break;
        case 'Alat Belum Checklist': setDetailListData(statsData.belumChecklist.list); break;
        case 'Alat Baik': setDetailListData(statsData.alatBaik.list); break;
        case 'Perlu Perhatian': setDetailListData(statsData.perluPerhatian.list); break;
        case 'Alat Rusak': setDetailListData(statsData.alatRusak.list); break;
        case 'Alat Rusak Berat': setDetailListData(statsData.alatRusakBerat.list); break;
        case 'Alat Tdk Ada Operator': setDetailListData(statsData.alatTdkAdaOperator.list); break;
        default: toast({ title: `Detail untuk: ${title}`, description: 'Fungsionalitas detail belum tersedia.' }); return;
    }
    
    setIsDetailListOpen(true);
  }

  const handleLogout = () => {
    localStorage.removeItem('user');
    router.push('/login');
  };
  
  const handleAddAlat = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userInfo?.lokasi) {
        toast({ title: 'Lokasi Pengguna Tidak Ditemukan', variant: 'destructive' });
        return;
    }

    setIsSubmitting(true);
    const form = event.currentTarget;
    const formData = new FormData(form);

    const newAlatData: Omit<AlatData, 'id'> = {
      nomorLambung: (formData.get('nomorLambung') as string).toUpperCase(),
      nomorPolisi: (formData.get('nomorPolisi') as string).toUpperCase(),
      jenisKendaraan: (formData.get('jenisKendaraan') as string).toUpperCase(),
      lokasi: userInfo.lokasi,
      statusKarantina: false,
    };

    if (!newAlatData.nomorLambung || !newAlatData.nomorPolisi || !newAlatData.jenisKendaraan) {
        toast({ title: 'Input Tidak Lengkap', variant: 'destructive' });
        setIsSubmitting(false);
        return;
    }

    try {
        await addDoc(collection(db, 'alat'), newAlatData);
        toast({ title: 'Alat Ditambahkan' });
        form.reset();
    } catch(error) {
        toast({ title: 'Error', description: 'Gagal menambahkan alat.', variant: 'destructive'});
    } finally {
        setIsSubmitting(false);
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
    } catch (error) {
        toast({ title: 'Mutasi Gagal', variant: 'destructive' });
    } finally {
        setIsMutating(false);
        setIsMutasiDialogOpen(false);
        setMutasiTarget(null);
        setNewLocationForMutasi('');
    }
  };

  const handleDeleteRequest = (item: AlatData | SopirBatanganData, type: 'alat' | 'pairing') => {
    setItemToDelete(item);
    setDeleteType(type);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || !deleteType) return;
    setIsSubmitting(true);
    try {
        const collectionName = deleteType === 'alat' ? 'alat' : 'sopir_batangan';
        const docRef = doc(db, collectionName, itemToDelete.id);
        await deleteDoc(docRef);
        toast({ title: 'Data Dihapus' });
    } catch (error) {
        toast({ title: 'Gagal Menghapus', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
        setIsDeleteDialogOpen(false);
        setItemToDelete(null);
        setDeleteType(null);
    }
  };

  const handleEditRequest = (alatToEdit: AlatData) => {
    setEditingAlat(alatToEdit);
  };

  const handleConfirmEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingAlat) return;
    setIsEditing(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    
    const updatedAlatData = {
      nomorLambung: (formData.get('editNomorLambung') as string).toUpperCase(),
      nomorPolisi: (formData.get('editNomorPolisi') as string).toUpperCase(),
      jenisKendaraan: (formData.get('editJenisKendaraan') as string).toUpperCase(),
    };
    
    try {
        const alatDocRef = doc(db, 'alat', editingAlat.id);
        await updateDoc(alatDocRef, updatedAlatData);
        toast({ title: 'Alat Diperbarui' });
        setEditingAlat(null);
    } catch (error) {
        toast({ title: 'Error', variant: 'destructive' });
    } finally {
        setIsEditing(false);
    }
  };

  // Sopir & Batangan Handlers
  const handleSavePairing = async () => {
    if (!selectedSopir || !selectedAlat || !userInfo?.lokasi) {
        toast({ title: 'Data Tidak Lengkap', description: 'Pilih sopir dan alat terlebih dahulu.', variant: 'destructive' });
        return;
    }
    setIsSubmitting(true);

    const pairingData: Omit<SopirBatanganData, 'id' | 'timestamp'> = {
        userId: selectedSopir.id,
        namaSopir: selectedSopir.username,
        nik: selectedSopir.nik,
        vehicleId: selectedAlat.id,
        nomorPolisi: selectedAlat.nomorPolisi,
        nomorLambung: selectedAlat.nomorLambung,
        keterangan: keterangan,
        lokasi: userInfo.lokasi,
    };
    
    try {
        if (editingPairing) {
            const pairingDocRef = doc(db, 'sopir_batangan', editingPairing.id);
            await updateDoc(pairingDocRef, pairingData);
            toast({ title: "Pasangan Diperbarui" });
        } else {
            const finalData = { ...pairingData, timestamp: Timestamp.now() };
            await addDoc(collection(db, 'sopir_batangan'), finalData);
            toast({ title: 'Pasangan Disimpan' });
        }
        // Reset form
        setSelectedSopir(null);
        setSelectedAlat(null);
        setKeterangan('');
        setEditingPairing(null);
    } catch (error) {
        toast({ title: 'Gagal Menyimpan', variant: 'destructive' });
        console.error(error);
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleEditPairing = (pairing: SopirBatanganData) => {
    setEditingPairing(pairing);
    setSelectedSopir(sopirOptions.find(s => s.id === pairing.userId) || null);
    setSelectedAlat(alat.find(a => a.id === pairing.vehicleId) || null);
    setKeterangan(pairing.keterangan);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const handleQuarantineRequest = (item: AlatData) => {
      setQuarantineTarget(item);
      setIsQuarantineConfirmOpen(true);
  }

  const handleConfirmQuarantine = async () => {
    if (!quarantineTarget) return;
    setIsSubmitting(true);
    const newStatus = !quarantineTarget.statusKarantina;
    
    try {
        const alatDocRef = doc(db, 'alat', quarantineTarget.id);
        await updateDoc(alatDocRef, { statusKarantina: newStatus });
        
        if (newStatus) { // if the vehicle is being quarantined
            const q = query(collection(db, "sopir_batangan"), where("nomorLambung", "==", quarantineTarget.nomorLambung));
            const pairingSnapshot = await getDocs(q);
            if (!pairingSnapshot.empty) {
                const pairingDoc = pairingSnapshot.docs[0];
                await deleteDoc(doc(db, "sopir_batangan", pairingDoc.id));
                toast({ title: 'Sopir Dilepaskan', description: `Sopir untuk ${quarantineTarget.nomorLambung} telah dilepaskan.` });
            }
             toast({
                title: `Alat Dikarantina`,
                description: `${quarantineTarget.nomorLambung} telah dimasukkan ke karantina.`
            });
        } else { // if the vehicle is being RELEASED from quarantine
            const dummyReport: Omit<Report, 'id' | 'timestamp'> & { timestamp: any } = {
                timestamp: Timestamp.now(),
                vehicleId: quarantineTarget.nomorLambung,
                operatorName: 'SISTEM',
                operatorId: 'SISTEM',
                location: quarantineTarget.lokasi,
                overallStatus: 'rusak',
                description: 'Alat ini baru dilepas dari karantina dan membutuhkan pengecekan serta perbaikan menyeluruh.',
                photo: [],
            };
            await addDoc(collection(db, 'checklist_reports'), dummyReport);
            toast({
                title: `Alat Dilepas dari Karantina`,
                description: `${quarantineTarget.nomorLambung} telah dilepas dan WO baru telah dibuat otomatis.`
            });
        }
    } catch (error) {
        console.error("Error toggling quarantine status:", error);
        toast({ title: 'Gagal Memperbarui Status', variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
        setIsQuarantineConfirmOpen(false);
        setQuarantineTarget(null);
    }
  };

  const renderLaporanLogistik = () => (
    <Card>
      <CardHeader>
        <CardTitle>Laporan Pemakaian Barang</CardTitle>
        <CardDescription>Catat pemakaian spare part untuk setiap perbaikan.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2 space-y-2"><Label>Nama Barang/Spare Part</Label><Input placeholder="cth: Filter Oli" /></div>
            <div className="space-y-2"><Label>Jumlah</Label><Input type="number" placeholder="0" /></div>
            <Button>Simpan Laporan</Button>
        </form>
        <div className="mt-6 text-center text-muted-foreground">
            <p>(Fitur masih dalam pengembangan)</p>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderContent = () => {
    switch (activeMenu) {
        case 'Dashboard':
            return (
              <main>
                 <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-6 mb-8">
                   {isFetchingData ? (
                       Array.from({ length: 8 }).map((_, i) => (
                          <Card key={i}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><Skeleton className="h-5 w-2/4" /><Skeleton className="h-6 w-6 rounded-full" /></CardHeader><CardContent><Skeleton className="h-12 w-1/4 mt-2" /><Skeleton className="h-4 w-3/4 mt-2" /></CardContent></Card>
                       ))
                   ) : statCards.map(card => (<StatCard key={card.title} {...card} onClick={() => handleStatCardClick(card.title)}/>))}
                </div>
              </main>
            );
        case 'Alat Rusak Berat/Karantina':
            return (
                <Card>
                    <CardHeader>
                        <CardTitle>Alat Rusak Berat / Karantina</CardTitle>
                        <CardDescription>Daftar alat yang ditandai sebagai rusak berat atau sedang dalam masa karantina.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="overflow-x-auto border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nomor Lambung</TableHead>
                                        <TableHead>Nomor Polisi</TableHead>
                                        <TableHead>Jenis Kendaraan</TableHead>
                                        <TableHead>Laporan Terakhir</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className='text-right'>Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isFetchingData ? (<TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>) : statsData.alatRusakBerat.list.length > 0 ? (statsData.alatRusakBerat.list.map((item:any) => {
                                        const latestReport = getLatestReport(item.nomorLambung, reports);
                                        return (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.nomorLambung}</TableCell>
                                            <TableCell>{item.nomorPolisi}</TableCell>
                                            <TableCell>{alat.find(a => a.id === item.id)?.jenisKendaraan}</TableCell>
                                            <TableCell>
                                                <p>{latestReport?.description || 'N/A'}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {latestReport?.timestamp ? format(new Date(latestReport.timestamp), 'dd MMM yyyy', {locale: localeID}) : 'N/A'}
                                                </p>
                                            </TableCell>
                                            <TableCell>{getStatusBadge('Karantina')}</TableCell>
                                            <TableCell className='text-right'>
                                                <div className="flex flex-col items-end gap-2">
                                                    <div className="space-y-1">
                                                         <h4 className="font-semibold text-xs text-right">Karantina</h4>
                                                         <Button size="sm" variant="outline" onClick={() => handleQuarantineRequest(alat.find(a => a.id === item.id)!)}>
                                                            Lepas Karantina
                                                        </Button>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )})) : (<TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Tidak ada alat yang dikarantina.</TableCell></TableRow>)}
                                </TableBody>
                            </Table>
                         </div>
                    </CardContent>
                </Card>
            );
        case 'Sopir & Batangan':
            return (
                <main className="space-y-8">
                    <Card><CardHeader><CardTitle className="flex items-center gap-3"><PlusCircle />{editingPairing ? 'Edit' : 'Tambah'} Pasangan Sopir & Batangan</CardTitle><CardDescription>Pasangkan sopir dengan kendaraan yang akan dioperasikan.</CardDescription></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                                <div className="md:col-span-2 space-y-2"><Label>Nama Sopir</Label>
                                    <Select value={selectedSopir?.id || ''} onValueChange={(val) => setSelectedSopir(sopirOptions.find(s => s.id === val) || null)}>
                                        <SelectTrigger><SelectValue placeholder="Pilih Sopir..." /></SelectTrigger>
                                        <SelectContent>{sopirOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.username}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2"><Label>NIK</Label><Input value={selectedSopir?.nik || ''} disabled className="bg-muted" /></div>
                                <div className="space-y-2"><Label>Nomor Polisi</Label>
                                     <Select value={selectedAlat?.id || ''} onValueChange={(val) => setSelectedAlat(alat.find(a => a.id === val) || null)}>
                                        <SelectTrigger><SelectValue placeholder="Pilih Kendaraan..." /></SelectTrigger>
                                        <SelectContent>{filteredAlatByLocation.map(a => <SelectItem key={a.id} value={a.id}>{a.nomorPolisi}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2"><Label>Nomor Lambung</Label><Input value={selectedAlat?.nomorLambung || ''} disabled className="bg-muted" /></div>
                                <div className="md:col-span-3 space-y-2"><Label>Keterangan</Label><Input value={keterangan} onChange={e => setKeterangan(e.target.value)} placeholder="Keterangan (jika ada)..." /></div>
                                <div className="md:col-span-3 flex gap-2">
                                <Button className="w-full" onClick={handleSavePairing} disabled={isSubmitting}><Save className="mr-2" />{editingPairing ? 'Update' : 'Simpan'}</Button>
                                    {editingPairing && <Button className="w-full" variant="outline" onClick={() => { setEditingPairing(null); setSelectedSopir(null); setSelectedAlat(null); setKeterangan(''); }}>Batal</Button>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card><CardHeader><CardTitle>Daftar Sopir & Batangan Aktif</CardTitle></CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto border rounded-lg">
                                <Table><TableHeader><TableRow><TableHead>Nama Sopir</TableHead><TableHead>NIK</TableHead><TableHead>Nomor Polisi</TableHead><TableHead>Nomor Lambung</TableHead><TableHead>Keterangan</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {isFetchingPairings ? (<TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>) : pairings.filter(p => p.lokasi === userInfo?.lokasi).length > 0 ? (pairings.filter(p => p.lokasi === userInfo?.lokasi).map(p => {
                                                const vehicle = alat.find(a => a.id === p.vehicleId);
                                                return (
                                                <TableRow key={p.id}>
                                                    <TableCell>{p.namaSopir}</TableCell>
                                                    <TableCell>{p.nik}</TableCell>
                                                    <TableCell>{p.nomorPolisi}</TableCell>
                                                    <TableCell>{p.nomorLambung}</TableCell>
                                                    <TableCell>{p.keterangan}</TableCell>
                                                    <TableCell className="text-right space-x-1">
                                                        <Button size="icon" variant="ghost" onClick={() => handleEditPairing(p)}><Pencil className="h-4 w-4 text-amber-500" /></Button>
                                                        {vehicle && <Button size="icon" variant="ghost" onClick={() => handleMutasiRequest(vehicle)}><ArrowRightLeft className="h-4 w-4 text-blue-500" /></Button>}
                                                        {vehicle && <Button size="icon" variant="ghost" onClick={() => handleQuarantineRequest(vehicle)}><ShieldAlert className="h-4 w-4 text-destructive" /></Button>}
                                                        <Button size="icon" variant="ghost" onClick={() => handleDeleteRequest(p, 'pairing')}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                    </TableCell>
                                                </TableRow>
                                                )
                                            })) : (<TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Belum ada pasangan sopir & batangan.</TableCell></TableRow>)}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </main>
            );
        case 'Histori Perbaikan Alat':
             return <HistoryComponent user={userInfo} allTasks={mechanicTasks} allUsers={users} alat={alat} allReports={allReports} />;
        case 'Laporan Logistik':
             return renderLaporanLogistik();
        case 'Manajemen Pengguna':
            return (
                <main>
                    <Card>
                        <CardHeader>
                            <CardTitle>Manajemen Pengguna</CardTitle>
                            <CardDescription>Daftar semua pengguna yang terdaftar di lokasi Anda.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto border rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nama</TableHead>
                                            <TableHead>Username</TableHead>
                                            <TableHead>NIK</TableHead>
                                            <TableHead>Jabatan</TableHead>
                                            <TableHead>Lokasi</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isFetchingData ? (
                                            <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></TableCell></TableRow>
                                        ) : usersInLocation.length > 0 ? (
                                            usersInLocation.map(user => (
                                                <TableRow key={user.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-3">
                                                            <Avatar>
                                                                <AvatarFallback>{user.username.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <span className="font-medium">{user.username}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{user.username}</TableCell>
                                                    <TableCell>{user.nik}</TableCell>
                                                    <TableCell>{user.jabatan}</TableCell>
                                                    <TableCell>{user.lokasi}</TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Tidak ada data pengguna.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </main>
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
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
                <AlertDialogDescription>
                    Anda yakin akan menghapus data ini secara permanen? Tindakan ini tidak dapat diurungkan.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmDelete} disabled={isSubmitting} className="bg-destructive hover:bg-destructive/90">
                     {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Ya, Hapus
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
     <Dialog open={isMutasiDialogOpen} onOpenChange={setIsMutasiDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Konfirmasi Mutasi Alat: {mutasiTarget?.nomorLambung}</DialogTitle>
                <DialogDescription>
                    Pindahkan alat dari lokasi <strong>{mutasiTarget?.lokasi}</strong> ke lokasi baru. Pastikan Anda yakin sebelum melanjutkan.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label htmlFor="mutasi-location">Pilih Lokasi Tujuan</Label>
                <Select value={newLocationForMutasi} onValueChange={setNewLocationForMutasi}>
                    <SelectTrigger id="mutasi-location">
                        <SelectValue placeholder="Pilih lokasi..." />
                    </SelectTrigger>
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
     <Dialog open={!!editingAlat} onOpenChange={(isOpen) => !isOpen && setEditingAlat(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Alat</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleConfirmEdit} className="space-y-4 pt-4">
                <div>
                    <Label htmlFor="editNomorLambung">Nomor Lambung</Label>
                    <Input id="editNomorLambung" name="editNomorLambung" defaultValue={editingAlat?.nomorLambung} required style={{ textTransform: 'uppercase' }} />
                </div>
                <div>
                    <Label htmlFor="editNomorPolisi">Nomor Polisi</Label>
                    <Input id="editNomorPolisi" name="editNomorPolisi" defaultValue={editingAlat?.nomorPolisi} required style={{ textTransform: 'uppercase' }} />
                </div>
                 <div>
                    <Label htmlFor="editJenisKendaraan">Jenis Kendaraan</Label>
                    <Input id="editJenisKendaraan" name="editJenisKendaraan" defaultValue={editingAlat?.jenisKendaraan} required style={{ textTransform: 'uppercase' }} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setEditingAlat(null)}>Batal</Button>
                    <Button type="submit" disabled={isEditing}>
                        {isEditing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Simpan Perubahan'}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
    
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
                <AlertDialogAction onClick={handleConfirmQuarantine}>
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
              <h2 className="text-lg font-semibold text-primary px-2">Workshop</h2>
            </SidebarHeader>
            <SidebarMenu className="flex-1">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                        isActive={activeMenu === item.name}
                        onClick={() => setActiveMenu(item.name as ActiveMenu)}
                        className="h-9 relative"
                    >
                        <item.icon className="h-4 w-4" />
                        <span className="text-sm">{item.name}</span>
                         {item.name === 'Pesan Masuk' && hasNewMessage && (
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-destructive animate-pulse"></span>
                         )}
                    </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            <SidebarFooter className="p-2 space-y-2">
                 <div className="text-center p-4 border rounded-lg">
                    <h3 className="font-bold text-lg">Logo PT Farika Riau Perkasa</h3>
                 </div>
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
            </header>
            
            {renderContent()}

          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
    </>
  );
}
