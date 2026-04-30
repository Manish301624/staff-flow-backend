import { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable,
  ActivityIndicator, Image, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useEnrollFace } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface Employee { id: number; name: string; role: string; facePhotoUrl?: string | null; }

interface Props {
  visible: boolean;
  employee: Employee | null;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = "capture" | "preview" | "uploading" | "done" | "error";

export function EnrollFaceModal({ visible, employee, onClose, onSuccess }: Props) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("capture");
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const { mutateAsync: enrollFace } = useEnrollFace();

  const reset = useCallback(() => {
    setStep("capture");
    setCapturedBase64(null);
    setCapturedUri(null);
    setErrorMsg("");
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted" && Platform.OS !== "web") {
      setErrorMsg("Camera permission is required to capture a face photo.");
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
        setErrorMsg("Failed to get image data. Please try again.");
        return;
      }

      const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
      setCapturedBase64(dataUrl);
      setCapturedUri(asset.uri);
      setStep("preview");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      setErrorMsg("Failed to open camera. Please try again.");
    }
  };

  const handleEnroll = async () => {
    if (!capturedBase64 || !employee) return;
    setStep("uploading");
    try {
      await enrollFace({ id: employee.id, data: { imageBase64: capturedBase64 } });
      await queryClient.invalidateQueries({ queryKey: ["listEmployees"] });
      setStep("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => { reset(); onSuccess(); }, 1800);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Enrollment failed. Make sure the photo clearly shows a front-facing face.";
      setErrorMsg(msg);
      setStep("error");
    }
  };

  if (!employee) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={handleClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>Register Face</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.body}>
          {/* Employee info */}
          <View style={[styles.empRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.empAvatar, { backgroundColor: colors.primary + "22" }]}>
              <Text style={[styles.empAvatarText, { color: colors.primary }]}>
                {employee.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.empName, { color: colors.foreground }]}>{employee.name}</Text>
              <Text style={[styles.empRole, { color: colors.mutedForeground }]}>{employee.role}</Text>
            </View>
            {employee.facePhotoUrl ? (
              <View style={styles.enrolledBadge}>
                <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                <Text style={styles.enrolledText}>Enrolled</Text>
              </View>
            ) : (
              <View style={styles.pendingBadge}>
                <Ionicons name="time-outline" size={14} color="#92400E" />
                <Text style={styles.pendingText}>Not enrolled</Text>
              </View>
            )}
          </View>

          {/* Steps */}
          {step === "capture" && (
            <View style={styles.section}>
              <View style={[styles.guideBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="camera-outline" size={48} color={colors.mutedForeground} />
                <Text style={[styles.guideTitle, { color: colors.foreground }]}>Take a clear face photo</Text>
                <Text style={[styles.guideDesc, { color: colors.mutedForeground }]}>
                  • Face must be clearly visible and centred{"\n"}
                  • Good, even lighting (no shadows){"\n"}
                  • Look directly at the camera{"\n"}
                  • Remove sunglasses or heavy makeup
                </Text>
              </View>
              <Pressable style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleCapture}>
                <Ionicons name={Platform.OS === "web" ? "image-outline" : "camera"} size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>
                  {Platform.OS === "web" ? "Choose Photo from Device" : "Open Camera"}
                </Text>
              </Pressable>
            </View>
          )}

          {step === "preview" && capturedUri && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Captured photo</Text>
              <View style={styles.photoPreviewWrap}>
                <Image source={{ uri: capturedUri }} style={styles.photoPreview} resizeMode="cover" />
                <View style={styles.photoOverlay}>
                  <Ionicons name="checkmark-circle" size={28} color="#16A34A" />
                </View>
              </View>
              <View style={styles.previewActions}>
                <Pressable
                  style={[styles.secondaryBtn, { borderColor: colors.border }]}
                  onPress={() => { setCapturedBase64(null); setCapturedUri(null); setStep("capture"); }}
                >
                  <Ionicons name="refresh" size={16} color={colors.foreground} />
                  <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Retake</Text>
                </Pressable>
                <Pressable style={[styles.primaryBtn, { backgroundColor: "#16A34A", flex: 1 }]} onPress={handleEnroll}>
                  <Ionicons name="scan" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>Enroll Face</Text>
                </Pressable>
              </View>
            </View>
          )}

          {step === "uploading" && (
            <View style={styles.centeredSection}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.statusTitle, { color: colors.foreground }]}>Analysing face…</Text>
              <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                Detecting facial landmarks and computing biometric profile
              </Text>
            </View>
          )}

          {step === "done" && (
            <View style={styles.centeredSection}>
              <View style={[styles.successCircle, { backgroundColor: "#DCFCE7" }]}>
                <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
              </View>
              <Text style={[styles.statusTitle, { color: colors.foreground }]}>Face Enrolled!</Text>
              <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                {employee.name}'s biometric profile is saved. Face recognition is ready.
              </Text>
            </View>
          )}

          {step === "error" && (
            <View style={styles.section}>
              <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                <Ionicons name="alert-circle" size={32} color="#DC2626" />
                <Text style={styles.errorTitle}>Enrollment Failed</Text>
                <Text style={styles.errorMsg}>{errorMsg}</Text>
              </View>
              <Pressable style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => setStep("capture")}>
                <Ionicons name="refresh" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>Try Again</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 18, fontFamily: "Inter_700Bold" },
  body: { flex: 1, padding: 20, gap: 16 },

  empRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 14,
  },
  empAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  empAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  empName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  empRole: { fontSize: 12, fontFamily: "Inter_400Regular" },
  enrolledBadge: {
    marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  enrolledText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#16A34A" },
  pendingBadge: {
    marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
  },
  pendingText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#92400E" },

  section: { gap: 14 },
  sectionLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  guideBox: {
    borderRadius: 16, borderWidth: 1, padding: 24,
    alignItems: "center", gap: 12,
  },
  guideTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  guideDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 20,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },

  photoPreviewWrap: {
    alignSelf: "center", borderRadius: 120, overflow: "hidden",
    position: "relative",
  },
  photoPreview: { width: 200, height: 200, borderRadius: 100 },
  photoOverlay: {
    position: "absolute", bottom: 12, right: 12,
    backgroundColor: "white", borderRadius: 16, padding: 2,
  },

  previewActions: { flexDirection: "row", gap: 10 },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 18,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  centeredSection: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingVertical: 40 },
  successCircle: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  statusTitle: { fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  statusSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, maxWidth: 280 },

  errorBox: {
    borderRadius: 16, borderWidth: 1, padding: 24,
    alignItems: "center", gap: 10,
  },
  errorTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#DC2626" },
  errorMsg: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#B91C1C", textAlign: "center", lineHeight: 20 },
});
