import React, { useState, useEffect, useCallback } from "react";
import { upsertSubmission, loadSubmission, listSubmissions, uploadBanner } from "./db.js";
import { TUTOR_PASSPHRASE } from "./config.js";

// MARK3085 Week 7 - Integrating Display, SEO & Paid Search across the RACE journey
//
// Two roles:
//   Student - enters brand name + class number. Sees only their own group's work.
//             No class switch, no gallery. Submits to tutor.
//   Tutor   - enters a passphrase. Sees every submission per class, and can
//             paste a group's exported text as a fallback if live sync lags.
//
// Students log in with their brand name (no spaces) + class number, e.g.
//   PalaceCinemas9413, FrankBody9414. The class number is baked into what
//   you hand out, so a student can never land in the other cohort's pile.

const BRANDS = {
  A: "Envato",
  B: "Frank Body",
  C: "Palace Cinemas",
  D: "Amber Electric",
  E: "The Somewhere Co.",
};

// Normalised brand name (lowercase, no spaces/punctuation) -> brand letter.
// Accepts a few natural variants so a typo like "thesomewhereco" still works.
const BRAND_BY_NORM = {
  envato: "A",
  frankbody: "B",
  palacecinemas: "C",
  palacecinema: "C",
  amberelectric: "D",
  amber: "D",
  thesomewhereco: "E",
  somewhereco: "E",
  thesomewhere: "E",
  somewhere: "E",
};
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// ---- UNSW palette ----
const UNSW = {
  yellow: "#FFD100",
  yellowDark: "#E5BC00",
  ink: "#231F20",
  paper: "#FFFFFF",
};
// RACE stage accents (kept distinct so the journey stays readable)
const STAGE = {
  reach: "#0072CE",
  act: "#00843D",
  convert: "#D2492A",
  integrate: "#5B2A86",
};

// ---- Warm-up 1: Paid / Owned / Earned (lecture-1 channel model) ----
const POE_ITEMS = [
  { id: "ppc", label: "Pay-per-click (PPC)", answer: "Paid" },
  { id: "paidsocial", label: "Paid social", answer: "Paid" },
  { id: "display", label: "Programmatic display", answer: "Paid" },
  { id: "affiliate", label: "Affiliate marketing", answer: "Paid" },
  { id: "seo", label: "Organic search (SEO)", answer: "Owned" },
  { id: "orgsocial", label: "Organic social", answer: "Owned" },
  { id: "blog", label: "In-house blog / email", answer: "Owned" },
  { id: "native", label: "Native advertising", answer: "Owned" },
  { id: "backlinks", label: "Backlinks", answer: "Earned" },
  { id: "mentions", label: "Earned mentions", answer: "Earned" },
  { id: "influencer", label: "Influencer outreach", answer: "Earned" },
  { id: "partner", label: "Partner emails", answer: "Earned" },
];

// ---- Warm-up 2: Organic vs Paid (slide 21 comparison) ----
const OVP_ITEMS = [
  { id: "q1", label: "Visibility builds gradually", answer: "Organic" },
  { id: "q2", label: "Immediate visibility", answer: "Paid" },
  { id: "q3", label: "Free clicks", answer: "Organic" },
  { id: "q4", label: "Pay per click (CPC)", answer: "Paid" },
  { id: "q5", label: "Marked as an ad", answer: "Paid" },
  { id: "q6", label: "Higher trust, sits lower on page", answer: "Organic" },
  { id: "q7", label: "Best for awareness & consideration", answer: "Organic" },
  { id: "q8", label: "Best for conversions & promotions", answer: "Paid" },
  { id: "q9", label: "RACE role: Act (engage & educate)", answer: "Organic" },
  { id: "q10", label: "RACE role: Convert (drive actions)", answer: "Paid" },
];

