import { $ } from 'bun';
import { readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { getIpfsNodes } from './config';
import type { ServerInfo } from './types';

export async function checkIpfsApi(apiEndpoint: string): Promise<{ ok: boolean; peerId?: string; error?: string }> {
  try {
    const response = await fetch(`${apiEndpoint}/api/v0/id`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = await response.json();
      return { ok: true, peerId: data.ID };
    }
    return { ok: false, error: `HTTP ${response.status}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, error: msg.includes('abort') ? 'Timeout' : msg };
  }
}

export async function findAvailableServer(): Promise<ServerInfo | null> {
  const nodes = getIpfsNodes();
  for (const node of nodes) {
    // Try hostname first
    const hostnameEndpoint = `http://${node.hostname}:${node.apiPort}`;
    let check = await checkIpfsApi(hostnameEndpoint);

    if (check.ok) {
      return {
        endpoint: hostnameEndpoint,
        gatewayUrl: `http://${node.hostname}:${node.gatewayPort}`,
        hostname: node.hostname,
        hasIpnsKeys: node.hasIpnsKeys,
      };
    }

    // Try IP fallback
    const ipEndpoint = `http://${node.ip}:${node.apiPort}`;
    check = await checkIpfsApi(ipEndpoint);

    if (check.ok) {
      return {
        endpoint: ipEndpoint,
        gatewayUrl: `http://${node.ip}:${node.gatewayPort}`,
        hostname: node.ip,
        hasIpnsKeys: node.hasIpnsKeys,
      };
    }
  }

  return null;
}

export async function addDirectoryToIpfs(server: ServerInfo, directory: string): Promise<string> {
  const dirName = directory.split('/').pop() || 'upload';

  const allFiles = readdirSync(directory, { recursive: true })
    .map((f: string | Buffer) => join(directory, f.toString()))
    .filter((f: string) => statSync(f).isFile());

  const formArgs: string[] = [];
  for (const filePath of allFiles) {
    const relativePath = relative(directory, filePath);
    formArgs.push('-F', `file=@${filePath};filename=${dirName}/${relativePath}`);
  }

  const curlArgs = [
    '-s', '-X', 'POST',
    `${server.endpoint}/api/v0/add?recursive=true&cid-version=1&wrap-with-directory=false&pin=true`,
    ...formArgs,
  ];

  const result = await $`curl ${curlArgs}`.text();
  const lines = result.trim().split('\n').filter(Boolean);

  let rootCid = '';
  for (const line of [...lines].reverse()) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.Name === dirName) {
        rootCid = parsed.Hash;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!rootCid) {
    throw new Error(`Failed to get root CID for ${dirName}`);
  }

  return rootCid;
}

export async function addFileToIpfs(server: ServerInfo, filePath: string): Promise<string> {
  const curlArgs = [
    '-s', '-X', 'POST',
    `${server.endpoint}/api/v0/add?cid-version=1&pin=true`,
    '-F', `file=@${filePath}`,
  ];

  const result = await $`curl ${curlArgs}`.text();
  const parsed = JSON.parse(result.trim());

  if (!parsed.Hash) {
    throw new Error(`Failed to get CID for ${filePath}`);
  }

  return parsed.Hash;
}

export async function pinContent(server: ServerInfo, cid: string): Promise<void> {
  const nodes = getIpfsNodes();

  // Pin on primary server
  try {
    await fetch(`${server.endpoint}/api/v0/pin/add?arg=${cid}`, {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    // Primary pin is best-effort since add already pins
  }

  // Best-effort pin on other reachable nodes
  for (const node of nodes) {
    if (node.hostname === server.hostname || node.ip === server.hostname) continue;

    const endpoint = `http://${node.hostname}:${node.apiPort}`;
    try {
      const check = await checkIpfsApi(endpoint);
      if (check.ok) {
        await fetch(`${endpoint}/api/v0/pin/add?arg=${cid}`, {
          method: 'POST',
          signal: AbortSignal.timeout(30000),
        });
      }
    } catch {
      // Ignore secondary pin failures
    }
  }
}

export async function publishToIpns(
  server: ServerInfo,
  cid: string,
  keyName: string,
): Promise<{ key: string; name: string }> {
  // Check if key exists, create if not
  try {
    const keyListRes = await fetch(`${server.endpoint}/api/v0/key/list`, { method: 'POST' });
    const keyListData = await keyListRes.json();
    const keys = keyListData.Keys || [];
    const hasKey = keys.some((k: { Name: string }) => k.Name === keyName);

    if (!hasKey) {
      await fetch(`${server.endpoint}/api/v0/key/gen?arg=${keyName}&type=ed25519`, {
        method: 'POST',
      });
    }
  } catch {
    // Try to create key anyway
    await fetch(`${server.endpoint}/api/v0/key/gen?arg=${keyName}&type=ed25519`, {
      method: 'POST',
    }).catch(() => {});
  }

  const publishRes = await fetch(
    `${server.endpoint}/api/v0/name/publish?arg=/ipfs/${cid}&key=${keyName}&allow-offline=true`,
    { method: 'POST', signal: AbortSignal.timeout(60000) },
  );

  if (!publishRes.ok) {
    throw new Error(`IPNS publish failed: HTTP ${publishRes.status}`);
  }

  const publishData = await publishRes.json();
  return { key: keyName, name: publishData.Name || keyName };
}
