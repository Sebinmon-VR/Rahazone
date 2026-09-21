import './env.js';
import fs from 'node:fs';
import path from 'node:path';
import { BlobServiceClient } from '@azure/storage-blob';
import { UPLOAD_DIR } from './db.js';

/**
 * Document storage. With AZURE_STORAGE_CONNECTION_STRING set, files go to Azure Blob
 * Storage under <container>/<prefix>/<name>; otherwise they go to UPLOAD_DIR on disk.
 * Callers only deal with the bare file name that is stored in rz_documents.file_name.
 */
const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER = process.env.AZURE_STORAGE_CONTAINER || 'uploads';
const PREFIX = (process.env.AZURE_STORAGE_PREFIX ?? 'rahazone').replace(/^\/+|\/+$/g, '');

export const usingBlob = !!CONN;
let container = null;

const blobName = (name) => (PREFIX ? `${PREFIX}/${name}` : name);
const diskPath = (name) => path.join(UPLOAD_DIR, path.basename(name));

/** Connects to the container (creating it if needed) or prepares the local folder. Returns a description. */
export async function initStorage() {
  if (!usingBlob) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    return `local disk (${UPLOAD_DIR})`;
  }
  const service = BlobServiceClient.fromConnectionString(CONN);
  container = service.getContainerClient(CONTAINER);
  await container.createIfNotExists();
  return `Azure Blob ${service.accountName}/${CONTAINER}/${PREFIX}`;
}

export async function saveFile(name, buffer, contentType) {
  if (!usingBlob) return fs.promises.writeFile(diskPath(name), buffer);
  await container.getBlockBlobClient(blobName(name)).uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType || 'application/octet-stream' },
  });
}

/** Returns a readable stream for the file, or null if it does not exist. */
export async function openFile(name) {
  if (!usingBlob) {
    const p = diskPath(name);
    return fs.existsSync(p) ? fs.createReadStream(p) : null;
  }
  try {
    const res = await container.getBlobClient(blobName(name)).download();
    return res.readableStreamBody ?? null;
  } catch (err) {
    if (err.statusCode === 404) return null;
    throw err;
  }
}

export async function deleteFiles(names) {
  await Promise.all(names.map(async (name) => {
    try {
      if (usingBlob) await container.getBlobClient(blobName(name)).deleteIfExists();
      else await fs.promises.unlink(diskPath(name));
    } catch (err) {
      if (err.code !== 'ENOENT') console.error(`Could not delete file ${name}:`, err.message);
    }
  }));
}
