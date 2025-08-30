
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Triggers a print dialog for a specific HTML element by opening its content
 * in a new, isolated window. This avoids CSS conflicts from the main page.
 * @param elementId The ID of the element to print.
 */
export function printElement(elementId: string) {
  const printableElement = document.getElementById(elementId);
  if (!printableElement) {
    console.error(`Element with ID #${elementId} not found.`);
    return;
  }

  const printWindow = window.open('', '_blank', 'height=800,width=800');
  
  if (printWindow) {
    printWindow.document.write('<html><head><title>Cetak Laporan</title>');

    // Link all stylesheets from the main document to the new window
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
      printWindow.document.write(link.outerHTML);
    });

    // Copy all style tags from the main document
     document.querySelectorAll('style').forEach(style => {
      printWindow.document.write(style.outerHTML);
    });
    
    printWindow.document.write('</head><body>');
    printWindow.document.write(printableElement.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();

    // Use a timeout to ensure all styles are loaded before printing
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
    }, 500);
  } else {
    alert("Please allow pop-ups for this website to print the report.");
  }
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
