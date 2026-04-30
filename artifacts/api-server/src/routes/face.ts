import { Router } from "express";
import { db, employeesTable, attendanceTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { requireAuth } from "../lib/auth";
import {
  detectFaceDescriptor,
  scoreFaces,
  isFaceServiceReady,
  initFaceService,
} from "../lib/faceService";
import { logger } from "../lib/logger";

const router = Router();

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "faces");

function ensureUploadsDir() {
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

function serviceCheck(res: any): boolean {
  if (!isFaceServiceReady()) {
    res.status(503).json({
      error: "Face service is still initializing. Please retry in a moment.",
    });
    return false;
  }
  return true;
}

router.post(
  "/employees/:id/enroll-face",
  requireAuth,
  async (req, res): Promise<void> => {
    const { adminId } = (req as any).user;
    const employeeId = parseInt(req.params.id, 10);
    const { imageBase64 } = req.body as { imageBase64: string };

    if (!imageBase64) {
      res.status(400).json({ error: "imageBase64 is required" });
      return;
    }

    if (!serviceCheck(res)) {
      initFaceService().catch((err) =>
        logger.error({ err }, "Background face service init failed"),
      );
      return;
    }

    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(and(eq(employeesTable.id, employeeId), eq(employeesTable.adminId, adminId)));

    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    req.log.info({ employeeId }, "Face enrollment: running face detection");
    const descriptor = await detectFaceDescriptor(imageBase64);
    if (!descriptor) {
      req.log.warn({ employeeId }, "Face enrollment: no face detected in image");
      res.status(422).json({
        error: "No face detected in the image. Please use a clear, front-facing photo.",
      });
      return;
    }

    ensureUploadsDir();
    const filename = `employee_${employeeId}.jpg`;
    const filepath = path.join(UPLOADS_DIR, filename);
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    writeFileSync(filepath, Buffer.from(base64Data, "base64"));

    const facePhotoUrl = `/api/uploads/faces/${filename}`;

    await db
      .update(employeesTable)
      .set({
        faceDescriptor: Array.from(descriptor),
        facePhotoUrl,
      })
      .where(eq(employeesTable.id, employeeId));

    req.log.info({ employeeId, facePhotoUrl }, "Face enrolled successfully");
    res.json({ success: true, employeeId, facePhotoUrl });
  },
);

router.post(
  "/verify-attendance",
  requireAuth,
  async (req, res): Promise<void> => {
    const { adminId } = (req as any).user;
    const {
      employeeId,
      imageBase64,
      date,
      checkIn,
    } = req.body as {
      employeeId: number;
      imageBase64: string;
      date?: string;
      checkIn?: string;
    };

    if (!employeeId || !imageBase64) {
      res.status(400).json({ error: "employeeId and imageBase64 are required" });
      return;
    }

    if (!serviceCheck(res)) {
      initFaceService().catch((err) =>
        logger.error({ err }, "Background face service init failed"),
      );
      return;
    }

    req.log.info({ employeeId }, "Verify attendance: image received, detecting face");

    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(and(eq(employeesTable.id, employeeId), eq(employeesTable.adminId, adminId)));

    if (!employee) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    if (!employee.faceDescriptor || !Array.isArray(employee.faceDescriptor)) {
      res.status(422).json({
        error: "Employee has no enrolled face. Please enroll a face first.",
        code: "NOT_ENROLLED",
      });
      return;
    }

    const liveDescriptor = await detectFaceDescriptor(imageBase64);
    if (!liveDescriptor) {
      req.log.warn({ employeeId }, "Verify attendance: no face detected in captured image");
      res.status(422).json({
        error: "No face detected in the captured image. Look directly at the camera.",
        code: "NO_FACE_DETECTED",
      });
      return;
    }

    req.log.info({ employeeId }, "Face detected — running match");

    const { distance, matchScore, isMatch } = scoreFaces(
      employee.faceDescriptor,
      liveDescriptor,
    );

    req.log.info(
      { employeeId, distance, matchScore, isMatch },
      `Match Score: ${matchScore}% — ${isMatch ? "MATCHED" : "NO MATCH"}`,
    );

    if (!isMatch) {
      res.json({
        matched: false,
        matchScore,
        distance,
        error: "Identity verification failed. Face does not match enrolled profile.",
      });
      return;
    }

    const attendanceDate = date ?? new Date().toISOString().slice(0, 10);
    const attendanceCheckIn =
      checkIn ??
      new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });

    // Upsert: if an "absent" record exists for today, update it to "present".
    // If a "present" record already exists, leave it (idempotent).
    // Otherwise insert a new "present" record.
    const existingRecords = await db
      .select()
      .from(attendanceTable)
      .where(
        and(
          eq(attendanceTable.employeeId, employeeId),
          eq(attendanceTable.date, attendanceDate),
        ),
      );

    const absentRecord = existingRecords.find((r) => r.status === "absent");
    const presentRecord = existingRecords.find((r) => r.status === "present");

    let attendanceId: number;

    if (presentRecord) {
      // Already marked present today — idempotent success
      attendanceId = presentRecord.id;
      req.log.info(
        { employeeId, attendanceId },
        "Database Update Status: Already present — no change needed",
      );
    } else if (absentRecord) {
      // Upgrade existing absent record to present
      const [updated] = await db
        .update(attendanceTable)
        .set({ status: "present", checkIn: attendanceCheckIn })
        .where(eq(attendanceTable.id, absentRecord.id))
        .returning();
      attendanceId = updated.id;
      req.log.info(
        { employeeId, attendanceId },
        "Database Update Status: Success — absent → present",
      );
    } else {
      // No record exists — insert new present record
      const [record] = await db
        .insert(attendanceTable)
        .values({
          adminId,
          employeeId,
          date: attendanceDate,
          status: "present",
          checkIn: attendanceCheckIn,
        })
        .returning();
      attendanceId = record.id;
      req.log.info(
        { employeeId, attendanceId },
        "Database Update Status: Success — new present record inserted",
      );
    }

    res.json({
      matched: true,
      matchScore,
      distance,
      attendanceId,
      employeeName: employee.name,
    });
  },
);

export default router;
