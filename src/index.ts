#!/usr/bin/env bun

import * as p from '@clack/prompts';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, resolve, basename, extname } from 'path';
import { UPLOAD_DIR, DEFAULT_GATEWAY, GLOBAL_REPORTS_DIR, getReportsDir, setReportsDir, setUseGlobalDir, STATE_DIR, CONFIG_JSON_PATH } from './config';
import { findAvailableServer, addDirectoryToIpfs, addFileToIpfs, pinContent, publishToIpns } from './ipfs';
import { createZip, countFiles, getDirectorySize, getFileSize, formatBytes } from './zip';
import { generateQrBuffers, printQrToTerminal } from './qr';
import { writePinnedPdf, writeJsonReport } from './report';
import { insertPin } from './db';
import { parseArgs, printHelp, printVersion } from './cli';
import { runEnvCommand } from './commands/env';
import { runPingCommand } from './commands/ping';
import { runHistoryCommand } from './commands/history';
import { runFindCommand } from './commands/find';
import { runGatewayCommand } from './commands/gateway';
import { runWizard } from './wizard';
import type { ServerInfo, UploadResult } from './types';

// ANSI helpers for CLI mode output
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

// ── Interactive TUI Mode ──────────────────────────────────────────────

async function interactiveMode() {
  p.intro('bun-ipfs');

  if (!existsSync(UPLOAD_DIR)) {
    p.cancel('upload/ directory not found');
    process.exit(1);
  }

  const folders = readdirSync(UPLOAD_DIR)
    .filter((f) => {
      const fullPath = join(UPLOAD_DIR, f);
      return statSync(fullPath).isDirectory();
    })
    .filter((f) => !f.startsWith('.'));

  if (folders.length === 0) {
    p.cancel('No folders found in upload/');
    process.exit(1);
  }

  p.log.info(`Found ${folders.length} folder${folders.length > 1 ? 's' : ''} in upload/`);

  const gateway = await p.select({
    message: 'Public gateway for URLs',
    options: [
      { value: 'https://ipfs.io', label: 'ipfs.io' },
      { value: 'https://dweb.link', label: 'dweb.link' },
      { value: 'custom', label: 'Custom gateway' },
    ],
  });

  if (p.isCancel(gateway)) {
    p.cancel('Cancelled');
    process.exit(0);
  }

  let gatewayUrl = gateway as string;

  if (gatewayUrl === 'custom') {
    const custom = await p.text({
      message: 'Enter gateway URL (e.g. https://gateway.example.com)',
      validate: (v) => {
        if (!v.startsWith('http')) return 'Must start with http:// or https://';
      },
    });

    if (p.isCancel(custom)) {
      p.cancel('Cancelled');
      process.exit(0);
    }

    gatewayUrl = (custom as string).replace(/\/$/, '');
  }

  const selected = await p.multiselect({
    message: 'Select folders to push',
    options: folders.map((f) => {
      const dir = join(UPLOAD_DIR, f);
      const files = countFiles(dir);
      const size = formatBytes(getDirectorySize(dir));
      return { value: f, label: f, hint: `${files} files, ${size}` };
    }),
  });

  if (p.isCancel(selected)) {
    p.cancel('Cancelled');
    process.exit(0);
  }

  const selectedFolders = selected as string[];

  const connectSpinner = p.spinner();
  connectSpinner.start('Connecting to IPFS node...');

  const server = await findAvailableServer();

  if (!server) {
    connectSpinner.stop('No IPFS node available');
    p.log.error('Could not connect to any IPFS node.');
    p.log.message(
      'Try one of:\n  1. ssh spark-2 "docker start ipfs"\n  2. ssh spark-1 "docker start ipfs"\n  3. ipfs daemon',
    );
    p.cancel('No IPFS connection');
    process.exit(1);
  }

  connectSpinner.stop(`Connected to ${server.hostname}`);

  if (!server.hasIpnsKeys) {
    p.log.warn('Connected node does not have existing IPNS keys. New keys will be created.');
  }

  const proceed = await p.confirm({
    message: `Push ${selectedFolders.length} folder${selectedFolders.length > 1 ? 's' : ''} to ${server.hostname}?`,
  });

  if (p.isCancel(proceed) || !proceed) {
    p.cancel('Cancelled');
    process.exit(0);
  }

  const results: UploadResult[] = [];
  const errors: { folder: string; error: string }[] = [];

  for (const folderName of selectedFolders) {
    const sourceDir = join(UPLOAD_DIR, folderName);

    try {
      await processFolder(folderName, sourceDir, server, gatewayUrl, results, false, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ folder: folderName, error: msg });
      p.log.error(`${folderName}: ${msg}`);
    }
  }

  p.log.message('');

  if (results.length > 0) {
    p.log.success(`Pushed ${results.length} folder${results.length > 1 ? 's' : ''}`);
    p.log.message('');

    for (const r of results) {
      p.log.message(`--- ${r.folderName} ---`);
      p.log.message(`  Folder CID: ${r.folderCid}`);
      p.log.message(`  Zip CID:    ${r.zipCid}`);
      p.log.message(`  IPNS:       ${r.ipnsName}`);
      p.log.message(`  IPFS URL:   ${r.folderUrl}`);
      p.log.message(`  IPNS URL:   ${r.ipnsUrl}`);
      if (r.reportPath) {
        p.log.message(`  Report:     ${r.reportPath}`);
      }
      p.log.message('');
    }
  }

  if (errors.length > 0) {
    p.log.warn(`${errors.length} folder${errors.length > 1 ? 's' : ''} failed:`);
    for (const e of errors) {
      p.log.message(`  ${e.folder}: ${e.error}`);
    }
  }

  p.outro('Done');
}

