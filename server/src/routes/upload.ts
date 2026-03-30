import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();

function normalizeFolder(input?: string | string[]) {
  if (!input) return "";
  const raw = Array.isArray(input) ? input[0] : input;
  const cleaned = raw.replace(/\\/g, "/").replace(/^\//, "").replace(/\/$/, "");
  if (!cleaned) return "";
  if (!/^[a-zA-Z0-9/_-]+$/.test(cleaned)) return "";
  if (cleaned.includes("..")) return "";
  return cleaned;
}

// Configure multer for file uploads with preserved extensions
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = normalizeFolder(req.query.folder as string | undefined);
    const target = folder ? path.join('uploads', folder) : 'uploads/';
    fs.mkdirSync(target, { recursive: true });
    cb(null, target);
  },
  filename: (req, file, cb) => {
    // Preserve original extension and use a descriptive name
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
});

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Upload file endpoint
router.post('/upload', authenticateToken, requireAdmin, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    const folder = normalizeFolder(req.query.folder as string | undefined);
    const urlPath = folder ? `/api/uploads/${folder}/${req.file.filename}` : `/api/uploads/${req.file.filename}`;

    // Generate public URL
    // Files are saved in uploads/ directory with preserved extensions
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    const publicUrl = `${baseUrl}${urlPath}`;

    console.log('File uploaded:', {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: publicUrl
    });

    res.json({
      url: urlPath, // Relative URL for frontend
      absoluteUrl: publicUrl, // Absolute URL for audio player
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
});

// Handle CORS preflight for audio files (NO AUTH REQUIRED)
router.options('/uploads/:filename', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});
router.options('/uploads/:folder/:filename', (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.sendStatus(204);
});

// Handle HEAD requests for file verification (NO AUTH REQUIRED - public files)
router.head('/uploads/:filename', (req: Request, res: Response) => {
  const filename = decodeURIComponent(req.params.filename);
  const filePath = path.resolve(uploadsDir, filename);
  
  // Security check: prevent directory traversal
  if (!filePath.startsWith(path.resolve(uploadsDir))) {
    return res.status(403).end();
  }
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).end();
  }
  
  const stats = fs.statSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.mpeg': 'audio/mpeg',
    '.mpg': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).end();
});
router.head('/uploads/:folder/:filename', (req: Request, res: Response) => {
  const folder = normalizeFolder(req.params.folder);
  const filename = decodeURIComponent(req.params.filename);
  const rootDir = folder ? path.join(uploadsDir, folder) : uploadsDir;
  const filePath = path.resolve(rootDir, filename);

  if (!filePath.startsWith(path.resolve(rootDir))) {
    return res.status(403).end();
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).end();
  }

  const stats = fs.statSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.mpeg': 'audio/mpeg',
    '.mpg': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', stats.size);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).end();
});

// Serve processed audio files (NO AUTH REQUIRED - public files)
router.get('/uploads/processed/:filename', (req: Request, res: Response) => {
  const filename = decodeURIComponent(req.params.filename);
  const processedDir = path.join(process.cwd(), 'uploads', 'processed');
  const filePath = path.resolve(processedDir, filename);
  
  // Security check
  if (!filePath.startsWith(path.resolve(processedDir))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found', filename });
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.mpeg': 'audio/mpeg',
    '.mpg': 'audio/mpeg',
  };
  const contentType = mimeTypes[ext] || 'audio/mpeg';

  const range = req.headers.range;
  if (range) {
    try {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const file = fs.createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      });
      
      file.pipe(res);
    } catch (error: any) {
      res.status(500).json({ error: 'Range request failed', message: error.message });
    }
  } else {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.sendFile(filePath);
  }
});

// Serve uploaded files from subfolders (NO AUTH REQUIRED - public files)
router.get('/uploads/:folder/:filename', (req: Request, res: Response) => {
  const folder = normalizeFolder(req.params.folder);
  const filename = decodeURIComponent(req.params.filename);
  const rootDir = folder ? path.join(uploadsDir, folder) : uploadsDir;
  const filePath = path.resolve(rootDir, filename);

  if (!filePath.startsWith(path.resolve(rootDir))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found', filename });
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.mpeg': 'audio/mpeg',
    '.mpg': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const range = req.headers.range;
  if (range) {
    try {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
      });

      file.pipe(res);
    } catch (error: any) {
      res.status(500).json({ error: 'Range request failed', message: error.message });
    }
  } else {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.sendFile(filePath);
  }
});

// Serve uploaded files with proper MIME types (NO AUTH REQUIRED - public files)
router.get('/uploads/:filename', (req: Request, res: Response) => {
  const filename = decodeURIComponent(req.params.filename); // Decode URL-encoded filename
  const filePath = path.resolve(uploadsDir, filename); // Use resolve for absolute path
  
  console.log('Serving file request:', {
    filename: req.params.filename,
    decodedFilename: filename,
    filePath,
    absolutePath: filePath,
    exists: fs.existsSync(filePath),
    range: req.headers.range,
    method: req.method
  });
  
  // Security check: prevent directory traversal
  if (!filePath.startsWith(path.resolve(uploadsDir))) {
    console.error('Security violation: directory traversal attempt', filePath);
    return res.status(403).json({ error: 'Access denied' });
  }
  
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', {
      requested: filename,
      path: filePath,
      uploadsDir: uploadsDir,
      filesInDir: fs.readdirSync(uploadsDir).slice(0, 5) // Show first 5 files for debugging
    });
    return res.status(404).json({ error: 'File not found', filename });
  }

  // Set proper Content-Type based on file extension
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.mpeg': 'audio/mpeg',
    '.mpg': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };

  // If no extension, try to detect from file content or default to audio/mpeg
  let contentType = mimeTypes[ext];
  if (!contentType) {
    // Check file size - audio files are typically larger
    const stats = fs.statSync(filePath);
    if (stats.size > 100000) { // > 100KB, likely audio
      contentType = 'audio/mpeg'; // Default to MP3
    } else {
      contentType = 'application/octet-stream';
    }
  }

  console.log('Serving file:', {
    filename,
    contentType,
    size: fs.statSync(filePath).size
  });

  // Handle range requests for audio streaming (required by Howler.js)
  const range = req.headers.range;
  if (range) {
    try {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      console.log('Range request:', { start, end, chunksize, fileSize });
      
      const file = fs.createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
      });
      
      file.on('error', (err) => {
        console.error('File stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'File read error' });
        }
      });
      
      file.pipe(res);
    } catch (error: any) {
      console.error('Range request error:', error);
      res.status(500).json({ error: 'Range request failed', message: error.message });
    }
  } else {
    // No range request - send entire file
    console.log('Sending full file');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('sendFile error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'File send failed', message: err.message });
        }
      }
    });
  }
});

export default router;
