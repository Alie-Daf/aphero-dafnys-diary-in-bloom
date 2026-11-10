// flowers.js: draws every flower as an SVG string, in a soft hand-painted style.
// No image files needed. Add a new flower by writing one small function and one line in FLOWERS.
//
// How the "painted" look works (three tricks):
//   1. Petals have no hard outline (only a faint one).
//   2. A little noise (the PAINT filter) makes the edges slightly wobbly, like watercolour.
//   3. Soft light on the top-left edges and soft shade on the bottom-right edges, like paint catching the light.

// ---------- Tiny drawing helpers ----------
const spin = (n, make, start = 0) => Array.from({ length: n }, (_, i) => make(start + (i * 360) / n)).join("");

// A petal-ish blob: faint outline so shapes still read clearly.
const shape = (d, fill, edge = "none", r = 0, w = 0.8) =>
  `<path d="${d}" transform="rotate(${r})" fill="${fill}" stroke="${edge}" stroke-opacity=".3" stroke-width="${w}" stroke-linejoin="round"/>`;
const oval = (rx, ry, cy, r, fill, edge = "none") =>
  `<ellipse cx="0" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${r})" fill="${fill}" stroke="${edge}" stroke-opacity=".3" stroke-width=".8"/>`;
const dot = (x, y, r, fill, edge = "none") => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${edge}" stroke-opacity=".3" stroke-width=".6"/>`;
const line = (d, color, w = 1.2) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
const at = (x, y, body, extra = "") => `<g transform="translate(${x},${y}) ${extra}">${body}</g>`;

const GREEN = "#7FA06B", GREEN_DARK = "#5E8654";
const leaf = (x, y, r, s = 1, c = "#8FB07A") =>
  at(x, y, `<path d="M0 0C8-10 24-10 32 0C24 10 8 10 0 0Z" fill="${c}" stroke="${GREEN_DARK}" stroke-opacity=".3" stroke-width=".8"/>
            <path d="M2 0H28" stroke="${GREEN_DARK}" stroke-opacity=".4" stroke-width=".7"/>`, `rotate(${r}) scale(${s})`);
const stem = () => line("M60 70C58 120 62 160 60 198", GREEN, 4) + leaf(60, 150, -30) + leaf(60, 164, 210);
const head = (body, x = 60, y = 58) => at(x, y, body);

