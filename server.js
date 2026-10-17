// Orgo Jeopardy server: no dependencies. Run: node server.js
const http = require("http"), fs = require("fs"), path = require("path");
const PIN = process.env.HOST_PIN || "orgo", PORT = process.env.PORT || 3000;

// ---------- diagram drawers (SVG strings) ----------
// M: skeletal chain. s={atom:label} ("=O" draws a C=O), d=[double-bond starts], hx={atom:"O"} heteroatoms, ci=circles [atom,dx,rx,dy,ry]
function M(n, s = {}, d = [], hx = {}, ci = []) {
  const W = 40 + (n - 1) * 34, X = i => 20 + i * 34, Y = i => (i % 2 ? 36 : 56);
  let o = `<svg viewBox="0 -10 ${W} 106" width="${W * 1.7}" style="max-width:92%;color:inherit" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="`;
  for (let i = 0; i < n; i++) o += X(i) + "," + Y(i) + " ";
  o += '"/>';
  d.forEach(j => (o += `<line x1="${X(j)}" y1="${Y(j) + 5}" x2="${X(j + 1)}" y2="${Y(j + 1) + 5}"/>`));
  for (const k in s) {
    const i = +k, u = i % 2, y = Y(i), e = u ? y - 20 : y + 20;
    let t = s[k];
    if (t[0] === "=") { o += `<line x1="${X(i) - 2.5}" y1="${y}" x2="${X(i) - 2.5}" y2="${e}"/><line x1="${X(i) + 2.5}" y1="${y}" x2="${X(i) + 2.5}" y2="${e}"/>`; t = t.slice(1); }
    else o += `<line x1="${X(i)}" y1="${y}" x2="${X(i)}" y2="${e}"/>`;
    if (t) o += `<text x="${X(i)}" y="${u ? e - 4 : e + 14}" fill="currentColor" stroke="none" text-anchor="middle" font-size="13">${t}</text>`;
  }
  for (const k in hx) o += `<rect class="hx" x="${X(+k) - 9}" y="${Y(+k) - 9}" width="18" height="18"/><text x="${X(+k)}" y="${Y(+k) + 5}" fill="currentColor" stroke="none" text-anchor="middle" font-size="14">${hx[k]}</text>`;
  ci.forEach(([i, dx, rx, dy, ry]) => (o += `<ellipse cx="${X(i) + dx}" cy="${Y(i) + dy}" rx="${rx}" ry="${ry}" stroke="#ffcc33" stroke-width="2.5"/>`));
  return o + "</svg>";
}
// NW: Newman projection. f/b = front/back labels, e = eclipsed
function NW(f, b, e) {
  const A = [90, 210, 330], B = e ? A.map(a => a + 22) : [30, 150, 270];
  const P = (a, r) => [(r * Math.cos((a * Math.PI) / 180)).toFixed(1), (-r * Math.sin((a * Math.PI) / 180)).toFixed(1)];
  const T = (p, t) => `<text x="${p[0]}" y="${p[1]}" fill="currentColor" stroke="none" text-anchor="middle" dominant-baseline="central" font-size="13">${t}</text>`;
  let o = '<svg viewBox="-80 -80 160 160" width="200" style="color:inherit" fill="none" stroke="currentColor" stroke-width="2.5"><circle r="28"/>';
  A.forEach((a, i) => { const p = P(a, 48); o += `<line x2="${p[0]}" y2="${p[1]}"/>` + T(P(a, 62), f[i]); });
  B.forEach((a, i) => { const p = P(a, 28), q = P(a, 46); o += `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>` + T(P(a, 60), b[i]); });
  return o + "</svg>";
}
// CH: cyclohexane chair. s=[[atom 0-5,'a'|'e',label]]
function CH(s = []) {
  const R = 52, k = 0.45, h = 12, pts = [];
  for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; pts.push([R * Math.cos(a), R * Math.sin(a) * k + (i % 2 ? h : -h), a]); }
  let o = '<svg viewBox="-120 -80 240 160" width="290" style="color:inherit" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><polygon points="' + pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ") + '"/>';
  s.forEach(([i, t, lab]) => {
    const [x, y, a] = pts[i], up = i % 2 === 0;
    let ex, ey, lx, ly;
    if (t === "a") { ex = x; ey = y + (up ? -30 : 30); lx = x; ly = ey + (up ? -8 : 16); }
    else { ex = x + 26 * Math.cos(a); ey = y + 26 * Math.sin(a) * k + (up ? 7 : -7); lx = ex + 12 * Math.cos(a); ly = ey + 4; }
    o += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="currentColor" stroke="none" text-anchor="middle" font-size="13">${lab}</text>`;
  });
  return o + "</svg>";
}

// ---------- question bank: [clue, answer]; "!" prefix = answer shown as-is ----------
const B = [
  [
    { c: "NAME THAT SKELETON", q: [
      ["Name this alkane.<br>" + M(5), "pentane"],
      ["Name this compound.<br>" + M(5, { 1: "Cl" }), "2-chloropentane"],
      ["Name this compound.<br>" + M(6, { 2: "", 3: "" }), "3,4-dimethylhexane"],
      ["Name this compound. The –OH wins the suffix.<br>" + M(6, { 1: "Br", 3: "OH" }), "5-bromohexan-3-ol"],
      ["Name this compound.<br>" + M(6, { 2: "=O", 4: "" }), "5-methylhexan-3-one"] ] },
    { c: "CIRCLED GROUPS", q: [
      ["Name the circled functional group.<br>" + M(4, { 1: "OH" }, [], {}, [[1, 0, 16, -13, 26]]), "an alcohol"],
      ["Name the circled functional group.<br>" + M(4, { 1: "=O" }, [], {}, [[1, 0, 16, -13, 26]]), "a ketone"],
      ["Name the circled functional group.<br>" + M(5, { 1: "=O" }, [], { 2: "O" }, [[1, 17, 38, -6, 28]]), "an ester"],
      ["Name the circled functional group.<br>" + M(4, { 3: "=O" }, [], {}, [[3, 0, 16, -13, 26]]), "an aldehyde"],
      ["Name the circled functional group.<br>" + M(5, {}, [], { 2: "O" }, [[2, 0, 17, 0, 17]]), "an ether"] ] },
    { c: "PRIORITY LANE", q: [
      ["Aldehyde or alcohol: the higher-priority group", "an aldehyde"],
      ["Of ester, amide and nitrile, this one ranks highest", "an ester"],
      ["The prefix used for –OH when a higher-priority group is present", "hydroxy"],
      ["A molecule with both a ketone and an amine gets this suffix", "-one"],
      ["Name this compound.<br>" + M(5, { 1: "OH", 3: "=O" }), "4-hydroxypentan-2-one"] ] },
    { c: "NEWMAN NATION", q: [
      ["Staggered or eclipsed?<br>" + NW(["H", "H", "H"], ["H", "H", "H"], 0), "staggered"],
      ["Staggered or eclipsed?<br>" + NW(["H", "H", "H"], ["H", "H", "H"], 1), "eclipsed"],
      ["Front CH₃ at top, back CH₃ at upper left. Name this conformation and its dihedral angle.<br>" + NW(["CH₃", "H", "H"], ["H", "CH₃", "H"], 0), "gauche, 60°"],
      ["Name this conformation and its dihedral angle.<br>" + NW(["CH₃", "H", "H"], ["H", "H", "CH₃"], 0), "anti, 180°"],
      ["Name this highest-energy butane conformation.<br>" + NW(["CH₃", "H", "H"], ["CH₃", "H", "H"], 1), "syn (fully eclipsed)"] ] },
    { c: "CHAIR CHAMP", q: [
      ["Is this methyl axial or equatorial?<br>" + CH([[0, "e", "CH₃"]]), "equatorial"],
      ["Is this methyl axial or equatorial?<br>" + CH([[0, "a", "CH₃"]]), "axial"],
      ["After a ring flip, this axial methyl becomes this.<br>" + CH([[2, "a", "CH₃"]]), "equatorial"],
      ["This chair is high in energy mainly because of this kind of strain.<br>" + CH([[0, "a", "t-Bu"]]), "1,3-diaxial strain"],
      ["How many 1,3-diaxial interactions involve the CH₃ groups?<br>" + CH([[0, "e", "CH₃"], [3, "e", "CH₃"]]), "none (0)"] ] }
  ],
  [
    { c: "CHAIRS II", q: [
      ["After a ring flip, this axial bromine becomes this.<br>" + CH([[1, "a", "Br"]]), "equatorial"],
      ["Name the strain that makes this chair high in energy.<br>" + CH([[0, "a", "CH₃"], [2, "a", "CH₃"]]), "1,3-diaxial strain (CH₃/CH₃ clash)"],
      ["Name this compound.<br>" + CH([[0, "e", "CH(CH₃)₂"], [3, "e", "CH₃"]]), "1-isopropyl-4-methylcyclohexane"],
      ["This chair beats its ring-flip. Why?<br>" + CH([[0, "e", "t-Bu"], [3, "a", "Br"]]), "t-Bu is far bigger, so it must stay equatorial"],
      ["All three groups of natural (–)-menthol sit in this position in its lowest-energy chair", "equatorial"] ] },
    { c: "CIRCLED GROUPS II", q: [
      ["Name the circled group.<br>" + M(5, {}, [], { 2: "O" }, [[2, 0, 17, 0, 17]]), "an ether"],
      ["Name the circled group.<br>" + M(4, { 1: "SH" }, [], {}, [[1, 0, 18, -13, 26]]), "a thiol"],
      ["Name the circled group.<br>" + M(4, { 3: "C≡N" }, [], {}, [[3, 0, 26, -13, 26]]), "a nitrile"],
      ["Name the circled group.<br>" + M(5, { 1: "=O" }, [], { 2: "NH" }, [[1, 17, 38, -6, 28]]), "an amide"],
      ["The circled group is this class of amine.<br>" + M(4, { 1: "N(CH₃)₂" }, [], {}, [[1, 0, 38, -13, 26]]), "a tertiary (3°) amine"] ] },
    { c: "NAMING NINJA", q: [
      ["Name this alkane.<br>" + M(6), "hexane"],
      ["Name this compound.<br>" + M(6, { 1: "", 2: "CH₂CH₃" }), "3-ethyl-2-methylhexane"],
      ["Name this compound.<br>" + M(5, { 1: "Cl", 2: "Cl" }), "2,3-dichloropentane"],
      ["Name this compound. Give the –OH the lowest number.<br>" + M(6, { 3: "OH" }, [0]), "hex-5-en-3-ol"],
      ["Name this compound.<br>" + M(7, { 2: "=O", 4: "Br" }), "5-bromoheptan-3-one"] ] },
    { c: "CONFORMATION THEORY", q: [
      ["A Newman projection looks directly down this", "a C–C bond (the bond axis)"],
      ["Eclipsed ethane sits about this many kJ/mol above staggered", "about 12 kJ/mol"],
      ["Torsional strain is repulsion between electrons in these bonds", "C–H bonds (bonding electrons)"],
      ["Bulkier substituents do this to the energy barrier to rotation", "raise (increase) it"],
      ["Order butane’s conformations from most to least stable: syn, gauche, anti, partially eclipsed", "anti, gauche, partially eclipsed, syn"] ] },
    { c: "ISOMERS & RINGS", q: [
      ["The number of constitutional isomers of C₅H₁₂", "3"],
      ["n-Butane boils at 0 °C and isobutane at –12 °C. Which has the stronger attractions?", "n-butane (it boils higher)"],
      ["Cyclopropane’s large heat of combustion per CH₂ reflects this kind of strain", "angle (ring) strain"],
      ["The ideal bond angle at an sp³ carbon", "109.5°"],
      ["The only cycloalkane that is flat", "cyclopropane"] ] }
  ]
];
const F = {
  c: "CHAIR CONFORMATIONS",
  q: "DRAW a chair cyclohexane with an equatorial methyl on one carbon and an equatorial isopropyl on the carbon directly across the ring (1,4), then label each group’s position.",
  a: "A chair with CH₃ and CH(CH₃)₂ both drawn equatorial on carbons 1 and 4 (slightly angled opposite to the axial bonds). Compound: 1-isopropyl-4-methylcyclohexane."
};
const V = [[100, 200, 300, 400, 500], [200, 400, 600, 800, 1000]];
const ans = a => (a[0] === "!" ? a.slice(1) : "What is " + a + "?");

// ---------- game state ----------
let S, IMG = {};
const rnd = n => Math.floor(Math.random() * n);
function setRound(r) {
  S.round = r; S.used = [...Array(5)].map(() => Array(5).fill(0)); S.dd = [];
  while (S.dd.length < (r ? 2 : 1)) { const k = [rnd(5), 1 + rnd(4)]; if (!S.dd.some(x => x[0] === k[0] && x[1] === k[1])) S.dd.push(k); }
}
function fresh() {
  S = { round: 0, sc: [0, 0, 0], cur: null, buzz: [], lock: [], last: -1, rv: false, timerEnd: 0, timerLen: 0, nv: [0, 0, 0], ev: { id: 0, t: "" }, fin: null };
  IMG = {}; setRound(0);
}
fresh();
const ev = t => (S.ev = { id: S.ev.id + 1, t });
const clamp = (n, lo, hi) => Math.max(lo, Math.min(Math.floor(+n) || 0, hi));

function view(host) {
  const v = { host, now: Date.now(), round: S.round, sc: S.sc, used: S.used, last: S.last, nv: S.nv, buzz: S.buzz, lock: S.lock,
    timerEnd: S.timerEnd, timerLen: S.timerLen, ev: S.ev, cats: S.round < 2 ? B[S.round].map(c => c.c) : [], vals: V[S.round] || [], rv: S.rv, cur: null, fin: null };
  const c = S.cur;
  if (c) {
    const q = B[S.round][c.c].q[c.r];
    v.cur = { c: c.c, r: c.r, v: c.v, dd: c.dd, ph: c.ph, team: c.team, cat: B[S.round][c.c].c, clue: c.ph === "wager" ? "" : q[0], ans: host || S.rv ? ans(q[1]) : null };
  }
  const f = S.fin;
  if (f) {
    const open = f.ph === "rev" || f.ph === "end";
    v.fin = { ph: f.ph, cat: F.c, clue: f.ph === "intro" ? "" : F.q, ans: host || open ? F.a : null,
      w: f.w.map(x => (host || open ? x : x == null ? null : "set")), d: f.d, dv: f.dv, m: f.m };
  }
  return v;
}

function act(b) {
  const h = b.pin === PIN, A = b.a, t = +b.t, c = S.cur, f = S.fin;
  if (A === "auth") return h;
  if (A === "join" && t >= 0 && t < 3 && typeof b.img === "string" && b.img.length < 200000) { IMG["n" + t] = b.img; S.nv[t]++; return true; }
  if (A === "buzz" && c && c.ph === "clue" && t >= 0 && t < 3) {
    if (S.lock.includes(t) || S.buzz.includes(t) || (c.team != null && c.team !== t)) return false;
    S.buzz.push(t); ev("buzz"); return true;
  }
  if (A === "fw" && f && f.ph === "intro" && t >= 0 && t < 3) { f.w[t] = clamp(b.n, 0, Math.max(S.sc[t], 0)); return true; }
  if (A === "fd" && f && f.ph === "clue" && t >= 0 && t < 3 && typeof b.img === "string" && b.img.length < 300000) { IMG["d" + t] = b.img; f.d[t] = 1; f.dv[t]++; return true; }
  if (!h) return false;
  switch (A) {
    case "pick": {
      const ci = +b.c, r = +b.r;
      if (c || S.round > 1 || !B[S.round][ci] || S.used[ci][r]) return false;
      const dd = S.dd.some(x => x[0] === ci && x[1] === r);
      S.cur = { c: ci, r, v: V[S.round][r], dd, ph: dd ? "wager" : "clue", team: null };
      S.buzz = []; S.lock = []; S.rv = false; S.timerEnd = 0; ev(dd ? "dd" : "open"); return true;
    }
    case "dd": if (c && c.ph === "wager" && t >= 0 && t < 3) { c.team = t; c.v = clamp(b.n, 0, Math.max(S.sc[t], S.round ? 1000 : 500)); c.ph = "clue"; return true; } return false;
    case "reveal": S.rv = true; return true;
    case "timer": S.timerLen = clamp(b.s, 1, 120); S.timerEnd = Date.now() + S.timerLen * 1000; ev("timer"); return true;
    case "rb": S.buzz = []; return true;
    case "mark":
      if (!c || c.ph !== "clue" || !(t >= 0 && t < 3)) return false;
      S.sc[t] += b.ok ? c.v : -c.v;
      if (b.ok) { S.last = t; S.rv = true; c.ph = "done"; S.timerEnd = 0; ev("ok"); }
      else { S.lock.push(t); S.buzz = S.buzz.filter(x => x !== t); ev("no"); if (c.dd) { S.rv = true; c.ph = "done"; } }
      return true;
    case "close": if (c) { S.used[c.c][c.r] = 1; S.cur = null; S.rv = false; S.timerEnd = 0; S.buzz = []; S.lock = []; } return true;
    case "next":
      if (c) return false;
      if (S.round === 0) setRound(1);
      else { S.round = 2; S.fin = { ph: "intro", w: [null, null, null], d: [0, 0, 0], dv: [0, 0, 0], m: [null, null, null] }; ev("final"); }
      return true;
    case "fclue": if (f && f.ph === "intro") { f.ph = "clue"; S.timerLen = 75; S.timerEnd = Date.now() + 75000; ev("timer"); return true; } return false;
    case "frev": if (f) { f.ph = "rev"; S.timerEnd = 0; return true; } return false;
    case "fm": if (f && f.ph === "rev" && f.m[t] == null && t >= 0 && t < 3) { const w = f.w[t] || 0; S.sc[t] += b.ok ? w : -w; f.m[t] = b.ok ? 1 : 0; ev(b.ok ? "ok" : "no"); return true; } return false;
    case "fend": if (f) { f.ph = "end"; ev("win"); return true; } return false;
    case "adj": if (t >= 0 && t < 3) { S.sc[t] += clamp(b.n, -5000, 5000); return true; } return false;
    case "reset": fresh(); return true;
  }
  return false;
}

// ---------- http ----------
const clients = new Set();
const send = (res, host) => res.write("data: " + JSON.stringify(view(host)) + "\n\n");
const broadcast = () => clients.forEach(cl => send(cl.res, cl.host));
setInterval(() => clients.forEach(cl => cl.res.write(": hb\n\n")), 20000);
const PUB = path.join(__dirname, "public");

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    const cl = { res, host: u.searchParams.get("pin") === PIN };
    clients.add(cl); send(res, cl.host); req.on("close", () => clients.delete(cl)); return;
  }
  if (u.pathname === "/act" && req.method === "POST") {
    let body = ""; req.on("data", d => { body += d; if (body.length > 400000) req.destroy(); });
    req.on("end", () => {
      let ok = false;
      try { ok = !!act(JSON.parse(body)); } catch (e) {}
      res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok }));
      broadcast();
    });
    return;
  }
  const m = u.pathname.match(/^\/img\/([nd][0-2])$/);
  if (m) {
    const k = m[1], host = u.searchParams.get("pin") === PIN, open = S.fin && (S.fin.ph === "rev" || S.fin.ph === "end");
    const data = IMG[k];
    if (!data || (k[0] === "d" && !host && !open)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
    return res.end(Buffer.from(data.split(",")[1] || "", "base64"));
  }
  if (["/", "/host", "/play"].includes(u.pathname.replace(/\/$/, "") || "/")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(fs.readFileSync(path.join(PUB, "app.html")));
  }
  res.writeHead(404); res.end("Not found");
}).listen(PORT, "0.0.0.0", () => console.log("Orgo Jeopardy on port " + PORT + " (host PIN: " + PIN + ")"));
