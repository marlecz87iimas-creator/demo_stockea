const MAX_LOGO_SIDE = 240;
const JPEG_QUALITY = 0.68;
/** Keep config payloads small for API/body limits. */
const MAX_DATA_URL_CHARS = 350_000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = src;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo leer el archivo'));
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/jpeg', quality);
}

/** Compacta el logo a data URL para usarlo en encabezado y notas sin auth de archivos. */
export async function fileToLogoDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo debe ser una imagen');
  }

  const original = await readFileAsDataUrl(file);
  const img = await loadImage(original);
  const scale = Math.min(1, MAX_LOGO_SIDE / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    if (original.length > MAX_DATA_URL_CHARS) {
      throw new Error('La imagen es demasiado grande. Usa un PNG/JPG más liviano.');
    }
    return original;
  }

  // Fondo blanco: JPEG no soporta transparencia.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = JPEG_QUALITY;
  let dataUrl = canvasToJpegDataUrl(canvas, quality);
  while (dataUrl.length > MAX_DATA_URL_CHARS && quality > 0.4) {
    quality -= 0.08;
    dataUrl = canvasToJpegDataUrl(canvas, quality);
  }
  if (dataUrl.length > MAX_DATA_URL_CHARS) {
    throw new Error('La imagen es demasiado grande. Usa un archivo más liviano.');
  }
  return dataUrl;
}

export function isDisplayableLogoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('data:image/')
    || url.startsWith('http://')
    || url.startsWith('https://')
    || url.startsWith('/');
}
