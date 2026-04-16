import { useState } from "react";
import { motion } from "framer-motion";
import { format, getDaysInMonth, startOfMonth, getDay, subMonths, addMonths } from "date-fns";
import {
  useListEmployees, useListAttendance, useMarkAttendance, useGetAttendanceSummary,
  getListAttendanceQueryKey, getGetAttendanceSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, Clock, MapPin } from "lucide-react";

const statusColors: Record<string, string> = {
  present: "bg-emerald-500",
  absent: "bg-red-500",
  half_day: "bg-amber-400",
};
const statusBadge: Record<string, string> = {
  present: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  absent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  half_day: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function AttendancePage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [markMode, setMarkMode] = useState(false);
  const [markingStatus, setMarkingStatus] = useState<Record<number, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const { data: employees } = useListEmployees();
  const { data: attendance, isLoading: attLoading } = useListAttendance({ month, year });
  const { data: summary } = useGetAttendanceSummary(
    { month, year },
    { query: { queryKey: getGetAttendanceSummaryQueryKey({ month, year }) } }
  );
  const markAttendance = useMarkAttendance();

  const todayAttendance = (attendance ?? []).filter(a => a.date === selectedDate);
  const attendanceMap = new Map(todayAttendance.map(a => [a.employeeId, a]));

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getDay(startOfMonth(currentDate));
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const getDateStatus = (day: number) => {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayAtt = (attendance ?? []).filter(a => a.date === dateStr);
    if (dayAtt.length === 0) return null;
    const presentCount = dayAtt.filter(a => a.status === "present").length;
    if (presentCount === dayAtt.length) return "all-present";
    if (presentCount === 0) return "all-absent";
    return "mixed";
  };

  const handleBulkMark = async (status: string) => {
    if (!employees?.length) return;
    const records = employees.map(e => ({
      employeeId: e.id,
      date: selectedDate,
      status,
    }));
    markAttendance.mutate({ data: { records } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAttendanceSummaryQueryKey({ month, year }) });
        toast({ title: "Bulk attendance marked", description: `All employees marked as ${status}` });
      },
    });
  };

  const handleMarkEmployee = async (employeeId: number, status: string) => {
    markAttendance.mutate({ data: { records: [{ employeeId, date: selectedDate, status }] } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAttendanceSummaryQueryKey({ month, year }) });
      },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground text-sm">Marking for: {format(new Date(selectedDate), "d MMMM yyyy")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleBulkMark("present")} data-testid="button-bulk-present">
            <CheckCircle2 size={14} className="mr-1.5 text-emerald-500" /> All Present
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleBulkMark("absent")} data-testid="button-bulk-absent">
            <XCircle size={14} className="mr-1.5 text-red-500" /> All Absent
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Calendar */}
        <Card className="border-card-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">{format(currentDate, "MMMM yyyy")}</CardTitle>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                  <ChevronLeft size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                <div key={d} className="text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
              {blanks.map(i => <div key={`blank-${i}`} />)}
              {days.map(day => {
                const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
                const status = getDateStatus(day);
                return (
                  <motion.button
                    key={day}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`relative text-xs font-medium rounded-lg py-1.5 transition-colors ${
                      isSelected ? "bg-primary text-primary-foreground" :
                      isToday ? "ring-2 ring-primary text-primary" :
                      "hover:bg-muted text-foreground"
                    }`}
                    data-testid={`calendar-day-${day}`}
                  >
                    {day}
                    {status && !isSelected && (
                      <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                        status === "all-present" ? "bg-emerald-500" :
                        status === "all-absent" ? "bg-red-500" : "bg-amber-400"
                      }`} />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Employee attendance marking */}
        <div className="lg:col-span-2 space-y-3">
          <p className="text-sm font-medium text-foreground">Mark Attendance</p>
          {!employees?.length ? (
            <p className="text-sm text-muted-foreground">Add employees first to mark attendance.</p>
          ) : (
            <div className="space-y-2">
              {employees.map((emp, i) => {
                const att = attendanceMap.get(emp.id);
                const currentStatus = att?.status;
                return (
                  <motion.div
                    key={emp.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="border-card-border shadow-sm" data-testid={`attendance-card-${emp.id}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-foreground">{emp.name}</p>
                              {att?.latitude && att?.longitude && (
                                <span title="GPS location captured">
                                  <MapPin size={12} className="text-blue-500" />
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{emp.role}</p>
                          </div>
                          <div className="flex gap-1.5">
                            {["present", "absent", "half_day"].map(s => (
                              <button
                                key={s}
                                onClick={() => handleMarkEmployee(emp.id, s)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  currentStatus === s
                                    ? `${statusBadge[s]} ring-2 ring-offset-1 ${s === "present" ? "ring-emerald-500" : s === "absent" ? "ring-red-500" : "ring-amber-400"}`
                                    : "bg-muted text-muted-foreground hover:bg-secondary"
                                }`}
                                data-testid={`button-mark-${s}-${emp.id}`}
                              >
                                {s === "present" ? "P" : s === "absent" ? "A" : "H"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Summary */}
      {summary && summary.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-card-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Monthly Summary — {format(currentDate, "MMMM yyyy")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs font-medium text-muted-foreground">Employee</th>
                      <th className="text-center py-2 text-xs font-medium text-muted-foreground">Present</th>
                      <th className="text-center py-2 text-xs font-medium text-muted-foreground">Absent</th>
                      <th className="text-center py-2 text-xs font-medium text-muted-foreground">Half Day</th>
                      <th className="text-center py-2 text-xs font-medium text-muted-foreground">OT Hours</th>
                      <th className="text-center py-2 text-xs font-medium text-muted-foreground">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.map(s => (
                      <tr key={s.employeeId} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 font-medium text-foreground">{s.employeeName}</td>
                        <td className="py-2.5 text-center text-emerald-600 dark:text-emerald-400 font-medium">{s.present}</td>
                        <td className="py-2.5 text-center text-red-600 dark:text-red-400 font-medium">{s.absent}</td>
                        <td className="py-2.5 text-center text-amber-600 dark:text-amber-400 font-medium">{s.halfDay}</td>
                        <td className="py-2.5 text-center text-muted-foreground">{s.overtime.toFixed(1)}</td>
                        <td className="py-2.5 text-center">
                          <Badge className={`text-xs ${s.percentage >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : s.percentage >= 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                            {s.percentage}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
