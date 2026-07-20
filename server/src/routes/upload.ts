import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuid } from 'uuid';
import { authenticate } from '../middleware/authenticate';
import { apiLimiter } from '../middleware/rateLimiter';
import { env } from '../config/env';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

// Allowlist: extension -> acceptable MIME types.
const ALLOWED: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.svg': ['image/svg+xml'],
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
  '.mp4': ['video/mp4'],
  '.mp3': ['audio/mpeg'],
  '.webm': ['video/webm', 'audio/webm'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
};

const uploadDir = path.resolve(env.UPLOAD_DIR, 'attachments');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimes = ALLOWED[ext];
    if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
      cb(new Error('File type not allowed'));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.use(authenticate, apiLimiter);

router.post('/', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File exceeds the 100MB limit' });
      }
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Force a safe download disposition so uploaded files cannot be rendered
    // inline as HTML (mitigates stored XSS via user-supplied files).
    res.setHeader('Content-Disposition', `attachment; filename="${req.file.originalname.replace(/"/g, '')}"`);

    res.status(201).json({
      fileUrl: `/uploads/attachments/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
    });
  });
});

export default router;
