const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const load = require('./load-typescript.cjs');

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const BACKGROUND = [17, 23, 31, 255];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function encodePNG(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) rgba.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([SIGNATURE, pngChunk('IHDR', header), pngChunk('IDAT', zlib.deflateSync(rows)), pngChunk('IEND', Buffer.alloc(0))]);
}

/** Decode the generated fixture and the helper's tiny PNG color probes. */
function decodePNG(png) {
  assert.ok(png.subarray(0, 8).equals(SIGNATURE));
  const imageData = [];
  let header;
  let palette;
  let transparency;
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') header = data;
    if (type === 'IDAT') imageData.push(data);
    if (type === 'PLTE') palette = data;
    if (type === 'tRNS') transparency = data;
    offset += length + 12;
  }
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  assert.ok(channels && [1, 2, 4, 8].includes(bitDepth));
  assert.equal(header[12], 0, 'Offline fixtures use non-interlaced PNG');
  const stride = Math.ceil(width * channels * bitDepth / 8);
  const bytesPerPixel = Math.max(1, Math.ceil(channels * bitDepth / 8));
  const inflated = zlib.inflateSync(Buffer.concat(imageData));
  const unfiltered = Buffer.alloc(stride * height);
  const paeth = (a, b, c) => {
    const p = a + b - c;
    const da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c);
    return da <= db && da <= dc ? a : db <= dc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const filter = inflated[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const left = x >= bytesPerPixel ? unfiltered[index - bytesPerPixel] : 0;
      const up = y ? unfiltered[index - stride] : 0;
      const upperLeft = y && x >= bytesPerPixel ? unfiltered[index - stride - bytesPerPixel] : 0;
      const predict = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, upperLeft)][filter];
      assert.notEqual(predict, undefined);
      unfiltered[index] = (inflated[y * (stride + 1) + 1 + x] + predict) & 255;
    }
  }
  const rgba = Buffer.alloc(width * height * 4);
  const sample = (y, component) => {
    const bit = component * bitDepth;
    return (unfiltered[y * stride + Math.floor(bit / 8)] >>> (8 - bitDepth - bit % 8)) & ((1 << bitDepth) - 1);
  };
  const scale = (value) => Math.round(value * 255 / ((1 << bitDepth) - 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const components = Array.from({ length: channels }, (_, channel) => sample(y, x * channels + channel));
    let pixel;
    if (colorType === 6) pixel = components;
    if (colorType === 2) pixel = [...components, 255];
    if (colorType === 4) pixel = [components[0], components[0], components[0], components[1]];
    if (colorType === 0) pixel = [scale(components[0]), scale(components[0]), scale(components[0]), 255];
    if (colorType === 3) {
      const index = components[0];
      pixel = [palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2], transparency?.[index] ?? 255];
    }
    for (let channel = 0; channel < 4; channel++) rgba[(y * width + x) * 4 + channel] = pixel[channel];
  }
  return { width, height, rgba };
}

function nativeBytes(rgba, order) {
  const result = Buffer.from(rgba);
  if (order === 'BGRA') for (let offset = 0; offset < result.length; offset += 4) {
    [result[offset], result[offset + 2]] = [result[offset + 2], result[offset]];
  }
  return result;
}

async function fixture(t, order = 'BGRA', settings = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'klever-annotation-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'before.png');
  const destination = path.join(root, 'before-action.png');
  const screen = { width: 64, height: 64 };
  const rgba = Buffer.alloc(screen.width * screen.height * 4);
  for (let offset = 0; offset < rgba.length; offset += 4) Buffer.from(BACKGROUND).copy(rgba, offset);
  const original = encodePNG(screen.width, screen.height, rgba);
  await fs.writeFile(source, original);
  const bitmapCalls = [];

  function mockImage(image, empty = false) {
    return {
      isEmpty: () => empty,
      getSize: () => ({ width: image.width, height: image.height }),
      toBitmap(options) {
        assert.equal(options?.scaleFactor, 1);
        const bitmap = nativeBytes(image.rgba, order);
        return settings.truncatedBitmap && image.width > 1 ? bitmap.subarray(0, bitmap.length - 4) : bitmap;
      },
      toPNG: () => encodePNG(image.width, image.height, image.rgba),
    };
  }
  const nativeImage = {
    createFromBuffer(buffer) {
      try { return mockImage(decodePNG(buffer)); }
      catch { return mockImage({ width: 0, height: 0, rgba: Buffer.alloc(0) }, true); }
    },
    createFromBitmap(bitmap, options) {
      bitmapCalls.push({ bitmap: Buffer.from(bitmap), options });
      assert.equal(bitmap.length, options.width * options.height * 4);
      assert.equal(options.scaleFactor, 1);
      return mockImage({ width: options.width, height: options.height, rgba: nativeBytes(bitmap, order) });
    },
  };
  const module = load('main/utils/android-annotation.ts', { electron: { nativeImage } });
  return { ...module, source, destination, screen, original, bitmapCalls,
    readResult: async () => decodePNG(await fs.readFile(destination)) };
}

const red = ([r, g, b, a]) => r > 180 && g < 100 && b < 100 && a === 255;
const green = ([r, g, b, a]) => g > 120 && r < 120 && b < 120 && a === 255;
const pixelAt = (image, x, y) => Array.from(image.rgba.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));
function countPixels(image, predicate) {
  let count = 0;
  for (let offset = 0; offset < image.rgba.length; offset += 4) if (predicate(Array.from(image.rgba.subarray(offset, offset + 4)))) count++;
  return count;
}

