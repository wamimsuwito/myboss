import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Triggers a print dialog for a specific HTML element.
 * Hides all other elements and prints only the content of the element with the given ID.
 * @param elementId The ID of the element to print.
 */
export function printElement(elementId: string) {
  const printableElement = document.getElementById(elementId);
  if (!printableElement) {
    console.error(`Element with ID #${elementId} not found.`);
    return;
  }
  
  // Temporarily add a class to the body to hide non-printable elements
  document.body.classList.add('printing-active');

  // A brief timeout can help ensure the browser has processed any recent DOM changes
  // before opening the print dialog.
  setTimeout(() => {
    window.print();
    // Clean up the class after printing is done or cancelled
    document.body.classList.remove('printing-active');
  }, 100);
}


export const formatNumberDisplay = (numStr: string | number | undefined, fractionDigits = 2) => {
    if (numStr === undefined || numStr === null) return "0";
    const num = Number(numStr);
    if (isNaN(num)) return "0";
    return num.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: fractionDigits });
};

export const resizeImage = (file: File, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

// Function to calculate distance between two lat/lon points in meters
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const d = R * c; // in metres
  return d;
}
