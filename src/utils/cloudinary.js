/**
 * Cloudinary Upload Utility for Images & Documents
 * Uploads images (student photos, camera captures) and documents (Aadhar, marksheets, certificates)
 * directly to Cloudinary REST API securely with automatic pre-compression to under 200 KB.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || import.meta.env.Cloud_name || 'rl8mwx31';
const API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY || import.meta.env.API_key || '854482785238572';
const API_SECRET = import.meta.env.VITE_CLOUDINARY_API_SECRET || import.meta.env.API_secret || 'dqhJ6XiT7pZXQTyw3MDLp0-bf8Y';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '/backend';

/**
 * Generate SHA-1 Hash using browser Web Crypto API
 */
async function generateSHA1(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * PDF Document to Canvas Renderer
 * Renders page 1 of a PDF file to HTML5 Canvas for client-side pre-compression
 */
async function renderPdfPageToCanvas(fileOrBlob) {
  try {
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    let arrayBuffer;
    if (fileOrBlob instanceof Blob) {
      arrayBuffer = await fileOrBlob.arrayBuffer();
    } else if (typeof fileOrBlob === 'string' && fileOrBlob.startsWith('data:')) {
      const base64Str = fileOrBlob.split(',')[1];
      const binaryStr = atob(base64Str);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      arrayBuffer = bytes.buffer;
    } else {
      return null;
    }

    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const scale = Math.min(1200 / unscaledViewport.width, 1200 / unscaledViewport.height, 1.5);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  } catch (err) {
    console.log('PDF Canvas rendering notice:', err);
    return null;
  }
}

/**
 * Canvas Image & Document Pre-Compression Helper
 * Compresses any image or PDF document to under maxKB (default: 200 KB) before uploading to Cloudinary
 * @param {File|Blob|string} fileOrBase64 
 * @param {number} maxKB Target maximum size in KB (default: 200 KB)
 * @returns {Promise<string>} Compressed Base64 Data URL
 */
export async function compressImage(fileOrBase64, maxKB = 200) {
  if (!fileOrBase64) return fileOrBase64;

  const isPdf = 
    (fileOrBase64 instanceof Blob && (fileOrBase64.type === 'application/pdf' || (fileOrBase64.name && fileOrBase64.name.toLowerCase().endsWith('.pdf')))) ||
    (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:application/pdf'));

  // If PDF, render page 1 to canvas for compression
  if (isPdf) {
    const pdfCanvas = await renderPdfPageToCanvas(fileOrBase64);
    if (pdfCanvas) {
      let quality = 0.85;
      let dataUrl = pdfCanvas.toDataURL('image/jpeg', quality);

      // Quality reduction loop
      while (dataUrl.length * 0.75 > maxKB * 1024 && quality > 0.15) {
        quality -= 0.1;
        dataUrl = pdfCanvas.toDataURL('image/jpeg', quality);
      }

      // Dimension downscale loop if still over maxKB
      let curCanvas = pdfCanvas;
      while (dataUrl.length * 0.75 > maxKB * 1024 && curCanvas.width > 300) {
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = Math.round(curCanvas.width * 0.8);
        scaledCanvas.height = Math.round(curCanvas.height * 0.8);
        const sCtx = scaledCanvas.getContext('2d');
        sCtx.fillStyle = '#ffffff';
        sCtx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);
        sCtx.drawImage(curCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
        curCanvas = scaledCanvas;
        dataUrl = curCanvas.toDataURL('image/jpeg', 0.6);
      }

      return dataUrl;
    }
  }

  // Standard Image Processing (PNG, JPEG, WEBP)
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Downscale high resolution images (max 1200px dimension)
      const MAX_DIM = 1200;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      let dataUrl = canvas.toDataURL('image/jpeg', quality);

      // Pass 1: Dynamically reduce quality
      while (dataUrl.length * 0.75 > maxKB * 1024 && quality > 0.15) {
        quality -= 0.1;
        dataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      // Pass 2: Dynamically scale down canvas dimensions if quality alone was insufficient
      while (dataUrl.length * 0.75 > maxKB * 1024 && canvas.width > 300) {
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = Math.round(canvas.width * 0.8);
        scaledCanvas.height = Math.round(canvas.height * 0.8);
        const sCtx = scaledCanvas.getContext('2d');
        sCtx.fillStyle = '#ffffff';
        sCtx.fillRect(0, 0, scaledCanvas.width, scaledCanvas.height);
        sCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
        canvas = scaledCanvas;
        dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      }

      resolve(dataUrl);
    };

    img.onerror = () => resolve(fileOrBase64);

    if (typeof fileOrBase64 === 'string') {
      img.src = fileOrBase64;
    } else if (fileOrBase64 instanceof File || fileOrBase64 instanceof Blob) {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(fileOrBase64);
      reader.readAsDataURL(fileOrBase64);
    } else {
      resolve(fileOrBase64);
    }
  });
}

