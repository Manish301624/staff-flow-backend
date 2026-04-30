import { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useListTasks, useUpdateTask } from "@workspace/api-client-react";

type Status = "all" | "pending" | "in_progress" | "completed";

const FILTERS: { label: string; value: Status }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in_progress" },
  { label: "Done", value: "completed" },
];

const PRIORITY_COLORS: Record<string, { color: string; bg: string }> = {
  high: { color: "#DC2626", bg: "#FEE2E2" },
  medium: { color: "#D97706", bg: "#FEF3C7" },
  low: { color: "#16A34A", bg: "#DCFCE7" },
};

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  pending: { icon: "ellipse-outline", color: "#6B7280" },
  in_progress: { icon: "time-outline", color: "#576DFA" },
  completed: { icon: "checkmark-circle", color: "#16A34A" },
};

function TaskCard({ task, colors, onToggle }: { task: any; colors: any; onToggle: (id: number, status: string) => void }) {
  const s = STATUS_ICONS[task.status] ?? STATUS_ICONS.pending;
  const p = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.low;
  const isCompleted = task.status === "completed";

  return (
    <View style={[styles.taskCard, { backgroundColor: colors.card, borderColor: colors.border }, isCompleted && { opacity: 0.6 }]}>
      <Pressable onPress={() => onToggle(task.id, task.status)} style={styles.taskToggle}>
        <Ionicons name={s.icon as any} size={22} color={s.color} />
      </Pressable>
      <View style={styles.taskBody}>
        <View style={styles.taskHeader}>
          <Text
            style={[styles.taskTitle, { color: colors.foreground }, isCompleted && styles.strikethrough]}
            numberOfLines={1}
          >
            {task.title}
          </Text>
          <View style={[styles.priorityBadge, { backgroundColor: p.bg }]}>
            <Text style={[styles.priorityText, { color: p.color }]}>{task.priority}</Text>
          </View>
        </View>
        {task.description ? (
          <Text style={[styles.taskDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
            {task.description}
          </Text>
        ) : null}
        <View style={styles.taskMeta}>
          {task.assignedToName ? (
            <View style={styles.metaRow}>
              <Ionicons name="person-outline" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{task.assignedToName}</Text>
            </View>
          ) : null}
          {task.dueDate ? (
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {new Date(task.dueDate).toLocaleDateString("en", { day: "numeric", month: "short" })}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export default function TasksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Status>("all");

  const { data: tasks, isLoading, refetch } = useListTasks({ status: filter !== "all" ? filter : undefined });
  const updateTask = useUpdateTask();

  const topPadding = Platform.OS === "web" ? 67 : 0;

  const handleToggle = (id: number, currentStatus: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextStatus = currentStatus === "completed" ? "pending" : currentStatus === "pending" ? "in_progress" : "completed";
    updateTask.mutate({ id, data: { status: nextStatus } }, { onSuccess: () => refetch() });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Filter tabs */}
      <View style={[styles.filterRow, { paddingTop: topPadding + 12, backgroundColor: colors.background }]}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            style={[
              styles.filterBtn,
              { borderColor: colors.border },
              filter === f.value && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, { color: filter === f.value ? "#fff" : colors.mutedForeground }]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={tasks ?? []}
          keyExtractor={(t) => String(t.id)}
          renderItem={({ item }) => <TaskCard task={item} colors={colors} onToggle={handleToggle} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!(tasks && tasks.length > 0)}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="checkbox-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {filter !== "all" ? "No tasks in this status" : "No tasks yet"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 12,
  },
  filterBtn: {
    flex: 1,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  filterText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 8,
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  taskToggle: {
    paddingTop: 1,
  },
  taskBody: { flex: 1 },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  taskTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
  priorityBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  priorityText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "capitalize",
  },
  taskDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 6,
  },
  taskMeta: {
    flexDirection: "row",
    gap: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
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
