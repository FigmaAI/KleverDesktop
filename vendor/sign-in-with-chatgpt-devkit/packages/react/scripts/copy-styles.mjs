import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import { copyPackageNotices } from '../../../scripts/copy-package-notices.mjs';

const output = new URL('../dist/', import.meta.url);
await mkdir(output, { recursive: true });
await copyFile(new URL('../src/styles.css', import.meta.url), new URL('styles.css', output));
await copyFile(new URL('../src/tokens.css', import.meta.url), new URL('tokens.css', output));
await copyPackageNotices(output);
await rm(new URL('assets/', output), { recursive: true, force: true });
await cp(new URL('../../../assets/', import.meta.url), new URL('assets/', output), { recursive: true });