const RACE_FIELDS = [
  {
    key: "reach",
    stage: "Reach",
    tool: "Display advertising · Canva",
    color: STAGE.reach,
    prompts: [
      ["banner", "Display banner concept: what does it say and show?"],
      ["audience", "Target audience for the banner"],
      ["reachLanding", "Landing page it points to"],
    ],
  },
  {
    key: "act",
    stage: "Act",
    tool: "SEO · AnswerThePublic",
    color: STAGE.act,
    prompts: [
      ["keyword", "Keyword theme"],
      ["blog", "Blog / content ideas"],
      ["faq", "Website FAQs to answer"],
    ],
  },
  {
    key: "convert",
    stage: "Convert",
    tool: "Paid search · WordStream",
    color: STAGE.convert,
    prompts: [
      ["intent", "High-intent keywords selected"],
      ["searchLanding", "Landing page for the search ad"],
    ],
  },
  {
    key: "integrate",
    stage: "Integrate",
    tool: "Bring it together",
    color: STAGE.integrate,
    prompts: [
      ["journey", "How do the three channels hand off to each other along the journey?"],
    ],
  },
];

// ---------- shared styles ----------
const card = {
  background: "var(--surface-2,#fff)",
  border: "0.5px solid var(--border,#e5e3dc)",
  borderRadius: 12,
  padding: "1rem 1.25rem",
};
const inp = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  fontSize: 14,
  borderRadius: 8,
  border: "0.5px solid var(--border-strong,#c9c7bd)",
  background: "var(--surface-2,#fff)",
  color: "var(--text-primary,#1a1a1a)",
};
const btnStyle = {
  padding: "6px 12px",
  fontSize: 13,
  borderRadius: 8,
  background: "transparent",
  border: `0.5px solid ${UNSW.ink}`,
  cursor: "pointer",
  color: "var(--text-primary,#1a1a1a)",
};
const yellowBtn = {
  ...btnStyle,
  background: UNSW.yellow,
  color: UNSW.ink,
  border: `0.5px solid ${UNSW.yellowDark}`,
  fontWeight: 500,
};

// Storage is handled by Supabase via ./db.js (upsertSubmission,
// loadSubmission, listSubmissions), imported at the top of this file.