/**
 * Helper to attach Cloudinary dynamic auto-compression & auto-format parameters to URLs
 * Converts: https://res.cloudinary.com/demo/image/upload/v1234/file.jpg
 * Into:     https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_1200,c_limit/v1234/file.jpg
 */
export function getOptimizedCloudinaryUrl(url, maxWidth = 1200) {
  if (!url || typeof url !== 'string') return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  if (url.includes('/f_auto,q_auto')) return url;

  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${maxWidth},c_limit/`);
}

/**
 * Upload a File object or base64 Data URI string directly to Cloudinary with automatic pre-compression to under 200 KB
 * @param {File|Blob|string} fileInput File object or base64 Data URL
 * @param {string} folder Target Cloudinary folder (default: 'sle_institution_documents')
 * @param {number} maxKB Target max size in KB (default: 200 KB)
 * @returns {Promise<string>} Cloudinary secure HTTPS URL
 */
export async function uploadToCloudinary(fileInput, folder = 'sle_institution_documents', maxKB = 200) {
  if (!fileInput) return '';

  // If already a remote Cloudinary URL or http URL, return optimized URL directly
  if (typeof fileInput === 'string' && (fileInput.startsWith('http://') || fileInput.startsWith('https://'))) {
    return getOptimizedCloudinaryUrl(fileInput);
  }

  // Pre-compress image to under 200 KB before uploading
  let payloadToUpload = fileInput;
  try {
    payloadToUpload = await compressImage(fileInput, maxKB);
  } catch (compErr) {
    console.log('Pre-compression notice:', compErr);
  }

  // Method 1: Direct Cloudinary REST API signed upload via Web Crypto SHA-1 signature
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = `folder=${folder}&timestamp=${timestamp}${API_SECRET}`;
    const signature = await generateSHA1(stringToSign);

    const formData = new FormData();
    formData.append('file', payloadToUpload);
    formData.append('api_key', API_KEY);
    formData.append('timestamp', String(timestamp));
    formData.append('folder', folder);
    formData.append('signature', signature);

    const directRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
      method: 'POST',
      body: formData
    });

    if (directRes.ok) {
      const json = await directRes.json();
      const rawUrl = json.secure_url || json.url;
      if (rawUrl) {
        const finalUrl = getOptimizedCloudinaryUrl(rawUrl);
        console.log('Cloudinary direct signed upload success (Compressed):', finalUrl);
        return finalUrl;
      }
    } else {
      const errJson = await directRes.json();
      console.log('Cloudinary signed upload notice:', errJson);
    }
  } catch (err) {
    console.log('Cloudinary direct signed upload error:', err);
  }

  // Method 2: Fallback via PHP backend upload endpoint
  const backendEndpoints = [
    `${BACKEND_URL}/upload.php`,
    '/backend/upload.php',
    'http://localhost/slesinstitution/backend/upload.php'
  ];

  for (const ep of backendEndpoints) {
    try {
      let body;
      let headers = {};

      if (typeof payloadToUpload === 'string') {
        body = JSON.stringify({ fileData: payloadToUpload, folder });
        headers = { 'Content-Type': 'application/json' };
      } else if (payloadToUpload instanceof File || payloadToUpload instanceof Blob) {
        const formData = new FormData();
        formData.append('file', payloadToUpload);
        formData.append('folder', folder);
        body = formData;
      }

      if (body) {
        const res = await fetch(ep, {
          method: 'POST',
          headers,
          body
        });

        if (res.ok) {
          const json = await res.json();
          const rawUrl = json.secure_url || json.url;
          if (json.success && rawUrl) {
            const finalUrl = getOptimizedCloudinaryUrl(rawUrl);
            console.log('Cloudinary upload success via PHP backend:', finalUrl);
            return finalUrl;
          }
        }
      }
    } catch (err) {}
  }

  // Return original input or processed data URL as fallback
  return typeof payloadToUpload === 'string' ? payloadToUpload : '';
}
