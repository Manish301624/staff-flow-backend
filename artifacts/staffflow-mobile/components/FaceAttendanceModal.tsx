import { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, FlatList,
  ActivityIndicator, Animated, Easing, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useVerifyAttendance } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type VerifyStep =
  | "pick"
  | "capture"
  | "matching"
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

const STEP_COLORS: Record<VerifyStep, string> = {
  pick: "#576DFA",
  capture: "#576DFA",
  matching: "#FBBF24",
  success: "#16A34A",
  failed: "#DC2626",
  error: "#DC2626",
};

export function FaceAttendanceModal({ visible, employees, onSuccess, onClose }: Props) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<VerifyStep>("pick");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [matchScore, setMatchScore] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const pulseAnim = useState(() => new Animated.Value(1))[0];

  const { mutateAsync: verifyAttendance } = useVerifyAttendance();

  useEffect(() => {
    if (!visible) {
      setStep("pick");
      setSelected(null);
      setMatchScore(0);
      setErrorMsg("");
    }
  }, [visible]);

  useEffect(() => {
    if (step === "matching") {
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

  const selectEmployee = (emp: Employee) => {
    setSelected(emp);
    setStep("capture");
  };

  const handleCapture = useCallback(async () => {
    if (!selected) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted" && Platform.OS !== "web") {
      setErrorMsg("Camera permission required.");
      setStep("error");
      return;
    }

    try {
      const result = Platform.OS === "web"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            base64: true,
          })
        : await ImagePicker.launchCameraAsync({
            cameraType: ImagePicker.CameraType.front,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            base64: true,
          });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (!asset.base64) {
        setErrorMsg("Could not read image data. Please try again.");
        setStep("error");
        return;
      }

      const imageBase64 = `data:image/jpeg;base64,${asset.base64}`;
      setStep("matching");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const today = new Date().toISOString().slice(0, 10);
      const checkIn = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

      const result2 = await verifyAttendance({
        data: {
          employeeId: selected.id,
          imageBase64,
          date: today,
          checkIn,
        },
      });

      setMatchScore(result2.matchScore);

      if (result2.matched) {
        setStep("success");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await queryClient.invalidateQueries({ queryKey: ["listAttendance"] });
        await queryClient.invalidateQueries({ queryKey: ["getAttendanceSummary"] });
        setTimeout(() => onSuccess(), 2500);
      } else {
        setStep("failed");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "An error occurred during verification.";
      setErrorMsg(msg);
      setStep("error");
    }
  }, [selected, verifyAttendance, queryClient, onSuccess]);

  const stepColor = STEP_COLORS[step];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: "#060B18" }]}>

        {/* Step 1: Pick employee */}
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
                  {item.facePhotoUrl ? (
                    <View style={styles.enrolledDot}>
                      <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                    </View>
                  ) : (
                    <View style={styles.unenrolledDot}>
                      <Ionicons name="alert-circle-outline" size={16} color="#FBBF24" />
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </Pressable>
              )}
            />
          </View>
        )}

        {/* Step 2: Capture */}
        {step === "capture" && (
          <View style={styles.fullScreen}>
            <View style={styles.topBar}>
              <Pressable style={styles.hudBtn} onPress={() => { setStep("pick"); setSelected(null); }}>
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
              {selected && (
                <View style={styles.empPill}>
                  <Ionicons name="person-circle-outline" size={16} color="#fff" />
                  <Text style={styles.empPillText}>{selected.name}</Text>
                </View>
              )}
              <Pressable style={styles.hudBtn} onPress={onClose}>
                <Ionicons name="close" size={22} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.captureArea}>
              <View style={[styles.faceFrame, { borderColor: stepColor }]}>
                <Ionicons name="person-circle-outline" size={100} color={stepColor} style={{ opacity: 0.5 }} />
              </View>
              <Text style={styles.captureHint}>
                {Platform.OS === "web"
                  ? "Select a clear face photo from your device"
                  : "Position your face in the frame, then capture"}
              </Text>
            </View>

            <View style={styles.captureControls}>
              <Pressable
                style={[styles.captureBtn, { backgroundColor: "#576DFA" }]}
                onPress={handleCapture}
              >
                <Ionicons
                  name={Platform.OS === "web" ? "image-outline" : "camera"}
                  size={22} color="#fff"
                />
                <Text style={styles.captureBtnText}>
                  {Platform.OS === "web" ? "Choose Photo" : "Capture Photo"}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Step 3: Matching */}
        {step === "matching" && (
          <View style={styles.fullScreen}>
            <View style={styles.centred}>
              <Animated.View style={[styles.matchingCircle, { borderColor: "#FBBF24", transform: [{ scale: pulseAnim }] }]}>
                <ActivityIndicator size="large" color="#FBBF24" />
              </Animated.View>
              <Text style={styles.matchingTitle}>Matching Face…</Text>
              <Text style={styles.matchingDesc}>
                Comparing biometric profile against enrolled face
              </Text>
            </View>
          </View>
        )}

        {/* Step 4a: Success */}
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
              <Text style={styles.resultSub}>Attendance marked for today</Text>
            </View>
          </View>
        )}

        {/* Step 4b: Failed */}
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
                <Pressable style={[styles.failBtn, { backgroundColor: "#576DFA" }]} onPress={() => setStep("capture")}>
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

        {/* Step 4c: Error */}
        {step === "error" && (
          <View style={styles.fullScreen}>
            <View style={styles.centred}>
              <View style={[styles.resultCircle, { backgroundColor: "#FEF2F2" }]}>
                <Ionicons name="alert-circle" size={80} color="#DC2626" />
              </View>
              <Text style={styles.resultTitle}>Error</Text>
              <Text style={styles.errorMsgText}>{errorMsg}</Text>
              <View style={styles.failActions}>
                <Pressable style={[styles.failBtn, { backgroundColor: "#576DFA" }]} onPress={() => setStep("capture")}>
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
  enrolledDot: { marginRight: 2 },
  unenrolledDot: { marginRight: 2 },

  fullScreen: { flex: 1, justifyContent: "space-between" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
  },
  hudBtn: {
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

  captureArea: { flex: 1, alignItems: "center", justifyContent: "center", gap: 24 },
  faceFrame: {
    width: 220, height: 260, borderRadius: 120, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  captureHint: {
    color: "rgba(255,255,255,0.5)", fontSize: 14,
    fontFamily: "Inter_400Regular", textAlign: "center",
    maxWidth: 280, lineHeight: 20,
  },
  captureControls: {
    paddingHorizontal: 24, paddingBottom: 52, gap: 14,
  },
  captureBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, borderRadius: 14, paddingVertical: 16,
  },
  captureBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

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
  resultSub: { color: "rgba(255,255,255,0.4)", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },

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
