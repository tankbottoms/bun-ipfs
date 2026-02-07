import { listPins } from '../db';
import { formatBytes } from '../zip';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

export function runHistoryCommand(): void {
  const pins = listPins(50);

  if (pins.length === 0) {
    console.log(`${c.dim}No push history found.${c.reset}`);
    console.log(`${c.dim}Push something first: ${c.cyan}bun-ipfs <path>${c.reset}`);
    return;
  }

  console.log(`${c.bold}bun-ipfs${c.reset} history  ${c.dim}(${pins.length} records)${c.reset}\n`);

  const pad = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '.' : s.padEnd(n);

  console.log(`  ${c.dim}${pad('Date', 20)} ${pad('Name', 20)} ${pad('CID', 18)} ${pad('Files', 6)} ${pad('Size', 10)} Server${c.reset}`);
  console.log(`  ${c.dim}${'─'.repeat(20)} ${'─'.repeat(20)} ${'─'.repeat(18)} ${'─'.repeat(6)} ${'─'.repeat(10)} ${'─'.repeat(20)}${c.reset}`);

  for (const pin of pins) {
    const ts = pin.timestamp || '';
    const cid = pin.folder_cid ? pin.folder_cid.slice(0, 16) + '..' : '';
    const serverHost = pin.server.replace(/^https?:\/\//, '').replace(/:\d+$/, '');

    console.log(
      `  ${c.dim}${pad(ts, 20)}${c.reset} ${c.cyan}${pad(pin.folder_name, 20)}${c.reset} ${pad(cid, 18)} ${pad(String(pin.file_count), 6)} ${pad(formatBytes(pin.folder_size), 10)} ${c.dim}${serverHost}${c.reset}`,
    );
  }

  console.log();
}
