import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const loginMutation = useLogin();

  const [email, setEmail] = useState("admin@staffflow.com");
  const [password, setPassword] = useState("password123");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email";
    if (!password || password.length < 6) e.password = "Password must be at least 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: async (response) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await login(response.token, response.user as any);
          router.replace("/(tabs)/");
        },
        onError: (err: any) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert("Sign in failed", err?.data?.error || "Invalid email or password");
        },
      }
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0), paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Branded header */}
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>SF</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.appName}>StaffFlow</Text>
            <Text style={styles.tagline}>HR Management</Text>
          </View>
        </View>

        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Welcome back</Text>
          <Text style={styles.heroSubtitle}>Sign in to your admin account</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={[styles.inputRow, errors.email ? styles.inputError : null]}>
              <Ionicons name="mail-outline" size={18} color="#7588A3" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: undefined })); }}
                placeholder="admin@company.com"
                placeholderTextColor="#7588A3"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                testID="input-email"
              />
            </View>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputRow, errors.password ? styles.inputError : null]}>
              <Ionicons name="lock-closed-outline" size={18} color="#7588A3" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: undefined })); }}
                placeholder="••••••••"
                placeholderTextColor="#7588A3"
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                testID="input-password"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={18} color="#7588A3" />
              </Pressable>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </View>

          {/* Submit */}
          <Pressable
            style={({ pressed }) => [styles.submitBtn, pressed && styles.submitPressed, loginMutation.isPending && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={loginMutation.isPending}
            testID="button-submit"
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.submitText}>Sign in</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </Pressable>
        </View>

        {/* Demo credentials */}
       <View style={styles.demoBox}>
          <Ionicons name="information-circle-outline" size={14} color="#7588A3" />
          <View style={styles.demoText}>
            <Text style={styles.demoLabel}>Demo: admin@staffflow.com / password123</Text>
          </View>
        </View>

        {/* Register link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>New organization? </Text>
          <Pressable onPress={() => router.push("/(auth)/register")}>
            <Text style={styles.footerLink}>Create account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#060B18",
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 48,
    marginTop: 8,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#576DFA",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  headerText: {
    gap: 1,
  },
  appName: {
    color: "#E1E7EF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  tagline: {
    color: "#7588A3",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  heroSection: {
    marginBottom: 28,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  heroSubtitle: {
    color: "#7588A3",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  card: {
    backgroundColor: "#0B111E",
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#1D283A",
    gap: 16,
    marginBottom: 16,
  },
  field: {
    gap: 6,
  },
  label: {
    color: "#E1E7EF",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161F2C",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1D283A",
    paddingHorizontal: 12,
    height: 48,
  },
  inputError: {
    borderColor: "#D93B3B",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#E1E7EF",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  eyeBtn: {
    padding: 4,
  },
  errorText: {
    color: "#D93B3B",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  submitBtn: {
    backgroundColor: "#576DFA",
    borderRadius: 12,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  submitPressed: {
    opacity: 0.85,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  demoBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#161F2C",
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
  },
  demoText: {
    flex: 1,
  },
  demoLabel: {
    color: "#7588A3",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    color: "#7588A3",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  footerLink: {
    color: "#576DFA",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
