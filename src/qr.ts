import QRCode from 'qrcode';
import { join } from 'path';
import { existsSync } from 'fs';
import { IMGCAT_PATH } from './config';
import type { QrPaths, QrBuffers } from './types';

// Generate QR codes as PNG files (for PDF embedding and backward compat)
export async function generateQrCodes(
  folderName: string,
  folderUrl: string,
  zipUrl: string,
  ipnsUrl: string,
  outputDir: string,
): Promise<QrPaths> {
  const paths: QrPaths = {
    folder: join(outputDir, `${folderName}-ipfs-folder.png`),
    zip: join(outputDir, `${folderName}-ipfs-zip.png`),
    ipns: join(outputDir, `${folderName}-ipns.png`),
  };

  const opts = { width: 400, margin: 2 };

  await Promise.all([
    QRCode.toFile(paths.folder, folderUrl, opts),
    QRCode.toFile(paths.zip, zipUrl, opts),
    ipnsUrl ? QRCode.toFile(paths.ipns, ipnsUrl, opts) : Promise.resolve(),
  ]);

  return paths;
}

// Generate QR codes as in-memory buffers (no file writes)
export async function generateQrBuffers(
  folderUrl: string,
  zipUrl: string,
  ipnsUrl: string,
): Promise<QrBuffers> {
  const opts = { width: 400, margin: 2, type: 'png' as const };

  const [folder, zip, ipns] = await Promise.all([
    QRCode.toBuffer(folderUrl, opts),
    QRCode.toBuffer(zipUrl, opts),
    ipnsUrl ? QRCode.toBuffer(ipnsUrl, opts) : Promise.resolve(Buffer.alloc(0)),
  ]);

  return { folder, zip, ipns };
}

// Generate base64 data URL for PDF embedding
export async function generateQrDataUrl(url: string): Promise<string> {
  if (!url) return '';
  return QRCode.toDataURL(url, { width: 200, margin: 1 });
}

// Print QR code to terminal using imgcat (iTerm2) or UTF-8 text fallback
export async function printQrToTerminal(label: string, url: string): Promise<void> {
  if (!url) return;

  const c = { reset: '\x1b[0m', dim: '\x1b[2m', cyan: '\x1b[36m', bold: '\x1b[1m' };
  console.log(`\n  ${c.bold}${label}${c.reset}`);
  console.log(`  ${c.dim}${url}${c.reset}`);

  // Try imgcat first (iTerm2)
  const imgcatPath = existsSync(IMGCAT_PATH) ? IMGCAT_PATH : null;
  if (imgcatPath) {
    try {
      const buffer = await QRCode.toBuffer(url, { width: 300, margin: 1 });
      const proc = Bun.spawn([imgcatPath, '--width', '30'], {
        stdin: 'pipe',
      });
      proc.stdin.write(buffer);
      proc.stdin.end();
      await proc.exited;
      return;
    } catch {
      // Fall through to text QR
    }
  }

  // Fallback: UTF-8 text QR code
  try {
    const text = await QRCode.toString(url, { type: 'utf8' } as any);
    console.log(text);
  } catch {
    console.log(`  ${c.dim}(QR display unavailable)${c.reset}`);
  }
}
