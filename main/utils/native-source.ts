import * as path from 'path';
import * as fs from 'fs';
import type { ApkSource } from '../types/project';

export function validateApkSource(source: ApkSource | undefined): string | undefined {
  if (!source) return undefined;
  if (source.type === 'installed_package') {
    return typeof source.packageName === 'string' && /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(source.packageName)
      ? undefined : 'Enter a valid Android package name.';
  }
  if (source.type === 'apk_file') {
    return typeof source.path === 'string' && path.isAbsolute(source.path) && fs.existsSync(source.path)
      ? undefined : 'Select an existing APK file.';
  }
  if (source.type === 'play_store_url') {
    try {
      const url = new URL(source.url || '');
      return url.protocol === 'https:' && url.hostname === 'play.google.com' && !!url.searchParams.get('id')
        ? undefined : 'Enter a Google Play app URL.';
    } catch { return 'Enter a Google Play app URL.'; }
  }
  return 'Unsupported Android app source.';
}
