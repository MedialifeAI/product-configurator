/**
 * Build the Jacob & Co Capability Overview PDF.
 *
 *   npm run build:capability-pdf
 *   node scripts/build-capability-pdf.mjs
 *
 * Output:
 *   docs/Jacob-and-Co-Capability-Overview.pdf
 *   public/capability-overview.pdf  (copy for static hosting)
 *
 * Optional cover image: place cover-watch.png at the repo root.
 *
 * Aesthetic: dark "maison" background, gold hairlines and eyebrows, serif
 * display typography, generous editorial whitespace. Matches the live site's
 * brand tokens (ink #0a0a0c, jc-gold #b4904e, bone #f5f2ea).
 */

import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT     = path.join(__dirname, '..');
const COVER    = path.join(ROOT, 'cover-watch.png');
const OUT_DIR   = path.join(ROOT, 'docs');
const OUT_FILE  = path.join(OUT_DIR, 'Jacob-and-Co-Capability-Overview.pdf');
const PUBLIC_FILE = path.join(ROOT, 'public', 'capability-overview.pdf');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// === Brand tokens (mirroring src/lib/siteConfigTypes.DEFAULT_THEME) ============
const COLORS = {
  ink:        '#0a0a0c',
  carbon:     '#15151a',
  bone:       '#f5f2ea',
  boneDim:    '#cfcabb',
  boneMute:   '#807a6c',
  gold:       '#b4904e',
  goldSoft:   '#85693a',
  goldGlow:   '#d4ad58',
};

const FONTS = {
  display:  'Times-Bold',
  displayI: 'Times-BoldItalic',
  serif:    'Times-Roman',
  sans:     'Helvetica',
  sansBold: 'Helvetica-Bold',
  sansObl:  'Helvetica-Oblique',
};

// US Letter portrait at 72 dpi
const PAGE = { w: 612, h: 792 };
const MARGIN = { top: 72, right: 64, bottom: 72, left: 64 };
const COL_W = PAGE.w - MARGIN.left - MARGIN.right;

// === PDF construction ========================================================
const doc = new PDFDocument({
  size: 'LETTER',
  margins: MARGIN,
  bufferPages: true,
  info: {
    Title:    'Immersive 3D E-Commerce Experience — Capability Overview',
    Author:   'Medialife AI · for Jacob & Co',
    Subject:  'Luxury Watch Configurator Platform — Capability Overview',
    Keywords: '3D, configurator, luxury, watch, AR, immersive commerce',
    Creator:  'Medialife AI',
  },
});

doc.pipe(fs.createWriteStream(OUT_FILE));

// pdfkit can silently spill content into a new page when content exceeds the
// margin box. That auto-page never receives our dark fill, leaving a stark
// white page in the middle of an otherwise maison-dark document. Catch every
// page-add (manual or auto) and paint the background first.
doc.on('pageAdded', () => {
  doc.save().rect(0, 0, PAGE.w, PAGE.h).fill(COLORS.ink).restore();
});

// --- Helpers -----------------------------------------------------------------
function fillPage(color = COLORS.ink) {
  doc.save().rect(0, 0, PAGE.w, PAGE.h).fill(color).restore();
}

function goldRule(x, y, w, opacity = 1) {
  doc.save()
    .opacity(opacity)
    .moveTo(x, y).lineTo(x + w, y)
    .lineWidth(0.75).strokeColor(COLORS.gold).stroke()
    .restore();
}

function trackedText(text, x, y, opts = {}) {
  // pdfkit doesn't expose letter-spacing — emulate via inserted spaces for
  // small-caps style eyebrows. Trades visual fidelity for readability.
  const {
    size = 8,
    color = COLORS.gold,
    font = FONTS.sansBold,
    upper = true,
    track = 2,
  } = opts;
  const out = upper ? text.toUpperCase() : text;
  doc.save().font(font).fontSize(size).fillColor(color).text(
    out,
    x, y,
    { characterSpacing: track, lineBreak: false },
  ).restore();
}

function eyebrow(text, y, opts = {}) {
  trackedText(text, MARGIN.left, y, { size: 8.5, track: 2.4, ...opts });
}

function displayTitle(text, y, opts = {}) {
  const {
    size = 32,
    color = COLORS.bone,
    font = FONTS.display,
    width = COL_W,
    x = MARGIN.left,
    align = 'left',
  } = opts;
  doc.save().font(font).fontSize(size).fillColor(color)
    .text(text, x, y, { width, align, lineGap: 4 })
    .restore();
  return doc.y;
}

function bodyText(text, opts = {}) {
  const {
    size = 10.5,
    color = COLORS.boneDim,
    font = FONTS.serif,
    width = COL_W,
    x = MARGIN.left,
    lineGap = 4,
    align = 'left',
    indent = 0,
  } = opts;
  doc.save().font(font).fontSize(size).fillColor(color)
    .text(text, x, doc.y, { width, align, lineGap, indent })
    .restore();
  return doc.y;
}

