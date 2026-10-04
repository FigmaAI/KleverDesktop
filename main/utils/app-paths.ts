import * as os from 'os';
import * as path from 'path';

/** Keep existing settings, test courses, and run records in their established data directory. */
export function getKleverDir(): string {
  return path.join(os.homedir(), '.klever-desktop');
}