// ---------- Flowers (each one is 120 wide x 200 tall, stem pointing down) ----------
function rose(dark, mid, light) {
  const b = dot(0, 0, 24, dark) + spin(5, a => oval(13, 16, -13, a, mid, dark)) + spin(5, a => oval(10, 12, -9, a, light, dark), 36)
    + dot(0, 0, 7, light, dark) + line("M-4 0C-4-5 4-5 4 0C4 4-2 5-3 2", dark, 1);
  return stem() + head(b);
}
function peony(dark, mid, light) {
  const b = spin(9, a => oval(12, 16, -17, a, dark, "#B85870")) + spin(8, a => oval(11, 14, -12, a, mid, "#C96A83"), 22)
    + spin(6, a => oval(8, 10, -7, a, light, "#D98298"), 10) + dot(0, 0, 3.5, "#F2C94C");
  return stem() + head(b);
}
function tulip(c1, c2, edge) {
  const b = shape("M-19-2C-24-26-10-38 0-44C10-38 24-26 19-2C10 9-10 9-19-2Z", c1, edge)
    + shape("M-10 5C-15-22-4-36 0-44C4-36 15-22 10 5C4 11-4 11-10 5Z", c2, edge);
  return stem() + head(b, 60, 66);
}
function daisy() {
  const b = spin(14, a => oval(5, 14, -22, a, "#FFFFFF", "#D9CFC4")) + spin(14, a => oval(5, 13, -20, a, "#FFFBF5", "#E3D9CC"), 12)
    + dot(0, 0, 9, "#F2C94C", "#D9A62A");
  return stem() + head(b);
}
function sunflower() {
  const b = spin(20, a => shape("M0-12C6-22 6-34 0-44C-6-34-6-22 0-12Z", "#F2B632", "#C98F1C", a, .7))
    + spin(20, a => shape("M0-10C5-19 5-29 0-36C-5-29-5-19 0-10Z", "#F8D24E", "#E0A82A", a, .6), 9)
    + dot(0, 0, 14, "#6B4A3A") + dot(0, 0, 9, "#4A3328");
  return stem() + head(b);
}
function gumamela(color, edge, throat, stamen) {          // hibiscus
  const petal = "M0 0C-24-6-32-32-16-46C-6-52 6-52 16-46C32-32 24-6 0 0Z";
  const b = spin(5, a => shape(petal, color, edge, a, 1)) + dot(0, 0, 7, throat) + line("M0 0C6-10 14-22 26-32", stamen, 3)
    + spin(5, a => dot(26 + 3 * Math.cos(a / 57), -32 + 3 * Math.sin(a / 57), 2.3, "#F2C94C", "#C98F1C"))
    + spin(5, a => dot(26 + 7 * Math.cos(a / 57 + 1), -32 + 7 * Math.sin(a / 57 + 1), 1.5, stamen));
  return stem() + head(b);
}
function sampaguita() {                                    // jasmine: little white blooms on a branch
  const bloom = (x, y, s) => at(x, y,
    spin(8, a => oval(5, 9, -8, a, "#FFFFFF", "#E4DACD")) + spin(6, a => oval(4, 7, -5, a, "#FFFDF8", "#EADFD2"), 20) + dot(0, 0, 2.5, "#E8E2A8"), `scale(${s})`);
  const leaves = [[60, 172, -55], [60, 176, 55], [58, 148, -60], [61, 142, 60], [48, 118, -65], [72, 110, 65]]
    .map(([x, y, r]) => at(x, y, oval(6, 11, -8, 0, "#5F8F58", "#477245"), `rotate(${r})`)).join("");
  const buds = [[98, 116, 50], [40, 76, -20], [84, 72, 15], [36, 100, -15]]
    .map(([x, y, r]) => at(x, y, oval(3, 6, -4, 0, "#FBF8EE", "#DCD3C0"), `rotate(${r})`)).join("");
  return line("M60 198C60 150 58 100 60 58", GREEN, 2.5) + line("M60 140C48 120 40 100 36 80", GREEN, 2.2)
    + line("M60 130C72 112 80 92 84 76", GREEN, 2.2) + line("M60 150C70 140 90 130 98 118", GREEN, 2)
    + leaves + buds + bloom(60, 52, 1.15) + bloom(34, 80, 0.9) + bloom(86, 76, 0.85);
}
function kalachuchi(color, edge, center) {                 // plumeria: five pinwheel petals
  const b = spin(5, a => shape("M0 0C-20-2-26-30-8-46C4-50 17-38 13-20C11-10 5-3 0 0Z", color, edge, a, .9))
    + spin(5, a => shape("M0 0C-6-6-7-14-3-20C3-15 5-8 0 0Z", center, "none", a)) + dot(0, 0, 2.6, "#E9A92E");
  return line("M60 198C58 150 62 110 60 72", "#8A7A5E", 5) + leaf(60, 150, -35, 1.5, "#6BA079") + leaf(60, 164, 215, 1.5, "#6BA079") + head(b, 60, 56);
}
function rosal() {                                         // gardenia: round white petals, glossy leaves
  const b = spin(6, a => oval(14, 19, -18, a, "#FFFFFF", "#DCD2C2")) + spin(6, a => oval(12, 16, -13, a, "#FFFDF8", "#E3D9CA"), 30)
    + spin(5, a => oval(7, 10, -6, a, "#FBF7EC", "#E3D9CA"), 12) + dot(0, 0, 4, "#EDE7C8", "#D9CFA8");
  return line("M60 70C58 120 62 160 60 198", GREEN, 4) + leaf(60, 146, -32, 1.3, "#3F7A4F") + leaf(60, 162, 212, 1.3, "#3F7A4F") + head(b);
}
function orchid(pet, top, low, lip, edge) {               // phalaenopsis
  const o = (cx, cy, rx, ry, r, f) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" transform="rotate(${r} ${cx} ${cy})" fill="${f}" stroke="${edge}" stroke-opacity=".3" stroke-width=".8"/>`;
  const b = o(-22, -4, 21, 17, -18, pet) + o(22, -4, 21, 17, 18, pet) + o(0, -24, 11, 17, 0, top) + o(-9, 20, 9, 17, 28, low) + o(9, 20, 9, 17, -28, low)
    + shape("M0-2C-9-4-12 6-6 12C-2 16 2 16 6 12C12 6 9-4 0-2Z", lip, edge) + dot(0, 4, 2, "#F2C94C") + dot(0, -6, 3.2, "#FFF0F5", edge);
  return line("M60 198C46 150 44 100 58 76", GREEN, 3.5) + dot(46, 128, 5, "#F7C6D6", edge) + dot(43, 110, 4, "#F7C6D6", edge)
    + leaf(60, 198, -150, 1.9, "#6BA079") + leaf(60, 198, -28, 1.9, "#6BA079") + head(b, 60, 62);
}
function carnation(d, m, l, edge) {                        // ruffled petals in three layers
  const ruffle = "M0 0L-12-18L-10-24L-6-20L-3-26L0-21L3-26L6-20L10-24L12-18Z";
  const layer = (s, start, fill) => `<g transform="scale(${s})">${spin(12, a => shape(ruffle, fill, edge, a, .6), start)}</g>`;
  const b = layer(1.3, 0, d) + layer(1, 15, m) + layer(0.66, 8, l) + dot(0, 0, 3, l, edge);
  const calyx = '<path d="M-11 18C-11 29-6 38 0 38C6 38 11 29 11 18Z" fill="#8FB07A" stroke="#5E8654" stroke-opacity=".3" stroke-width=".8"/>';
  return line("M60 70C58 120 62 160 60 198", GREEN, 3.5) + leaf(60, 150, -35, 1.1) + leaf(60, 166, 215, 1.1) + head(calyx, 60, 66) + head(b, 60, 54);
}
function lavender() {
  const floret = (i, a) => at(60, 40 + i * 11, oval(4, 7, -6, 0, i % 2 ? "#9B7FCB" : "#B7A3D6", "#7B5FAF"), `rotate(${a})`);
  const spikes = Array.from({ length: 11 }, (_, i) => floret(i, -38) + floret(i, 38)).join("");
  return line("M60 198C60 150 60 100 60 30", GREEN, 3) + spikes + at(60, 32, oval(3.5, 7, -4, 0, "#B7A3D6", "#7B5FAF")) + leaf(60, 170, -40, .9) + leaf(60, 176, 220, .9);
}
function sakura() {
  const petal = "M0 0C-14-8-17-26-9-33L0-27L9-33C17-26 14-8 0 0Z";
  const b = spin(5, a => shape(petal, "#F8C8D2", "#E48BA2", a, .9)) + dot(0, 0, 3.5, "#E88AA2")
    + [0.3, 1.4, 2.5, 3.6, 4.7, 5.6].map(i => dot(13 * Math.sin(i), -13 * Math.cos(i), 1.4, "#C94A6B")).join("");
  return line("M60 198C58 150 62 110 60 70", "#7B5A4A", 3.5) + line("M61 130C74 120 82 108 90 98", "#7B5A4A", 2.5)
    + head(b) + at(90, 98, b, "scale(.55)") + leaf(60, 160, -30, .9, "#9BB88A");
}