function smallLabel(text, x, y, opts = {}) {
  const { size = 7.5, color = COLORS.boneMute, track = 1.6 } = opts;
  doc.save().font(FONTS.sansBold).fontSize(size).fillColor(color)
    .text(text.toUpperCase(), x, y, { characterSpacing: track, lineBreak: false })
    .restore();
}

// Page numbers are stamped at the end via doc.bufferedPageRange so the count
// always matches the actual rendered length even when sections soft-break.

function newSectionPage() {
  doc.addPage();
  fillPage();
}

/** Minimal dial motif when cover-watch.png is absent. */
function drawCoverPlaceholder(x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  doc.save()
    .opacity(0.22)
    .circle(cx, cy, Math.min(w, h) * 0.34)
    .lineWidth(0.75).strokeColor(COLORS.gold).stroke()
    .circle(cx, cy, Math.min(w, h) * 0.26)
    .lineWidth(0.5).strokeColor(COLORS.goldSoft).stroke()
    .circle(cx, cy, 5).fillColor(COLORS.gold).fill()
    .restore();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r0 = Math.min(w, h) * 0.28;
    const r1 = Math.min(w, h) * 0.31;
    doc.save()
      .opacity(0.18)
      .moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      .lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
      .lineWidth(0.5).strokeColor(COLORS.gold).stroke()
      .restore();
  }
}

// =============================================================================
// COVER
// =============================================================================
fillPage();

// Top wordmark
doc.save()
  .font(FONTS.display).fontSize(20).fillColor(COLORS.bone)
  .text('JACOB & CO', MARGIN.left, MARGIN.top, {
    width: COL_W, align: 'center', characterSpacing: 6,
  })
  .restore();

// Wordmark hairline
goldRule(PAGE.w / 2 - 80, MARGIN.top + 36, 160, 0.7);

// Hero image — fit and center (optional cover-watch.png at repo root)
const imgY = 160;
const imgH = 360;
if (fs.existsSync(COVER)) {
  doc.image(COVER, MARGIN.left, imgY, {
    width: COL_W,
    height: imgH,
    align: 'center',
    valign: 'center',
    fit: [COL_W, imgH],
  });
} else {
  drawCoverPlaceholder(MARGIN.left, imgY, COL_W, imgH);
}

// Title block — tightened layout so subtitle clears the PREPARED FOR block
const titleY = 540;
doc.save()
  .font(FONTS.sansBold).fontSize(8.5).fillColor(COLORS.gold)
  .text('CAPABILITY OVERVIEW', MARGIN.left, titleY, {
    width: COL_W, align: 'center', characterSpacing: 3,
  })
  .restore();

doc.save()
  .font(FONTS.display).fontSize(32).fillColor(COLORS.bone)
  .text('Immersive 3D', MARGIN.left, titleY + 24, {
    width: COL_W, align: 'center', lineGap: 0,
  })
  .font(FONTS.displayI).fontSize(32).fillColor(COLORS.goldGlow)
  .text('E-Commerce Experience', MARGIN.left, doc.y - 4, {
    width: COL_W, align: 'center',
  })
  .restore();

goldRule(PAGE.w / 2 - 40, doc.y + 12, 80, 0.7);

doc.save()
  .font(FONTS.serif).fontSize(11).fillColor(COLORS.boneDim)
  .text(
    'Luxury Watch Configurator Platform · Astronomia Dragon',
    MARGIN.left, doc.y + 22,
    { width: COL_W, align: 'center' },
  )
  .restore();

// Footer block — pushed below the title with explicit spacing
doc.save()
  .font(FONTS.sansBold).fontSize(8).fillColor(COLORS.boneMute)
  .text('PREPARED FOR', MARGIN.left, PAGE.h - 96, {
    width: COL_W, align: 'center', characterSpacing: 2.6,
  })
  .font(FONTS.display).fontSize(13).fillColor(COLORS.bone)
  .text('Jacob & Co. Maison Concierge', MARGIN.left, PAGE.h - 76, {
    width: COL_W, align: 'center',
  })
  .restore();

doc.save()
  .font(FONTS.sansBold).fontSize(7).fillColor(COLORS.boneMute)
  .text('MEDIALIFE AI · 2026', MARGIN.left, PAGE.h - 40, {
    characterSpacing: 2, lineBreak: false,
  })
  .text('CONFIDENTIAL', PAGE.w - MARGIN.right - 60, PAGE.h - 40, {
    width: 60, align: 'right', characterSpacing: 2, lineBreak: false,
  })
  .restore();

