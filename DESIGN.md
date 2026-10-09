---
name: MoveMarket
description: Live chess prediction pools on Monad, presented as a chess broadcast you can call.
colors:
  studio-teal: "#0d3a35"
  control-room: "#082a26"
  panel-teal: "#12463f"
  panel-deep: "#0a302b"
  rule-teal: "#2b5c55"
  text-on-teal: "#ffffff"
  muted-on-teal: "#a9c7c2"
  soft-on-teal: "#d3e5e2"
  broadcast-gold: "#f2c14e"
  coral-no: "#ff8a6b"
  live-red: "#c8301f"
  locked-amber: "#ffd27a"
  lower-third-white: "#ffffff"
  lower-third-wash: "#eef4f3"
  chip-wash: "#d6e4e2"
  ink-on-light: "#082a26"
  muted-on-light: "#3d5c58"
  board-light: "#eeeed2"
  board-dark: "#5f9f8f"
  board-last-light: "#f5f08a"
  board-last-dark: "#b8c95c"
typography:
  broadcast-display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 6vw, 6rem)"
    fontWeight: 900
    lineHeight: 0.9
    fontVariation: "'wdth' 68"
  broadcast-title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: 1.05
    fontVariation: "'wdth' 75"
  question:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.15
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.45
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  numeral:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontWeight: 800
    fontFeature: "'tnum' 1"
rounded:
  tag: "2px"
  control: "4px"
  panel: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "18px"
  xl: "28px"
  section: "48px"
components:
  button-stake:
    backgroundColor: "{colors.control-room}"
    textColor: "{colors.lower-third-white}"
    rounded: "{rounded.control}"
    height: "52px"
    padding: "0 22px"
  button-yes-selected:
    backgroundColor: "{colors.broadcast-gold}"
    textColor: "{colors.ink-on-light}"
    rounded: "{rounded.control}"
    height: "52px"
  button-no-selected:
    backgroundColor: "{colors.coral-no}"
    textColor: "{colors.ink-on-light}"
    rounded: "{rounded.control}"
    height: "52px"
  button-side-idle:
    backgroundColor: "{colors.lower-third-white}"
    textColor: "{colors.ink-on-light}"
    rounded: "{rounded.control}"
    height: "52px"
  chip-amount:
    backgroundColor: "{colors.chip-wash}"
    textColor: "{colors.ink-on-light}"
    rounded: "{rounded.control}"
    height: "44px"
  chip-amount-selected:
    backgroundColor: "{colors.control-room}"
    textColor: "{colors.lower-third-white}"
    rounded: "{rounded.control}"
    height: "44px"
  tag-live:
    backgroundColor: "{colors.live-red}"
    textColor: "{colors.text-on-teal}"
    rounded: "{rounded.tag}"
    padding: "2px 8px"
  panel:
    backgroundColor: "{colors.panel-teal}"
    textColor: "{colors.text-on-teal}"
    rounded: "{rounded.panel}"
---

# Design System: MoveMarket

## Overview

**Creative North Star: "The Broadcast Booth"**

MoveMarket looks like the graphics package of a chess broadcast. The board sits in a studio-teal frame, players have cards like camera feeds, and every open market arrives as a lower third across the bottom of the frame. The viewer should feel they are watching a game first and that calling the next plies is part of the show.

Density is medium: one board, one open market in focus, a short list of other markets and their states. Colour does real jobs. Gold means Yes and the call to act, coral means No, red is reserved for the LIVE tag, amber marks a locked market. Everything else is teal and white.

Rejected on purpose (from PRODUCT.md and the user): crypto-dashboard templates with rounded card soup, gradients, glow and pills everywhere; screens that feel cluttered; screens that feel stiff or cold.

**Key Characteristics:**
- Board first, framed like a broadcast feed.
- Open market = lower third with the question, Yes/No, amount chips and one stake button.
- Pool split drawn as a vertical bar next to the board, read like an eval bar.
- One type family (Archivo); width does the role contrast.

## Colors

Studio teal grounds, white lower thirds, gold and coral for the two sides.

- **studio-teal / control-room / panel-teal**: page ground, header, cards and list rows.
- **broadcast-gold**: Yes side, primary actions on teal, the "Predict now" tab, claimable totals.
- **coral-no**: No side and No share of pool bars. Always paired with a text label, never colour alone.
- **live-red**: the LIVE tag only.
- **locked-amber**: Locked state text.
- **board-light / board-dark**: board squares; **board-last-*** marks the last move.

## Typography

Archivo with the width axis, loaded from Google Fonts (`Archivo:wdth,wght@62..125,400..900`).

