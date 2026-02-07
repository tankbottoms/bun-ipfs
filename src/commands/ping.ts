import { IPFS_NODES } from '../config';
import { checkIpfsApi } from '../ipfs';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
};

export async function runPingCommand(): Promise<void> {
  console.log(`${c.bold}bun-ipfs${c.reset} ping\n`);

  if (IPFS_NODES.length === 0) {
    console.log(`${c.yellow}No IPFS nodes configured.${c.reset}`);
    console.log(`${c.dim}Run ${c.cyan}bun-ipfs config${c.reset}${c.dim} to set up nodes.${c.reset}`);
    return;
  }

  const pad = (s: string, n: number) => s.padEnd(n);

  console.log(`  ${c.dim}${pad('Node', 14)} ${pad('Endpoint', 36)} ${pad('Status', 12)} Peer ID${c.reset}`);
  console.log(`  ${c.dim}${'─'.repeat(14)} ${'─'.repeat(36)} ${'─'.repeat(12)} ${'─'.repeat(20)}${c.reset}`);

  for (const node of IPFS_NODES) {
    const hostnameEndpoint = `http://${node.hostname}:${node.apiPort}`;
    let check = await checkIpfsApi(hostnameEndpoint);

    if (!check.ok) {
      const ipEndpoint = `http://${node.ip}:${node.apiPort}`;
      check = await checkIpfsApi(ipEndpoint);

      if (check.ok) {
        const peerShort = check.peerId ? check.peerId.slice(0, 20) + '...' : '';
        console.log(`  ${c.cyan}${pad(node.name, 14)}${c.reset} ${pad(ipEndpoint, 36)} ${c.green}${pad('online', 12)}${c.reset} ${c.dim}${peerShort}${c.reset}`);
        continue;
      }
    }

    if (check.ok) {
      const peerShort = check.peerId ? check.peerId.slice(0, 20) + '...' : '';
      console.log(`  ${c.cyan}${pad(node.name, 14)}${c.reset} ${pad(hostnameEndpoint, 36)} ${c.green}${pad('online', 12)}${c.reset} ${c.dim}${peerShort}${c.reset}`);
    } else {
      console.log(`  ${c.cyan}${pad(node.name, 14)}${c.reset} ${pad(hostnameEndpoint, 36)} ${c.red}${pad('offline', 12)}${c.reset} ${c.dim}${check.error || ''}${c.reset}`);
    }
  }

  console.log();
}
