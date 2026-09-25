import { colorSwatch, PHOTO_STAGE_SHORT } from "@/lib/customers/shared";
import { formatKm, formatPlate } from "@/lib/format";
import type { PhotoStage } from "@/lib/validations/schemas";

/*
 * "Fotos" de ejemplo del modo demo: ilustraciones SVG (data URL) que imitan
 * una toma de inspección, con marca de agua de OT y etapa. Evitan depender
 * de imágenes externas y pesan ~3 KB cada una. Sin "server-only": el
 * asistente de recepción las usa como fotos de prueba en el navegador.
 */

export type DemoShot = "side" | "side-right" | "odometer" | "brake" | "chain" | "engine" | "damage";

type ShotOptions = {
  shot: DemoShot;
  stage: PhotoStage;
  color: string | null;
  plate: string;
  folio: string;
  km: number | null;
  /** Texto del recuadro de daño / detalle. */
  label?: string;
};

const W = 1600;
const H = 1067;

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const BACKGROUNDS: Record<PhotoStage, [string, string, string]> = {
  // pared (arriba), pared (abajo), piso
  reception: ["#3b4250", "#252a33", "#1b1e24"],
  in_progress: ["#4a3f35", "#2c251f", "#1f1a16"],
  delivery: ["#dfe3e8", "#b8bec7", "#8e959f"],
};

function backdrop(stage: PhotoStage) {
  const [top, bottom, floor] = BACKGROUNDS[stage];
  return `<defs><linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
<radialGradient id="light" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="${W}" height="${H}" fill="url(#wall)"/>
<rect y="${H * 0.74}" width="${W}" height="${H * 0.26}" fill="${floor}"/>
<rect width="${W}" height="${H}" fill="url(#light)"/>`;
}

function wheel(cx: number, cy: number, disc: boolean) {
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const a = (i * 2 * Math.PI) / 5;
    return `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * 118).toFixed(1)}" y2="${(cy + Math.sin(a) * 118).toFixed(1)}" stroke="#2b2f36" stroke-width="16" stroke-linecap="round"/>`;
  }).join("");
  return `<circle cx="${cx}" cy="${cy}" r="170" fill="none" stroke="#111" stroke-width="46"/>
<circle cx="${cx}" cy="${cy}" r="125" fill="none" stroke="#3a3f47" stroke-width="10"/>${spokes}
${disc ? `<circle cx="${cx}" cy="${cy}" r="88" fill="none" stroke="#a8adb5" stroke-width="18"/><rect x="${cx + 55}" y="${cy - 70}" width="46" height="70" rx="12" fill="#c1121f"/>` : ""}
<circle cx="${cx}" cy="${cy}" r="22" fill="#9ca3af"/>`;
}

function motorcycle(color: string) {
  return `<ellipse cx="800" cy="935" rx="560" ry="34" fill="#000" opacity="0.35"/>
${wheel(470, 760, false)}${wheel(1130, 760, true)}
<path d="M760 640 L470 760" stroke="#3f444c" stroke-width="34" stroke-linecap="round"/>
<path d="M1030 400 L1130 760" stroke="#c9ccd1" stroke-width="30" stroke-linecap="round"/>
<path d="M705 470 L760 640 L905 470 L960 640 L1030 430" fill="none" stroke="${color}" stroke-width="16" stroke-linejoin="round" opacity="0.85"/>
<rect x="690" y="560" width="270" height="170" rx="26" fill="#30343b"/>
<rect x="720" y="585" width="90" height="60" rx="10" fill="#454b54"/>
<path d="M840 725 Q700 760 560 700" fill="none" stroke="#8b9099" stroke-width="24" stroke-linecap="round"/>
<path d="M760 475 Q860 375 1010 405 L1040 520 Q900 565 780 545 Z" fill="${color}"/>
<path d="M800 470 Q880 420 990 430" fill="none" stroke="#fff" stroke-width="10" opacity="0.25" stroke-linecap="round"/>
<path d="M560 470 Q650 440 775 468 L772 512 Q660 506 560 502 Z" fill="#17191d"/>
<path d="M420 430 L585 468 L560 505 L462 478 Z" fill="${color}"/>
<path d="M985 372 L1062 356" stroke="#1b1d21" stroke-width="16" stroke-linecap="round"/>
<circle cx="1098" cy="445" r="42" fill="#e8eaee" stroke="#2b2f36" stroke-width="10"/>`;
}

function odometer(km: number | null) {
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = Math.PI * (1 + i / 10);
    const x1 = 800 + Math.cos(a) * 300;
    const y1 = 560 + Math.sin(a) * 300;
    const x2 = 800 + Math.cos(a) * 270;
    const y2 = 560 + Math.sin(a) * 270;
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${i > 7 ? "#ef4444" : "#e5e7eb"}" stroke-width="8"/>`;
  }).join("");
  return `<rect x="330" y="200" width="940" height="620" rx="70" fill="#0b0d10" stroke="#2d3138" stroke-width="18"/>
<path d="M500 560 A300 300 0 0 1 1100 560" fill="none" stroke="#1f2937" stroke-width="34"/>
<path d="M500 560 A300 300 0 0 1 760 262" fill="none" stroke="#22d3ee" stroke-width="34"/>${ticks}
<text x="800" y="545" text-anchor="middle" font-family="Arial, sans-serif" font-size="120" font-weight="700" fill="#f9fafb">N</text>
<text x="800" y="700" text-anchor="middle" font-family="'Courier New', monospace" font-size="92" font-weight="700" fill="#f9fafb">${escape(km !== null ? formatKm(km) : "— km")}</text>
<text x="800" y="760" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" fill="#9ca3af" letter-spacing="6">ODÓMETRO</text>
<g fill="#22c55e">${[0, 1, 2, 3, 4].map((i) => `<rect x="${420 + i * 44}" y="760" width="32" height="18" rx="4"/>`).join("")}</g>`;
}

