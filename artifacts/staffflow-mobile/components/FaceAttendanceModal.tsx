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
import * as FaceDetector from "expo-face-detector";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useVerifyAttendance } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

// — constants —
const POLL_INTERVAL_MS = 600;
const FACE_HOLD_MS = 1500;
const FACE_HOLD_FRAMES = Math.ceil(FACE_HOLD_MS / POLL_INTERVAL_MS); // ≥3 frames

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
  const [faceDetected, setFaceDetected] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0); // 0–1

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveRef = useRef(0);
  const isCapturingRef = useRef(false);
  const progressAnim = useState(() => new Animated.Value(0))[0];
  const pulseAnim = useState(() => new Animated.Value(1))[0];

  const { mutateAsync: verifyAttendance } = useVerifyAttendance();

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      stopPolling();
      setStep("pick");
      setSelected(null);
      setMatchScore(0);
      setErrorMsg("");
      setFaceDetected(false);
      setHoldProgress(0);
      consecutiveRef.current = 0;
      isCapturingRef.current = false;
      progressAnim.setValue(0);
    }
  }, [visible]);

  // Pulse animation during "verifying"
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

  // — face detection polling —
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const submitVerification = useCallback(async (imageBase64: string) => {
    if (!selected) return;
    stopPolling();
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
  }, [selected, verifyAttendance, queryClient, onSuccess, stopPolling]);

  const pollFaceDetection = useCallback(async () => {
    if (isCapturingRef.current || !cameraRef.current) return;

    try {
      const pic = await cameraRef.current.takePictureAsync({
        quality: 0.25,
        skipProcessing: true,
        base64: false,
      });

      if (!pic?.uri) {
        scheduleNextPoll();
        return;
      }

      // Detect faces in the captured frame
      const result = await FaceDetector.detectFacesAsync(pic.uri, {
        mode: FaceDetector.FaceDetectorMode.fast,
        detectLandmarks: FaceDetector.FaceDetectorLandmarks.none,
        runClassifications: FaceDetector.FaceDetectorClassifications.none,
      });

      const hasFace = result.faces.length > 0;
      console.log("[FaceAttendance] Face Detected:", hasFace, "| Consecutive frames:", consecutiveRef.current);
      setFaceDetected(hasFace);

      if (hasFace) {
        consecutiveRef.current += 1;
        const progress = Math.min(consecutiveRef.current / FACE_HOLD_FRAMES, 1);
        setHoldProgress(progress);
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: POLL_INTERVAL_MS * 0.9,
          useNativeDriver: false,
        }).start();

        if (consecutiveRef.current >= FACE_HOLD_FRAMES) {
          // Held long enough — capture final at good quality
          isCapturingRef.current = true;
          stopPolling();
          const finalPic = await cameraRef.current.takePictureAsync({
            quality: 0.75,
            base64: true,
          });
          if (finalPic?.base64) {
            const imageBase64 = `data:image/jpeg;base64,${finalPic.base64}`;
            await submitVerification(imageBase64);
          }
          return;
        }
      } else {
        consecutiveRef.current = 0;
        setHoldProgress(0);
        progressAnim.setValue(0);
      }
    } catch {
      // Camera not ready yet — ignore
    }

    scheduleNextPoll();
  }, [stopPolling, submitVerification, progressAnim]);

  const scheduleNextPoll = useCallback(() => {
    pollRef.current = setTimeout(pollFaceDetection, POLL_INTERVAL_MS);
  }, [pollFaceDetection]);

  const startCamera = useCallback(async (emp: Employee) => {
    setSelected(emp);

    if (Platform.OS === "web") {
      // Web fallback — open image picker
      const { default: ImagePicker } = await import("expo-image-picker");
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.75,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]?.base64) {
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

    consecutiveRef.current = 0;
    isCapturingRef.current = false;
    setFaceDetected(false);
    setHoldProgress(0);
    progressAnim.setValue(0);
    setStep("camera");
    // Start polling after the camera mounts (short delay)
    pollRef.current = setTimeout(pollFaceDetection, 800);
  }, [permission, requestPermission, submitVerification, pollFaceDetection, progressAnim]);

  const retryCamera = useCallback(() => {
    if (!selected) { setStep("pick"); return; }
    consecutiveRef.current = 0;
    isCapturingRef.current = false;
    setFaceDetected(false);
    setHoldProgress(0);
    progressAnim.setValue(0);
    setStep("camera");
    pollRef.current = setTimeout(pollFaceDetection, 800);
  }, [selected, pollFaceDetection, progressAnim]);

  // — ring progress color —
  const ringColor = faceDetected ? "#16A34A" : "#576DFA44";
  const ringFillColor = faceDetected ? "#16A34A" : "#576DFA";

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
                  onPress={() => startCamera(item)}
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

        {/* ── Step 2: Live camera with auto-detection ── */}
        {step === "camera" && (
          <View style={styles.fullScreen}>
            {/* Top bar */}
            <View style={styles.topBar}>
              <Pressable style={styles.hudBtn} onPress={() => { stopPolling(); setStep("pick"); setSelected(null); }}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
              {selected && (
                <View style={styles.empPill}>
                  <Ionicons name="person-circle-outline" size={16} color="#fff" />
                  <Text style={styles.empPillText}>{selected.name}</Text>
                </View>
              )}
              <Pressable style={styles.hudBtn} onPress={() => { stopPolling(); onClose(); }}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>

            {/* Camera view */}
            <View style={styles.cameraWrapper}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing="front"
              />

              {/* Face oval guide */}
              <View style={styles.ovalOuter}>
                <View style={[styles.ovalRing, { borderColor: ringColor }]}>
                  {/* Progress arc approximated by a filled ring */}
                  <Animated.View
                    style={[
                      styles.ovalFill,
                      {
                        opacity: progressAnim,
                        borderColor: ringFillColor,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Status badge */}
              <View style={styles.detectionBadge}>
                {faceDetected ? (
                  <View style={[styles.badge, { backgroundColor: "#16A34A22", borderColor: "#16A34A" }]}>
                    <View style={styles.pulseDot} />
                    <Text style={[styles.badgeText, { color: "#16A34A" }]}>
                      Face detected — hold still…
                    </Text>
                  </View>
                ) : (
                  <View style={[styles.badge, { backgroundColor: "#FFFFFF11", borderColor: "#FFFFFF22" }]}>
                    <Text style={[styles.badgeText, { color: "rgba(255,255,255,0.6)" }]}>
                      Position face in the oval
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.cameraFooter}>
              <Text style={styles.cameraHint}>
                Keep your face centred. Capture is automatic.
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
                  Match Score: {matchScore}%  (below threshold)
                </Text>
              </View>
              <Text style={styles.resultSub}>The captured face does not match the enrolled profile.</Text>
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

  // Pick step
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

  // Camera step
  fullScreen: { flex: 1 },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  hudBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center",
  },
  empPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  empPillText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  cameraWrapper: { flex: 1, position: "relative", overflow: "hidden" },

  ovalOuter: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
  },
  ovalRing: {
    width: 220, height: 280, borderRadius: 130,
    borderWidth: 3, alignItems: "center", justifyContent: "center",
  },
  ovalFill: {
    width: 214, height: 274, borderRadius: 127,
    borderWidth: 3,
  },

  detectionBadge: {
    position: "absolute", bottom: 24, left: 0, right: 0,
    alignItems: "center",
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1,
  },
  pulseDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#16A34A",
  },
  badgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  cameraFooter: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingBottom: 44, paddingHorizontal: 32, alignItems: "center",
  },
  cameraHint: {
    color: "rgba(255,255,255,0.4)", fontSize: 13,
    fontFamily: "Inter_400Regular", textAlign: "center",
    marginTop: 76,
  },

  // Verifying / result steps
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
