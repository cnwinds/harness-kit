import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(packageRoot, '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}
