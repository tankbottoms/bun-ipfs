import * as p from '@clack/prompts';
import { writeFileSync, mkdirSync } from 'fs';
import { STATE_DIR, CONFIG_JSON_PATH } from './config';
import { setConfigValue, initDatabase } from './db';
import type { BunIpfsConfig } from './types';

export async function runWizard(): Promise<void> {
  p.intro('bun-ipfs setup');

  p.log.info('Configure your IPFS nodes and default gateway.');
  p.log.message('This wizard writes to ~/.local/store/bun-ipfs/');

  const nodeInput = await p.text({
    message: 'IPFS nodes (name:host:ip:apiPort:gwPort:hasIpnsKeys,...)',
    placeholder: 'local:localhost:127.0.0.1:5001:8080:false',
    initialValue: 'local:localhost:127.0.0.1:5001:8080:false',
    validate: (v) => {
      if (!v.trim()) return 'At least one node is required';
      const parts = v.split(',');
      for (const part of parts) {
        if (part.split(':').length < 3) return 'Each node needs at least name:host:ip';
      }
    },
  });

  if (p.isCancel(nodeInput)) {
    p.cancel('Setup cancelled');
    process.exit(0);
  }

  const gateway = await p.text({
    message: 'Default public gateway URL',
    placeholder: 'https://ipfs.io',
    initialValue: 'https://ipfs.io',
    validate: (v) => {
      if (!v.startsWith('http')) return 'Must start with http:// or https://';
    },
  });

  if (p.isCancel(gateway)) {
    p.cancel('Setup cancelled');
    process.exit(0);
  }

  const publicGateways = await p.text({
    message: 'Public gateways for report links (comma-separated)',
    placeholder: 'https://ipfs.io,https://dweb.link',
    initialValue: 'https://ipfs.io,https://dweb.link',
  });

  if (p.isCancel(publicGateways)) {
    p.cancel('Setup cancelled');
    process.exit(0);
  }

  const config: BunIpfsConfig = {
    ipfsNodes: (nodeInput as string).trim(),
    defaultGateway: (gateway as string).trim().replace(/\/$/, ''),
    publicGateways: (publicGateways as string).trim(),
  };

  // Write JSON config
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(CONFIG_JSON_PATH, JSON.stringify(config, null, 2) + '\n');

  // Also write to SQLite config table
  initDatabase();
  setConfigValue('ipfs_nodes', config.ipfsNodes || '');
  setConfigValue('default_gateway', config.defaultGateway || '');
  setConfigValue('public_gateways', config.publicGateways || '');

  p.log.success(`Config written to ${CONFIG_JSON_PATH}`);
  p.outro('Setup complete. Run bun-ipfs ping to test connectivity.');
}
