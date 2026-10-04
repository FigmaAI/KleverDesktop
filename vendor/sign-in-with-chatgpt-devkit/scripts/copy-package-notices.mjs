import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export async function copyPackageNotices(output) {
  for (const filename of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'docs/dependency-inventory.json']) {
    const destination = new URL(filename, output);
    await mkdir(new URL('./', destination), { recursive: true });
    await copyFile(new URL(`../${filename}`, import.meta.url), destination);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (!process.argv[2]) throw new Error('Usage: node copy-package-notices.mjs <output-directory>');
  await copyPackageNotices(pathToFileURL(`${resolve(process.argv[2])}/`));
}
