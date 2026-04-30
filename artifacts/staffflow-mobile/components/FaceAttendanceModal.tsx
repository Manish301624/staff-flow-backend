import { useRef, useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, FlatList,
  ActivityIndicator, Animated, Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

type DetectionState = "idle" | "detecting" | "locking" | "processing" | "success" | "error";

const LOCK_DELAY_MS = 1400;
const SUCCESS_DISMISS_MS = 2000;

const FRAME_COLORS: Record<DetectionState, string> = {
  idle: "rgba(255,255,255,0.3)",
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
  const SIZE = 30;
  const THICK = 3;
  const base: Record<string, number | string> = {
    position: "absolute" as const,
    width: SIZE, height: SIZE,
    borderColor: color,
    borderRadius: 4,
  };
  if (position === "tl") { base.top = 0; base.left = 0; base.borderRightWidth = 0; base.borderBottomWidth = 0; base.borderTopWidth = THICK; base.borderLeftWidth = THICK; }
  if (position === "tr") { base.top = 0; base.right = 0; base.borderLeftWidth = 0; base.borderBottomWidth = 0; base.borderTopWidth = THICK; base.borderRightWidth = THICK; }
  if (position === "bl") { base.bottom = 0; base.left = 0; base.borderRightWidth = 0; base.borderTopWidth = 0; base.borderBottomWidth = THICK; base.borderLeftWidth = THICK; }
  if (position === "br") { base.bottom = 0; base.right = 0; base.borderLeftWidth = 0; base.borderTopWidth = 0; base.borderBottomWidth = THICK; base.borderRightWidth = THICK; }
  return <View style={base as any} />;
}

function ScanAnimation({ state }: { state: DetectionState }) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const scanLine = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ripple = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring1, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(ring1, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(ring2, { toValue: 1, duration: 1800, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(ring2, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    const scan = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(scanLine, { toValue: 0, duration: 2000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    const glowAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ])
    );
    ripple.start();
    scan.start();
    glowAnim.start();
    return () => { ripple.stop(); scan.stop(); glowAnim.stop(); };
  }, []);

  const ring1Scale = ring1.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] });
  const ring1Opacity = ring1.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.8, 0.4, 0] });
  const ring2Scale = ring2.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] });
  const ring2Opacity = ring2.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.8, 0.4, 0] });
  const scanLineY = scanLine.interpolate({ inputRange: [0, 1], outputRange: [-FRAME_H / 2 + 20, FRAME_H / 2 - 20] });

  const active = state !== "idle";
  const frameColor = FRAME_COLORS[state];

  return (
    <View style={scan_styles.container}>
      {/* Ripple rings */}
      {active && (
        <>
          <Animated.View style={[scan_styles.ring, { borderColor: frameColor, transform: [{ scale: ring1Scale }], opacity: ring1Opacity }]} />
          <Animated.View style={[scan_styles.ring, { borderColor: frameColor, transform: [{ scale: ring2Scale }], opacity: ring2Opacity }]} />
        </>
      )}

      {/* Face icon */}
      <Animated.View style={[scan_styles.faceIconBg, { opacity: glow, shadowColor: frameColor }]}>
        <Ionicons
          name={state === "success" ? "checkmark-circle" : state === "error" ? "close-circle" : "person-circle-outline"}
          size={80}
          color={frameColor}
        />
      </Animated.View>

      {/* Scan line overlay */}
      {active && state !== "processing" && state !== "success" && state !== "error" && (
        <Animated.View style={[scan_styles.scanLine, { backgroundColor: frameColor, transform: [{ translateY: scanLineY }] }]} />
      )}
    </View>
  );
}

const FRAME_W = 260;
const FRAME_H = 320;

const scan_styles = StyleSheet.create({
  container: { width: FRAME_W, height: FRAME_H, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    width: FRAME_W - 20, height: FRAME_W - 20,
    borderRadius: (FRAME_W - 20) / 2,
    borderWidth: 2,
  },
  faceIconBg: {
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 10,
  },
  scanLine: {
    position: "absolute",
    left: 0, right: 0, height: 2, opacity: 0.6,
  },
});

