import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { getReportsDir, PUBLIC_GATEWAYS, FONTS_DIR } from './config';
import { formatBytes } from './zip';
import type { UploadResult, QrBuffers } from './types';

// Load bundled fonts
function loadFont(name: string): Uint8Array {
  return readFileSync(join(FONTS_DIR, name));
}

// Format date for summary prose: "February 4, 2026"
function formatDateProse(d: Date): string {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Format date for header: "2026-02-04 18:10:00"
function formatDateHeader(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Extract hostname from server endpoint
function serverHost(server: string): string {
  return server.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
}

export async function writePinnedPdf(result: UploadResult, qrBuffers: QrBuffers): Promise<string> {
  const reportsDir = getReportsDir();
  mkdirSync(reportsDir, { recursive: true });

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const fileName = `${dateStr}-ipfs-ipns-${result.folderName}.pinned.pdf`;
  const filePath = join(reportsDir, fileName);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const monoBytes = loadFont('CourierNew.ttf');
  const monoBoldBytes = loadFont('CourierNew-Bold.ttf');
  const mono = await doc.embedFont(monoBytes);
  const monoBold = await doc.embedFont(monoBoldBytes);

  const W = 612; // US Letter
  const H = 792;
  const M = 36; // margin
  const contentW = W - M * 2;
  const lh = 12; // line height

  const page = doc.addPage([W, H]);
  let y = H - M;

  const host = serverHost(result.server);

  // ── Header box ──────────────────────────────────────────────────

  const boxH = 68;
  const boxY = y - boxH;

  page.drawRectangle({
    x: M, y: boxY, width: contentW, height: boxH,
    borderColor: rgb(0.15, 0.15, 0.15),
    borderWidth: 1.5,
    color: rgb(1, 1, 1),
  });

  const title = 'IPFS/IPNS REPORT';
  const titleSize = 18;
  const titleW = monoBold.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: M + (contentW - titleW) / 2,
    y: boxY + boxH - 24,
    size: titleSize, font: monoBold,
    color: rgb(0, 0, 0),
  });

  const nameSize = 12;
  const nameW = mono.widthOfTextAtSize(result.folderName, nameSize);
  page.drawText(result.folderName, {
    x: M + (contentW - nameW) / 2,
    y: boxY + boxH - 40,
    size: nameSize, font: mono,
    color: rgb(0, 0, 0),
  });

  const dateLine = `${formatDateHeader(now)}  //  ${host}`;
  const dateSize = 8;
  const dateW = mono.widthOfTextAtSize(dateLine, dateSize);
  page.drawText(dateLine, {
    x: M + (contentW - dateW) / 2,
    y: boxY + boxH - 55,
    size: dateSize, font: mono,
    color: rgb(0, 0, 0),
  });

  y = boxY - 24;

  // ── Prose paragraph ───────────────────────────────────────────

  const prose = `The folder ${result.folderName} containing ${result.fileCount} files (${formatBytes(result.folderSize)}) was published to IPFS via ${host} on ${formatDateProse(now)}. Content is pinned on the network and a compressed archive (${formatBytes(result.zipSize)}) is available as a separate CID. The folder is published to IPNS under the key ${result.ipnsKeyName}, providing a persistent name that always resolves to the latest version.`;

  const proseSize = 8.5;
  const maxLineW = contentW;
  const words = prose.split(' ');
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (mono.widthOfTextAtSize(test, proseSize) > maxLineW) {
      page.drawText(line, { x: M, y, size: proseSize, font: mono, color: rgb(0, 0, 0) });
      y -= lh;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x: M, y, size: proseSize, font: mono, color: rgb(0, 0, 0) });
    y -= lh;
  }

  y -= 10;

  // ── QR code group (3 across, boxed) ───────────────────────────

  const qrSize = 90;
  const qrGap = 36;
  const qrRowW = qrSize * 3 + qrGap * 2;
  const qrOffsetX = M + (contentW - qrRowW) / 2;
  const qrLabelSize = 7.5;
  const boxPadTop = 12;
  const boxPadBot = 10;
  const labelGap = 6;
  const qrBoxH = boxPadTop + qrSize + labelGap + 10 + boxPadBot;

  // Light border box around QR group
  page.drawRectangle({
    x: M, y: y - qrBoxH, width: contentW, height: qrBoxH,
    borderColor: rgb(0.75, 0.75, 0.75),
    borderWidth: 0.5,
    color: rgb(1, 1, 1),
  });

  const qrTopY = y - boxPadTop;

  const qrCodes: { buf: Buffer; label: string }[] = [
    { buf: qrBuffers.folder, label: 'Folder' },
    { buf: qrBuffers.zip, label: 'Zip' },
    { buf: qrBuffers.ipns, label: 'IPNS' },
  ];

  for (let i = 0; i < qrCodes.length; i++) {
    const { buf, label } = qrCodes[i];
    const qrX = qrOffsetX + i * (qrSize + qrGap);

    if (buf && buf.length > 0) {
      try {
        const img = await doc.embedPng(buf);
        page.drawImage(img, { x: qrX, y: qrTopY - qrSize, width: qrSize, height: qrSize });
      } catch {
        // QR embed failed, skip image
      }
    }

    // Centered label under QR
    const labelW = mono.widthOfTextAtSize(label, qrLabelSize);
    page.drawText(label, {
      x: qrX + (qrSize - labelW) / 2,
      y: qrTopY - qrSize - labelGap - 8,
      size: qrLabelSize, font: mono,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  y -= qrBoxH + 14;

  // ── Detail rows ───────────────────────────────────────────────

  const labelCol = M;
  const valueCol = M + 76;
  const valSize = 7.5;
  const labelSize = 7.5;

  function drawRow(label: string, value: string) {
    page.drawText(label, { x: labelCol, y, size: labelSize, font: mono, color: rgb(0, 0, 0) });
    page.drawText(value, { x: valueCol, y, size: valSize, font: mono, color: rgb(0, 0, 0) });
    y -= lh;
  }

  function drawColorSep() {
    y -= 2;
    page.drawLine({
      start: { x: M, y },
      end: { x: W - M, y },
      thickness: 0.75,
      color: rgb(0.7, 0.15, 0.15),
    });
    y -= 10;
  }

  // Folder
  drawRow('Folder CID', result.folderCid);
  drawRow('Folder URL', result.folderUrl);
  drawColorSep();

  // Zip
  if (result.zipCid && result.zipCid !== result.folderCid) {
    drawRow('Zip CID', result.zipCid);
    drawRow('Zip URL', result.zipUrl || '');
    drawColorSep();
  }

  // IPNS
  if (result.ipnsName) {
    drawRow('IPNS Key', result.ipnsKeyName);
    drawRow('IPNS Name', result.ipnsName);
    drawRow('IPNS URL', result.ipnsUrl || '');
  }

  // Gateways
  y -= 6;
  const gwHosts = PUBLIC_GATEWAYS.map((gw) => new URL(gw).hostname).join('  //  ');
  drawRow('Gateways', gwHosts);

  // Save
  const pdfBytes = await doc.save();
  writeFileSync(filePath, pdfBytes);

  return filePath;
}

// JSON report for machine consumption
export function writeJsonReport(result: UploadResult, outputDir: string): void {
  mkdirSync(outputDir, { recursive: true });

  const json = {
    timestamp: new Date().toISOString(),
    folderName: result.folderName,
    cids: {
      folder: result.folderCid,
      zip: result.zipCid,
    },
    ipns: {
      keyName: result.ipnsKeyName,
      name: result.ipnsName,
    },
    urls: {
      ipfs: result.folderUrl,
      zip: result.zipUrl,
      ipns: result.ipnsUrl,
    },
    server: result.server,
    gateway: result.gateway,
    stats: {
      fileCount: result.fileCount,
      folderSize: result.folderSize,
      zipSize: result.zipSize,
    },
    reportPath: result.reportPath,
  };

  writeFileSync(join(outputDir, `${result.folderName}-report.json`), JSON.stringify(json, null, 2));
}
