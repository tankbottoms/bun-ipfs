export interface IpfsNode {
  name: string;
  hostname: string;
  ip: string;
  apiPort: number;
  gatewayPort: number;
  hasIpnsKeys: boolean;
}

export interface ServerInfo {
  endpoint: string;
  gatewayUrl: string;
  hostname: string;
  hasIpnsKeys: boolean;
}

export interface UploadResult {
  folderName: string;
  folderCid: string;
  zipCid: string;
  ipnsKeyName: string;
  ipnsName: string;
  server: string;
  gateway: string;
  folderUrl: string;
  zipUrl: string;
  ipnsUrl: string;
  fileCount: number;
  folderSize: number;
  zipSize: number;
  reportPath?: string;
}

export interface QrPaths {
  folder: string;
  zip: string;
  ipns: string;
}

export interface QrBuffers {
  folder: Buffer;
  zip: Buffer;
  ipns: Buffer;
}

export interface PinRecord {
  id?: number;
  timestamp?: string;
  folder_name: string;
  folder_cid: string;
  zip_cid?: string;
  ipns_key_name?: string;
  ipns_name?: string;
  server: string;
  gateway: string;
  folder_url: string;
  zip_url?: string;
  ipns_url?: string;
  file_count: number;
  folder_size: number;
  zip_size: number;
  report_path?: string;
}

export interface BunIpfsConfig {
  ipfsNodes?: string;
  defaultGateway?: string;
  publicGateways?: string;
  reportsDir?: string;
}

export type CliCommand =
  | 'help'
  | 'version'
  | 'interactive'
  | 'push'
  | 'env'
  | 'ping'
  | 'history'
  | 'find'
  | 'gateway'
  | 'config';
