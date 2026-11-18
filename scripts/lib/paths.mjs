// Proje klasör yolları (Windows ve Linux/macOS'ta aynı şekilde çalışır)
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '..', '..');
export const DATA_FILE = path.join(ROOT, 'data', 'site.json');
export const DIST = path.join(ROOT, 'dist');
export const STATIC_DIR = path.join(ROOT, 'static');
export const ASSETS_DIR = path.join(ROOT, 'assets');
export const ADMIN_DIR = path.join(ROOT, 'admin');
export const MARKED_ESM = path.join(ROOT, 'node_modules', 'marked', 'lib', 'marked.esm.js');