for (const order of ['RGBA', 'BGRA']) {
  test(`tap annotation draws visible red ring and green marker with ${order} native pixels`, async (t) => {
    const f = await fixture(t, order);
    await f.annotateAndroidScreenshot(f.source, f.destination, { type: 'tap', intent: 'Open details', x: 32, y: 32 }, f.screen);
    const image = await f.readResult();
    assert.equal(image.width, f.screen.width);
    assert.equal(image.height, f.screen.height);
    assert.ok(countPixels(image, red) > 10, 'A red interaction marker must remain visible');
    assert.ok(countPixels(image, green) > 10, 'The green tap marker must remain visible');
    assert.deepEqual(await fs.readFile(f.source), f.original);
    assert.equal(f.bitmapCalls.length, 1);
    assert.deepEqual({ ...f.bitmapCalls[0].options }, { width: 64, height: 64, scaleFactor: 1 });
  });

  test(`diagonal swipe arrow follows action coordinates with ${order} native pixels`, async (t) => {
    const f = await fixture(t, order);
    await f.annotateAndroidScreenshot(f.source, f.destination, { type: 'swipe', intent: 'Move diagonally', x: 8, y: 8, endX: 56, endY: 40 }, f.screen);
    const image = await f.readResult();
    assert.ok(green(pixelAt(image, 32, 24)), 'The arrow shaft must pass through the actual swipe midpoint');
    assert.ok(green(pixelAt(image, 56, 40)), 'The arrow must reach the actual swipe endpoint');
    assert.ok(countPixels(image, green) > 30);
    assert.equal(countPixels(image, red), 0);
    assert.deepEqual(await fs.readFile(f.source), f.original);
  });

  test(`edge tap clips marker strokes without corrupting ${order} image rows`, async (t) => {
    const f = await fixture(t, order);
    await f.annotateAndroidScreenshot(f.source, f.destination, { type: 'tap', intent: 'Tap screen corner', x: 0, y: 0 }, f.screen);
    const image = await f.readResult();
    assert.ok(countPixels(image, red) > 0);
    assert.ok(countPixels(image, green) > 0);
    assert.deepEqual(pixelAt(image, 63, 63), BACKGROUND);
    assert.equal(image.rgba.length, 64 * 64 * 4);
  });

  test(`arrowhead at image edge clips safely with ${order} native pixels`, async (t) => {
    const f = await fixture(t, order);
    await f.annotateAndroidScreenshot(f.source, f.destination, { type: 'swipe', intent: 'Swipe toward corner', x: 0, y: 0, endX: 63, endY: 63 }, f.screen);
    const image = await f.readResult();
    assert.ok(green(pixelAt(image, 0, 0)));
    assert.ok(green(pixelAt(image, 63, 63)));
    assert.ok(green(pixelAt(image, 32, 32)));
    assert.deepEqual(pixelAt(image, 0, 63), BACKGROUND);
    assert.equal(image.rgba.length, 64 * 64 * 4);
  });
}

test('annotation refuses to replace an existing historical destination', async (t) => {
  const f = await fixture(t);
  const history = Buffer.from('existing history must be preserved');
  await fs.writeFile(f.destination, history);
  await assert.rejects(f.annotateAndroidScreenshot(f.source, f.destination, { type: 'tap', intent: 'Tap', x: 20, y: 20 }, f.screen), /exist/i);
  assert.deepEqual(await fs.readFile(f.destination), history);
  assert.deepEqual(await fs.readFile(f.source), f.original);
});

test('annotation cannot use the original screenshot as its output path', async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.annotateAndroidScreenshot(f.source, f.source, { type: 'tap', intent: 'Tap', x: 20, y: 20 }, f.screen), /original|separate/i);
  assert.deepEqual(await fs.readFile(f.source), f.original);
  assert.equal(f.bitmapCalls.length, 0);
});

test('annotation rejects dimension mismatch and a malformed native bitmap', async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.annotateAndroidScreenshot(f.source, f.destination, { type: 'tap', intent: 'Tap', x: 20, y: 20 }, { width: 63, height: 64 }), /dimension|size|match/i);
  await assert.rejects(fs.access(f.destination));
  const short = await fixture(t, 'RGBA', { truncatedBitmap: true });
  await assert.rejects(short.annotateAndroidScreenshot(short.source, short.destination, { type: 'tap', intent: 'Tap', x: 20, y: 20 }, short.screen), /bitmap|size|length|format/i);
  await assert.rejects(fs.access(short.destination));
});

test('unsupported actions and coordinates outside the screenshot create no annotation', async (t) => {
  const f = await fixture(t);
  for (const action of [
    { type: 'text', intent: 'Type input', text: 'hello' }, { type: 'wait', intent: 'Wait', durationMs: 500 },
    { type: 'tap', intent: 'Outside', x: -1, y: 10 }, { type: 'tap', intent: 'Outside', x: 64, y: 10 },
    { type: 'tap', intent: 'Fractional', x: 10.5, y: 10 },
    { type: 'swipe', intent: 'Outside', x: 0, y: 0, endX: 10, endY: 64 },
  ]) {
    await assert.rejects(f.annotateAndroidScreenshot(f.source, f.destination, action, f.screen), /unsupported|action|coordinate|bounds|screen|integer/i);
    await assert.rejects(fs.access(f.destination));
  }
  assert.deepEqual(await fs.readFile(f.source), f.original);
});

test('non-PNG source is rejected without changing it or creating a destination', async (t) => {
  const f = await fixture(t);
  const invalid = Buffer.from('not a screenshot PNG');
  await fs.writeFile(f.source, invalid);
  await assert.rejects(f.annotateAndroidScreenshot(f.source, f.destination, { type: 'tap', intent: 'Tap', x: 20, y: 20 }, f.screen), /PNG|image|screenshot/i);
  assert.deepEqual(await fs.readFile(f.source), invalid);
  await assert.rejects(fs.access(f.destination));
});
