/**
 * Resize + compress an image file using an off-screen canvas.
 * GPT-4o Vision performs best at ≤1024px on the longest edge and
 * rejects payloads larger than ~20 MB. Phone camera shots are often
 * 4–15 MB at full resolution, so this step is mandatory for live use.
 *
 * Returns { base64, mime } — the raw base64 string (no data-URL prefix)
 * and the MIME type to pass to the OpenAI image_url content block.
 */
export async function resizeImageForVision(file, maxDimension = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, maxDimension / Math.max(w, h));
      const targetW = Math.round(w * scale);
      const targetH = Math.round(h * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, targetW, targetH);

      // Use JPEG at 88% quality for the best size/fidelity trade-off.
      // PNG originals are converted too — the model doesn't need lossless.
      const outputMime = 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob returned null.'));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            const base64 = dataUrl.split(',')[1];
            resolve({ base64, mime: outputMime });
          };
          reader.onerror = () => reject(new Error('FileReader failed.'));
          reader.readAsDataURL(blob);
        },
        outputMime,
        0.88,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Image could not be loaded for resizing.'));
    };

    img.src = objectUrl;
  });
}
