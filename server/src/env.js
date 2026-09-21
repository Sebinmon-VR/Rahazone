// Loads server/.env into process.env if present (Node 21+ built-in). Import this first.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env'));
} catch {
  /* no .env file: rely on real environment variables */
}