export function FaceAttendanceModal({ visible, employees, onSuccess, onClose, onSubmit }: Props) {
  const colors = useColors();
  const [step, setStep] = useState<"pick" | "camera">("pick");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detectionState, setDetectionState] = useState<DetectionState>("idle");

  const submittedRef = useRef(false);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const frameColor = FRAME_COLORS[detectionState];

  const clearLockTimer = () => {
    if (lockTimerRef.current) { clearTimeout(lockTimerRef.current); lockTimerRef.current = null; }
  };

  useEffect(() => {
    if (!visible) {
      setStep("pick");
      setSelectedEmployee(null);
      setDetectionState("idle");
      submittedRef.current = false;
      clearLockTimer();
    }
  }, [visible]);

  useEffect(() => {
    if (detectionState === "detecting" || detectionState === "locking") {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ])
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [detectionState]);

  useEffect(() => {
    if (detectionState === "success") {
      Animated.spring(scaleAnim, { toValue: 1.1, useNativeDriver: true, friction: 4 }).start(() =>
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 4 }).start()
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const t = setTimeout(() => onSuccess(), SUCCESS_DISMISS_MS);
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
    }
  }, [selectedEmployee, onSubmit]);

  const handleDetectFace = () => {
    if (submittedRef.current || detectionState !== "idle") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDetectionState("detecting");
    lockTimerRef.current = setTimeout(() => {
      setDetectionState("locking");
      lockTimerRef.current = setTimeout(() => triggerSubmit(), 700);
    }, LOCK_DELAY_MS);
  };

  const handleRetry = () => {
    submittedRef.current = false;
    setDetectionState("idle");
    clearLockTimer();
  };

  const selectEmployee = (emp: Employee) => {
    setSelectedEmployee(emp);
    setStep("camera");
  };

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
        )}

        {/* ── Step 2: Scan view ── */}
        {step === "camera" && (
          <View style={styles.scanContainer}>
            {/* Top bar */}
            <View style={styles.topBar}>
              <Pressable style={styles.hudCloseBtn} onPress={onClose}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
              {selectedEmployee && (
                <View style={styles.empPill}>
                  <Ionicons name="person-circle-outline" size={16} color="#fff" />
                  <Text style={styles.empPillText}>{selectedEmployee.name}</Text>
                </View>
              )}
              <Pressable style={styles.hudCloseBtn} onPress={() => { clearLockTimer(); setStep("pick"); setDetectionState("idle"); submittedRef.current = false; }}>
                <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.5)" />
              </Pressable>
            </View>

            {/* Face frame */}
            <View style={styles.frameArea}>
              <Animated.View style={[styles.frameOuter, { borderColor: frameColor, transform: [{ scale: scaleAnim }] }]}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <View style={[styles.frameInner, { position: "relative" }]}>
                    <CornerBracket position="tl" color={frameColor} />
                    <CornerBracket position="tr" color={frameColor} />
                    <CornerBracket position="bl" color={frameColor} />
                    <CornerBracket position="br" color={frameColor} />
                    <ScanAnimation state={detectionState} />
                  </View>
                </Animated.View>
              </Animated.View>

              {/* Guide rings */}
              {detectionState === "idle" && (
                <View style={styles.guideText}>
                  <Text style={styles.guideLabel}>Center your face in the frame</Text>
                </View>
              )}
            </View>

            {/* Bottom controls */}
            <View style={styles.bottomControls}>
              {/* Status pill */}
              <View style={[styles.statusPill, { backgroundColor: "rgba(255,255,255,0.08)", borderColor: frameColor + "44", borderWidth: 1 }]}>
                {detectionState === "processing" && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
                {detectionState === "success" && <Ionicons name="checkmark-circle" size={18} color="#16A34A" style={{ marginRight: 8 }} />}
                {detectionState === "error" && <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 8 }} />}
                {(detectionState === "detecting" || detectionState === "locking") && <Ionicons name="scan-outline" size={18} color="#FBBF24" style={{ marginRight: 8 }} />}
                {detectionState === "idle" && <Ionicons name="eye-outline" size={18} color="rgba(255,255,255,0.5)" style={{ marginRight: 8 }} />}
                <Text style={styles.statusText}>{STATUS_LABELS[detectionState]}</Text>
              </View>

              {/* Primary action: Detect Face */}
              {detectionState === "idle" && (
                <Pressable style={[styles.primaryBtn, { backgroundColor: "#576DFA" }]} onPress={handleDetectFace}>
                  <Ionicons name="scan" size={20} color="#fff" />
                  <Text style={styles.primaryBtnText}>Detect Face</Text>
                </Pressable>
              )}

              {/* Retry on error */}
              {detectionState === "error" && (
                <Pressable style={[styles.primaryBtn, { backgroundColor: "#DC2626" }]} onPress={handleRetry}>
                  <Ionicons name="refresh" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Try Again</Text>
                </Pressable>
              )}

              {/* Manual fallback */}
              {detectionState === "idle" && (
                <Pressable style={styles.manualBtn} onPress={triggerSubmit}>
                  <Text style={styles.manualText}>Skip scan — Mark Present Directly</Text>
                </Pressable>
              )}
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
  pickIconRow: { alignItems: "center", paddingVertical: 20, gap: 10 },
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

  scanContainer: { flex: 1, alignItems: "center" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    width: "100%", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  hudCloseBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  empPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  empPillText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },

  frameArea: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  frameOuter: {
    borderWidth: 1, borderRadius: 20,
    padding: 6,
  },
  frameInner: {
    width: FRAME_W, height: FRAME_H,
    borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  guideText: { alignItems: "center" },
  guideLabel: { color: "rgba(255,255,255,0.45)", fontSize: 13, fontFamily: "Inter_400Regular" },

  bottomControls: {
    width: "100%", paddingHorizontal: 24, paddingBottom: 52, gap: 12, alignItems: "center",
  },
  statusPill: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12,
    width: "100%",
  },
  statusText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14,
    width: "100%", justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  manualBtn: {
    borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10,
  },
  manualText: { color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "Inter_400Regular" },
});