// =============================================================================
// 01 — VISION
// =============================================================================
newSectionPage();

smallLabel('01', MARGIN.left, MARGIN.top, { size: 10, color: COLORS.gold, track: 2 });
eyebrow('The Vision', MARGIN.top + 26);
displayTitle(
  'A digital destination worthy of a high-complication timepiece.',
  MARGIN.top + 46,
  { size: 28 },
);
goldRule(MARGIN.left, doc.y + 14, 60);

doc.y += 30;
bodyText(
  'A single digital destination where the product is experienced in three dimensions from the first second — not as a flat product page with a spin button, but as a cinematic, configurable, shoppable presentation. Visitors explore the watch as an object of craft, configure meaningful variants, isolate components for a closer look, and move naturally toward appointment, inquiry, or purchase — on desktop, mobile, and through optional AR and print touchpoints.',
  { size: 11.5, lineGap: 5 },
);

doc.y += 26;
// Quote-style callout
doc.save()
  .moveTo(MARGIN.left, doc.y).lineTo(MARGIN.left, doc.y + 80)
  .lineWidth(2).strokeColor(COLORS.gold).stroke()
  .restore();
doc.save()
  .font(FONTS.displayI).fontSize(15).fillColor(COLORS.bone)
  .text(
    '"Immersive commerce built for considered purchase — where education, emotion, and configuration happen in one continuous flow."',
    MARGIN.left + 18, doc.y + 4,
    { width: COL_W - 18, lineGap: 4 },
  )
  .restore();


// =============================================================================
// 02 — WHAT MAKES THIS DIFFERENT
// =============================================================================
newSectionPage();

smallLabel('02', MARGIN.left, MARGIN.top, { size: 10, color: COLORS.gold, track: 2 });
eyebrow('What Makes This Different', MARGIN.top + 26);
displayTitle('Nine differentiators.', MARGIN.top + 46, { size: 28 });
goldRule(MARGIN.left, doc.y + 14, 60);

doc.y += 26;
bodyText(
  'Each capability below answers the question luxury brands ask of every digital investment: does this make the product feel rarer, or does it commoditise it?',
  { size: 10.5, lineGap: 4, color: COLORS.boneDim },
);

const usps = [
  ['3D-first, not 3D-added',
   'The watch is the hero of the page. Photography supports the experience rather than replacing it.'],
  ['Holographic part inspection',
   'Shoppers isolate dragon, case, movement, dial, globe, strap and more — a "museum case" moment competitors rarely offer online.'],
  ['True variant configuration',
   'Dragon finishes and case metals update in real time. No pre-rendered stills per SKU.'],
  ['Scroll-driven storytelling',
   'Editorial narrative panels over the live 3D scene build desire and comprehension before configuration.'],
  ['Shareable configurations',
   'Any build can be saved and sent via link or QR — ideal for concierge, retail partners, and follow-up.'],
  ['AR-ready journey',
   'View in AR from the configurator (phone handoff / in-space preview) with a path to full try-on in a later phase.'],
  ['Activated Print',
   'Magazines, postcards, stickers, and collateral become interactive entry points into the same experience.'],
  ['Self-service admin',
   'Your team updates copy, lighting, models, and feature toggles without a dev cycle for every tweak.'],
  ['Optional AI concierge',
   'Text and voice assistant for product Q&A and booking, connected to your existing systems.'],
];

doc.y += 22;
const yStart = doc.y;
const colGap = 18;
const colW = (COL_W - colGap) / 2;
let col = 0;
let yLeft = yStart;
let yRight = yStart;

usps.forEach(([title, body], i) => {
  const colX = i % 2 === 0 ? MARGIN.left : MARGIN.left + colW + colGap;
  const colY = i % 2 === 0 ? yLeft : yRight;
  // Gold bullet square
  doc.save().rect(colX, colY + 4, 6, 6).fill(COLORS.gold).restore();
  doc.save()
    .font(FONTS.sansBold).fontSize(10).fillColor(COLORS.bone)
    .text(title, colX + 14, colY, { width: colW - 14, lineGap: 2 })
    .font(FONTS.serif).fontSize(9.5).fillColor(COLORS.boneDim)
    .text(body, colX + 14, doc.y + 2, { width: colW - 14, lineGap: 3 })
    .restore();
  if (i % 2 === 0) yLeft = doc.y + 14;
  else yRight = doc.y + 14;
});


// =============================================================================
// 03 — VISITOR EXPERIENCE
// =============================================================================
newSectionPage();

smallLabel('03', MARGIN.left, MARGIN.top, { size: 10, color: COLORS.gold, track: 2 });
eyebrow('The Visitor Experience', MARGIN.top + 26);
displayTitle('What the shopper sees.', MARGIN.top + 46, { size: 28 });
goldRule(MARGIN.left, doc.y + 14, 60);

