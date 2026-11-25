import type { AreaUnit } from '../types/rental';

/**
 * Exact Haversine distance in kilometers between two lat/lng points.
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/** 1 Gaj (Square Yard) = 9 Square Feet */
export function gajToSqft(gaj: number): number {
  if (!Number.isFinite(gaj) || gaj <= 0) return 0;
  return Math.round(gaj * 9);
}

export function sqftToGaj(sqft: number): number {
  if (!Number.isFinite(sqft) || sqft <= 0) return 0;
  return Math.round(sqft / 9);
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatArea(areaGaj: number, areaSqft: number, primaryUnit: AreaUnit): string {
  const sqftFormatted = areaSqft.toLocaleString('en-IN');
  const gajFormatted = areaGaj.toLocaleString('en-IN');
  if (primaryUnit === 'gaj') {
    return `${gajFormatted} Gaj (${sqftFormatted} sq.ft)`;
  }
  return `${sqftFormatted} sq.ft (${gajFormatted} Gaj)`;
}

/**
 * Compresses an uploaded image file to a lightweight JPEG data URL (< 140KB)
 * so it respects Firestore's document size limits cleanly.
 */
export async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected photo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const maxWidth = 800;
        const maxHeight = 600;
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.72);
        if (compressed.length > 190000) {
          resolve(canvas.toDataURL('image/jpeg', 0.52));
        } else {
          resolve(compressed);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || `id_${Date.now()}`;
}
