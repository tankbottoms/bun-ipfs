import { $ } from 'bun';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';

export async function createZip(sourceDir: string, folderName: string, outputDir?: string): Promise<string> {
  const zipDir = outputDir || sourceDir.replace(/\/[^/]+$/, '');
  const zipPath = join(zipDir, `${folderName}.zip`);

  // Remove existing zip if present
  await $`rm -f ${zipPath}`.quiet();

  // Create zip from inside the source directory so paths are relative
  await $`cd ${sourceDir} && zip -r ${zipPath} .`.quiet();

  return zipPath;
}

export function countFiles(dir: string): number {
  let count = 0;
  const entries = readdirSync(dir, { recursive: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.toString());
    if (statSync(fullPath).isFile()) count++;
  }
  return count;
}

export function getDirectorySize(dir: string): number {
  let total = 0;
  const entries = readdirSync(dir, { recursive: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.toString());
    const stat = statSync(fullPath);
    if (stat.isFile()) total += stat.size;
  }
  return total;
}

export function getFileSize(path: string): number {
  return statSync(path).size;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}
