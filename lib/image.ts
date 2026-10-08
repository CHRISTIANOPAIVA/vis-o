// lib/image.ts
//
// Preparo das fotos no navegador antes do upload para /api/analyze-food.
// Foto de celular crua tem 3-8 MB (e base64 infla ~33%): estoura o limite de
// corpo da Vercel (~4,5 MB) e o teto de 5 MB por imagem da Anthropic. A API
// reduz para ~1568 px no lado maior de qualquer forma, entao mandar mais que
// isso so gasta banda e latencia.

const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.85;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function resizeToJpegDataUrl(file: File): Promise<string> {
  // createImageBitmap ja aplica a orientacao EXIF (foto em retrato nao sai deitada).
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponivel");

    // JPEG nao tem transparencia: sem fundo, PNG transparente sairia preto.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}

/**
 * Converte a foto em data URL JPEG com no maximo MAX_DIMENSION px no lado
 * maior (nunca amplia). Se o navegador nao conseguir decodificar o arquivo
 * (ex.: HEIC fora do Safari), envia o original.
 */
export async function prepareImageForUpload(file: File): Promise<string> {
  try {
    return await resizeToJpegDataUrl(file);
  } catch (err) {
    console.warn("Nao foi possivel redimensionar a imagem, enviando original", err);
    return readAsDataUrl(file);
  }
}
