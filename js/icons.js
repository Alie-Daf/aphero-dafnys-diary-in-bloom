// icons.js: thin line icons, drawn as inline SVG. One place for every icon on the site.
// icon("heart") returns a small <svg> string you can drop into any HTML.
const PATHS = {
  home:     '<path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z"/>',
  letter:   '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  flower:   '<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5C10 7 10.5 4 12 3c1.5 1 2 4 0 6.5zM14.5 12c2.5-2 5.5-1.5 6.5 0-1 1.5-4 2-6.5 0zM12 14.5c2 2.5 1.5 5.5 0 6.5-1.5-1-2-4 0-6.5zM9.5 12C7 14 4 13.5 3 12c1-1.5 4-2 6.5 0z"/>',
  camera:   '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13" r="3.5"/>',
  frame:    '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M3 17l5-4 4 3 3-2 6 4"/>',
  book:     '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13"/>',
  key:      '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  heart:    '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
  star:     '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  leaf:     '<path d="M5 19C5 9 11 5 19 5c0 8-4 14-14 14zM5 19l8-8"/>',
  sparkle:  '<path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
  moon:     '<path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>',
  sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  rain:     '<path d="M7 15a4 4 0 01-.5-8A5.5 5.5 0 0117.5 8 3.5 3.5 0 0117 15z"/><path d="M9 18v2M13 18v2"/>',
  pen:      '<path d="M4 20l4-1 11-11-3-3L5 16zM14 6l3 3"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  undo:     '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
  camera_off: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><path d="M3 3l18 18"/>',
};

export function icon(name, extra = "") {
  return `<svg class="icon ${extra}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] || ""}</svg>`;
}
// Just the "d" (outline) text of an icon's first path, used to draw icons on a canvas (photobooth stickers).
export const iconPath = (name) => (PATHS[name].match(/ d="([^"]+)"/) || [])[1];

// Fill every <span data-icon="heart"></span> in the page with its icon.
export function fillIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach(el => { el.innerHTML = icon(el.dataset.icon); });
}