// ── CLI Push Mode ─────────────────────────────────────────────────────

async function cliPushMode(paths: string[], gatewayUrl: string, quiet: boolean, showQr: boolean, useGlobalDir: boolean) {
  // Set the global directory flag before any operations
  setUseGlobalDir(useGlobalDir);
  if (!quiet) {
    console.log(`${c.cyan}bun-ipfs${c.reset} ${c.dim}uploading ${paths.length} path${paths.length > 1 ? 's' : ''}${c.reset}`);
    console.log();
  }

  // Connect to IPFS
  if (!quiet) process.stdout.write(`${c.dim}  Connecting to IPFS...${c.reset}`);
  const server = await findAvailableServer();

  if (!server) {
    console.log(` ${c.red}FAILED${c.reset}`);
    console.error(`${c.red}Could not connect to any IPFS node.${c.reset}`);
    console.error(`${c.dim}Configure IPFS_NODES in .env or run ${c.cyan}bun-ipfs config${c.reset}`);
    process.exit(1);
  }

  if (!quiet) console.log(` ${c.green}${server.hostname}${c.reset}`);

  const results: UploadResult[] = [];
  const errors: { path: string; error: string }[] = [];

  for (const inputPath of paths) {
    const resolved = resolve(inputPath);

    if (!existsSync(resolved)) {
      errors.push({ path: inputPath, error: 'Path does not exist' });
      if (!quiet) console.log(`  ${c.red}[x]${c.reset} ${inputPath}: not found`);
      continue;
    }

    const stat = statSync(resolved);

    try {
      if (stat.isDirectory()) {
        await processFolder(basename(resolved), resolved, server, gatewayUrl, results, quiet, showQr);
      } else if (stat.isFile()) {
        await processFile(resolved, server, gatewayUrl, results, quiet, showQr);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ path: inputPath, error: msg });
      if (!quiet) console.log(`  ${c.red}[x]${c.reset} ${inputPath}: ${msg}`);
    }
  }

  // Summary
  if (!quiet) {
    console.log();
    if (results.length > 0) {
      console.log(`${c.green}  [done]${c.reset} Pushed ${results.length} item${results.length > 1 ? 's' : ''}`);
      console.log();
      for (const r of results) {
        console.log(`  ${c.bold}${r.folderName}${c.reset}`);
        console.log(`  ${c.dim}CID${c.reset}     ${c.cyan}${r.folderCid}${c.reset}`);
        if (r.zipCid && r.zipCid !== r.folderCid) {
          console.log(`  ${c.dim}ZIP${c.reset}     ${c.cyan}${r.zipCid}${c.reset}`);
        }
        if (r.ipnsName) {
          console.log(`  ${c.dim}IPNS${c.reset}    ${r.ipnsName}`);
        }
        console.log(`  ${c.dim}URL${c.reset}     ${r.folderUrl}`);
        if (r.reportPath) {
          console.log(`  ${c.dim}Report${c.reset}  ${r.reportPath}`);
        }
        console.log();
      }
      console.log(`${c.dim}  State directory: ${STATE_DIR}${c.reset}`);
      console.log();
    }
    if (errors.length > 0) {
      console.log(`${c.yellow}  [warn]${c.reset} ${errors.length} failed:`);
      for (const e of errors) {
        console.log(`    ${e.path}: ${e.error}`);
      }
    }
  }
}