const chapters = [
  ['The Reveal', 'Full-screen 3D hero with the complete watch, subtle motion, and scroll-linked animation (exploded view on scroll) dramatising complexity without leaving the page. Premium typography and brand framing; key specifications surfaced discreetly at the sides on desktop.'],
  ['The Craft Narrative', 'Glass-style editorial panels appear over the continuing 3D scene as the user scrolls. Each chapter covers a pillar of the product — hand-engraved dragon, movement, globe, sapphire architecture — with optional highlight metrics. Designed to feel like a digital maison brochure, not a generic template.'],
  ['Make It Yours', 'The core conversion engine. Dragon variants, case and movement metals, globe handling, live 3D assembly, inspect mode for component isolation, reset view, canvas backgrounds, edition + reference line, and copy-link sharing — all in one cohesive interface.'],
  ['Specifications & Closing', 'An exact accounting: structured specifications table, appointment CTA with primary and secondary actions, boutique footprint copy. Optional Activated Print showcase block explaining how print collateral connects to the digital experience.'],
  ['Mobile & Tablet', 'Layout adapts so the 3D viewport and controls fit one screen on phones. Performance tiering delivers stable, representative experience on iOS and Android while desktop shows the fullest visual fidelity. AR handoff optimised for phone via QR and native viewers.'],
];

doc.y += 26;
chapters.forEach(([title, body], i) => {
  const num = String(i + 1).padStart(2, '0');
  doc.save()
    .font(FONTS.display).fontSize(11).fillColor(COLORS.gold)
    .text(num, MARGIN.left, doc.y, { width: 28, lineBreak: false })
    .font(FONTS.display).fontSize(13).fillColor(COLORS.bone)
    .text(title, MARGIN.left + 32, doc.y - 2, { width: COL_W - 32 })
    .restore();
  doc.save()
    .font(FONTS.serif).fontSize(10).fillColor(COLORS.boneDim)
    .text(body, MARGIN.left + 32, doc.y + 4, { width: COL_W - 32, lineGap: 3.5 })
    .restore();
  doc.y += 16;
});


// =============================================================================
// 04 — AUGMENTED REALITY
// =============================================================================
newSectionPage();

smallLabel('04', MARGIN.left, MARGIN.top, { size: 10, color: COLORS.gold, track: 2 });
eyebrow('Augmented Reality', MARGIN.top + 26);
displayTitle('From the page to the wrist, in two phases.', MARGIN.top + 46, { size: 26 });
goldRule(MARGIN.left, doc.y + 14, 60);

doc.y += 28;

// Phase A card
const phaseA_y = doc.y;
doc.save().rect(MARGIN.left, phaseA_y, COL_W, 168)
  .lineWidth(0.5).strokeColor(COLORS.gold).stroke()
  .restore();

doc.save()
  .font(FONTS.sansBold).fontSize(8).fillColor(COLORS.gold)
  .text('PHASE A · INCLUDED IN CORE PACKAGE', MARGIN.left + 22, phaseA_y + 18, {
    characterSpacing: 2.2,
  })
  .font(FONTS.display).fontSize(20).fillColor(COLORS.bone)
  .text('Configurator AR', MARGIN.left + 22, phaseA_y + 36)
  .font(FONTS.serif).fontSize(10.5).fillColor(COLORS.boneDim)
  .text(
    'View in AR from the configurator after the shopper has chosen dragon and metal. On desktop, a QR code opens the exact configuration on the shopper\'s phone. On mobile, the experience launches directly into platform AR — Quick Look on iPhone, Scene Viewer on Android — with sensible real-world scale and placement guidance for a luxury watch. Admin controls govern AR scale, shadows, and whether to use a shared optimised model or per-configuration assets.',
    MARGIN.left + 22, phaseA_y + 70,
    { width: COL_W - 44, lineGap: 3.5 },
  )
  .restore();

doc.y = phaseA_y + 188;

// Phase B card
const phaseB_y = doc.y;
doc.save().rect(MARGIN.left, phaseB_y, COL_W, 130)
  .lineWidth(0.5).strokeColor(COLORS.goldSoft).dash(2, { space: 2 }).stroke()
  .undash()
  .restore();

doc.save()
  .font(FONTS.sansBold).fontSize(8).fillColor(COLORS.goldSoft)
  .text('PHASE B · FOLLOW-ON DELIVERY', MARGIN.left + 22, phaseB_y + 18, {
    characterSpacing: 2.2,
  })
  .font(FONTS.display).fontSize(20).fillColor(COLORS.bone)
  .text('Full Watch Try-On', MARGIN.left + 22, phaseB_y + 36)
  .font(FONTS.serif).fontSize(10.5).fillColor(COLORS.boneDim)
  .text(
    'Wrist-scale try-on AR with further model adaptation and optimisation. Recommended as a second delivery so the immersive site and configurator can launch on schedule, with try-on developed in parallel as stage two.',
    MARGIN.left + 22, phaseB_y + 70,
    { width: COL_W - 44, lineGap: 3.5 },
  )
  .restore();


