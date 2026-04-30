import { useRef, useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, FlatList,
  ActivityIndicator, Animated, Platform, Easing,
} from "react-native";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import * as FaceDetector from "expo-face-detector";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

type DetectionState = "idle" | "detecting" | "locking" | "processing" | "success" | "error";

const LOCK_DELAY_MS = 1400;
const SUCCESS_DISMISS_MS = 2200;

const FRAME_COLORS: Record<DetectionState, string> = {
  idle: "rgba(255,255,255,0.35)",
  detecting: "#FBBF24",
  locking: "#34D399",
  processing: "#576DFA",
  success: "#16A34A",
  error: "#DC2626",
};

const STATUS_LABELS: Record<DetectionState, string> = {
  idle: "Position your face inside the frame",
  detecting: "Face detected — hold still…",
  locking: "Verifying identity…",
  processing: "Marking attendance…",
  success: "Attendance marked!",
  error: "Could not mark attendance. Try again.",
};

interface Employee { id: number; name: string; role: string; department?: string | null; }

interface Props {
  visible: boolean;
  employees: Employee[];
  onSuccess: () => void;
  onClose: () => void;
  onSubmit: (employeeId: number) => Promise<void>;
}

function CornerBracket({ position, color }: { position: "tl" | "tr" | "bl" | "br"; color: string }) {
  const SIZE = 28;
  const THICKNESS = 3;
  const borderStyle: Record<string, unknown> = { borderColor: color };
  if (position === "tl") borderStyle.borderBottomWidth = 0, borderStyle.borderRightWidth = 0;
  if (position === "tr") borderStyle.borderBottomWidth = 0, borderStyle.borderLeftWidth = 0;
  if (position === "bl") borderStyle.borderTopWidth = 0, borderStyle.borderRightWidth = 0;
  if (position === "br") borderStyle.borderTopWidth = 0, borderStyle.borderLeftWidth = 0;

  const posStyle = {
    tl: { top: 0, left: 0 },
    tr: { top: 0, right: 0 },
    bl: { bottom: 0, left: 0 },
    br: { bottom: 0, right: 0 },
  }[position];

  return (
    <View style={[
      {
        position: "absolute",
        width: SIZE, height: SIZE,
        borderWidth: THICKNESS,
        borderRadius: 4,
        ...borderStyle,
      },
      posStyle,
    ]} />
  );
}