// ---------- Fillers (greenery that sits behind the flowers) ----------
let seed = 7;                                                // a tiny repeatable "random" so the picture never changes
const rand = (min, max) => { seed = (seed * 16807) % 2147483647; return min + (seed / 2147483647) * (max - min); };
function babysBreath() {
  seed = 7;
  return [[60, 40], [30, 70], [90, 66], [18, 112], [102, 106], [44, 96], [78, 92]].map(([x, y]) =>
    line(`M60 198C60 150 ${x} ${y + 50} ${x} ${y}`, GREEN, 1.2) +
    Array.from({ length: 9 }, () => dot(x + rand(-9, 9), y + rand(-9, 9), rand(1.8, 2.9), "#FFFFFF", "#E4DACD")).join("")).join("");
}
function eucalyptus() {
  let o = line("M60 198C56 150 64 100 58 40", GREEN, 2.5);
  for (let i = 0, y = 60; y < 180; i++, y += 17) {
    o += at(50, y, oval(9, 10, 0, 0, "#A9C4B0", "#7F9C8A")) + at(70, y + 8, oval(9.5, 10.5, 0, 0, "#B9D0BE", "#7F9C8A"));
  }
  return o + at(58, 36, oval(8, 9, 0, 0, "#A9C4B0", "#7F9C8A"));
}
function fern() {
  let o = line("M60 198C60 150 60 100 60 28", "#6F9A63", 2);
  for (let i = 0; i < 12; i++) {
    const y = 176 - i * 12, len = 24 - i * 1.5;
    for (const s of [-1, 1]) o += `<ellipse cx="${60 + (s * len) / 2}" cy="${y}" rx="${len / 2}" ry="3.2" transform="rotate(${-s * 22} 60 ${y})" fill="#78A06C" stroke="#5E8654" stroke-opacity=".3" stroke-width=".5"/>`;
  }
  return o;
}

