import fs from "fs";
import path from "path";
import multer from "multer";
import crypto from "crypto";
import { db } from "./db";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = db.getUploadsDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname) || ".bin";
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
      return;
    }
    cb(null, true);
  },
});

export function publicUploadUrl(filename: string) {
  return `/uploads/${filename}`;
}