// =============================================================================
// 05 — ACTIVATED PRINT
// =============================================================================
newSectionPage();

smallLabel('05', MARGIN.left, MARGIN.top, { size: 10, color: COLORS.gold, track: 2 });
eyebrow('Activated Print', MARGIN.top + 26);
displayTitle('Offline to online, one continuous artefact.', MARGIN.top + 46, { size: 26 });
goldRule(MARGIN.left, doc.y + 14, 60);

doc.y += 28;
bodyText(
  'Static luxury print becomes a measurable digital touchpoint. Any cover image, postcard, sticker, or ad unit can trigger the same 3D and configurator experience via QR or smart link. An editorial poster section on the site demonstrates the concept — image, headline, explanation. Ideal for magazine inserts, event materials, boutique leave-behinds, and partner co-marketing.',
  { size: 11, lineGap: 4.5 },
);

doc.y += 22;
// USP highlight
const principleY = doc.y;
const principleH = 64;
doc.save().rect(MARGIN.left, principleY, COL_W, principleH).fill(COLORS.carbon).restore();
goldRule(MARGIN.left, principleY, COL_W, 0.5);
goldRule(MARGIN.left, principleY + principleH, COL_W, 0.5);
doc.save()
  .font(FONTS.sansBold).fontSize(8).fillColor(COLORS.gold)
  .text('THE PRINCIPLE', MARGIN.left + 20, principleY + 12, { characterSpacing: 2.4 })
  .font(FONTS.displayI).fontSize(15).fillColor(COLORS.bone)
  .text(
    'One creative asset. One scan. The full product story and configuration — not a generic landing page.',
    MARGIN.left + 20, principleY + 28,
    { width: COL_W - 40, lineGap: 3 },
  )
  .restore();

doc.y = principleY + principleH + 32;

// Use cases
const printUses = [
  ['Magazine inserts',  'Premium editorial integrated with editorial 3D experience.'],
  ['Event materials',   'Boutique events extend into a take-home digital encounter.'],
  ['Partner co-marketing', 'Each impression measurable, each scan attributable.'],
];

const useColW = (COL_W - 24) / 3;
printUses.forEach(([t, b], i) => {
  const x = MARGIN.left + i * (useColW + 12);
  doc.save()
    .rect(x, doc.y, 14, 1).fill(COLORS.gold)
    .font(FONTS.sansBold).fontSize(9.5).fillColor(COLORS.bone)
    .text(t, x, doc.y + 10, { width: useColW })
    .font(FONTS.serif).fontSize(9.5).fillColor(COLORS.boneDim)
    .text(b, x, doc.y + 6, { width: useColW, lineGap: 3 })
    .restore();
});


// =============================================================================
// 06 — AI CONCIERGE (OPTIONAL)
// =============================================================================
newSectionPage();

smallLabel('06', MARGIN.left, MARGIN.top, { size: 10, color: COLORS.gold, track: 2 });
eyebrow('Optional Extension', MARGIN.top + 26);
displayTitle('An AI concierge that speaks the maison.', MARGIN.top + 46, { size: 26 });
goldRule(MARGIN.left, doc.y + 14, 60);

doc.y += 28;
bodyText(
  'A natural upsell on the same property: a concierge that answers questions on complications, materials, edition size, boutique availability, and configuration choices — and books viewings or captures lead details when intent is high. Text, voice, or both, with optional integrations into CRM, email, calendar, or internal concierge workflows.',
  { size: 11, lineGap: 4.5 },
);

doc.y += 30;
const aiCards = [
  ['Product Expert', 'Complications, materials, edition size, boutique availability.'],
  ['Booking Agent',  'Schedules viewings, captures lead details, hands off to concierge.'],
  ['Voice or Text',  'Suited to high-touch clientele who expect white-glove service online.'],
];
aiCards.forEach(([t, b], i) => {
  const cy = doc.y + i * 78;
  doc.save()
    .rect(MARGIN.left, cy, 3, 56).fill(COLORS.gold).restore();
  doc.save()
    .font(FONTS.display).fontSize(15).fillColor(COLORS.bone)
    .text(t, MARGIN.left + 18, cy + 2, { width: COL_W - 18 })
    .font(FONTS.serif).fontSize(10.5).fillColor(COLORS.boneDim)
    .text(b, MARGIN.left + 18, doc.y + 4, { width: COL_W - 18, lineGap: 3 })
    .restore();
});

