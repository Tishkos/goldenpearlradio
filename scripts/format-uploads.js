#!/usr/bin/env node
/**
 * Ensures uploads directory structure exists:
 *   uploads/
 *   uploads/processed/
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const dirs = ['uploads', 'uploads/processed'];

for (const dir of dirs) {
  const fullPath = path.join(root, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log('Created:', dir);
  } else {
    console.log('Exists:', dir);
  }
}

console.log('Uploads structure ready.');
