const blockedHosts = new Set();

export function canTryHost(url) {
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) && !blockedHosts.has(parsed.host);
  } catch {
    return false;
  }
}

export async function fetchImageInBrowser(url) {
  if (!canTryHost(url)) {
    throw new Error("cors");
  }
  const parsed = new URL(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`La descarga respondió HTTP ${response.status}.`);
    }
    const blob = await response.blob();
    const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    if (!extensions[blob.type]) throw new Error("Formato no compatible; usa PNG, JPG o WEBP.");
    if (blob.size > 10 * 1024 * 1024) throw new Error("La imagen debe pesar 10 MB o menos.");
    let name;
    try { name = decodeURIComponent(parsed.pathname.split('/').pop()); } catch { name = ""; }
    name = (name || `referencia.${extensions[blob.type]}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    return new File([blob], name, { type: blob.type });
  } catch (error) {
    if (error instanceof TypeError) {
      blockedHosts.add(parsed.host);
      throw new Error("cors");
    }
    if (controller.signal.aborted) throw new Error("La descarga tardó más de 20 segundos.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
