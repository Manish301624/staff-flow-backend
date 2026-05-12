import { View, Text, StyleSheet, ScrollView, Pressable, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { router } from "expo-router";

export default function EmployeeProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : 0;

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout", style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        }
      }
    ]);
  };

  const infoRows = [
    { icon: "person-outline", label: "Full Name", value: user?.name },
    { icon: "mail-outline", label: "Email", value: user?.email },
    { icon: "briefcase-outline", label: "Role", value: (user as any)?.role },
    { icon: "business-outline", label: "Department", value: (user as any)?.department || "N/A" },
  ];

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar section */}
      <View style={[styles.avatarSection, { paddingTop: topPadding + 20 }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) ?? "E"}</Text>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
        <Text style={[styles.role, { color: colors.mutedForeground }]}>{(user as any)?.role}</Text>
        <View style={[styles.employeeBadge, { backgroundColor: colors.primary + "22" }]}>
          <Ionicons name="person-circle-outline" size={14} color={colors.primary} />
          <Text style={[styles.employeeBadgeText, { color: colors.primary }]}>Employee Account</Text>
        </View>
      </View>

      {/* Info section */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Profile Information</Text>
        {infoRows.map((row, i) => (
          <View key={row.label} style={[styles.infoRow, { borderTopColor: colors.border, borderTopWidth: i > 0 ? 1 : 0 }]}>
            <View style={[styles.infoIcon, { backgroundColor: colors.primary + "22" }]}>
              <Ionicons name={row.icon as any} size={16} color={colors.primary} />
            </View>
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{row.value || "N/A"}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Logout */}
      <Pressable
        style={[styles.logoutBtn, { backgroundColor: "#FEE2E2" }]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={20} color="#DC2626" />
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>

      <View style={{ height: insets.bottom + 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  avatarSection: { alignItems: "center", paddingBottom: 24, paddingHorizontal: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { color: "#fff", fontSize: 32, fontFamily: "Inter_700Bold" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 4 },
  role: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 12 },
  employeeBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  employeeBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  section: { marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 16, borderWidth: 1 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  infoValue: { fontSize: 15, fontFamily: "Inter_500Medium" },
  logoutBtn: { marginHorizontal: 16, borderRadius: 14, height: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logoutText: { color: "#DC2626", fontSize: 16, fontFamily: "Inter_700Bold" },
});
