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
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useVerifyAttendance } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

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
  // Use a ref so timer callbacks always see the latest employee without stale-closure issues
  const selectedRef = useRef<Employee | null>(null);
  const [selectedDisplay, setSelectedDisplay] = useState<Employee | null>(null);

  const [matchScore, setMatchScore] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState(3);

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const timerIds = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const capturedRef = useRef(false);

  const progressAnim = useState(() => new Animated.Value(0))[0];
  const pulseAnim = useState(() => new Animated.Value(1))[0];

  const { mutateAsync: verifyAttendance } = useVerifyAttendance();

  const clearAllTimers = useCallback(() => {
    timerIds.current.forEach(clearTimeout);
    timerIds.current.clear();
  }, []);

  const safeTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timerIds.current.delete(id);
      fn();
    }, ms);
    timerIds.current.add(id);
    return id;
  }, []);

  // Reset when modal closes
  useEffect(() => {
    if (!visible) {
      clearAllTimers();
      setStep("pick");
      selectedRef.current = null;
      setSelectedDisplay(null);
      setMatchScore(0);
      setErrorMsg("");
      setSecondsLeft(3);
      capturedRef.current = false;
      progressAnim.setValue(0);
    }
  }, [visible, clearAllTimers]);

  // Pulse animation while verifying
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

  // Employee is passed directly — never read from state in timer callbacks
  const submitVerification = useCallback(async (emp: Employee, imageBase64: string) => {
    clearAllTimers();
    setStep("verifying");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const today = new Date().toISOString().slice(0, 10);
    const checkIn = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

    console.log("[FaceAttendance] Sending to backend — employeeId:", emp.id, "imageLen:", imageBase64.length);

    try {
      const result = await verifyAttendance({
        data: { employeeId: emp.id, imageBase64, date: today, checkIn },
      });

      console.log("[FaceAttendance] Match Score:", result.matchScore, "| Matched:", result.matched);
      setMatchScore(result.matchScore);

      if (result.matched) {
        setStep("success");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Query keys match what the generated hooks use (URL-path based)
        await queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/attendance/summary"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/insights"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/attendance-trend"] });
        setTimeout(() => onSuccess(), 2000);
      } else {
        setStep("failed");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      const msg =
        err?.data?.error ??
        err?.response?.data?.error ??
        err?.message ??
        "Verification error. Please try again.";
      console.log("[FaceAttendance] Error:", msg);
      setErrorMsg(msg);
      setStep("error");
    }
  }, [verifyAttendance, queryClient, onSuccess, clearAllTimers]);

  const uriToBase64 = useCallback(async (uri: string): Promise<string | null> => {
    try {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return b64 ? `data:image/jpeg;base64,${b64}` : null;
    } catch (e) {
      console.log("[FaceAttendance] FileSystem fallback failed:", e);
      return null;
    }
  }, []);

  // emp is passed directly — no stale closure on selectedRef
  const startCountdown = useCallback((emp: Employee) => {
    capturedRef.current = false;
    setSecondsLeft(3);
    progressAnim.setValue(0);

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: COUNTDOWN_MS,
      useNativeDriver: false,
      easing: Easing.linear,
    }).start();

    // Tick display
    safeTimeout(() => setSecondsLeft(2), 1000);
    safeTimeout(() => setSecondsLeft(1), 2000);
    safeTimeout(() => setSecondsLeft(0), 3000);

    // Actual capture
    safeTimeout(async () => {
      if (capturedRef.current) {
        console.log("[FaceAttendance] Skipping duplicate capture");
        return;
      }
      if (!cameraRef.current) {
        setErrorMsg("Camera not ready. Please try again.");
        setStep("error");
        return;
      }

      capturedRef.current = true;
      console.log("[FaceAttendance] Auto-capture triggered for emp:", emp.id);

      try {
        const pic = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
        console.log("[FaceAttendance] Picture taken — uri:", pic?.uri, "has base64:", !!pic?.base64);

        if (!pic?.uri) throw new Error("Camera returned no picture");

        const imageBase64: string | null = pic.base64
          ? `data:image/jpeg;base64,${pic.base64}`
          : await uriToBase64(pic.uri);

        if (!imageBase64) throw new Error("Could not read image data from camera");

        await submitVerification(emp, imageBase64);
      } catch (e: any) {
        console.log("[FaceAttendance] Capture error:", e?.message ?? e);
        setErrorMsg(e?.message ?? "Could not capture photo. Please try again.");
        setStep("error");
      }
    }, COUNTDOWN_MS);
  }, [progressAnim, safeTimeout, submitVerification, uriToBase64]);

  const openCamera = useCallback(async (emp: Employee) => {
    // Store in ref immediately so retryCamera can access it
    selectedRef.current = emp;
    setSelectedDisplay(emp);

    if (Platform.OS === "web") {
      const { default: ImagePicker } = await import("expo-image-picker");
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.75,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const asset = res.assets[0];
        const imageBase64: string | null = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri ? await uriToBase64(asset.uri) : null;
        if (imageBase64) await submitVerification(emp, imageBase64);
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
    // Pass emp directly into startCountdown — avoids stale closure
    safeTimeout(() => startCountdown(emp), 900);
  }, [permission, requestPermission, submitVerification, startCountdown, safeTimeout, uriToBase64]);

  const retryCamera = useCallback(() => {
    clearAllTimers();
    capturedRef.current = false;
    const emp = selectedRef.current;
    if (!emp) { setStep("pick"); return; }
    setStep("camera");
    safeTimeout(() => startCountdown(emp), 900);
  }, [startCountdown, safeTimeout, clearAllTimers]);

  const RING_SIZE = 240;
  const RING_BORDER = 4;

  const ringColor = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["#576DFA", "#FBBF24", "#16A34A"],
  });

  // Use selectedDisplay for rendering (updated via setSelectedDisplay)
  const selected = selectedDisplay;

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
            <View style={styles.topBar}>
              <Pressable style={styles.hudBtn} onPress={() => { clearAllTimers(); setStep("pick"); selectedRef.current = null; setSelectedDisplay(null); }}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
              {selected && (
                <View style={styles.empPill}>
                  <Ionicons name="person-circle-outline" size={16} color="#fff" />
                  <Text style={styles.empPillText}>{selected.name}</Text>
                </View>
              )}
              <Pressable style={styles.hudBtn} onPress={() => { clearAllTimers(); onClose(); }}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>

            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

            <View style={styles.ovalWrapper}>
              <View style={{ width: RING_SIZE, height: RING_SIZE + 40, position: "relative", alignItems: "center", justifyContent: "center" }}>
                <View style={[styles.ovalBg, { width: RING_SIZE, height: RING_SIZE + 40, borderRadius: RING_SIZE / 2 }]} />
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
                <View style={styles.countdownOverlay}>
                  <Text style={styles.countdownNum}>{secondsLeft}</Text>
                </View>
              </View>
            </View>

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
  ovalRing: { position: "absolute" },
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