export function FaceAttendanceModal({ visible, employees, onSuccess, onClose, onSubmit }: Props) {
  const colors = useColors();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<"pick" | "camera">("pick");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detectionState, setDetectionState] = useState<DetectionState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const submittedRef = useRef(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const frameColor = FRAME_COLORS[detectionState];

  const clearLockTimer = () => {
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!visible) {
      setStep("pick");
      setSelectedEmployee(null);
      setDetectionState("idle");
      setErrorMsg("");
      submittedRef.current = false;
      clearLockTimer();
    }
  }, [visible]);

  useEffect(() => {
    if (detectionState === "detecting" || detectionState === "locking") {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [detectionState]);

  useEffect(() => {
    if (detectionState === "success") {
      Animated.spring(scaleAnim, { toValue: 1.08, useNativeDriver: true, friction: 4 }).start(() => {
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 4 }).start();
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const t = setTimeout(() => { onSuccess(); }, SUCCESS_DISMISS_MS);
      return () => clearTimeout(t);
    }
  }, [detectionState]);

  const triggerSubmit = useCallback(async () => {
    if (submittedRef.current || !selectedEmployee) return;
    submittedRef.current = true;
    setDetectionState("processing");
    clearLockTimer();
    try {
      await onSubmit(selectedEmployee.id);
      setDetectionState("success");
    } catch {
      submittedRef.current = false;
      setDetectionState("error");
      setErrorMsg("Submission failed. Check your connection.");
    }
  }, [selectedEmployee, onSubmit]);

  const handleFacesDetected = useCallback(({ faces }: { faces: FaceDetector.FaceFeature[] }) => {
    if (submittedRef.current || detectionState === "processing" || detectionState === "success") return;
    if (faces.length > 0) {
      const face = faces[0];
      const bounds = face.bounds;
      const minSize = 90;
      const isBigEnough = bounds.size.width >= minSize && bounds.size.height >= minSize;
      if (!isBigEnough) {
        if (detectionState !== "idle") { setDetectionState("idle"); clearLockTimer(); }
        return;
      }
      if (detectionState === "idle") {
        setDetectionState("detecting");
        lockTimerRef.current = setTimeout(() => {
          setDetectionState("locking");
          lockTimerRef.current = setTimeout(triggerSubmit, 600);
        }, LOCK_DELAY_MS);
      }
    } else {
      if (detectionState === "detecting") {
        setDetectionState("idle");
        clearLockTimer();
      }
    }
  }, [detectionState, triggerSubmit]);

  const handleWebManualDetect = () => {
    if (submittedRef.current) return;
    setDetectionState("detecting");
    setTimeout(() => {
      setDetectionState("locking");
      setTimeout(triggerSubmit, 700);
    }, LOCK_DELAY_MS);
  };

  const handleRetry = () => {
    submittedRef.current = false;
    setDetectionState("idle");
    setErrorMsg("");
    clearLockTimer();
  };

  const selectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    if (permission?.granted) {
      setStep("camera");
    } else {
      requestPermission().then((res) => {
        if (res.granted) setStep("camera");
      });
    }
  };

  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        {step === "pick" ? (
          <View style={[styles.pickContainer, { backgroundColor: colors.background }]}>
            <View style={styles.pickHeader}>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
              <Text style={[styles.pickTitle, { color: colors.foreground }]}>Face Attendance</Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={styles.pickIconRow}>
              <View style={[styles.scanIconBg, { backgroundColor: colors.primary + "18" }]}>
                <Ionicons name="scan" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.pickSubtitle, { color: colors.mutedForeground }]}>
                Select the employee to scan
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
                  onPress={() => selectEmployee(item)}
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
                  <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                </Pressable>
              )}
            />
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            {/* Permission not granted */}
            {!permission?.granted ? (
              <View style={[styles.permBox, { backgroundColor: colors.background }]}>
                <Ionicons name="camera-outline" size={56} color={colors.mutedForeground} />
                <Text style={[styles.permTitle, { color: colors.foreground }]}>Camera Access Needed</Text>
                <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
                  StaffFlow needs camera access to verify attendance.
                </Text>
                <Pressable style={[styles.permBtn, { backgroundColor: colors.primary }]} onPress={() => requestPermission()}>
                  <Text style={styles.permBtnText}>Grant Camera Access</Text>
                </Pressable>
                <Pressable onPress={() => setStep("pick")} style={styles.backLink}>
                  <Text style={[styles.backLinkText, { color: colors.mutedForeground }]}>← Back</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing={"front" as CameraType}
                  onFacesDetected={Platform.OS !== "web" ? handleFacesDetected : undefined}
                  faceDetectorSettings={Platform.OS !== "web" ? {
                    mode: FaceDetector.FaceDetectorMode.fast,
                    detectLandmarks: FaceDetector.FaceDetectorLandmarks.none,
                    runClassifications: FaceDetector.FaceDetectorClassifications.none,
                    minDetectionInterval: 300,
                    tracking: true,
                  } : undefined}
                />

                {/* Dark overlay with face-frame cutout */}
                <View style={styles.overlay} pointerEvents="none">
                  <View style={styles.overlayTop} />
                  <View style={styles.overlayMiddle}>
                    <View style={styles.overlaySide} />
                    <Animated.View
                      style={[
                        styles.faceFrame,
                        {
                          borderColor: frameColor,
                          opacity: detectionState === "detecting" || detectionState === "locking"
                            ? pulseOpacity
                            : 1,
                          transform: [{ scale: scaleAnim }],
                        },
                      ]}
                    >
                      <CornerBracket position="tl" color={frameColor} />
                      <CornerBracket position="tr" color={frameColor} />
                      <CornerBracket position="bl" color={frameColor} />
                      <CornerBracket position="br" color={frameColor} />
                    </Animated.View>
                    <View style={styles.overlaySide} />
                  </View>
                  <View style={styles.overlayBottom} />
                </View>

                {/* Top HUD */}
                <View style={styles.topHud} pointerEvents="box-none">
                  <Pressable style={styles.hudCloseBtn} onPress={onClose}>
                    <Ionicons name="close" size={22} color="#fff" />
                  </Pressable>
                  {selectedEmployee && (
                    <View style={styles.empPill}>
                      <Ionicons name="person-circle-outline" size={16} color="#fff" />
                      <Text style={styles.empPillText}>{selectedEmployee.name}</Text>
                    </View>
                  )}
                </View>

                {/* Bottom HUD */}
                <View style={styles.bottomHud} pointerEvents="box-none">
                  {/* Status indicator */}
                  <View style={[styles.statusPill, { backgroundColor: "rgba(0,0,0,0.65)" }]}>
                    {detectionState === "processing" && (
                      <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                    )}
                    {detectionState === "success" && (
                      <Ionicons name="checkmark-circle" size={18} color="#16A34A" style={{ marginRight: 8 }} />
                    )}
                    {detectionState === "error" && (
                      <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />
                    )}
                    {(detectionState === "detecting" || detectionState === "locking") && (
                      <Ionicons name="scan-outline" size={18} color="#FBBF24" style={{ marginRight: 8 }} />
                    )}
                    {detectionState === "idle" && (
                      <Ionicons name="eye-outline" size={18} color="rgba(255,255,255,0.6)" style={{ marginRight: 8 }} />
                    )}
                    <Text style={styles.statusText}>{STATUS_LABELS[detectionState]}</Text>
                  </View>

                  {/* Web: primary simulate button (face detection not available on web) */}
                  {Platform.OS === "web" && detectionState === "idle" && (
                    <Pressable style={styles.webScanBtn} onPress={handleWebManualDetect}>
                      <Ionicons name="scan" size={20} color="#fff" />
                      <Text style={styles.webScanText}>Tap to Detect Face</Text>
                    </Pressable>
                  )}

                  {/* Retry on error */}
                  {detectionState === "error" && (
                    <Pressable style={styles.retryBtn} onPress={handleRetry}>
                      <Text style={styles.retryText}>Try Again</Text>
                    </Pressable>
                  )}

                  {/* Manual fallback — always visible when idle/detecting */}
                  {(detectionState === "idle" || detectionState === "detecting") && (
                    <Pressable style={styles.manualBtn} onPress={triggerSubmit}>
                      <Ionicons name="hand-right-outline" size={16} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.manualText}>
                        {Platform.OS === "web" ? "Skip — Mark Present Now" : "Mark Manually (Fallback)"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const FRAME_W = 260;
const FRAME_H = 320;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },

  pickContainer: { flex: 1 },
  pickHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16,
  },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  pickTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  pickIconRow: { alignItems: "center", paddingVertical: 24, gap: 12 },
  scanIconBg: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
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

  cameraContainer: { flex: 1 },

  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: "column" },
  overlayTop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  overlayMiddle: { flexDirection: "row", height: FRAME_H },
  overlaySide: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  overlayBottom: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },

  faceFrame: {
    width: FRAME_W,
    height: FRAME_H,
    borderRadius: 20,
    borderWidth: 0,
    position: "relative",
  },

  topHud: {
    position: "absolute", top: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  hudCloseBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  empPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  empPillText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  bottomHud: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, paddingBottom: 56, gap: 14, alignItems: "center",
  },
  statusPill: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12,
    maxWidth: 320,
  },
  statusText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },

  webScanBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#576DFA", borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14, width: "100%",
    justifyContent: "center",
  },
  webScanText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  retryBtn: {
    backgroundColor: "#DC2626", borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 12,
  },
  retryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  manualBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10,
  },
  manualText: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_500Medium" },

  permBox: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16,
  },
  permTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  permDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  permBtn: {
    borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8,
  },
  permBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  backLink: { marginTop: 4 },
  backLinkText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
