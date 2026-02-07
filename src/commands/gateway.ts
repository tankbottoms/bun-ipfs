import { DEFAULT_GATEWAY } from '../config';
import { getConfigValue, setConfigValue, initDatabase } from '../db';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

export function runGatewayCommand(args: string[]): void {
  if (args.length === 0) {
    // Show current gateway
    initDatabase();
    const dbGateway = getConfigValue('default_gateway');
    const effective = dbGateway || DEFAULT_GATEWAY;
    const source = dbGateway ? 'database' : process.env.IPFS_DEFAULT_GATEWAY ? 'environment' : 'built-in default';

    console.log(`${c.bold}bun-ipfs${c.reset} gateway\n`);
    console.log(`  ${c.dim}Current:${c.reset} ${c.cyan}${effective}${c.reset}`);
    console.log(`  ${c.dim}Source:${c.reset}  ${source}`);
    console.log();
    console.log(`  ${c.dim}Set with: ${c.cyan}bun-ipfs gateway set <url>${c.reset}`);
    console.log();
    return;
  }

  if (args[0] === 'set' && args[1]) {
    const url = args[1].replace(/\/$/, '');
    if (!url.startsWith('http')) {
      console.log(`${c.yellow}Gateway URL must start with http:// or https://${c.reset}`);
      process.exit(1);
    }
    initDatabase();
    setConfigValue('default_gateway', url);
    console.log(`${c.green}Gateway set to ${url}${c.reset}`);
    return;
  }

  console.log(`${c.yellow}Usage: bun-ipfs gateway [set <url>]${c.reset}`);
}