doc.y += aiCards.length * 78 + 6;
doc.save()
  .font(FONTS.displayI).fontSize(12).fillColor(COLORS.goldGlow)
  .text(
    'The 3D experience creates intent. The AI assistant captures and converts it — while the brand voice stays consistent.',
    MARGIN.left, doc.y,
    { width: COL_W, align: 'center', lineGap: 3 },
  )
  .restore();


// =============================================================================
// 07 — ADMIN CONSOLE
// =============================================================================
newSectionPage();

smallLabel('07', MARGIN.left, MARGIN.top, { size: 10, color: COLORS.gold, track: 2 });
eyebrow('Admin Console', MARGIN.top + 26);
displayTitle('Self-management without the dev cycle.', MARGIN.top + 46, { size: 26 });
goldRule(MARGIN.left, doc.y + 14, 60);

doc.y += 26;
bodyText(
  'A password-protected workspace so your marketing, digital, and product teams own the experience without opening tickets for every update. Live previews of hero and configurator while editing.',
  { size: 10.5, lineGap: 4 },
);

doc.y += 18;
const adminGroups = [
  { title: 'Features & Toggles', items: [
    'AR button on or off globally',
    'Developer diagnostics visibility',
    'Asset quality strategy per device tier',
  ]},
  { title: 'Content (no code)', items: [
    'SEO, header, hero, story panels',
    'Configurator copy, specifications, CTA',
    'Activated Print section copy and assets',
  ]},
  { title: 'Scene & Presentation', items: [
    'Hero scale, sway, lighting, exposure',
    'Configurator lighting and backgrounds',
    'Per-platform model quality presets',
  ]},
  { title: '3D Model Management', items: [
    'Per-part uploads with drag-and-drop',
    'Hero, AR, dragon, metal, dial slots',
    'External CDN URL fallback per slot',
  ]},
  { title: 'AR Settings', items: [
    'Real-world scale, shadow, preview behaviour',
    'Shared vs per-configuration AR models',
    'Optional external AR link (open in new tab)',
  ]},
  { title: 'Brand & Theme', items: [
    'Core color tokens and typography alignment',
    'Consistent maison-dark luxury out of the box',
    'Reset to approved baseline in one click',
  ]},
];

const aColGap = 16;
const aColW = (COL_W - aColGap) / 2;
let rowY = doc.y;
adminGroups.forEach((g, i) => {
  const x = i % 2 === 0 ? MARGIN.left : MARGIN.left + aColW + aColGap;
  if (i % 2 === 0 && i > 0) rowY += 116;
  // Header
  doc.save()
    .rect(x, rowY, 16, 1).fill(COLORS.gold)
    .font(FONTS.sansBold).fontSize(9).fillColor(COLORS.bone)
    .text(g.title.toUpperCase(), x, rowY + 8, { characterSpacing: 1.4, width: aColW })
    .restore();
  let itemY = rowY + 24;
  g.items.forEach((it) => {
    doc.save()
      .font(FONTS.serif).fontSize(9.5).fillColor(COLORS.boneDim)
      .text(`· ${it}`, x, itemY, { width: aColW, lineGap: 2.5 })
      .restore();
    itemY = doc.y + 4;
  });
});


// =============================================================================
// 08 — WHY ADMIN MATTERS
// =============================================================================
newSectionPage();

smallLabel('08', MARGIN.left, MARGIN.top, { size: 10, color: COLORS.gold, track: 2 });
eyebrow('Why Admin Matters', MARGIN.top + 26);
displayTitle('Control and discretion, without technical complexity.', MARGIN.top + 46, { size: 24 });
goldRule(MARGIN.left, doc.y + 14, 60);

doc.y += 28;
const scenarios = [
  ['New dragon finish or metal launch',  'Upload models and update copy in one session — no developer cycle.'],
  ['Boutique event',                      'Shareable configuration links and Activated Print assets without redeploying the site.'],
  ['Seasonal campaign',                   'Adjust lighting, backgrounds, and hero copy to match creative briefs.'],
  ['Regional rollout',                    'Toggle features such as AR per market when required.'],
];

scenarios.forEach(([sit, action]) => {
  doc.save()
    .rect(MARGIN.left, doc.y + 6, 4, 4).fill(COLORS.gold)
    .font(FONTS.sansBold).fontSize(10.5).fillColor(COLORS.bone)
    .text(sit, MARGIN.left + 16, doc.y, { width: COL_W - 16 })
    .font(FONTS.serif).fontSize(10).fillColor(COLORS.boneDim)
    .text(action, MARGIN.left + 16, doc.y + 4, { width: COL_W - 16, lineGap: 3 })
    .restore();
  doc.y += 16;
});

