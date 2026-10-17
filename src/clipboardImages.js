const imageTypes = ["image/png", "image/jpeg", "image/webp"];

export function clipboardImage(data) {
  const items = [...(data?.items || [])];
  const image = items.find((item) => item.kind === "file" && imageTypes.includes(item.type));
  if (image) {
    return { file: image.getAsFile(), error: "", hasImage: true };
  }
  const hasImage = items.some((item) => item.kind === "file" && item.type.startsWith("image/"));
  return {
    file: null,
    hasImage,
    error: hasImage ? "Formato no compatible; usa PNG, JPG o WEBP." : "",
  };
}

export function referenceImageError(file) {
  if (!imageTypes.includes(file.type)) {
    return "Formato no compatible; usa PNG, JPG o WEBP.";
  }
  if (file.size > 10 * 1024 * 1024) {
    return "La imagen debe pesar 10 MB o menos.";
  }
  return "";
}
