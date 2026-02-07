import { existsSync } from 'fs';
import {
  getConfig, STATE_DIR, DB_PATH, CONFIG_JSON_PATH, STATE_ENV_PATH,
  IPFS_NODES, PUBLIC_GATEWAYS, DEFAULT_GATEWAY, getReportsDir,
} from '../config';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m',
};

function resolveSource(key: string): string {
  if (process.env[key]) return 'env / .env (CWD)';
  // Can't distinguish state .env from JSON easily, just check if it resolved
  return 'default';
}

export function runEnvCommand(): void {
  console.log(`${c.bold}bun-ipfs${c.reset} environment\n`);

  const reportsDir = getReportsDir();

  console.log(`${c.bold}${c.yellow}State Directory${c.reset}`);
  console.log(`  ${c.dim}Path:${c.reset}     ${STATE_DIR}`);
  console.log(`  ${c.dim}Database:${c.reset} ${DB_PATH} ${existsSync(DB_PATH) ? c.green + '[exists]' + c.reset : c.dim + '[not created]' + c.reset}`);
  console.log(`  ${c.dim}Config:${c.reset}   ${CONFIG_JSON_PATH} ${existsSync(CONFIG_JSON_PATH) ? c.green + '[exists]' + c.reset : c.dim + '[not created]' + c.reset}`);
  console.log(`  ${c.dim}Env:${c.reset}      ${STATE_ENV_PATH} ${existsSync(STATE_ENV_PATH) ? c.green + '[exists]' + c.reset : c.dim + '[not created]' + c.reset}`);
  console.log();

  console.log(`${c.bold}${c.yellow}Reports Directory${c.reset}`);
  console.log(`  ${c.dim}Path:${c.reset}     ${reportsDir} ${existsSync(reportsDir) ? c.green + '[exists]' + c.reset : c.dim + '[not created]' + c.reset}`);
  console.log();

  console.log(`${c.bold}${c.yellow}IPFS Configuration${c.reset}`);

  const envVars = [
    { key: 'IPFS_NODES', value: getConfig('IPFS_NODES') || '(default: localhost)' },
    { key: 'IPFS_DEFAULT_GATEWAY', value: DEFAULT_GATEWAY },
    { key: 'IPFS_PUBLIC_GATEWAYS', value: PUBLIC_GATEWAYS.join(', ') },
  ];

  for (const { key, value } of envVars) {
    const source = resolveSource(key);
    console.log(`  ${c.green}${key}${c.reset}`);
    console.log(`    ${c.dim}Value:${c.reset}  ${value}`);
    console.log(`    ${c.dim}Source:${c.reset} ${source}`);
  }
  console.log();

  console.log(`${c.bold}${c.yellow}Configured Nodes${c.reset}`);
  for (const node of IPFS_NODES) {
    console.log(`  ${c.cyan}${node.name}${c.reset}  ${node.hostname}:${node.apiPort}  ${c.dim}(${node.ip})${c.reset}  IPNS keys: ${node.hasIpnsKeys ? c.green + 'yes' : c.dim + 'no'}${c.reset}`);
  }
  console.log();
}