doc.y += 24;
doc.save()
  .rect(MARGIN.left, doc.y, COL_W, 1).fill(COLORS.gold)
  .font(FONTS.displayI).fontSize(13).fillColor(COLORS.bone)
  .text(
    'Luxury brands need control and discretion. The admin console delivers both without exposing technical complexity to end users.',
    MARGIN.left, doc.y + 18,
    { width: COL_W, lineGap: 4 },
  )
  .restore();


// =============================================================================
// 09 — PACKAGE STRUCTURE
// =============================================================================
newSectionPage();

smallLabel('09', MARGIN.left, MARGIN.top, { size: 10, color: COLORS.gold, track: 2 });
eyebrow('Package Structure', MARGIN.top + 26);
displayTitle('Modules, sequenced for momentum.', MARGIN.top + 46, { size: 26 });
goldRule(MARGIN.left, doc.y + 14, 60);

doc.y += 26;

const modules = [
  ['Core Immersive Site',   'Hero, story scroll, specifications, CTA, responsive layouts.',           'Core'],
  ['3D Configurator',       'Variants, inspect / X-ray, share links, backgrounds.',                    'Core'],
  ['AR (Configurator-Led)', 'QR handoff, mobile AR launch, admin tuning.',                            'Core'],
  ['Admin Console',         'Full self-management as detailed in section 07.',                        'Core'],
  ['Activated Print',       'Collateral strategy plus on-site showcase section.',                     'Core'],
  ['AI Concierge',          'Q&A and booking, voice or text. Optional.',                              'Optional'],
  ['Watch Try-On AR',       'Full wrist try-on after model pipeline. Phase 2.',                       'Phase 2'],
];

const tableTop = doc.y;
// Header row
doc.save()
  .font(FONTS.sansBold).fontSize(8).fillColor(COLORS.gold)
  .text('MODULE',  MARGIN.left,           tableTop, { characterSpacing: 2, width: 150 })
  .text('SUMMARY', MARGIN.left + 170,     tableTop, { characterSpacing: 2, width: 220 })
  .text('PHASE',   MARGIN.left + 410,     tableTop, { characterSpacing: 2, width: 80 })
  .restore();
goldRule(MARGIN.left, tableTop + 16, COL_W, 0.5);

let rY = tableTop + 26;
modules.forEach(([m, s, ph]) => {
  doc.save()
    .font(FONTS.display).fontSize(11.5).fillColor(COLORS.bone)
    .text(m, MARGIN.left, rY, { width: 160 })
    .font(FONTS.serif).fontSize(9.5).fillColor(COLORS.boneDim)
    .text(s, MARGIN.left + 170, rY + 2, { width: 230, lineGap: 2 })
    .font(FONTS.sansBold).fontSize(8).fillColor(ph === 'Core' ? COLORS.gold : COLORS.boneMute)
    .text(ph.toUpperCase(), MARGIN.left + 410, rY + 4, { characterSpacing: 1.8, width: 80 })
    .restore();
  rY = Math.max(doc.y, rY) + 14;
  doc.save().rect(MARGIN.left, rY - 6, COL_W, 0.25).fill(COLORS.boneMute).opacity(0.3).restore();
});

doc.y = rY + 16;
doc.save()
  .font(FONTS.sansBold).fontSize(8).fillColor(COLORS.gold)
  .text('INDICATIVE TIMELINE', MARGIN.left, doc.y, { characterSpacing: 2 })
  .font(FONTS.serif).fontSize(10.5).fillColor(COLORS.boneDim)
  .text(
    'Core package and admin deployable within approximately four weeks. Try-on AR developed in parallel as stage two.',
    MARGIN.left, doc.y + 6,
    { width: COL_W, lineGap: 3 },
  )
  .restore();


// =============================================================================
// 10 — OUTCOMES
// =============================================================================
newSectionPage();

smallLabel('10', MARGIN.left, MARGIN.top, { size: 10, color: COLORS.gold, track: 2 });
eyebrow('Outcomes You Can Expect', MARGIN.top + 26);
displayTitle('What changes when the experience ships.', MARGIN.top + 46, { size: 26 });
goldRule(MARGIN.left, doc.y + 14, 60);

doc.y += 30;

const outcomes = [
  ['Higher engagement',          'Time on page and interaction depth exceed static product-page benchmarks.'],
  ['Stronger consideration',     'Shoppers understand why the watch is exceptional before they configure.'],
  ['Concierge-ready sharing',    'Exact configurations in a link for sales teams and clients.'],
  ['Omnichannel coherence',      'Print, web, and AR tell one continuous story.'],
  ['Operational independence',   'Your team runs content and assets through admin — not change requests.'],
];

