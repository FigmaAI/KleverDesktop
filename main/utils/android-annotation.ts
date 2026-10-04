/** Portable report annotations derived from immutable Android screenshot evidence. */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { nativeImage } from 'electron';
import type { RecordedAction } from '../types/project';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// Opaque, one-pixel RGBA PNGs. Electron supplies their native bitmap byte order.
const RED_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const GREEN_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNg+M/wHwAEAQH/cetH5QAAAABJRU5ErkJggg==';
let nativeColors: { red: Buffer; green: Buffer } | undefined;

function colors(): { red: Buffer; green: Buffer } {
  if (!nativeColors) {
    const probe = (encoded: string) => {
      const image = nativeImage.createFromBuffer(Buffer.from(encoded, 'base64'));
      const size = image.getSize(1);
      const bitmap = image.toBitmap({ scaleFactor: 1 });
      if (image.isEmpty() || size.width !== 1 || size.height !== 1 || bitmap.length !== 4) {
        throw new Error('Electron cannot encode screenshot annotation colors.');
      }
      return Buffer.from(bitmap);
    };
    nativeColors = { red: probe(RED_PIXEL), green: probe(GREEN_PIXEL) };
  }
  return nativeColors;
}

function coordinate(value: number | undefined, maximum: number): number {
  if (!Number.isSafeInteger(value) || value === undefined || value < 0 || value >= maximum) {
    throw new Error('Screenshot annotation coordinates are outside the original image.');
  }
  return value;
}

/** Save tap/swipe marks into a new PNG; the original and earlier exports remain untouched. */
export async function annotateAndroidScreenshot(
  sourcePath: string,
  destinationPath: string,
  action: RecordedAction,
  screen: { width: number; height: number },
): Promise<void> {
  if (!action || (action.type !== 'tap' && action.type !== 'swipe')) {
    throw new Error('Only tap and swipe screenshot annotations are supported.');
  }
  if (!Number.isSafeInteger(screen.width) || !Number.isSafeInteger(screen.height) ||
      screen.width < 1 || screen.height < 1 || !Number.isSafeInteger(screen.width * screen.height * 4)) {
    throw new Error('Screenshot annotation dimensions are invalid.');
  }
  if (path.resolve(sourcePath) === path.resolve(destinationPath)) {
    throw new Error('An annotation must be saved separately from the original screenshot.');
  }
  const x = coordinate(action.x, screen.width);
  const y = coordinate(action.y, screen.height);
  const endX = action.type === 'swipe' ? coordinate(action.endX, screen.width) : x;
  const endY = action.type === 'swipe' ? coordinate(action.endY, screen.height) : y;
  const original = await fs.readFile(sourcePath);
  if (original.length < 24 || !original.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Screenshot annotations require an original PNG image.');
  }
  const decoded = nativeImage.createFromBuffer(original);
  const { width, height } = decoded.getSize(1);
  if (decoded.isEmpty() || width !== screen.width || height !== screen.height) {
    throw new Error('The recorded screen dimensions do not match the original screenshot.');
  }
  const bitmap = Buffer.from(decoded.toBitmap({ scaleFactor: 1 }));
  if (bitmap.length !== width * height * 4) throw new Error('Electron returned an unsupported screenshot bitmap.');
  const palette = colors();
  const thickness = Math.max(2, Math.round(Math.min(width, height) / 400));
  const strokeRadius = Math.floor(thickness / 2);

  const pixel = (pixelX: number, pixelY: number, color: Buffer) => {
    if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
      color.copy(bitmap, (pixelY * width + pixelX) * 4);
    }
  };
  const stamp = (centerX: number, centerY: number, color: Buffer) => {
    for (let dy = -strokeRadius; dy <= strokeRadius; dy++) {
      for (let dx = -strokeRadius; dx <= strokeRadius; dx++) {
        if (dx * dx + dy * dy <= strokeRadius * strokeRadius) pixel(centerX + dx, centerY + dy, color);
      }
    }
  };
  const line = (startX: number, startY: number, finishX: number, finishY: number, color: Buffer) => {
    let currentX = Math.round(startX), currentY = Math.round(startY);
    const finishXi = Math.round(finishX), finishYi = Math.round(finishY);
    const dx = Math.abs(finishXi - currentX), dy = -Math.abs(finishYi - currentY);
    const directionX = currentX < finishXi ? 1 : -1, directionY = currentY < finishYi ? 1 : -1;
    let error = dx + dy;
    while (true) {
      stamp(currentX, currentY, color);
      if (currentX === finishXi && currentY === finishYi) break;
      const doubled = error * 2;
      if (doubled >= dy) { error += dy; currentX += directionX; }
      if (doubled <= dx) { error += dx; currentY += directionY; }
    }
  };

  if (action.type === 'tap') {
    const radius = Math.max(2, Math.min(Math.floor(Math.min(width, height) / 4),
      Math.max(8, Math.round(Math.min(width, height) * 0.02))));
    const halfBox = Math.round(radius * 1.6);
    const left = Math.max(0, x - halfBox), top = Math.max(0, y - halfBox);
    const right = Math.min(width - 1, x + halfBox), bottom = Math.min(height - 1, y + halfBox);
    // This is a tap marker box, not an inferred UI element boundary.
    line(left, top, right, top, palette.green);
    line(right, top, right, bottom, palette.green);
    line(right, bottom, left, bottom, palette.green);
    line(left, bottom, left, top, palette.green);
    const segments = Math.max(16, Math.ceil(2 * Math.PI * radius));
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment / segments * 2 * Math.PI;
      stamp(Math.round(x + Math.cos(angle) * radius), Math.round(y + Math.sin(angle) * radius), palette.red);
    }
  } else {
    line(x, y, endX, endY, palette.green);
    const length = Math.hypot(endX - x, endY - y);
    if (length > 0) {
      const unitX = (endX - x) / length, unitY = (endY - y) / length;
      const head = Math.min(length * 0.3, Math.max(8, Math.min(width, height) * 0.035));
      line(endX, endY, endX - unitX * head + unitY * head * 0.5,
        endY - unitY * head - unitX * head * 0.5, palette.green);
      line(endX, endY, endX - unitX * head - unitY * head * 0.5,
        endY - unitY * head + unitX * head * 0.5, palette.green);
    }
  }
  const annotated = nativeImage.createFromBitmap(bitmap, { width, height, scaleFactor: 1 });
  if (annotated.isEmpty()) throw new Error('Electron could not encode the screenshot annotation.');
  const encoded = annotated.toPNG({ scaleFactor: 1 });
  if (encoded.length < 24 || !encoded.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Electron returned an invalid screenshot annotation.');
  }
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.writeFile(destinationPath, encoded, { flag: 'wx', mode: 0o600 });
}
