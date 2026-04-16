import { motion } from "framer-motion";
import {
  useGetDashboardStats, getGetDashboardStatsQueryKey,
  useGetSmartInsights, getGetSmartInsightsQueryKey,
  useGetAttendanceTrend, getGetAttendanceTrendQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Users, UserCheck, UserX, DollarSign, TrendingUp, ClipboardList, AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import QuickAddPayment from "@/components/quick-add-payment";
import { format, parseISO } from "date-fns";

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.3 } }),
};

const CHART_COLORS = {
  present: "#7c3aed",
  absent: "#f43f5e",
  halfDay: "#f59e0b",
};

const insightIcon: Record<string, typeof AlertTriangle> = {
  warning: AlertTriangle,
  success: CheckCircle,
  info: Info,
  alert: XCircle,
};

const insightColor: Record<string, string> = {
  warning: "text-amber-500 bg-amber-500/10",
  success: "text-emerald-500 bg-emerald-500/10",
  info: "text-blue-500 bg-blue-500/10",
  alert: "text-red-500 bg-red-500/10",
};

function formatCurrency(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey() },
  });
  const { data: insights, isLoading: insightsLoading } = useGetSmartInsights({
    query: { queryKey: getGetSmartInsightsQueryKey() },
  });
  const { data: trend, isLoading: trendLoading } = useGetAttendanceTrend({
    query: { queryKey: getGetAttendanceTrendQueryKey() },
  });

  const now = new Date();

  const statCards = [
    { label: "Total Employees", value: stats?.totalEmployees ?? 0, icon: Users, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Present Today", value: stats?.presentToday ?? 0, icon: UserCheck, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Absent Today", value: stats?.absentToday ?? 0, icon: UserX, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Month Salary", value: formatCurrency(stats?.totalSalaryThisMonth ?? 0), icon: DollarSign, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Total Paid", value: formatCurrency(stats?.totalPaidThisMonth ?? 0), icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Pending Dues", value: formatCurrency(stats?.pendingDues ?? 0), icon: DollarSign, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Active Tasks", value: stats?.activeTasks ?? 0, icon: ClipboardList, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Half Day Today", value: stats?.halfDayToday ?? 0, icon: UserCheck, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  ];

  const pieData = stats ? [
    { name: "Present", value: stats.presentToday, color: CHART_COLORS.present },
    { name: "Absent", value: stats.absentToday, color: CHART_COLORS.absent },
    { name: "Half Day", value: stats.halfDayToday, color: CHART_COLORS.halfDay },
  ].filter(d => d.value > 0) : [];

  const trendData = (trend ?? []).map(d => ({
    ...d,
    day: format(parseISO(d.date), "EEE"),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">{format(now, "EEEE, d MMMM yyyy")}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div key={card.label} custom={i} variants={cardVariants} initial="hidden" animate="visible">
            <Card className="border-card-border shadow-sm hover:shadow-md transition-shadow" data-testid={`card-${card.label.toLowerCase().replace(/ /g, "-")}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{card.label}</p>
                    {statsLoading ? (
                      <Skeleton className="h-7 w-16" />
                    ) : (
                      <p className="text-xl font-bold text-foreground">{card.value}</p>
                    )}
                  </div>
                  <div className={`p-2 rounded-lg ${card.bg}`}>
                    <card.icon size={18} className={card.color} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card className="border-card-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Attendance Trend (7 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {trendLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trendData} barSize={8} barGap={2}>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#6b7280" }} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                    <Bar dataKey="present" fill={CHART_COLORS.present} radius={[4, 4, 0, 0]} name="Present" />
                    <Bar dataKey="absent" fill={CHART_COLORS.absent} radius={[4, 4, 0, 0]} name="Absent" />
                    <Bar dataKey="halfDay" fill={CHART_COLORS.halfDay} radius={[4, 4, 0, 0]} name="Half Day" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="border-card-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">Today's Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No attendance marked today</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Smart Insights */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="border-card-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-foreground">Smart Insights</CardTitle>
          </CardHeader>
          <CardContent>
            {insightsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(insights ?? []).map((insight) => {
                  const Icon = insightIcon[insight.type] || Info;
                  const colorClass = insightColor[insight.type] || insightColor.info;
                  return (
                    <motion.div
                      key={insight.id}
                      whileHover={{ scale: 1.01 }}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border"
                      data-testid={`insight-${insight.id}`}
                    >
                      <div className={`p-1.5 rounded-lg ${colorClass.split(" ")[1]}`}>
                        <Icon size={14} className={colorClass.split(" ")[0]} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{insight.message}</p>
                        {insight.metric && (
                          <Badge variant="secondary" className="mt-1 text-xs">{insight.metric}</Badge>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Add Payment FAB */}
      <QuickAddPayment />
    </div>
  );
}
