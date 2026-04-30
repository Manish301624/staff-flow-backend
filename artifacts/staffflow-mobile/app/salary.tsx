import { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useGetSalarySummary, useCreatePayment } from "@workspace/api-client-react";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function SummaryTile({ label, amount, color, bg }: { label: string; amount: number; color: string; bg: string }) {
  return (
    <View style={[styles.tile, { backgroundColor: bg }]}>
      <Text style={[styles.tileAmount, { color }]}>₹{amount.toLocaleString("en-IN")}</Text>
      <Text style={[styles.tileLabel, { color }]}>{label}</Text>
    </View>
  );
}

function SalaryCard({ emp, colors, month, year, onPaid }: { emp: any; colors: any; month: number; year: number; onPaid: (emp: any) => void }) {
  const hasPending = emp.pending > 0;
  return (
    <View style={[styles.empCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.empCardHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{emp.employeeName.charAt(0)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.empName, { color: colors.foreground }]} numberOfLines={1}>{emp.employeeName}</Text>
          <Text style={[styles.empDays, { color: colors.mutedForeground }]}>
            {emp.presentDays + Math.floor(emp.halfDays / 2)}/{emp.workingDays} days • {emp.salaryType}
          </Text>
        </View>
        {hasPending ? (
          <View style={[styles.pendingBadge, { backgroundColor: "#FEF3C7" }]}>
            <Text style={[styles.pendingBadgeText, { color: "#D97706" }]}>Pending</Text>
          </View>
        ) : (
          <View style={[styles.pendingBadge, { backgroundColor: "#DCFCE7" }]}>
            <Text style={[styles.pendingBadgeText, { color: "#16A34A" }]}>Paid</Text>
          </View>
        )}
      </View>

      <View style={styles.salaryGrid}>
        <View style={styles.salaryLine}>
          <Text style={[styles.salaryLineLabel, { color: colors.mutedForeground }]}>Base Salary</Text>
          <Text style={[styles.salaryLineValue, { color: colors.foreground }]}>₹{emp.baseSalary.toLocaleString("en-IN")}</Text>
        </View>
        {emp.overtimePay > 0 && (
          <View style={styles.salaryLine}>
            <Text style={[styles.salaryLineLabel, { color: colors.mutedForeground }]}>Overtime</Text>
            <Text style={[styles.salaryLineValue, { color: "#16A34A" }]}>+₹{emp.overtimePay.toLocaleString("en-IN")}</Text>
          </View>
        )}
        {emp.deductions > 0 && (
          <View style={styles.salaryLine}>
            <Text style={[styles.salaryLineLabel, { color: colors.mutedForeground }]}>Deductions</Text>
            <Text style={[styles.salaryLineValue, { color: "#DC2626" }]}>-₹{emp.deductions.toLocaleString("en-IN")}</Text>
          </View>
        )}
        {emp.advances > 0 && (
          <View style={styles.salaryLine}>
            <Text style={[styles.salaryLineLabel, { color: colors.mutedForeground }]}>Advances</Text>
            <Text style={[styles.salaryLineValue, { color: "#DC2626" }]}>-₹{emp.advances.toLocaleString("en-IN")}</Text>
          </View>
        )}
        <View style={[styles.salaryLine, styles.netLine]}>
          <Text style={[styles.salaryLineLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Net Salary</Text>
          <Text style={[styles.netValue, { color: colors.primary }]}>₹{emp.netSalary.toLocaleString("en-IN")}</Text>
        </View>
      </View>

      {hasPending && (
        <Pressable
          style={[styles.payBtn, { backgroundColor: colors.primary }]}
          onPress={() => onPaid(emp)}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
          <Text style={styles.payBtnText}>Mark Paid  ₹{emp.pending.toLocaleString("en-IN")}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function SalaryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading, refetch } = useGetSalarySummary({ month, year });
  const createPayment = useCreatePayment();

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    if (ny > now.getFullYear() || (ny === now.getFullYear() && nm > now.getMonth() + 1)) return;
    setMonth(nm); setYear(ny);
  };

  const employees: any[] = Array.isArray(data) ? data : [];
  const totalPayable = employees.reduce((s, e) => s + e.netSalary, 0);
  const totalPaid = employees.reduce((s, e) => s + e.paid, 0);
  const totalPending = employees.reduce((s, e) => s + e.pending, 0);

  const handleMarkPaid = (emp: any) => {
    Alert.alert(
      "Mark as Paid",
      `Pay ₹${emp.pending.toLocaleString("en-IN")} to ${emp.employeeName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            createPayment.mutate(
              {
                data: {
                  employeeId: emp.employeeId,
                  amount: emp.pending,
                  type: "salary",
                  method: "bank",
                  status: "paid",
                  month,
                  year,
                  note: `Salary for ${MONTH_NAMES[month - 1]} ${year}`,
                },
              },
              { onSuccess: () => refetch(), onError: () => Alert.alert("Error", "Payment failed.") }
            );
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Month navigator */}
      <View style={[styles.monthNav, { backgroundColor: colors.background }]}>
        <Pressable onPress={prevMonth} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: colors.foreground }]}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <Pressable onPress={nextMonth} style={styles.navBtn}>
          <Ionicons name="chevron-forward" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      {/* Summary tiles */}
      <View style={styles.tilesRow}>
        <SummaryTile label="Total Payable" amount={totalPayable} color="#576DFA" bg="#EDECFE" />
        <SummaryTile label="Paid" amount={totalPaid} color="#16A34A" bg="#DCFCE7" />
        <SummaryTile label="Pending" amount={totalPending} color="#D97706" bg="#FEF3C7" />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={employees}
          keyExtractor={(e) => String(e.employeeId)}
          renderItem={({ item }) => (
            <SalaryCard emp={item} colors={colors} month={month} year={year} onPaid={handleMarkPaid} />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="wallet-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No salary data for this month</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  monthNav: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 12,
  },
  navBtn: { padding: 6 },
  monthLabel: { fontSize: 17, fontFamily: "Inter_700Bold" },
  tilesRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  tile: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  tileAmount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  tileLabel: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 2 },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
  empCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  empCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  empName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  empDays: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  pendingBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  pendingBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  salaryGrid: { gap: 6 },
  salaryLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  netLine: { borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 8, marginTop: 2 },
  salaryLineLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  salaryLineValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  netValue: { fontSize: 16, fontFamily: "Inter_700Bold" },
  payBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 10, paddingVertical: 10, gap: 6,
  },
  payBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