outcomes.forEach(([t, b], i) => {
  const oy = doc.y;
  doc.save()
    .font(FONTS.display).fontSize(12).fillColor(COLORS.gold)
    .text(`0${i + 1}`, MARGIN.left, oy, { width: 36, lineBreak: false })
    .font(FONTS.display).fontSize(15).fillColor(COLORS.bone)
    .text(t, MARGIN.left + 40, oy - 2, { width: COL_W - 40 })
    .restore();
  doc.save()
    .font(FONTS.serif).fontSize(10.5).fillColor(COLORS.boneDim)
    .text(b, MARGIN.left + 40, doc.y + 4, { width: COL_W - 40, lineGap: 3 })
    .restore();
  doc.y += 16;
});


// =============================================================================
// 11 — CLOSING
// =============================================================================
newSectionPage();

smallLabel('11', MARGIN.left, MARGIN.top, { size: 10, color: COLORS.gold, track: 2 });
eyebrow('In Summary', MARGIN.top + 26);
displayTitle(
  'Not a product viewer bolted onto a website.',
  MARGIN.top + 46,
  { size: 26 },
);
goldRule(MARGIN.left, doc.y + 14, 60);

doc.y += 28;
doc.save()
  .font(FONTS.serif).fontSize(12).fillColor(COLORS.boneDim)
  .text(
    'A luxury-native, 3D commerce platform: cinematic opening, editorial story, real-time configuration, holographic inspection, shareable builds, AR handoff, optional print activation, and AI concierge — with an admin console designed so the maison stays in control.',
    MARGIN.left, doc.y,
    { width: COL_W, lineGap: 5 },
  )
  .restore();

doc.y += 24;
doc.save()
  .font(FONTS.serif).fontSize(11).fillColor(COLORS.boneDim)
  .text(
    'We recommend packaging the immersive site, configurator, AR entry point, Activated Print, and admin as the first release, with full watch try-on AR as the natural second act once assets are production-optimised for every device.',
    MARGIN.left, doc.y,
    { width: COL_W, lineGap: 4.5 },
  )
  .restore();

doc.y += 44;
goldRule(MARGIN.left, doc.y, 80);

doc.y += 22;
doc.save()
  .font(FONTS.display).fontSize(20).fillColor(COLORS.bone)
  .text('Begin the conversation.', MARGIN.left, doc.y, { width: COL_W })
  .restore();

doc.y += 8;
doc.save()
  .font(FONTS.serif).fontSize(11).fillColor(COLORS.boneDim)
  .text(
    'A live demonstration is the fastest way to convey what this is. Forty-five minutes — desktop, phone, AR, admin — end to end.',
    MARGIN.left, doc.y + 6,
    { width: COL_W, lineGap: 3.5 },
  )
  .restore();

// Bottom signature
const sigY = PAGE.h - 132;
goldRule(MARGIN.left, sigY, COL_W, 0.6);
doc.save()
  .font(FONTS.sansBold).fontSize(8).fillColor(COLORS.gold)
  .text('MEDIALIFE AI', MARGIN.left, sigY + 14, { characterSpacing: 2.6 })
  .font(FONTS.serif).fontSize(9).fillColor(COLORS.boneMute)
  .text('Immersive commerce, 3D product configuration, AR delivery.', MARGIN.left, sigY + 30)
  .text('dapo@rethinkreality.ai · MedialifeAI/product-configurator',  MARGIN.left, sigY + 44)
  .restore();


// =============================================================================
// Stamp page numbers + running footer on every page except the cover.
// Page 0 in bufferedPageRange is the cover; we leave it untouched.
const range = doc.bufferedPageRange();
const totalContentPages = range.count - 1; // cover excluded from N/N counter
for (let i = 1; i < range.count; i++) {
  doc.switchToPage(range.start + i);
  const pageNum = String(i).padStart(2, '0');
  const total   = String(totalContentPages).padStart(2, '0');
  doc.save()
    .font(FONTS.sansBold).fontSize(7).fillColor(COLORS.boneMute)
    .text(`${pageNum} / ${total}`, MARGIN.left, PAGE.h - MARGIN.bottom + 24, {
      characterSpacing: 2, lineBreak: false,
    })
    .text('ASTRONOMIA DRAGON · CAPABILITY OVERVIEW',
      PAGE.w - MARGIN.right - 240, PAGE.h - MARGIN.bottom + 24,
      { width: 240, align: 'right', characterSpacing: 1.6, lineBreak: false })
    .restore();
}

await new Promise((resolve, reject) => {
  doc.on('end', resolve);
  doc.on('error', reject);
  doc.end();
});

fs.copyFileSync(OUT_FILE, PUBLIC_FILE);

console.log(`✓ Wrote ${path.relative(ROOT, OUT_FILE)} (${range.count} pages)`);
console.log(`✓ Copied to ${path.relative(ROOT, PUBLIC_FILE)}`);
