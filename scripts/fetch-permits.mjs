import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { fetchAndNormalizePermits, syncPermitsToSupabase } from '../netlify/functions/_permit-sync.js';

loadEnv({ path: path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), '.env.local') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'public', 'data');
const outputFile = path.join(outputDir, 'permits.json');

async function main() {
  const payload = await fetchAndNormalizePermits();

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  try {
    await syncPermitsToSupabase(payload.permits);
  } catch (error) {
    console.warn(`[PERMIT SYNC WARNING] ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log(`Wrote ${payload.count} permits to ${outputFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