// ── Process a single file ─────────────────────────────────────────────

async function processFile(
  filePath: string,
  server: ServerInfo,
  gatewayUrl: string,
  results: UploadResult[],
  quiet = false,
  showQr = false,
): Promise<void> {
  const fileName = basename(filePath, extname(filePath));
  const fileSize = getFileSize(filePath);
  const ipnsKeyName = `push-${fileName}`;

  if (!quiet) process.stdout.write(`  ${c.dim}[..]${c.reset} ${fileName}: uploading...`);

  const fileCid = await addFileToIpfs(server, filePath);
  if (!quiet) process.stdout.write(`\r  ${c.green}[ok]${c.reset} ${fileName}: ${fileCid.slice(0, 16)}...`);

  // Pin
  await pinContent(server, fileCid);

  // IPNS
  let ipnsName = '';
  try {
    const ipns = await publishToIpns(server, fileCid, ipnsKeyName);
    ipnsName = ipns.name;
  } catch {
    ipnsName = '';
  }

  const folderUrl = `${gatewayUrl}/ipfs/${fileCid}`;
  const ipnsUrl = ipnsName ? `${gatewayUrl}/ipns/${ipnsName}` : '';

  // QR buffers for PDF
  let qrBuffers;
  try {
    qrBuffers = await generateQrBuffers(folderUrl, folderUrl, ipnsUrl);
  } catch {
    // QR generation is optional
  }

  const result: UploadResult = {
    folderName: fileName,
    folderCid: fileCid,
    zipCid: fileCid,
    ipnsKeyName,
    ipnsName,
    server: server.endpoint,
    gateway: gatewayUrl,
    folderUrl,
    zipUrl: folderUrl,
    ipnsUrl,
    fileCount: 1,
    folderSize: fileSize,
    zipSize: fileSize,
  };

  // Generate PDF report
  if (qrBuffers) {
    try {
      result.reportPath = await writePinnedPdf(result, qrBuffers);
    } catch {
      // PDF generation is non-critical
    }
  }

  // Insert into database
  try {
    insertPin({
      folder_name: result.folderName,
      folder_cid: result.folderCid,
      zip_cid: result.zipCid,
      ipns_key_name: result.ipnsKeyName,
      ipns_name: result.ipnsName,
      server: result.server,
      gateway: result.gateway,
      folder_url: result.folderUrl,
      zip_url: result.zipUrl,
      ipns_url: result.ipnsUrl,
      file_count: result.fileCount,
      folder_size: result.folderSize,
      zip_size: result.zipSize,
      report_path: result.reportPath,
    });
  } catch {
    // DB insert is non-critical
  }

  // Write JSON report alongside PDF
  writeJsonReport(result, getReportsDir());

  if (!quiet) console.log(`\r  ${c.green}[ok]${c.reset} ${fileName}: ${fileCid.slice(0, 16)}...  `);

  // QR to terminal
  if (showQr) {
    await printQrToTerminal('IPFS', folderUrl);
    if (ipnsUrl) await printQrToTerminal('IPNS', ipnsUrl);
  }

  results.push(result);
}

// ── Process a folder ──────────────────────────────────────────────────