// ---------- The list the Bouquet page reads. Add a line here to add a flower. ----------
export const FLOWERS = [
  { id: "rose-red",     name: "Red rose",        kind: "flower", draw: () => rose("#B3263E", "#DB4259", "#F27A8C") },
  { id: "rose-blush",   name: "Blush rose",      kind: "flower", draw: () => rose("#E8A0AE", "#F4C0CA", "#FBDDE2") },
  { id: "peony",        name: "Peony",           kind: "flower", draw: () => peony("#D9748E", "#EE9FB3", "#F9CBD6") },
  { id: "tulip",        name: "Tulip",           kind: "flower", draw: () => tulip("#F08FAA", "#F8B6C8", "#C9607E") },
  { id: "daisy",        name: "Daisy",           kind: "flower", draw: daisy },
  { id: "sunflower",    name: "Sunflower",       kind: "flower", draw: sunflower },
  { id: "gumamela",     name: "Gumamela",        kind: "flower", local: true, draw: () => gumamela("#E23D55", "#B5273F", "#8E1630", "#B5273F") },
  { id: "gumamela-w",   name: "White gumamela",  kind: "flower", local: true, draw: () => gumamela("#FFFFFF", "#D4C6C6", "#E88AA2", "#E0708F") },
  { id: "sampaguita",   name: "Sampaguita",      kind: "flower", local: true, draw: sampaguita },
  { id: "kalachuchi",   name: "Kalachuchi",      kind: "flower", local: true, draw: () => kalachuchi("#FFFDF8", "#E0D3BE", "#F5C842") },
  { id: "kalachuchi-p", name: "Pink kalachuchi", kind: "flower", local: true, draw: () => kalachuchi("#F7B6C8", "#D9718F", "#F2C94C") },
  { id: "rosal",        name: "Rosal",           kind: "flower", local: true, draw: rosal },
  { id: "orchid",       name: "Orchid",          kind: "flower", draw: () => orchid("#F4B6CB", "#F9CBD9", "#F0A5BE", "#C94A8A", "#D9718F") },
  { id: "carnation",    name: "Carnation",       kind: "flower", draw: () => carnation("#EE8FAE", "#F6B2C7", "#FBD6E1", "#C9607E") },
  { id: "lavender",     name: "Lavender",        kind: "flower", draw: lavender },
  { id: "sakura",       name: "Sakura",          kind: "flower", draw: sakura },
  { id: "babys-breath", name: "Baby’s breath",   kind: "filler", draw: babysBreath },
  { id: "eucalyptus",   name: "Eucalyptus",      kind: "filler", draw: eucalyptus },
  { id: "fern",         name: "Fern",            kind: "filler", draw: fern },
];

// ---------- The painted finish (shared by every flower) ----------
// One SVG filter does all the "painting":
//   wobble the edges a little, then add a soft shade on the lower-right edge and a soft light on the upper-left edge.
const DEFS = `<defs>
  <filter id="paint" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation=".6" result="paint"/>
    <feOffset in="SourceAlpha" dx="-2.5" dy="-3.5" result="o1"/>
    <feComposite in="SourceAlpha" in2="o1" operator="out"/>
    <feGaussianBlur stdDeviation="2.2"/>
    <feComposite in2="SourceAlpha" operator="in"/>
    <feColorMatrix type="matrix" values="0 0 0 0 .29  0 0 0 0 .2  0 0 0 0 .16  0 0 0 .55 0" result="shade"/>
    <feOffset in="SourceAlpha" dx="2.5" dy="3.5" result="o2"/>
    <feComposite in="SourceAlpha" in2="o2" operator="out"/>
    <feGaussianBlur stdDeviation="2.2"/>
    <feComposite in2="SourceAlpha" operator="in"/>
    <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .8 0" result="light"/>
    <feMerge><feMergeNode in="paint"/><feMergeNode in="shade"/><feMergeNode in="light"/></feMerge>
  </filter>
</defs>`;

// A complete, standalone SVG string. Works inline in HTML AND as an image source for a canvas.
export function flowerSvg(id, { label = "", width = 0 } = {}) {
  const f = FLOWERS.find(x => x.id === id);
  if (!f) return "";
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  const size = width ? `width="${width}" height="${Math.round(width * 200 / 120)}"` : "";   // a canvas needs a real size, or the picture comes out blurry
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 200" ${size} ${a11y}>${DEFS}<g filter="url(#paint)">${f.draw()}</g></svg>`;
}

// Load a flower as an <img> (the canvas needs an image to draw). Cached, so each loads once.
const cache = new Map();
export function flowerImage(id) {
  if (!cache.has(id)) {
    cache.set(id, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(flowerSvg(id, { width: 360 }));
    }));
  }
  return cache.get(id);
}