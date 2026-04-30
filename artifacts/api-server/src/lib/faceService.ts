import path from "path";
import { mkdirSync, existsSync, createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { logger } from "./logger";

const MODEL_DIR = path.join(process.cwd(), "models");

const MODEL_FILES = [
  "tiny_face_detector_model-shard1",
  "tiny_face_detector_model-weights_manifest.json",
  "face_landmark_68_tiny_model-shard1",
  "face_landmark_68_tiny_model-weights_manifest.json",
  "face_recognition_model-shard1",
  "face_recognition_model-shard2",
  "face_recognition_model-weights_manifest.json",
];

const CDN =
  "https://raw.githubusercontent.com/vladmandic/face-api/master/model";

async function downloadModels(): Promise<void> {
  mkdirSync(MODEL_DIR, { recursive: true });
  for (const file of MODEL_FILES) {
    const dest = path.join(MODEL_DIR, file);
    if (existsSync(dest)) continue;
    logger.info({ file }, "Downloading face model");
    const resp = await fetch(`${CDN}/${file}`);
    if (!resp.ok) {
      throw new Error(`Failed to download model file ${file}: ${resp.status} ${resp.statusText}`);
    }
    const ws = createWriteStream(dest);
    await pipeline(resp.body as unknown as NodeJS.ReadableStream, ws);
    logger.info({ file }, "Model downloaded");
  }
}

let initialized = false;
let initPromise: Promise<void> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceapi: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let canvasModule: any = null;

export async function initFaceService(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    logger.info("Initializing face service...");

    [faceapi, canvasModule] = await Promise.all([
      import("@vladmandic/face-api"),
      import("canvas"),
    ]);

    const { Canvas, Image, ImageData } = canvasModule;

    faceapi.env.monkeyPatch({
      Canvas: Canvas as unknown as typeof HTMLCanvasElement,
      Image: Image as unknown as typeof HTMLImageElement,
      ImageData: ImageData as unknown as typeof globalThis.ImageData,
    });

    await downloadModels();

    await faceapi.nets.tinyFaceDetector.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceLandmark68TinyNet.loadFromDisk(MODEL_DIR);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_DIR);

    initialized = true;
    logger.info("Face service ready");
  })();

  return initPromise;
}

export function isFaceServiceReady(): boolean {
  return initialized;
}

export async function detectFaceDescriptor(
  imageBase64: string,
): Promise<Float32Array | null> {
  if (!initialized) {
    throw new Error("Face service not initialized");
  }

  const { loadImage } = canvasModule;
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  const img = await loadImage(buffer);

  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 416 }))
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  return detection?.descriptor ?? null;
}

const MATCH_THRESHOLD_SCORE = 60;

export function scoreFaces(
  stored: number[],
  live: Float32Array,
): { distance: number; matchScore: number; isMatch: boolean } {
  const distance: number = faceapi.euclideanDistance(
    stored as unknown as Float32Array,
    live,
  );
  const matchScore = Math.round(Math.max(0, Math.min(100, (1 - distance) * 100)));
  return {
    distance: parseFloat(distance.toFixed(4)),
    matchScore,
    isMatch: matchScore >= MATCH_THRESHOLD_SCORE,
  };
}
