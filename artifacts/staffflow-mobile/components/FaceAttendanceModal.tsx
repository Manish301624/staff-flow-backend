import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useVerifyAttendance } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

// Countdown before auto-capture (ms)
const COUNTDOWN_MS = 3000;

type VerifyStep =
  | "pick"
  | "camera"
  | "verifying"
  | "success"
  | "failed"
  | "error";

interface Employee {
  id: number;
  name: string;
  role: string;
  department?: string | null;
  facePhotoUrl?: string | null;
}

interface Props {
  visible: boolean;
  employees: Employee[];
  onSuccess: () => void;
  onClose: () => void;
}

export function FaceAttendanceModal({ visible, employees, onSuccess, onClose }: Props) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<VerifyStep>("pick");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState(3);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capturedRef = useRef(false);

  const progressAnim = useState(() => new Animated.Value(0))[0];
  const pulseAnim = useState(() => new Animated.Value(1))[0];

  const { mutateAsync: verifyAttendance } = useVerifyAttendance();

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      clearTimer();
      setStep("pick");
      setSelected(null);
      setMatchScore(0);
      setErrorMsg("");
      setSecondsLeft(3);
      capturedRef.current = false;
      progressAnim.setValue(0);
    }
  }, [visible, clearTimer]);

  // Pulse while verifying
  useEffect(() => {
    if (step === "verifying") {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      );
      anim.start();
      return () => anim.stop();
    }
    pulseAnim.setValue(1);
  }, [step]);

  const submitVerification = useCallback(async (imageBase64: string) => {
    if (!selected) return;
    clearTimer();
    setStep("verifying");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const today = new Date().toISOString().slice(0, 10);
    const checkIn = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    console.log("[FaceAttendance] Image sent to backend for employee:", selected.id);

    try {
      const result = await verifyAttendance({
        data: { employeeId: selected.id, imageBase64, date: today, checkIn },
      });

      console.log("[FaceAttendance] Match Score:", result.matchScore, "| Matched:", result.matched);
      setMatchScore(result.matchScore);

      if (result.matched) {
        setStep("success");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await queryClient.invalidateQueries({ queryKey: ["listAttendance"] });
        await queryClient.invalidateQueries({ queryKey: ["getAttendanceSummary"] });
        await queryClient.invalidateQueries({ queryKey: ["getDashboardStats"] });
        setTimeout(() => onSuccess(), 2000);
      } else {
        setStep("failed");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Verification error. Please try again.";
      console.log("[FaceAttendance] Error:", msg);
      setErrorMsg(msg);
      setStep("error");
    }
  }, [selected, verifyAttendance, queryClient, onSuccess, clearTimer]);

  // Auto-capture after countdown
  const startCountdown = useCallback(() => {
    capturedRef.current = false;
    setSecondsLeft(3);
    progressAnim.setValue(0);

    // Animate the ring over COUNTDOWN_MS
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: COUNTDOWN_MS,
      useNativeDriver: false,
      easing: Easing.linear,
    }).start();

    // Tick seconds for display
    let remaining = 3;
    const tick = () => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining > 0) {
        timerRef.current = setTimeout(tick, 1000);
      }
    };
    timerRef.current = setTimeout(tick, 1000);

    // Actual capture trigger
    timerRef.current = setTimeout(async () => {
      if (capturedRef.current || !cameraRef.current) return;
      capturedRef.current = true;
      console.log("[FaceAttendance] Face Detected: auto-capture triggered");

      try {
        const pic = await cameraRef.current.takePictureAsync({ quality: 0.75, base64: true });
        if (pic?.base64) {
          await submitVerification(`data:image/jpeg;base64,${pic.base64}`);
        }
      } catch {
        setErrorMsg("Could not capture photo. Please try again.");
        setStep("error");
      }
    }, COUNTDOWN_MS);
  }, [progressAnim, submitVerification]);

  const openCamera = useCallback(async (emp: Employee) => {
    setSelected(emp);

    if (Platform.OS === "web") {
      // Web: use image picker instead of camera
      const { default: ImagePicker } = await import("expo-image-picker");
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.75,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]?.base64) {
        setSelected(emp);
        await submitVerification(`data:image/jpeg;base64,${res.assets[0].base64}`);
      }
      return;
    }

    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        setErrorMsg("Camera permission is required for face attendance.");
        setStep("error");
        return;
      }
    }

    setStep("camera");
    // Give camera time to warm up, then start countdown
    timerRef.current = setTimeout(startCountdown, 900);
  }, [permission, requestPermission, submitVerification, startCountdown]);

  const retryCamera = useCallback(() => {
    if (!selected) { setStep("pick"); return; }
    capturedRef.current = false;
    setStep("camera");
    timerRef.current = setTimeout(startCountdown, 900);
  }, [selected, startCountdown]);

  // Ring size
  const RING_SIZE = 240;
  const RING_BORDER = 4;

  const ringColor = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["#576DFA", "#FBBF24", "#16A34A"],
  });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: "#060B18" }]}>

        {/* ── Step 1: Pick employee ── */}
        {step === "pick" && (
          <View style={[styles.pickContainer, { backgroundColor: colors.background }]}>
            <View style={styles.pickHeader}>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.pickTitle, { color: colors.foreground }]}>Face Attendance</Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={styles.pickIconRow}>
              <View style={[styles.scanIconBg, { backgroundColor: "#16A34A18" }]}>
                <Ionicons name="scan" size={40} color="#16A34A" />
              </View>
              <Text style={[styles.pickSubtitle, { color: colors.mutedForeground }]}>
                Select an employee to verify
              </Text>
            </View>
            <FlatList
              data={employees}
              keyExtractor={(e) => String(e.id)}
              contentContainerStyle={styles.empList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.empCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => openCamera(item)}
                >
                  <View style={[styles.empAvatar, { backgroundColor: colors.primary + "22" }]}>
                    <Text style={[styles.empAvatarText, { color: colors.primary }]}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.empName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.empRole, { color: colors.mutedForeground }]}>
                      {item.role}{item.department ? ` • ${item.department}` : ""}
                    </Text>
                  </View>
                  {item.facePhotoUrl
                    ? <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                    : <Ionicons name="alert-circle-outline" size={16} color="#FBBF24" />}
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            />
          </View>
        )}

        {/* ── Step 2: Live camera with countdown ── */}
        {step === "camera" && (
          <View style={styles.fullScreen}>
            {/* Top bar */}
            <View style={styles.topBar}>
              <Pressable style={styles.hudBtn} onPress={() => { clearTimer(); setStep("pick"); setSelected(null); }}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
              {selected && (
                <View style={styles.empPill}>
                  <Ionicons name="person-circle-outline" size={16} color="#fff" />
                  <Text style={styles.empPillText}>{selected.name}</Text>
                </View>
              )}
              <Pressable style={styles.hudBtn} onPress={() => { clearTimer(); onClose(); }}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>

            {/* Camera */}
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

            {/* Animated oval guide */}
            <View style={styles.ovalWrapper}>
              <View style={{ width: RING_SIZE, height: RING_SIZE + 40, position: "relative", alignItems: "center", justifyContent: "center" }}>
                {/* Background oval */}
                <View style={[styles.ovalBg, { width: RING_SIZE, height: RING_SIZE + 40, borderRadius: RING_SIZE / 2 }]} />
                {/* Animated border ring */}
                <Animated.View
                  style={[
                    styles.ovalRing,
                    {
                      width: RING_SIZE,
                      height: RING_SIZE + 40,
                      borderRadius: RING_SIZE / 2,
                      borderWidth: RING_BORDER,
                      borderColor: ringColor,
                    },
                  ]}
                />
                {/* Countdown number */}
                <View style={styles.countdownOverlay}>
                  <Text style={styles.countdownNum}>{secondsLeft}</Text>
                </View>
              </View>
            </View>

            {/* Hint */}
            <View style={styles.cameraHintBox}>
              <Text style={styles.cameraHint}>
                Centre your face in the oval — capturing in {secondsLeft}s
              </Text>
            </View>
          </View>
        )}

        {/* ── Step 3: Verifying ── */}
        {step === "verifying" && (
          <View style={styles.fullScreen}>
            <View style={styles.centred}>
              <Animated.View style={[styles.matchingCircle, { borderColor: "#FBBF24", transform: [{ scale: pulseAnim }] }]}>
                <ActivityIndicator size="large" color="#FBBF24" />
              </Animated.View>
              <Text style={styles.matchingTitle}>Verifying Identity…</Text>
              <Text style={styles.matchingDesc}>
                Comparing biometric profile against enrolled face
              </Text>
            </View>
          </View>
        )}

        {/* ── Step 4a: Success ── */}
        {step === "success" && (
          <View style={styles.fullScreen}>
            <View style={styles.centred}>
              <View style={[styles.resultCircle, { backgroundColor: "#16A34A22" }]}>
                <Ionicons name="checkmark-circle" size={80} color="#16A34A" />
              </View>
              <Text style={styles.resultTitle}>Identity Verified</Text>
              <Text style={styles.resultName}>{selected?.name}</Text>
              <View style={[styles.scorePill, { backgroundColor: "#DCFCE7" }]}>
                <Ionicons name="analytics-outline" size={14} color="#16A34A" />
                <Text style={[styles.scoreText, { color: "#16A34A" }]}>
                  Match Score: {matchScore}%
                </Text>
              </View>
              <Text style={styles.resultSub}>Attendance marked as Present ✓</Text>
              <Text style={[styles.resultSub, { marginTop: 4, opacity: 0.5 }]}>
                Returning to Dashboard…
              </Text>
            </View>
          </View>
        )}

        {/* ── Step 4b: Failed match ── */}
        {step === "failed" && (
          <View style={styles.fullScreen}>
            <View style={styles.centred}>
              <View style={[styles.resultCircle, { backgroundColor: "#FEF2F2" }]}>
                <Ionicons name="close-circle" size={80} color="#DC2626" />
              </View>
              <Text style={styles.resultTitle}>Verification Failed</Text>
              <View style={[styles.scorePill, { backgroundColor: "#FEE2E2" }]}>
                <Ionicons name="analytics-outline" size={14} color="#DC2626" />
                <Text style={[styles.scoreText, { color: "#DC2626" }]}>
                  Match Score: {matchScore}%
                </Text>
              </View>
              <Text style={styles.resultSub}>Face does not match the enrolled profile.</Text>
              <View style={styles.failActions}>
                <Pressable style={[styles.failBtn, { backgroundColor: "#576DFA" }]} onPress={retryCamera}>
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.failBtnText}>Try Again</Text>
                </Pressable>
                <Pressable style={styles.failBtnGhost} onPress={onClose}>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Inter_400Regular", fontSize: 14 }}>Cancel</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* ── Step 4c: Error ── */}
        {step === "error" && (
          <View style={styles.fullScreen}>
            <View style={styles.centred}>
              <View style={[styles.resultCircle, { backgroundColor: "#FEF2F2" }]}>
                <Ionicons name="alert-circle" size={80} color="#DC2626" />
              </View>
              <Text style={styles.resultTitle}>Error</Text>
              <Text style={styles.errorMsgText}>{errorMsg}</Text>
              <View style={styles.failActions}>
                <Pressable style={[styles.failBtn, { backgroundColor: "#576DFA" }]} onPress={retryCamera}>
                  <Ionicons name="refresh" size={16} color="#fff" />
                  <Text style={styles.failBtnText}>Retry</Text>
                </Pressable>
                <Pressable style={styles.failBtnGhost} onPress={onClose}>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Inter_400Regular", fontSize: 14 }}>Close</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  pickContainer: { flex: 1 },
  pickHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
  },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  pickTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  pickIconRow: { alignItems: "center", paddingVertical: 16, gap: 8 },
  scanIconBg: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  pickSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular" },
  empList: { paddingHorizontal: 16, gap: 10, paddingBottom: 40 },
  empCard: {
    flexDirection: "row", alignItems: "center", borderRadius: 16,
    borderWidth: 1, padding: 16, gap: 14,
  },
  empAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  empAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  empName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  empRole: { fontSize: 12, fontFamily: "Inter_400Regular" },

  fullScreen: { flex: 1 },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  hudBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center",
  },
  empPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  empPillText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  ovalWrapper: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 80,
    alignItems: "center", justifyContent: "center",
  },
  ovalBg: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  ovalRing: {
    position: "absolute",
  },
  countdownOverlay: {
    position: "absolute",
    bottom: -48,
    alignItems: "center",
  },
  countdownNum: {
    color: "#fff",
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    opacity: 0.9,
  },

  cameraHintBox: {
    position: "absolute",
    bottom: 44,
    left: 0, right: 0,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  cameraHint: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },

  centred: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 },
  matchingCircle: {
    width: 120, height: 120, borderRadius: 60, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  matchingTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  matchingDesc: { color: "rgba(255,255,255,0.5)", fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },

  resultCircle: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" },
  resultTitle: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  resultName: { color: "rgba(255,255,255,0.7)", fontSize: 17, fontFamily: "Inter_500Medium" },
  scorePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  scoreText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  resultSub: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },

  failActions: { gap: 12, marginTop: 8, width: "100%", alignItems: "center" },
  failBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
    width: "100%", justifyContent: "center",
  },
  failBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  failBtnGhost: { paddingVertical: 10 },
  errorMsgText: {
    color: "rgba(255,255,255,0.5)", fontSize: 13, fontFamily: "Inter_400Regular",
    textAlign: "center", lineHeight: 20, maxWidth: 280,
  },
});
