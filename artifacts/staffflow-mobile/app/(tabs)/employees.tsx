import { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput,
  ActivityIndicator, Platform, Modal, ScrollView,
  KeyboardAvoidingView, Alert,
} from "react-native";
import { ConfirmModal } from "@/components/ConfirmModal";
import { EnrollFaceModal } from "@/components/EnrollFaceModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useListEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from "@workspace/api-client-react";

const SALARY_TYPES = ["monthly", "daily"];
const STATUSES = ["active", "inactive"];

interface EmployeeForm {
  name: string;
  phone: string;
  email: string;
  role: string;
  department: string;
  salary: string;
  salaryType: string;
  joiningDate: string;
  status: string;
  password: string;
}

const EMPTY_FORM: EmployeeForm = {
  name: "", phone: "", email: "", role: "", department: "",
  salary: "", salaryType: "monthly", joiningDate: "", status: "active", password: "",
};

function EmployeeCard({ employee, colors, onEdit, onDelete, onEnroll }: { employee: any; colors: any; onEdit: (e: any) => void; onDelete: (id: number) => void; onEnroll: (e: any) => void }) {
  const isActive = employee.status === "active";
  const isEnrolled = !!employee.facePhotoUrl;
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: colors.primary + "22" }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>
          {employee.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[styles.cardName, { color: colors.foreground }]} numberOfLines={1}>{employee.name}</Text>
          {isEnrolled && <Ionicons name="scan-circle" size={14} color="#16A34A" />}
        </View>
        <Text style={[styles.cardRole, { color: colors.mutedForeground }]} numberOfLines={1}>
          {employee.role}{employee.department ? ` • ${employee.department}` : ""}
        </Text>
        <Text style={[styles.cardSalary, { color: colors.mutedForeground }]}>
          ₹{employee.salary.toLocaleString("en-IN")}/{employee.salaryType === "monthly" ? "mo" : "day"}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <View style={[styles.statusBadge, { backgroundColor: isActive ? "#DCFCE7" : "#FEE2E2" }]}>
          <Text style={[styles.statusText, { color: isActive ? "#16A34A" : "#DC2626" }]}>
            {isActive ? "Active" : "Inactive"}
          </Text>
        </View>
        <View style={styles.actionBtns}>
          <Pressable onPress={() => onEnroll(employee)} hitSlop={8}>
            <Ionicons name="scan-outline" size={16} color={isEnrolled ? "#16A34A" : colors.mutedForeground} />
          </Pressable>
          <Pressable onPress={() => onEdit(employee)} hitSlop={8}>
            <Ionicons name="pencil-outline" size={16} color={colors.primary} />
          </Pressable>
          <Pressable onPress={() => onDelete(employee.id)} hitSlop={8}>
            <Ionicons name="trash-outline" size={16} color={colors.destructive} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function EmployeesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);

  const { data: employees, isLoading, error, refetch } = useListEmployees({ search: search || undefined });
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [enrollTarget, setEnrollTarget] = useState<any | null>(null);

  const topPadding = Platform.OS === "web" ? 67 : 0;

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const openEdit = (emp: any) => {
    setEditingId(emp.id);
    setForm({
          name: emp.name, phone: emp.phone ?? "", email: emp.email ?? "",
          role: emp.role, department: emp.department ?? "",
          salary: String(emp.salary), salaryType: emp.salaryType,
          joiningDate: emp.joiningDate ?? "", status: emp.status ?? "active",
          password: "", // don't pre-fill password
        });
    setShowModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleDelete = (id: number) => {
    setConfirmDeleteId(id);
  };

  const handleSave = () => {
    if (!form.name || !form.role || !form.salary || !form.phone) {
      Alert.alert("Error", "Name, phone, role and salary are required.");
      return;
    }
    const salary = parseFloat(form.salary);
    if (isNaN(salary) || salary <= 0) {
      Alert.alert("Error", "Enter a valid salary amount.");
      return;
    }
    const payload: any = {
          name: form.name, phone: form.phone, email: form.email || null,
          role: form.role, department: form.department || null,
          salary, salaryType: form.salaryType,
          joiningDate: form.joiningDate || new Date().toISOString().split("T")[0],
          status: form.status,
        };
        if (form.password) {
          payload.password = form.password;
        }

    if (editingId) {
      updateEmployee.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: () => { setShowModal(false); refetch(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
          onError: () => Alert.alert("Error", "Could not update employee."),
        }
      );
    } else {
      createEmployee.mutate(
        { data: payload },
        {
          onSuccess: () => { setShowModal(false); refetch(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
          onError: () => Alert.alert("Error", "Could not create employee."),
        }
      );
    }
  };

  const isSaving = createEmployee.isPending || updateEmployee.isPending;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View style={[styles.searchBar, { paddingTop: topPadding + 12, backgroundColor: colors.background }]}>
        <View style={[styles.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search employees..."
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.destructive} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Failed to load employees</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={employees ?? []}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item }) => (
            <EmployeeCard employee={item} colors={colors} onEdit={openEdit} onDelete={handleDelete} onEnroll={setEnrollTarget} />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 100) },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="people-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {search ? "No employees found" : "No employees yet"}
              </Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + (Platform.OS === "web" ? 34 + 24 : 100 + 12) }]}
        onPress={openCreate}
      >
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView style={[styles.modalRoot, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {editingId ? "Edit Employee" : "Add Employee"}
              </Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {[
              { key: "name", label: "Full Name *", placeholder: "John Doe" },
              { key: "phone", label: "Phone *", placeholder: "+91 9876543210", keyboardType: "phone-pad" },
              { key: "email", label: "Email", placeholder: "john@company.com", keyboardType: "email-address" },
              { key: "role", label: "Role *", placeholder: "Software Engineer" },
              { key: "department", label: "Department", placeholder: "Engineering" },
              { key: "joiningDate", label: "Joining Date (YYYY-MM-DD)", placeholder: "2024-01-01" },
              { key: "password", label: editingId ? "New Password (leave blank to keep)" : "Password *", placeholder: "Min 6 characters", secureTextEntry: true },
             ].map(({ key, label, placeholder, keyboardType, secureTextEntry }: any) => (
                           <View key={key}>
                             <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
                             <TextInput
                               style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
                               value={(form as any)[key]}
                               onChangeText={(v) => setForm(f => ({ ...f, [key]: v }))}
                               placeholder={placeholder}
                               placeholderTextColor={colors.mutedForeground}
                               keyboardType={keyboardType as any}
                               autoCapitalize={key === "email" || key === "password" ? "none" : "words"}
                               secureTextEntry={secureTextEntry ?? false}
                             />
                           </View>
                         ))}

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Salary Amount *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
              value={form.salary}
              onChangeText={(v) => setForm(f => ({ ...f, salary: v }))}
              placeholder="25000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Salary Type</Text>
            <View style={styles.optionRow}>
              {SALARY_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.optionBtn, { borderColor: colors.border }, form.salaryType === t && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setForm(f => ({ ...f, salaryType: t }))}
                >
                  <Text style={[styles.optionBtnText, { color: form.salaryType === t ? "#fff" : colors.foreground }]}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Status</Text>
            <View style={styles.optionRow}>
              {STATUSES.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.optionBtn, { borderColor: colors.border }, form.status === s && { backgroundColor: s === "active" ? "#16A34A" : "#DC2626", borderColor: "transparent" }]}
                  onPress={() => setForm(f => ({ ...f, status: s }))}
                >
                  <Text style={[styles.optionBtnText, { color: form.status === s ? "#fff" : colors.foreground }]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>{editingId ? "Save Changes" : "Add Employee"}</Text>
              )}
            </Pressable>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
      <ConfirmModal
        visible={confirmDeleteId !== null}
        title="Delete Employee"
        message="This will permanently remove the employee and all their records."
        confirmLabel="Delete"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId !== null) {
            deleteEmployee.mutate({ id: confirmDeleteId }, { onSuccess: () => { setConfirmDeleteId(null); refetch(); } });
          }
        }}
      />

      <EnrollFaceModal
        visible={enrollTarget !== null}
        employee={enrollTarget}
        onClose={() => setEnrollTarget(null)}
        onSuccess={() => { setEnrollTarget(null); refetch(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchBar: { paddingHorizontal: 16, paddingBottom: 12 },
  searchRow: {
    flexDirection: "row", alignItems: "center", borderRadius: 12,
    borderWidth: 1, paddingHorizontal: 12, height: 44, gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  card: {
    flexDirection: "row", alignItems: "center", borderRadius: 14,
    padding: 14, borderWidth: 1, gap: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  cardRole: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
  cardSalary: { fontSize: 12, fontFamily: "Inter_500Medium" },
  cardActions: { alignItems: "flex-end", gap: 8 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  actionBtns: { flexDirection: "row", gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  retryBtn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  fab: {
    position: "absolute", right: 20, width: 56, height: 56,
    borderRadius: 28, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  modalRoot: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  input: {
    height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14,
    fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 16,
  },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  optionBtn: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  optionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  submitBtn: { borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", marginTop: 8 },
  submitBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
