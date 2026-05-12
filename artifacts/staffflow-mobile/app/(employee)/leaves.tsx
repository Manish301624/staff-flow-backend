import { View, Text, StyleSheet, FlatList, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useListLeaves } from "@workspace/api-client-react";

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  pending: { color: "#F59E0B", bg: "#FEF3C7" },
  approved: { color: "#16A34A", bg: "#DCFCE7" },
  rejected: { color: "#DC2626", bg: "#FEE2E2" },
};

export default function EmployeeLeavesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const empId = (user as any)?.employeeId;

  const { data: leaves, isLoading } = useListLeaves({});
  const myLeaves = (leaves ?? []).filter((l: any) => l.employeeId === empId);

  const topPadding = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>My Leaves</Text>
      </View>

      {/* Summary */}
      <View style={styles.chips}>
        <View style={[styles.chip, { backgroundColor: "#FEF3C7" }]}>
          <Text style={[styles.chipCount, { color: "#F59E0B" }]}>{myLeaves.filter((l: any) => l.status === "pending").length}</Text>
          <Text style={[styles.chipLabel, { color: "#F59E0B" }]}>Pending</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: "#DCFCE7" }]}>
          <Text style={[styles.chipCount, { color: "#16A34A" }]}>{myLeaves.filter((l: any) => l.status === "approved").length}</Text>
          <Text style={[styles.chipLabel, { color: "#16A34A" }]}>Approved</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: "#FEE2E2" }]}>
          <Text style={[styles.chipCount, { color: "#DC2626" }]}>{myLeaves.filter((l: any) => l.status === "rejected").length}</Text>
          <Text style={[styles.chipLabel, { color: "#DC2626" }]}>Rejected</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={myLeaves}
          keyExtractor={(l) => String(l.id)}
          renderItem={({ item }) => {
            const s = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending;
            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={[styles.leaveType, { color: colors.foreground }]}>{item.leaveType ?? "Leave"}</Text>
                    <Text style={[styles.leaveDates, { color: colors.mutedForeground }]}>
                      {new Date(item.startDate).toLocaleDateString("en", { day: "numeric", month: "short" })}
                      {" — "}
                      {new Date(item.endDate).toLocaleDateString("en", { day: "numeric", month: "short" })}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: s.bg }]}>
                    <Text style={[styles.badgeText, { color: s.color }]}>
                      {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                    </Text>
                  </View>
                </View>
                {item.reason && (
                  <Text style={[styles.reason, { color: colors.mutedForeground }]}>{item.reason}</Text>
                )}
              </View>
            );
          }}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="time-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No leave records</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  chips: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginBottom: 12 },
  chip: { flex: 1, borderRadius: 12, padding: 12, alignItems: "center" },
  chipCount: { fontSize: 22, fontFamily: "Inter_700Bold" },
  chipLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  card: { borderRadius: 14, padding: 16, borderWidth: 1, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  leaveType: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  leaveDates: { fontSize: 12, fontFamily: "Inter_400Regular" },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  reason: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
