// Design tokens from docs/design/SPEC.md. Light mode only for MVP.
export const colors = {
  background: "#F2F2F7",
  card: "#FFFFFF",
  accent: "#1A5CFF",
  text: "#000000",
  textSecondary: "#6B6B70",
  textTertiary: "#8E8E93",
  separator: "#E5E5EA",
  searchField: "#E9E9EE",
  chip: "#FFFFFF",
  danger: "#FF3B30",
  // Status colors
  expired: "#FF3B30",
  soon30: "#FF9500",
  soon90: "#1A5CFF",
  good: "#34C759",
  none: "#8E8E93",
  // Category tiles
  passport: "#8E5CF6",
  insurance: "#34C759",
  lease: "#FF9500",
  vehicle: "#30B0C7",
  health: "#FF2D55",
  drivers_license: "#1A5CFF",
  other: "#8E8E93",
} as const;

export const radius = { card: 12, tile: 10, pill: 999, chip: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const type = {
  largeTitle: { fontSize: 34, fontWeight: "700" as const, letterSpacing: 0.4 },
  title: { fontSize: 28, fontWeight: "700" as const },
  eyebrow: { fontSize: 13, fontWeight: "600" as const, letterSpacing: 0.3, color: colors.textTertiary },
  sectionHeader: { fontSize: 13, fontWeight: "500" as const, letterSpacing: 0.4, color: colors.textTertiary },
  body: { fontSize: 17 },
  rowTitle: { fontSize: 17, fontWeight: "600" as const },
  caption: { fontSize: 13 },
  subline: { fontSize: 15 },
} as const;

// Tints used behind a status color (pill backgrounds, icon squares): 15% alpha.
export const tint = (hex: string, alpha = 0.15) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};
