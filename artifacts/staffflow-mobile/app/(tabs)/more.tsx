import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

interface MenuItemProps {
  icon: string;
  label: string;
  sublabel?: string;
  iconBg: string;
  iconColor: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}

function MenuItem({ icon, label, sublabel, iconBg, iconColor, onPress, colors }: MenuItemProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { opacity: 0.7 },
      ]}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <View style={[styles.menuIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.menuLabel}>
        <Text style={[styles.menuTitle, { color: colors.foreground }]}>{label}</Text>
        {sublabel ? <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const topPadding = Platform.OS === "web" ? 67 : 0;

  const handleLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await logout();
    router.replace("/(auth)/login");
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: topPadding + 12, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.profileAvatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.profileAvatarText}>{user?.name?.charAt(0) ?? "A"}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.foreground }]}>{user?.name}</Text>
          <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>{user?.email}</Text>
          <View style={[styles.profileBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.profileBadgeText, { color: colors.primary }]}>{user?.companyName}</Text>
          </View>
        </View>
      </View>

      {/* HR Management */}
      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>HR MANAGEMENT</Text>
      <View style={styles.menuGroup}>
        <MenuItem
          icon="wallet-outline"
          label="Salary & Payroll"
          sublabel="Calculate & manage salaries"
          iconBg="#DCFCE7"
          iconColor="#16A34A"
          onPress={() => router.push("/salary")}
          colors={colors}
        />
        <MenuItem
          icon="cash-outline"
          label="Payments"
          sublabel="Transaction history"
          iconBg="#DBEAFE"
          iconColor="#2563EB"
          onPress={() => router.push("/payments")}
          colors={colors}
        />
        <MenuItem
          icon="umbrella-outline"
          label="Leaves"
          sublabel="Approve & manage leave requests"
          iconBg="#FEF3C7"
          iconColor="#D97706"
          onPress={() => router.push("/leaves")}
          colors={colors}
        />
      </View>

      {/* Account */}
      <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>ACCOUNT</Text>
      <View style={styles.menuGroup}>
        <MenuItem
          icon="settings-outline"
          label="Settings"
          sublabel="Profile & preferences"
          iconBg={colors.muted}
          iconColor={colors.mutedForeground}
          onPress={() => router.push("/settings")}
          colors={colors}
        />
        <Pressable
          style={({ pressed }) => [
            styles.menuItem,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
          onPress={handleLogout}
        >
          <View style={[styles.menuIcon, { backgroundColor: "#FEE2E2" }]}>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          </View>
          <Text style={[styles.menuTitle, { color: "#DC2626", flex: 1 }]}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 14,
    marginBottom: 24,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  profileAvatarText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 6,
  },
  profileBadge: {
    alignSelf: "flex-start",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  profileBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuGroup: {
    marginBottom: 24,
    gap: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    gap: 14,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1 },
  menuTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 1,
  },
  menuSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
