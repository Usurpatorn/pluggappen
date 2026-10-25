/* ========= Visual math: inline SVG figures (theme-aware via CSS variables) ========= */
const VIS = {
  clock(h, mm, size = 180) {
    const r = size / 2, c = r; const hourAng = ((h % 12) + mm / 60) * 30, minAng = mm * 6;
    const pt = (ang, len) => { const a = (ang - 90) * Math.PI / 180; return [c + len * Math.cos(a), c + len * Math.sin(a)]; };
    let ticks = ''; for (let i = 0; i < 60; i++) { const [x1, y1] = pt(i * 6, r - 6), [x2, y2] = pt(i * 6, r - (i % 5 ? 10 : 18)); ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--ink)" stroke-width="${i % 5 ? 1.5 : 3}" stroke-linecap="round"/>`; }
    let nums = ''; for (let i = 1; i <= 12; i++) { const [x, y] = pt(i * 30, r - 32); nums += `<text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" text-anchor="middle" font-size="${size * 0.095}" font-weight="700" fill="var(--ink)" font-family="var(--display)">${i}</text>`; }
    const [hx, hy] = pt(hourAng, r * 0.5), [mx, my] = pt(minAng, r * 0.74);
    return `<svg class="fig" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Klocka som visar ${h}:${String(mm).padStart(2, '0')}"><circle cx="${c}" cy="${c}" r="${r - 2}" fill="var(--card)" stroke="var(--ink)" stroke-width="3"/>${ticks}${nums}<line x1="${c}" y1="${c}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="var(--ink)" stroke-width="7" stroke-linecap="round"/><line x1="${c}" y1="${c}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke="var(--acc)" stroke-width="5" stroke-linecap="round"/><circle cx="${c}" cy="${c}" r="6" fill="var(--acc)"/></svg>`;
  },
  // pizza / circle split into d parts, n shaded
  pie(n, d, size = 160) {
    const r = size / 2 - 4, c = size / 2; let parts = '';
    for (let i = 0; i < d; i++) {
      const a0 = (i / d) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / d) * 2 * Math.PI - Math.PI / 2;
      const x0 = c + r * Math.cos(a0), y0 = c + r * Math.sin(a0), x1 = c + r * Math.cos(a1), y1 = c + r * Math.sin(a1);
      parts += `<path d="M${c},${c} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 ${d === 1 ? 1 : 0},1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${i < n ? 'var(--acc)' : 'var(--card)'}" stroke="var(--ink)" stroke-width="2.5"/>`;
    }
    return `<svg class="fig" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${n} av ${d} delar färgade">${parts}</svg>`;
  },
  // horizontal bar split in d parts, n shaded
  bar(n, d, w = 260, h = 44) {
    let parts = ''; const pw = (w - 4) / d;
    for (let i = 0; i < d; i++) parts += `<rect x="${(2 + i * pw).toFixed(1)}" y="2" width="${pw.toFixed(1)}" height="${h - 4}" fill="${i < n ? 'var(--acc)' : 'var(--card)'}" stroke="var(--ink)" stroke-width="2"/>`;
    return `<svg class="fig" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${n} av ${d} delar färgade">${parts}</svg>`;
  },
  // number line from a to b with step, optional marks {value,label}
  numberLine(a, b, step, marks = [], w = 300) {
    const pad = 16, usable = w - 2 * pad; const x = (v) => pad + ((v - a) / (b - a)) * usable;
    let ticks = ''; for (let v = a; v <= b; v += step) { const big = ((v - a) / step) % 5 === 0; ticks += `<line x1="${x(v).toFixed(1)}" y1="${big ? 22 : 28}" x2="${x(v).toFixed(1)}" y2="40" stroke="var(--ink)" stroke-width="${big ? 2.5 : 1.5}"/>${big ? `<text x="${x(v).toFixed(1)}" y="58" text-anchor="middle" font-size="12" fill="var(--muted)" font-family="var(--body)">${v}</text>` : ''}`; }
    const ms = marks.map(m => `<circle cx="${x(m.value).toFixed(1)}" cy="34" r="7" fill="${m.color || 'var(--acc)'}"/><text x="${x(m.value).toFixed(1)}" y="14" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)" font-family="var(--display)">${m.label ?? ''}</text>`).join('');
    return `<svg class="fig" viewBox="0 0 ${w} 64" width="${w}" height="64" role="img" aria-label="Tallinje från ${a} till ${b}"><line x1="${pad}" y1="34" x2="${w - pad}" y2="34" stroke="var(--ink)" stroke-width="2.5"/><polygon points="${w - pad},34 ${w - pad - 8},29 ${w - pad - 8},39" fill="var(--ink)"/>${ticks}${ms}</svg>`;
  },
  // rectangle with grid cells (a × b), labels on sides; grid optional
  rect(a, b, opts = {}) {
    const cell = Math.min(26, Math.floor(220 / Math.max(a, b))); const W = a * cell, H = b * cell; const pad = 26;
    let cells = ''; if (opts.grid) for (let i = 0; i < a; i++) for (let j = 0; j < b; j++) cells += `<rect x="${pad + i * cell}" y="${pad + j * cell}" width="${cell}" height="${cell}" fill="var(--acc-soft)" stroke="var(--line)" stroke-width="1"/>`;
    const la = opts.labelA ?? `${a} cm`, lb = opts.labelB ?? `${b} cm`;
    return `<svg class="fig" viewBox="0 0 ${W + 2 * pad + 50} ${H + 2 * pad}" width="${W + 2 * pad + 50}" height="${H + 2 * pad}" role="img" aria-label="Rektangel ${la} gånger ${lb}">${cells}<rect x="${pad}" y="${pad}" width="${W}" height="${H}" fill="${opts.grid ? 'none' : 'var(--acc-soft)'}" stroke="var(--ink)" stroke-width="2.5"/><text x="${pad + W / 2}" y="${pad - 8}" text-anchor="middle" font-size="14" font-weight="700" fill="var(--ink)" font-family="var(--display)">${la}</text><text x="${pad + W + 8}" y="${pad + H / 2 + 5}" font-size="14" font-weight="700" fill="var(--ink)" font-family="var(--display)">${lb}</text></svg>`;
  },
  // coins row
  coins(counts) {
    const order = [['10', 44, '#d9b84a'], ['5', 38, '#d9b84a'], ['1', 32, '#c9ccd3']]; let x = 4, out = '';
    for (const [v, d, col] of order) for (let i = 0; i < (counts[v] || 0); i++) { out += `<circle cx="${x + d / 2}" cy="30" r="${d / 2}" fill="${col}" stroke="var(--ink)" stroke-width="2"/><text x="${x + d / 2}" y="35" text-anchor="middle" font-size="${d * 0.4}" font-weight="800" fill="#1d2433" font-family="var(--display)">${v}</text>`; x += d + 8; }
    return `<svg class="fig" viewBox="0 0 ${Math.max(60, x)} 60" width="${Math.max(60, x)}" height="60" role="img" aria-label="Mynt">${out}</svg>`;
  },
  // simple shapes
  shape(name, size = 120) {
    const c = size / 2, r = size / 2 - 8; const poly = (n, rot = -90) => Array.from({ length: n }, (_, i) => { const a = (rot + i * 360 / n) * Math.PI / 180; return `${(c + r * Math.cos(a)).toFixed(1)},${(c + r * Math.sin(a)).toFixed(1)}`; }).join(' ');
    const body = name === 'cirkel' ? `<circle cx="${c}" cy="${c}" r="${r}"/>` : name === 'kvadrat' ? `<rect x="10" y="10" width="${size - 20}" height="${size - 20}"/>` : name === 'rektangel' ? `<rect x="6" y="${size * 0.25}" width="${size - 12}" height="${size * 0.5}"/>` : name === 'triangel' ? `<polygon points="${poly(3)}"/>` : name === 'femhörning' ? `<polygon points="${poly(5)}"/>` : `<polygon points="${poly(6)}"/>`;
    return `<svg class="fig" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${name}"><g fill="var(--acc-soft)" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round">${body}</g></svg>`;
  },
};
if (typeof module !== 'undefined') module.exports = { VIS };