async function processFolder(
  folderName: string,
  sourceDir: string,
  server: ServerInfo,
  gatewayUrl: string,
  results: UploadResult[],
  quiet = false,
  showQr = false,
): Promise<void> {
  const fileCount = countFiles(sourceDir);
  if (fileCount === 0) {
    if (!quiet) console.log(`  ${c.yellow}[skip]${c.reset} ${folderName}: empty folder`);
    return;
  }

  const folderSize = getDirectorySize(sourceDir);
  const ipnsKeyName = `push-${folderName}`;

  if (quiet) {
    // Quiet mode: no spinners, direct calls
    const zipPath = await createZip(sourceDir, folderName);
    const zipSize = getFileSize(zipPath);
    const folderCid = await addDirectoryToIpfs(server, sourceDir);
    const zipCid = await addFileToIpfs(server, zipPath);
    await pinContent(server, folderCid);
    await pinContent(server, zipCid);

    let ipnsName = '';
    try {
      const ipns = await publishToIpns(server, folderCid, ipnsKeyName);
      ipnsName = ipns.name;
    } catch {
      ipnsName = '';
    }

    const folderUrl = `${gatewayUrl}/ipfs/${folderCid}/`;
    const zipUrl = `${gatewayUrl}/ipfs/${zipCid}`;
    const ipnsUrl = ipnsName ? `${gatewayUrl}/ipns/${ipnsName}/` : '';

    let qrBuffers;
    try {
      qrBuffers = await generateQrBuffers(folderUrl, zipUrl, ipnsUrl);
    } catch {}

    const result: UploadResult = {
      folderName, folderCid, zipCid, ipnsKeyName, ipnsName,
      server: server.endpoint, gateway: gatewayUrl,
      folderUrl, zipUrl, ipnsUrl,
      fileCount, folderSize, zipSize,
    };

    if (qrBuffers) {
      try {
        result.reportPath = await writePinnedPdf(result, qrBuffers);
      } catch {}
    }

    try {
      insertPin({
        folder_name: result.folderName, folder_cid: result.folderCid,
        zip_cid: result.zipCid, ipns_key_name: result.ipnsKeyName,
        ipns_name: result.ipnsName, server: result.server,
        gateway: result.gateway, folder_url: result.folderUrl,
        zip_url: result.zipUrl, ipns_url: result.ipnsUrl,
        file_count: result.fileCount, folder_size: result.folderSize,
        zip_size: result.zipSize, report_path: result.reportPath,
      });
    } catch {}

    writeJsonReport(result, getReportsDir());
    results.push(result);
    return;
  }

  // Interactive mode with spinners
  const spinner = p.spinner();

  spinner.start(`${folderName}: creating zip...`);
  const zipPath = await createZip(sourceDir, folderName);
  const zipSize = getFileSize(zipPath);
  spinner.stop(`${folderName}: zip created (${formatBytes(zipSize)})`);

  spinner.start(`${folderName}: uploading folder to IPFS...`);
  const folderCid = await addDirectoryToIpfs(server, sourceDir);
  spinner.stop(`${folderName}: folder CID ${folderCid.slice(0, 20)}...`);

  spinner.start(`${folderName}: uploading zip to IPFS...`);
  const zipCid = await addFileToIpfs(server, zipPath);
  spinner.stop(`${folderName}: zip CID ${zipCid.slice(0, 20)}...`);

  spinner.start(`${folderName}: pinning content...`);
  await pinContent(server, folderCid);
  await pinContent(server, zipCid);
  spinner.stop(`${folderName}: pinned`);

  spinner.start(`${folderName}: publishing to IPNS...`);
  let ipnsName = '';
  try {
    const ipns = await publishToIpns(server, folderCid, ipnsKeyName);
    ipnsName = ipns.name;
    spinner.stop(`${folderName}: IPNS published`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    spinner.stop(`${folderName}: IPNS publish failed (${msg})`);
    p.log.warn('CID is still pinned -- IPNS just timed out.');
    ipnsName = ipnsKeyName;
  }

  const folderUrl = `${gatewayUrl}/ipfs/${folderCid}/`;
  const zipUrl = `${gatewayUrl}/ipfs/${zipCid}`;
  const ipnsUrl = ipnsName ? `${gatewayUrl}/ipns/${ipnsName}/` : '';

  spinner.start(`${folderName}: generating QR codes + PDF report...`);
  let qrBuffers;
  try {
    qrBuffers = await generateQrBuffers(folderUrl, zipUrl, ipnsUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    spinner.stop(`${folderName}: QR generation failed (${msg})`);
  }

  const result: UploadResult = {
    folderName, folderCid, zipCid, ipnsKeyName, ipnsName,
    server: server.endpoint, gateway: gatewayUrl,
    folderUrl, zipUrl, ipnsUrl,
    fileCount, folderSize, zipSize,
  };

  if (qrBuffers) {
    try {
      result.reportPath = await writePinnedPdf(result, qrBuffers);
      spinner.stop(`${folderName}: report written to ${result.reportPath}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      spinner.stop(`${folderName}: PDF report failed (${msg})`);
    }
  }

  // Insert into database
  try {
    insertPin({
      folder_name: result.folderName, folder_cid: result.folderCid,
      zip_cid: result.zipCid, ipns_key_name: result.ipnsKeyName,
      ipns_name: result.ipnsName, server: result.server,
      gateway: result.gateway, folder_url: result.folderUrl,
      zip_url: result.zipUrl, ipns_url: result.ipnsUrl,
      file_count: result.fileCount, folder_size: result.folderSize,
      zip_size: result.zipSize, report_path: result.reportPath,
    });
  } catch {
    // DB insert is non-critical
  }

  writeJsonReport(result, getReportsDir());

  // QR to terminal
  if (showQr && qrBuffers) {
    await printQrToTerminal('IPFS Folder', folderUrl);
    await printQrToTerminal('IPFS Zip', zipUrl);
    if (ipnsUrl) await printQrToTerminal('IPNS', ipnsUrl);
  }

  results.push(result);
}

// ── First-run check ──────────────────────────────────────────────────

async function checkFirstRun(): Promise<void> {
  const { existsSync: exists } = await import('fs');
  const { mkdirSync, writeFileSync, readFileSync } = await import('fs');

  if (exists(CONFIG_JSON_PATH)) return;

  // First run — ask where to store reports
  mkdirSync(STATE_DIR, { recursive: true });

  // First run setup - we'll just create the state directory
  // Reports will be saved to CWD by default now
  p.log.info(`State directory: ${STATE_DIR}`);
  p.log.info(`Reports will be saved to current directory by default`);
  p.log.info(`Use --use-global-dir to save to: ${GLOBAL_REPORTS_DIR}`);

  // Create a minimal config file to mark first run complete
  let config: Record<string, unknown> = {};
  if (exists(CONFIG_JSON_PATH)) {
    try { config = JSON.parse(readFileSync(CONFIG_JSON_PATH, 'utf-8')); } catch {}
  }
  config.firstRunComplete = true;
  writeFileSync(CONFIG_JSON_PATH, JSON.stringify(config, null, 2) + '\n');
}

// ── Entry point ───────────────────────────────────────────────────────

const args = parseArgs(process.argv);

// Commands that need first-run check (anything that touches DB or reports)
const needsInit = new Set<string>(['push', 'interactive', 'history', 'find', 'gateway', 'config']);

if (needsInit.has(args.command)) {
  checkFirstRun().then(() => runCommand(args)).catch((err) => {
    console.error(`${c.red}${err instanceof Error ? err.message : String(err)}${c.reset}`);
    process.exit(1);
  });
} else {
  runCommand(args);
}

function runCommand(args: ReturnType<typeof parseArgs>) {

switch (args.command) {
  case 'help':
    printHelp();
    break;

  case 'version':
    printVersion();
    break;

  case 'interactive':
    interactiveMode().catch((err) => {
      p.log.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
    break;

  case 'push':
    cliPushMode(
      args.paths,
      args.gateway || DEFAULT_GATEWAY,
      args.quiet,
      args.qr,
      args.useGlobalDir,
    ).catch((err) => {
      console.error(`${c.red}${err instanceof Error ? err.message : String(err)}${c.reset}`);
      process.exit(1);
    });
    break;

  case 'env':
    runEnvCommand();
    break;

  case 'ping':
    runPingCommand().catch((err) => {
      console.error(`${c.red}${err instanceof Error ? err.message : String(err)}${c.reset}`);
      process.exit(1);
    });
    break;

  case 'history':
    runHistoryCommand();
    break;

  case 'find':
    runFindCommand(args.findQuery);
    break;

  case 'gateway':
    runGatewayCommand(args.gatewayArgs);
    break;

  case 'config':
    runWizard().catch((err) => {
      console.error(`${c.red}${err instanceof Error ? err.message : String(err)}${c.reset}`);
      process.exit(1);
    });
    break;
}
} // end runCommand
