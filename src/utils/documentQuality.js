/**
 * Lightweight mobile document checks (blur heuristic, size, resolution).
 * Does not perform OCR or government identity verification.
 */

const MAX_RECOMMENDED_BYTES = 2 * 1024 * 1024;
const MIN_EDGE_PX = 800;

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image.'));
    };
    img.src = url;
  });
}

/** Variance of grayscale Laplacian — higher usually means sharper. */
function sharpnessScore(imageData, width, height) {
  const data = imageData.data;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const c = gray[y * width + x];
      const lap =
        -4 * c +
        gray[(y - 1) * width + x] +
        gray[(y + 1) * width + x] +
        gray[y * width + (x - 1)] +
        gray[y * width + (x + 1)];
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/**
 * @param {File} file
 * @returns {Promise<{ ok: boolean, label: string, warnings: string[], width: number, height: number, sizeKb: number, sharpness: number }>}
 */
export async function analyzeDocumentImage(file) {
  const warnings = [];
  const sizeKb = Math.round(file.size / 1024);

  if (!file.type.startsWith('image/')) {
    return {
      ok: false,
      label: 'Not an image',
      warnings: ['Use camera or gallery photo (JPEG/PNG).'],
      width: 0,
      height: 0,
      sizeKb,
      sharpness: 0,
    };
  }

  if (file.size > MAX_RECOMMENDED_BYTES) {
    warnings.push(`File is ${sizeKb} KB — compress below 2 MB for faster portal upload.`);
  }

  const img = await loadImageFromFile(file);
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const longEdge = Math.max(width, height);

  if (longEdge < MIN_EDGE_PX) {
    warnings.push('Resolution is low — move closer or retake in better light.');
  }

  const sampleW = 320;
  const sampleH = Math.round((height / width) * sampleW) || 240;
  const canvas = document.createElement('canvas');
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const imageData = ctx.getImageData(0, 0, sampleW, sampleH);
  const sharpness = sharpnessScore(imageData, sampleW, sampleH);

  if (sharpness < 35) {
    warnings.push('Image may be blurry — hold steady and avoid shadow/glare.');
  }

  const ok = warnings.length === 0;
  return {
    ok,
    label: ok ? 'Ready for upload' : 'Review before upload',
    warnings,
    width,
    height,
    sizeKb,
    sharpness: Math.round(sharpness),
  };
}
