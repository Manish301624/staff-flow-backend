import { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useListAttendance, useGetAttendanceSummary } from "@workspace/api-client-react";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function SummaryChip({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipCount, { color }]}>{count}</Text>
      <Text style={[styles.chipLabel, { color }]}>{label}</Text>
    </View>
  );
}

function AttendanceRow({ record, colors }: { record: any; colors: any }) {
  const statusMap: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    present: { label: "Present", color: "#16A34A", bg: "#DCFCE7", icon: "checkmark-circle" },
    absent: { label: "Absent", color: "#DC2626", bg: "#FEE2E2", icon: "close-circle" },
    half_day: { label: "Half Day", color: "#D97706", bg: "#FEF3C7", icon: "remove-circle" },
  };
  const s = statusMap[record.status] ?? statusMap.absent;

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.rowAvatar, { backgroundColor: colors.primary + "22" }]}>
        <Text style={[styles.rowAvatarText, { color: colors.primary }]}>
          {(record.employeeName ?? "?").charAt(0)}
        </Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>{record.employeeName}</Text>
        <Text style={[styles.rowDate, { color: colors.mutedForeground }]}>
          {new Date(record.date).toLocaleDateString("en", { day: "numeric", month: "short" })}
        </Text>
      </View>
      <View style={[styles.rowBadge, { backgroundColor: s.bg }]}>
        <Ionicons name={s.icon as any} size={14} color={s.color} />
        <Text style={[styles.rowBadgeText, { color: s.color }]}>{s.label}</Text>
      </View>
    </View>
  );
}

export default function AttendanceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: attendance, isLoading, refetch } = useListAttendance({ month, year });
  const { data: summary } = useGetAttendanceSummary({ month, year });

  const topPadding = Platform.OS === "web" ? 67 : 0;

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

  const totalPresent = summary?.reduce((a: number, b: any) => a + (b.present ?? 0), 0) ?? 0;
  const totalAbsent = summary?.reduce((a: number, b: any) => a + (b.absent ?? 0), 0) ?? 0;
  const totalHalf = summary?.reduce((a: number, b: any) => a + (b.halfDay ?? 0), 0) ?? 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Month navigator */}
      <View style={[styles.monthNav, { paddingTop: topPadding + 12, backgroundColor: colors.background }]}>
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

      {/* Summary chips */}
      <View style={styles.chips}>
        <SummaryChip label="Present" count={totalPresent} color="#16A34A" bg="#DCFCE7" />
        <SummaryChip label="Absent" count={totalAbsent} color="#DC2626" bg="#FEE2E2" />
        <SummaryChip label="Half Day" count={totalHalf} color="#D97706" bg="#FEF3C7" />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={attendance ?? []}
          keyExtractor={(r) => String(r.id)}
          renderItem={({ item }) => <AttendanceRow record={item} colors={colors} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(attendance && attendance.length > 0)}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="calendar-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No attendance records</Text>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  navBtn: {
    padding: 6,
  },
  monthLabel: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  chips: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  chip: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  chipCount: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  chipLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  rowAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  rowAvatarText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  rowInfo: { flex: 1 },
  rowName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  rowDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  rowBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rowBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});