- **broadcast-display** and **broadcast-title**: uppercase, 68 to 75% width, for page titles, table names, "Predict now", "Live now". Never for sentences.
- **question**: market questions at full width, weight 800.
- **body**: 16px minimum, weight 500 on teal (light text on dark gets one extra weight step).
- **numeral**: tabular figures for percentages, pools, countdowns and balances.
- No monospace. Transaction hashes stay in Archivo.

## Layout

- Desktop game: header, title row, then three columns (player cards 220 to 260px, board up to 640px with the pool bar, markets list from 300px), then the full-width lower third.
- Mobile game: header, title row, player bars attached above and below the board, market switcher, lower third pinned to the bottom.
- Page containers max 1380px, 28px side padding on desktop, 12 to 20px on mobile.
- Wide tables (Positions) scroll inside their own box below 980px.

## Elevation & Depth

Flat. Depth comes from tonal layering (control-room above studio-teal above panel-deep) and from the white lower third sitting on teal. No glow. Shadows only on things that float above the page: dialogs, the stake sheet, the account popover and toasts. A selected player card uses a 2px inset gold ring.

## Shapes

Small radii only: 2px tags, 4px controls, 6px panels. Pool bars use 2 to 3px radius. Circles appear only in the settlement timeline dots and onboarding step markers.

## Components

- **Lower third (Predict now)**: gold tab with countdown, white body with the question and pool, wash area with Yes, No, amount chips and the stake button.
- **Pool bar**: vertical, 14 to 22px wide, coral on top (No share), gold below (Yes share), numbers inside.
- **Market row**: panel-teal button; selected row turns white with dark text; thin gold/coral split bar.
- **State list**: Locked (amber), Provisional: Yes/No (white), Final: Yes/No with CRE transaction link, Voided, Expired and No stakes (grey on panel-deep, never coral, so they do not read as No).
- **Positions table**: side shown as a gold or coral tag with the word Yes or No; actions Claim (gold), Refund (outlined), Watch (link).
- **Onboarding steps**: ordered list on panel-teal, done step with a check icon, current step with a gold progress bar.

## Prototype components (hi-fi, Oktober 2026)

Sumber: artboard `Components.dc.html` dan `Prototype.dc.html` di canvas desain.

- **Button variants**: Primary gold (Start, Stake, Claim), Dark (aksi di atas putih atau gold), Ghost on dark (Refund, aksi kedua), Ghost on light (Cancel di dialog), Yes (gold), No (coral), Amount chip, Text link.
- **Button states**: hover lebih terang satu langkah, focus ring gold 3px dengan offset 2px, pressed turun 1px dan lebih gelap, disabled opacity 45% dengan cursor not-allowed, loading menampilkan spinner dan label tetap ada. Tinggi minimum 44px, default 48px, besar 56px.
- **Status chip**: Open (gold, berubah coral saat sisa 5 detik atau kurang), Locked (amber), Waiting for ply N (soft), Provisional (putih), Final (control-room), Voided / Voided: no winning stakes / Expired (abu #3b4a48), No stakes (panel-deep, teks muted).
- **Market card**: chip status, pool, pertanyaan lengkap dari `describeMarket`, pool bar horizontal gold/coral, tombol Yes dan No dengan persen pool dan odds tersirat. Tombol mati 1 detik sebelum lock.
- **Stake sheet**: dialog di desktop, bottom sheet di mobile. Isi: hitung mundur, toggle Yes/No, input nominal dengan chip 1, 5, 10, Max, sisa cap 100, estimasi payout dan profit, catatan fee 2%, gas. Error inline di bawah input (AmountTooSmall, StakeCapExceeded, INSUFFICIENT_USDC dengan tombol Get test tokens) dan panel error untuk BettingClosed.
- **Passkey sheet**: tiruan dialog sistem (warna sistem, bukan token MoveMarket) dengan label "Shown by your device, not by MoveMarket".
- **Banner**: Resolver offline (amber, papan dijeda), Reconnecting (panel dengan spinner), Session ended (putih dengan tombol Unlock).
- **Toast**: sukses (putih, ikon gold), error (#3b1416, teks #ffd2cf, bisa punya tombol Try again), pending (panel, spinner), info (panel).
- **Error colors**: error surface #3b1416 di atas teal, error text #b0261f di atas putih. Live red tetap hanya untuk tag LIVE.
- **Prototype controls**: panel abu bergaris putus-putus di kiri bawah. Bukan bagian produk.

## Do's and Don'ts

- Do keep every Yes/No signal labelled in text as well as colour.
- Do show where a result came from: resolver for provisional, Chainlink CRE with tx for final.
- Do keep touch targets at 44px or more.
- Don't use red for No; red belongs to LIVE.
- Don't add gradients, glow, glass or decorative shadows.
- Don't introduce a second font family.
- Don't put eyebrow labels above headings.
