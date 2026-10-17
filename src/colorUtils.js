export function hexToRgb(hex) {
  const value = typeof hex === "string" ? hex.replace(/^#/, "") : "";
  const expanded = /^[0-9a-f]{3}$/i.test(value)
    ? value.split("").map((digit) => digit + digit).join("")
    : value;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
}

export function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

export function luminance(hex) {
  const channels = Object.values(hexToRgb(hex)).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function readableText(hex) {
  return luminance(hex) > 0.45 ? "#141414" : "#f7f4ee";
}

export function rarityGem(rarity) {
  const gems = {
    common: { from: "#62656a", to: "#111214" },
    uncommon: { from: "#eff3f5", to: "#6a747f" },
    rare: { from: "#ffe8a3", to: "#947022" },
    mythic: { from: "#ffac43", to: "#b52e20" },
    special: { from: "#deb4ff", to: "#7435ad" },
    bonus: { from: "#deb4ff", to: "#7435ad" },
  };
  return gems[rarity] || gems.common;
}
