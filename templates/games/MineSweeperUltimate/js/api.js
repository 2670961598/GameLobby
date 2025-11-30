// Minesweeper Ultimate – API Helper
// ---------------------------------
// Tries to communicate with a backend at /scores. If unreachable, falls back to
// localStorage so the app remains fully usable in standalone mode.

const BASE = "/scores";
const GAME = "MinesweeperUltimate";

async function request(url, opts) {
  try {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (err) {
    throw err; // propagate to caller – they'll decide to fallback
  }
}

// ---- Public API ----
export async function postScore(diff, name, score) {
  const payload = { game: GAME, difficulty: diff, name, score };
  try {
    await request(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (_e) {
    // offline fallback – store in localStorage
    const key = `mu_scores_${diff}`;
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.push(payload);
    localStorage.setItem(key, JSON.stringify(arr));
  }
}

export async function fetchScores(diff) {
  try {
    return await request(`${BASE}?game=${GAME}&difficulty=${diff}`);
  } catch (_e) {
    // fallback to localStorage
    const key = `mu_scores_${diff}`;
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    return arr;
  }
} 