// =====================================================================
// Warm-up sorter
// =====================================================================
function Sorter({ title, items, buckets }) {
  const [placed, setPlaced] = useState({});
  const [checked, setChecked] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [big, setBig] = useState(false); // projector mode
  const remaining = items.filter((i) => !placed[i.id]);
  const place = (id, bucket) => {
    setPlaced((p) => ({ ...p, [id]: bucket }));
    setChecked(false);
  };
  const reset = () => {
    setPlaced({});
    setChecked(false);
  };
  const correct = items.filter((i) => placed[i.id] === i.answer).length;
  const total = items.length;

  // Scaled dimensions: normal for laptops, large for projector.
  const s = big
    ? { title: 26, btn: 17, status: 22, tray: 96, gap: 12, bucket: 240, bucketLabel: 22, bucketGap: 10 }
    : { title: 16, btn: 13, status: 15, tray: 44, gap: 8, bucket: 120, bucketLabel: 13, bucketGap: 6 };

  const bigBtn = big ? { padding: "10px 18px", fontSize: 17 } : {};

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: s.title, fontWeight: 500 }}>{title}</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setBig((v) => !v)} style={{ ...btnStyle, ...bigBtn }} title="Larger tiles and text for the projector">
            {big ? "Laptop size" : "Projector size"}
          </button>
          <button onClick={() => setChecked(true)} style={{ ...yellowBtn, ...bigBtn }}>Check answers</button>
          <button onClick={reset} style={{ ...btnStyle, ...bigBtn }}>Reset</button>
        </div>
      </div>
      {checked && (
        <div style={{ marginBottom: "0.75rem", fontSize: s.status, fontWeight: big ? 500 : 400, color: correct === total ? "var(--text-success,#0f6e56)" : "var(--text-secondary,#666)" }}>
          {correct} of {total} correct{correct === total ? ". All placed correctly." : ". Red tiles are in the wrong column."}
        </div>
      )}
      <div
        style={{ display: "flex", flexWrap: "wrap", gap: s.gap, minHeight: s.tray, padding: big ? 12 : 8, marginBottom: "1rem", background: "var(--surface-0,#f7f5ef)", borderRadius: 8 }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => dragId && place(dragId, null)}
      >
        {remaining.length === 0 && <span style={{ fontSize: s.bucketLabel, color: "var(--text-muted,#999)", padding: 4 }}>All items placed.</span>}
        {remaining.map((i) => (
          <span key={i.id} draggable onDragStart={() => setDragId(i.id)} style={tileStyle(null, big)}>{i.label}</span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${buckets.length}, minmax(0,1fr))`, gap: big ? 18 : 12 }}>
        {buckets.map((b) => (
          <div key={b} onDragOver={(e) => e.preventDefault()} onDrop={() => dragId && place(dragId, b)}
            style={{ minHeight: s.bucket, background: "var(--surface-1,#faf9f5)", border: "0.5px solid var(--border,#e5e3dc)", borderRadius: 12, padding: big ? 16 : 10 }}>
            <div style={{ fontSize: s.bucketLabel, fontWeight: 500, marginBottom: big ? 12 : 8, color: "var(--text-secondary,#666)" }}>{b}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: s.bucketGap }}>
              {items.filter((i) => placed[i.id] === b).map((i) => (
                <span key={i.id} draggable onDragStart={() => setDragId(i.id)} style={tileStyle(checked ? i.answer === b : null, big)}>{i.label}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function tileStyle(state, big) {
  let bg = "#FFF4CC", fg = UNSW.ink, bd = UNSW.yellowDark;
  if (state === true) { bg = "#E1F5EE"; fg = "#04342C"; bd = "#5DCAA5"; }
  else if (state === false) { bg = "#FCEBEB"; fg = "#501313"; bd = "#F09595"; }
  return {
    display: "inline-block",
    padding: big ? "12px 18px" : "6px 10px",
    fontSize: big ? 20 : 13,
    borderRadius: 8,
    cursor: "grab",
    userSelect: "none",
    background: bg,
    color: fg,
    border: `${big ? 1 : 0.5}px solid ${bd}`,
  };
}

// =====================================================================
// Ad previewer
// =====================================================================
function FieldLabel({ children }) {
  return <div style={{ fontSize: 13, color: "var(--text-secondary,#666)", margin: "12px 0 4px" }}>{children}</div>;
}
function AdPreviewer({ ad, setAd, bannerUrl, onUpload, uploading }) {
  const up = (k) => (e) => setAd({ ...ad, [k]: e.target.value });
  const h1 = ad.headline1 || "Your headline here";
  const h2 = ad.headline2 || "Second headline";
  const url = ad.display || "yourbrand.com.au/offer";
  const desc = ad.desc || "Your description line. Say what you offer and why to click.";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20 }}>
      <div>
        <FieldLabel>Headline 1</FieldLabel>
        <input value={ad.headline1 || ""} onChange={up("headline1")} maxLength={30} style={inp} placeholder="Max 30 characters" />
        <FieldLabel>Headline 2</FieldLabel>
        <input value={ad.headline2 || ""} onChange={up("headline2")} maxLength={30} style={inp} placeholder="Max 30 characters" />
        <FieldLabel>Display URL</FieldLabel>
        <input value={ad.display || ""} onChange={up("display")} style={inp} placeholder="yourbrand.com.au/offer" />
        <FieldLabel>Description</FieldLabel>
        <textarea value={ad.desc || ""} onChange={up("desc")} maxLength={90} rows={3} style={{ ...inp, resize: "vertical" }} placeholder="Max 90 characters" />
        <FieldLabel>Display banner CTA</FieldLabel>
        <input value={ad.cta || ""} onChange={up("cta")} maxLength={20} style={inp} placeholder="e.g. Shop now" />

        <FieldLabel>Upload your Canva banner (PNG or JPG)</FieldLabel>
        <label style={{ ...btnStyle, display: "inline-block", cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.6 : 1 }}>
          {uploading ? "Uploading…" : bannerUrl ? "Replace image" : "Choose image"}
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
            style={{ display: "none" }}
          />
        </label>
        <div style={{ fontSize: 12, color: "var(--text-muted,#999)", marginTop: 6 }}>
          Export your banner from Canva, then upload it here. It travels with your submission.
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-muted,#999)", marginBottom: 6 }}>Paid search result</div>
        <div style={{ ...card, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 500, border: "1px solid #333", borderRadius: 3, padding: "0 4px" }}>Sponsored</span>
            <span style={{ fontSize: 12, color: "#202124" }}>{url}</span>
          </div>
          <div style={{ fontSize: 18, color: "#1a0dab", lineHeight: 1.3 }}>{h1} | {h2}</div>
          <div style={{ fontSize: 13, color: "#4d5156", marginTop: 2 }}>{desc}</div>
        </div>

        {bannerUrl && (
          <>
            <div style={{ fontSize: 12, color: "var(--text-muted,#999)", marginBottom: 6 }}>Your uploaded Canva banner</div>
            <img src={bannerUrl} alt="Uploaded Canva banner" style={{ width: "100%", maxWidth: 360, borderRadius: 8, border: "0.5px solid var(--border,#e5e3dc)", marginBottom: 20, display: "block" }} />
          </>
        )}

        <div style={{ fontSize: 12, color: "var(--text-muted,#999)", marginBottom: 6 }}>Text banner preview</div>
        <div style={{ width: "100%", maxWidth: 300, aspectRatio: "6 / 5", border: `0.5px solid ${UNSW.yellowDark}`, borderRadius: 8, background: UNSW.ink, color: "#fff", padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 500, lineHeight: 1.2 }}>{h1}</div>
            <div style={{ fontSize: 13, marginTop: 6, opacity: 0.9 }}>{desc}</div>
          </div>
          <span style={{ alignSelf: "flex-start", background: UNSW.yellow, color: UNSW.ink, fontSize: 13, fontWeight: 500, padding: "6px 14px", borderRadius: 6 }}>{ad.cta || "Shop now"}</span>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// RACE canvas
// =====================================================================
function RaceCanvas({ data, setField }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {RACE_FIELDS.map((f) => (
        <div key={f.key} style={{ ...card, borderLeft: `4px solid ${f.color}`, borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 500, color: f.color }}>{f.stage}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted,#999)" }}>{f.tool}</span>
          </div>
          {f.prompts.map(([pk, label]) => (
            <div key={pk} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary,#666)", marginBottom: 4 }}>{label}</div>
              <textarea value={data[pk] || ""} onChange={(e) => setField(pk, e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function canvasToText(group, cls, canvas, ad, brand) {
  const brandName = BRANDS[brand] || group;
  const lines = [`MARK3085 W7 - ${brandName} (class ${cls})`];
  RACE_FIELDS.forEach((f) => {
    lines.push("", f.stage + ":");
    f.prompts.forEach(([pk, label]) => {
      lines.push(`  ${label}`);
      lines.push(`  -> ${canvas?.[pk] || "-"}`);
    });
  });
  if (ad && (ad.headline1 || ad.desc)) {
    lines.push("", "Ad draft:");
    if (ad.headline1) lines.push(`  H1: ${ad.headline1}`);
    if (ad.headline2) lines.push(`  H2: ${ad.headline2}`);
    if (ad.desc) lines.push(`  Desc: ${ad.desc}`);
    if (ad.display) lines.push(`  URL: ${ad.display}`);
    if (ad.cta) lines.push(`  CTA: ${ad.cta}`);
  }
  return lines.join("\n");
}

// =====================================================================
// Lululemon worked example (tutor showcase only, not tied to any login
// and never written to the submissions table)
// =====================================================================
const LULU_DEMO = {
  reach: {
    banner: 'Bold banner: "Move with intention." Shows a runner in Lululemon gear at dawn on a coastal path, with a "Shop the run edit" button.',
    audience: "Active women and men 25 to 40 in metro AU who train regularly and value premium, versatile activewear they can wear beyond the gym.",
    reachLanding: "The seasonal running collection landing page, not the homepage.",
  },
  act: {
    keyword: '"best running leggings" and "gym to street outfits"',
    blog: '"5 pieces that take you from run to brunch"; "How to choose leggings for high-intensity training"',
    faq: '"Are Lululemon leggings squat-proof?"; "What is the difference between Align and Wunder Train?"',
  },
  convert: {
    intent: '"buy Align leggings", "Lululemon running shorts", "Wunder Train tights"',
    searchLanding: "The specific product page for the searched item, with size and colour in stock.",
  },
  integrate: {
    journey: "Display builds brand affinity with people not yet shopping (Reach). SEO content captures them as they research fit and use-cases (Act). Paid search intercepts high-intent buyers typing product names and sends them to a purchasable product page (Convert). Display retargeting then re-engages anyone who browsed but did not buy.",
  },
};

function DemoView({ onExit }) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", color: "var(--text-primary,#1a1a1a)", maxWidth: 960, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div style={{ background: UNSW.yellow, borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: UNSW.ink, opacity: 0.7 }}>MARK3085 · Week 7 · Worked example</div>
          <div style={{ fontSize: 18, fontWeight: 500, color: UNSW.ink }}>Lululemon: an integrated RACE journey</div>
        </div>
        <button onClick={onExit} style={{ ...btnStyle, background: "transparent", border: `0.5px solid ${UNSW.ink}` }}>Exit</button>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary,#666)", marginTop: 0, marginBottom: 16 }}>
        This is a sample answer to show what "good" looks like across the four stages. Lululemon is not one of the course brands; it is here purely as an illustration.
      </p>
      {RACE_FIELDS.map((f) => (
        <div key={f.key} style={{ ...card, borderLeft: `4px solid ${f.color}`, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 500, color: f.color }}>{f.stage}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted,#999)" }}>{f.tool}</span>
          </div>
          {f.prompts.map(([pk, label]) => (
            <div key={pk} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary,#666)", marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 14 }}>{LULU_DEMO[f.key][pk]}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// =====================================================================
// Gate
// =====================================================================
function Gate({ onStudent, onTutor, onExample }) {
  const [code, setCode] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [mode, setMode] = useState("student");

  const enterStudent = () => {
    const raw = code.trim();
    const m = /^(.*?)(9413|9414)$/.exec(norm(raw));
    if (!m) { setErr("Enter your brand name then your class number, e.g. PalaceCinemas9413."); return; }
    const brand = BRAND_BY_NORM[m[1]];
    const cls = m[2];
    if (!brand) { setErr("Brand not recognised. Check the spelling, e.g. FrankBody9414."); return; }
    // Stored group id: brand letter + class, e.g. C9413. Stable and readable.
    onStudent({ group: `${brand}${cls}`, brand, cls });
  };
  const enterTutor = () => {
    if (pass.trim() !== TUTOR_PASSPHRASE) { setErr("That passphrase doesn't match."); return; }
    onTutor();
  };

  return (
    <div style={{ maxWidth: 460, margin: "40px auto", ...card, borderTop: `4px solid ${UNSW.yellow}` }}>
      <div style={{ fontSize: 12, color: "var(--text-muted,#999)" }}>MARK3085 · Week 7 Tutorial</div>
      <h1 style={{ margin: "2px 0 16px", fontSize: 20, fontWeight: 500 }}>Integrating Display, SEO & Paid Search</h1>
      <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
        {[["student", "I'm a student"], ["tutor", "I'm the tutor"], ["example", "Show example"]].map(([id, label]) => (
          <button key={id} onClick={() => { setMode(id); setErr(""); }}
            style={{ ...btnStyle, ...(mode === id ? { background: UNSW.yellow, border: `0.5px solid ${UNSW.yellowDark}`, fontWeight: 500 } : {}) }}>
            {label}
          </button>
        ))}
      </div>
      {mode === "student" && (
        <div>
          <FieldLabel>Your group login</FieldLabel>
          <input value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enterStudent()} style={inp} placeholder="e.g. PalaceCinemas9413" autoFocus />
          <div style={{ fontSize: 12, color: "var(--text-muted,#999)", margin: "6px 0 14px" }}>
            Your brand name (no spaces) then your class number. Your tutor gives you this.
          </div>
          <button onClick={enterStudent} style={{ ...yellowBtn, width: "100%", padding: "10px" }}>Start</button>
        </div>
      )}
      {mode === "tutor" && (
        <div>
          <FieldLabel>Tutor passphrase</FieldLabel>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enterTutor()} style={inp} autoFocus />
          <button onClick={enterTutor} style={{ ...yellowBtn, width: "100%", padding: "10px", marginTop: 14 }}>Open submissions</button>
        </div>
      )}
      {mode === "example" && (
        <div>
          <div style={{ fontSize: 13, color: "var(--text-secondary,#666)", margin: "0 0 14px" }}>
            A worked Lululemon example showing an integrated RACE journey. Handy to project before groups start.
          </div>
          <button onClick={onExample} style={{ ...yellowBtn, width: "100%", padding: "10px" }}>Show worked example</button>
        </div>
      )}
      {err && <div style={{ fontSize: 13, color: "var(--text-danger,#a32d2d)", marginTop: 12 }}>{err}</div>}
    </div>
  );
}

// =====================================================================
// Student app
// =====================================================================
function StudentApp({ session, onExit }) {
  const { group, brand, cls } = session;
  const [tab, setTab] = useState("warmup");
  const [canvas, setCanvas] = useState({});
  const [ad, setAd] = useState({});
  const [bannerUrl, setBannerUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const [exportText, setExportText] = useState("");

  useEffect(() => {
    let live = true;
    loadSubmission(cls, group)
      .then((d) => {
        if (!live || !d) return;
        setCanvas(d.canvas || {});
        setAd(d.ad || {});
        setBannerUrl(d.banner_url || "");
      })
      .catch(() => {
        // No saved row yet, or network hiccup. Start blank; the copy/paste
        // backup still works regardless.
      });
    return () => { live = false; };
  }, [cls, group]);

  const setField = (k, v) => setCanvas((c) => ({ ...c, [k]: v }));

  const handleUpload = async (file) => {
    if (file.size > 6 * 1024 * 1024) {
      setStatus("That image is over 6MB. Please export a smaller version from Canva.");
      setTimeout(() => setStatus(""), 5000);
      return;
    }
    setUploading(true);
    setStatus("Uploading banner…");
    try {
      const publicUrl = await uploadBanner(cls, group, file);
      setBannerUrl(publicUrl);
      // Persist immediately so the image isn't lost if they forget to submit.
      await upsertSubmission(cls, group, { canvas, ad, brand, banner_url: publicUrl });
      setStatus("Banner uploaded.");
    } catch (e) {
      setStatus("Upload didn't go through. Try again, or show your Canva export directly.");
    }
    setUploading(false);
    setTimeout(() => setStatus(""), 4000);
  };

  const submit = async () => {
    setStatus("Submitting…");
    try {
      await upsertSubmission(cls, group, { canvas, ad, brand, banner_url: bannerUrl });
      setStatus("Submitted to tutor.");
    } catch (e) {
      setStatus("Live submit didn't go through. Use the copy below as backup.");
    }
    setExportText(canvasToText(group, cls, canvas, ad, brand));
    setTimeout(() => setStatus(""), 5000);
  };

  const pullAd = () => {
    const s = [ad.headline1 && `H1: ${ad.headline1}`, ad.headline2 && `H2: ${ad.headline2}`, ad.desc && `Desc: ${ad.desc}`, ad.display && `URL: ${ad.display}`].filter(Boolean).join(" | ");
    if (s) setField("banner", s);
    setTab("canvas");
  };

  const copyExport = () => {
    const t = canvasToText(group, cls, canvas, ad, brand);
    setExportText(t);
    navigator.clipboard?.writeText(t).then(() => setStatus("Copied. Paste it to your tutor if asked.")).catch(() => {});
    setTimeout(() => setStatus(""), 4000);
  };

  return (
    <Shell brand={brand} cls={cls} onExit={onExit}
      tabs={[["warmup", "Warm-ups"], ["ad", "Ad previewer"], ["canvas", "RACE canvas"]]}
      tab={tab} setTab={setTab}>
      {tab === "warmup" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={card}><Sorter title="Sort into paid, owned & earned media" items={POE_ITEMS} buckets={["Paid", "Owned", "Earned"]} /></div>
          <div style={card}><Sorter title="Organic or paid search?" items={OVP_ITEMS} buckets={["Organic", "Paid"]} /></div>
        </div>
      )}
      {tab === "ad" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Draft your ad, see it rendered</h3>
            <button onClick={pullAd} style={yellowBtn}>Send to RACE canvas →</button>
          </div>
          <AdPreviewer ad={ad} setAd={setAd} bannerUrl={bannerUrl} onUpload={handleUpload} uploading={uploading} />
        </div>
      )}
      {tab === "canvas" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary,#666)" }}>{BRANDS[brand]} · class {cls}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {status && <span style={{ fontSize: 13, color: "var(--text-secondary,#666)" }}>{status}</span>}
              <button onClick={copyExport} style={btnStyle}>Copy my work</button>
              <button onClick={submit} style={yellowBtn}>Submit to tutor</button>
            </div>
          </div>
          <RaceCanvas data={canvas} setField={setField} />
          {exportText && (
            <div style={{ ...card, marginTop: 16, background: "var(--surface-1,#faf9f5)" }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Backup copy</div>
              <div style={{ fontSize: 12, color: "var(--text-muted,#999)", marginBottom: 8 }}>
                If your tutor can't see your submission, copy this and send it to them.
              </div>
              <textarea readOnly value={exportText} rows={8} style={{ ...inp, fontFamily: "var(--font-mono,monospace)", fontSize: 12 }} />
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

// =====================================================================
// Tutor app
// =====================================================================
function TutorApp({ onExit }) {
  const [cls, setCls] = useState("9413");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pasted, setPasted] = useState([]);
  const [pasteBox, setPasteBox] = useState("");

  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listSubmissions(cls);
      // Normalise to the shape the board expects: group + brand + canvas + cls.
      const out = data.map((r) => ({
        group: r.group_code,
        brand: r.brand,
        cls: r.cls,
        canvas: r.canvas || {},
        ad: r.ad || {},
        bannerUrl: r.banner_url || "",
      }));
      out.sort((a, b) => a.group.localeCompare(b.group));
      setRows(out);
    } catch (e) {
      setError("Could not load submissions. Check your connection and hit Refresh.");
      setRows([]);
    }
    setLoading(false);
  }, [cls]);

  useEffect(() => { refresh(); }, [refresh]);

  const addPaste = () => {
    if (pasteBox.trim()) { setPasted((p) => [...p, pasteBox.trim()]); setPasteBox(""); }
  };

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", color: "var(--text-primary,#1a1a1a)", maxWidth: 960, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-muted,#999)" }}>MARK3085 · Week 7 · Tutor view</div>
          <h1 style={{ margin: "2px 0 0", fontSize: 22, fontWeight: 500 }}>Group submissions</h1>
        </div>
        <button onClick={onExit} style={btnStyle}>Exit</button>
      </div>

      <div style={{ ...card, padding: "12px 14px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderTop: `4px solid ${UNSW.yellow}` }}>
        <span style={{ fontSize: 13, color: "var(--text-secondary,#666)" }}>Class</span>
        {["9413", "9414"].map((c) => (
          <button key={c} onClick={() => setCls(c)} style={{ ...btnStyle, ...(cls === c ? { background: UNSW.ink, color: "#fff", border: `0.5px solid ${UNSW.ink}` } : {}) }}>{c}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={refresh} style={yellowBtn}>Refresh</button>
      </div>

      {loading && <p style={{ fontSize: 14, color: "var(--text-muted,#999)" }}>Loading…</p>}
      {error && <div style={{ ...card, marginBottom: 12, color: "var(--text-danger,#a32d2d)", fontSize: 14 }}>{error}</div>}
      {!loading && !error && rows.length === 0 && (
        <div style={{ ...card, textAlign: "center", color: "var(--text-muted,#999)", marginBottom: 20 }}>
          No submissions yet in class {cls}. They appear as groups hit Submit. If sync is slow in the room, use the paste box below.
        </div>
      )}

      {rows.map((g) => (
        <div key={g.group} style={{ ...card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 500 }}>{BRANDS[g.brand] || g.group}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted,#999)" }}>class {g.cls || cls}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
            {RACE_FIELDS.map((f) => (
              <div key={f.key}>
                <div style={{ fontSize: 12, fontWeight: 500, color: f.color, marginBottom: 4 }}>{f.stage}</div>
                {f.prompts.map(([pk, label]) => (
                  <div key={pk} style={{ fontSize: 13, marginBottom: 6, color: "var(--text-secondary,#555)" }}>
                    {g.canvas?.[pk] ? g.canvas[pk] : <span style={{ color: "var(--text-muted,#bbb)" }}>-</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {g.bannerUrl && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: STAGE.reach, marginBottom: 4 }}>Uploaded Canva banner</div>
              <img src={g.bannerUrl} alt="Group banner" style={{ maxWidth: 320, width: "100%", borderRadius: 8, border: "0.5px solid var(--border,#e5e3dc)", display: "block" }} />
            </div>
          )}
        </div>
      ))}

      <div style={{ ...card, marginTop: 20, background: "var(--surface-1,#faf9f5)" }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Paste a group's work (fallback)</div>
        <div style={{ fontSize: 12, color: "var(--text-muted,#999)", marginBottom: 8 }}>
          If a group's live submission doesn't show, have them hit "Copy my work" and send you the text. Paste it here to display it.
        </div>
        <textarea value={pasteBox} onChange={(e) => setPasteBox(e.target.value)} rows={4} style={{ ...inp, fontFamily: "var(--font-mono,monospace)", fontSize: 12 }} placeholder="Paste group export here" />
        <div style={{ marginTop: 8 }}><button onClick={addPaste} style={yellowBtn}>Add to board</button></div>
        {pasted.map((t, i) => (
          <pre key={i} style={{ ...card, marginTop: 12, whiteSpace: "pre-wrap", fontFamily: "var(--font-mono,monospace)", fontSize: 12, color: "var(--text-primary,#1a1a1a)" }}>{t}</pre>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// Shell (student chrome)
// =====================================================================
function Shell({ brand, cls, onExit, tabs, tab, setTab, children }) {
  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", color: "var(--text-primary,#1a1a1a)", maxWidth: 940, margin: "0 auto", padding: "20px 16px 60px" }}>
      <div style={{ background: UNSW.yellow, borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 12, color: UNSW.ink, opacity: 0.7 }}>MARK3085 · Week 7 Tutorial</div>
          <div style={{ fontSize: 18, fontWeight: 500, color: UNSW.ink }}>Integrating Display, SEO & Paid Search</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: UNSW.ink }}>{BRANDS[brand]} · class {cls}</div>
          <button onClick={onExit} style={{ ...btnStyle, marginTop: 4, background: "transparent", border: `0.5px solid ${UNSW.ink}` }}>Switch group</button>
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ ...btnStyle, ...(tab === id ? { background: UNSW.yellow, border: `0.5px solid ${UNSW.yellowDark}`, fontWeight: 500 } : { border: "0.5px solid transparent" }) }}>
            {label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}

// =====================================================================
// Root
// =====================================================================
export default function App() {
  const [role, setRole] = useState(null);
  if (!role) {
    return <Gate onStudent={(s) => setRole({ kind: "student", ...s })} onTutor={() => setRole({ kind: "tutor" })} onExample={() => setRole({ kind: "example" })} />;
  }
  if (role.kind === "tutor") return <TutorApp onExit={() => setRole(null)} />;
  if (role.kind === "example") return <DemoView onExit={() => setRole(null)} />;
  return <StudentApp session={role} onExit={() => setRole(null)} />;
}
