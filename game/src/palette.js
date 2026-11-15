export const PALETTE = {
  canvas: '#101216',
  surface: '#1c2026',
  hairline: '#2e343d',
  ink: '#ece7db',
  muted: '#9aa3ad',
  accent: '#f08a1d',
  ember: '#ff7a1a',
  teal: '#2fb8a6',
  danger: '#e5484d',
  sky: '#1a2433',
  ground: '#23262b',
  lamp: '#ffb45e',
};

export function hex(name) {
  return PALETTE[name];
}
