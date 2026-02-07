import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import type { IpfsNode, BunIpfsConfig } from './types';

export const VERSION = '1.0.0';
export const TOOL_NAME = 'bun-ipfs';

// State directory: ~/.local/store/bun-ipfs/ (DB, config, .env)
const HOME = process.env.HOME || process.env.USERPROFILE || '/tmp';
export const STATE_DIR = join(HOME, '.local', 'store', 'bun-ipfs');
export const DB_PATH = join(STATE_DIR, 'bun-ipfs.sqlite');
export const CONFIG_JSON_PATH = join(STATE_DIR, 'bun-ipfs.json');
export const IMGCAT_PATH = join(STATE_DIR, 'imgcat');
export const STATE_ENV_PATH = join(STATE_DIR, '.env');

// Reports directory: current working directory by default, or global dir if --use-global-dir flag is set
const isMac = process.platform === 'darwin';
export const GLOBAL_REPORTS_DIR = isMac
  ? join(HOME, 'Documents', 'bun-ipfs', 'reports')
  : join(STATE_DIR, 'reports');

// Mutable reports dir — set by CLI flag or defaults to CWD
let _reportsDir = '';
let _useGlobalDir = false;

export function getReportsDir(): string {
  if (_reportsDir) return _reportsDir;
  // If using global directory flag, use the global reports dir
  if (_useGlobalDir) {
    _reportsDir = GLOBAL_REPORTS_DIR;
    return _reportsDir;
  }
  // Otherwise use current working directory
  _reportsDir = process.cwd();
  return _reportsDir;
}

export function setReportsDir(dir: string): void {
  _reportsDir = dir;
}

export function setUseGlobalDir(use: boolean): void {
  _useGlobalDir = use;
}

export function getUseGlobalDir(): boolean {
  return _useGlobalDir;
}

// Keep REPORTS_DIR export for backward compat (lazy)
export const REPORTS_DIR = GLOBAL_REPORTS_DIR;

// Fonts directory (bundled in project)
export const FONTS_DIR = join(import.meta.dir, 'fonts');

// Project-relative directories (repo mode)
export const PROJECT_ROOT = join(import.meta.dir, '..');
export const UPLOAD_DIR = join(PROJECT_ROOT, 'upload');
export const DOCS_DIR = join(PROJECT_ROOT, 'docs');

// Load .env files manually (for config resolution)
function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const entries: Record<string, string> = {};
  const content = readFileSync(path, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

// Load JSON config file
function loadJsonConfig(): BunIpfsConfig {
  if (!existsSync(CONFIG_JSON_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_JSON_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

// Config resolution order (highest priority first):
// 1. Environment variables (includes CLI overrides already applied by Bun)
// 2. .env in CWD (repo-mode) — already loaded by Bun runtime
// 3. ~/.local/store/bun-ipfs/.env
// 4. ~/.local/store/bun-ipfs/bun-ipfs.json
// 5. SQLite config table (handled by db.ts getConfigValue)
// 6. Built-in defaults
const stateEnv = loadEnvFile(STATE_ENV_PATH);
const jsonConfig = loadJsonConfig();

export function getConfig(key: string): string | undefined {
  // Process.env includes env vars + CWD .env (loaded by Bun)
  if (process.env[key]) return process.env[key];
  // State dir .env
  if (stateEnv[key]) return stateEnv[key];
  // JSON config mapping
  const jsonMap: Record<string, keyof BunIpfsConfig> = {
    IPFS_NODES: 'ipfsNodes',
    IPFS_DEFAULT_GATEWAY: 'defaultGateway',
    IPFS_PUBLIC_GATEWAYS: 'publicGateways',
  };
  const jsonKey = jsonMap[key];
  if (jsonKey && jsonConfig[jsonKey]) return jsonConfig[jsonKey];
  return undefined;
}

// Parse IPFS_NODES: "name:hostname:ip:apiPort:gatewayPort:hasIpnsKeys,..."
function parseNodes(): IpfsNode[] {
  const raw = getConfig('IPFS_NODES');
  if (!raw) return defaultNodes();

  return raw.split(',').map((entry) => {
    const [name, hostname, ip, apiPort, gatewayPort, hasIpnsKeys] = entry.split(':');
    return {
      name: name || 'local',
      hostname: hostname || 'localhost',
      ip: ip || '127.0.0.1',
      apiPort: parseInt(apiPort) || 5001,
      gatewayPort: parseInt(gatewayPort) || 8080,
      hasIpnsKeys: hasIpnsKeys === 'true',
    };
  });
}

function defaultNodes(): IpfsNode[] {
  return [
    { name: 'local', hostname: 'localhost', ip: '127.0.0.1', apiPort: 5001, gatewayPort: 8080, hasIpnsKeys: false },
  ];
}

export function getIpfsNodes(): IpfsNode[] {
  return parseNodes();
}

// Keep module-level export for backward compat within codebase
export const IPFS_NODES: IpfsNode[] = parseNodes();

export const PUBLIC_GATEWAYS: string[] = (() => {
  const raw = getConfig('IPFS_PUBLIC_GATEWAYS');
  return raw ? raw.split(',').map((g) => g.trim()) : ['https://ipfs.io', 'https://dweb.link'];
})();

export const DEFAULT_GATEWAY: string =
  getConfig('IPFS_DEFAULT_GATEWAY') || 'https://ipfs.io';
