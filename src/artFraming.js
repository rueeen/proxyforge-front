export function artBounds(width, height, { offsetX = 0, offsetY = 0, zoom = 100 }) {
  if (!(width > 0 && height > 0)) {
    return null;
  }
  const cardRatio = 63 / 88;
  const imageRatio = width / height;
  const w = (imageRatio > cardRatio ? imageRatio / cardRatio * 100 : 100) * zoom / 100;
  const h = (imageRatio > cardRatio ? 100 : cardRatio / imageRatio * 100) * zoom / 100;
  const left = 50 + offsetX - w / 2;
  const top = 50 + offsetY - h / 2;
  return { width: w, height: h, left, top, gaps: left > .001 || top > .001 || left + w < 99.999 || top + h < 99.999 };
}

export function artStyle(bounds) {
  if (!bounds) {
    return undefined;
  }
  const { width, height, left, top } = bounds;
  const masks = [];
  const xFade = Math.min(100, 4 / width * 100);
  const yFade = Math.min(100, 4 / height * 100);
  if (left > .001) masks.push(`linear-gradient(to right, transparent, #000 ${xFade}%)`);
  if (left + width < 99.999) masks.push(`linear-gradient(to left, transparent, #000 ${xFade}%)`);
  if (top > .001) masks.push(`linear-gradient(to bottom, transparent, #000 ${yFade}%)`);
  if (top + height < 99.999) masks.push(`linear-gradient(to top, transparent, #000 ${yFade}%)`);
  return {
    width: `${width}%`,
    height: `${height}%`,
    left: `${left}%`,
    top: `${top}%`,
    objectFit: 'fill',
    maskImage: masks.length ? masks.join(', ') : 'none',
    WebkitMaskImage: masks.length ? masks.join(', ') : 'none',
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in',
  };
}
