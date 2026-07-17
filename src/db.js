import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";

// Thin wrapper over the Supabase REST API (PostgREST). No SDK needed.
// One table: submissions (cls, group_code, brand, canvas, ad, updated_at),
// unique on (cls, group_code) so a resubmit overwrites the same row.

const REST = `${SUPABASE_URL}/rest/v1/submissions`;
const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// Insert or update this group's row. Uses upsert via merge-duplicates on the
// (cls, group_code) unique constraint.
export async function upsertSubmission(cls, group, payload) {
  const body = {
    cls,
    group_code: group,
    brand: payload.brand || null,
    canvas: payload.canvas || {},
    ad: payload.ad || {},
    banner_url: payload.banner_url || null,
    updated_at: new Date().toISOString(),
  };
  const res = await fetch(REST, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`upsert failed (${res.status}): ${text}`);
  }
  return res.json();
}

// Upload a banner image to the public `banners` bucket and return its public
// URL. File is keyed by class+group so a re-upload overwrites the old one.
export async function uploadBanner(cls, group, file) {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${cls}/${group}.${ext}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/banners/${path}`;
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": file.type || "image/png",
      "x-upsert": "true", // overwrite if the group re-uploads
    },
    body: file,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`upload failed (${res.status}): ${text}`);
  }
  // Public URL (bucket is public). Cache-bust so a re-upload shows immediately.
  return `${SUPABASE_URL}/storage/v1/object/public/banners/${path}?t=${Date.now()}`;
}

// Load one group's row (or null if none yet).
export async function loadSubmission(cls, group) {
  const url = `${REST}?cls=eq.${encodeURIComponent(cls)}&group_code=eq.${encodeURIComponent(group)}&select=*`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`load failed (${res.status})`);
  const rows = await res.json();
  return rows[0] || null;
}

// Load every submission for a class, newest first. Used by the tutor board.
export async function listSubmissions(cls) {
  const url = `${REST}?cls=eq.${encodeURIComponent(cls)}&select=*&order=group_code.asc`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`list failed (${res.status})`);
  return res.json();
}