function brake() {
  const holes = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 2 * Math.PI) / 24;
    const r = i % 2 ? 250 : 215;
    return `<circle cx="${(760 + Math.cos(a) * r).toFixed(1)}" cy="${(540 + Math.sin(a) * r).toFixed(1)}" r="13" fill="#1f2329"/>`;
  }).join("");
  return `<circle cx="760" cy="540" r="330" fill="#b9bec6"/>
<circle cx="760" cy="540" r="330" fill="none" stroke="#8d939c" stroke-width="10"/>${holes}
<circle cx="760" cy="540" r="160" fill="#2b2f36"/>
${Array.from({ length: 6 }, (_, i) => {
  const a = (i * Math.PI) / 3;
  return `<circle cx="${(760 + Math.cos(a) * 120).toFixed(1)}" cy="${(540 + Math.sin(a) * 120).toFixed(1)}" r="18" fill="#d4af37"/>`;
}).join("")}
<circle cx="760" cy="540" r="62" fill="#6b7280"/>
<rect x="1010" y="300" width="190" height="470" rx="60" fill="#c1121f"/>
<text x="1105" y="560" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#fff" transform="rotate(-90 1105 540)">brembo</text>`;
}

function chain() {
  const teeth = Array.from({ length: 42 }, (_, i) => {
    const a = (i * 2 * Math.PI) / 42;
    const x = 760 + Math.cos(a) * 330;
    const y = 540 + Math.sin(a) * 330;
    return `<rect x="${(x - 14).toFixed(1)}" y="${(y - 20).toFixed(1)}" width="28" height="40" rx="6" fill="#9ca3af" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }).join("");
  const links = Array.from({ length: 22 }, (_, i) => {
    const a = Math.PI * 0.55 + (i * Math.PI * 0.9) / 21;
    const x = 760 + Math.cos(a) * 352;
    const y = 540 + Math.sin(a) * 352;
    return `<rect x="${(x - 26).toFixed(1)}" y="${(y - 14).toFixed(1)}" width="52" height="28" rx="14" fill="#d4af37" stroke="#6b5a1e" stroke-width="5" transform="rotate(${((a * 180) / Math.PI + 90).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }).join("");
  return `${teeth}<circle cx="760" cy="540" r="315" fill="#7c828b"/>
${Array.from({ length: 5 }, (_, i) => {
  const a = (i * 2 * Math.PI) / 5;
  return `<circle cx="${(760 + Math.cos(a) * 180).toFixed(1)}" cy="${(540 + Math.sin(a) * 180).toFixed(1)}" r="70" fill="#4b5058"/>`;
}).join("")}
<circle cx="760" cy="540" r="80" fill="#9ca3af"/>${links}`;
}

function engine(color: string) {
  return `<rect x="360" y="330" width="880" height="470" rx="60" fill="#2c3037"/>
<rect x="430" y="250" width="740" height="200" rx="46" fill="${color}"/>
<text x="800" y="380" text-anchor="middle" font-family="Arial, sans-serif" font-size="92" font-weight="800" fill="#fff" letter-spacing="10" opacity="0.92">DESMO</text>
${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${480 + i * 128}" cy="480" r="20" fill="#9ca3af"/>`).join("")}
<rect x="470" y="540" width="660" height="40" rx="12" fill="#1a1d22"/>
${[0, 1, 2, 3].map((i) => `<rect x="${500 + i * 160}" y="610" width="110" height="150" rx="18" fill="#3b4048" stroke="#555b64" stroke-width="6"/>`).join("")}
<path d="M300 820 Q800 700 1300 820" fill="none" stroke="#111" stroke-width="30" stroke-linecap="round"/>`;
}

function damageMarker(label: string) {
  return `<circle cx="905" cy="480" r="120" fill="none" stroke="#facc15" stroke-width="12" stroke-dasharray="26 16"/>
<path d="M1020 420 L1180 300" stroke="#facc15" stroke-width="10"/>
<rect x="1150" y="220" width="400" height="92" rx="16" fill="#facc15"/>
<text x="1350" y="280" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#111">${escape(label)}</text>
<path d="M860 455 L935 505 M870 500 L950 470" stroke="#f8fafc" stroke-width="5" opacity="0.8"/>`;
}

function overlay({ plate, folio, stage }: ShotOptions) {
  const dark = stage === "delivery" ? "#111827" : "#f9fafb";
  return `<rect x="${W - 350}" y="40" width="250" height="84" rx="12" fill="#fff" stroke="#111" stroke-width="6"/>
<text x="${W - 225}" y="100" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#111" letter-spacing="3">${escape(formatPlate(plate))}</text>
<text x="${W - 110}" y="${H - 40}" text-anchor="end" font-family="'Courier New', monospace" font-size="34" fill="${dark}" opacity="0.85">${escape(`MotoOps · ${folio} · ${PHOTO_STAGE_SHORT[stage].toUpperCase()}`)}</text>`;
}

export function demoPhotoUrl(options: ShotOptions) {
  const color = colorSwatch(options.color) ?? "#c1121f";
  const scene = {
    side: () => motorcycle(color),
    // Costado derecho: la misma moto reflejada.
    "side-right": () => `<g transform="translate(${W} 0) scale(-1 1)">${motorcycle(color)}</g>`,
    damage: () => motorcycle(color) + damageMarker(options.label ?? "Rayón"),
    odometer: () => odometer(options.km),
    brake,
    chain,
    engine: () => engine(color),
  }[options.shot]();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${backdrop(options.stage)}${scene}${overlay(options)}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
