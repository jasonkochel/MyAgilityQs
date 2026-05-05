#!/usr/bin/env node
/**
 * Progression test CLI — interactive smoke testing for the live API.
 *
 *   node tools/progtest.mjs                # menu-driven REPL
 *   node tools/progtest.mjs --server URL   # override API base URL
 *
 * On first run, prompts for login. State (token + test dog id) is persisted
 * to .progtest-state.json at the repo root (gitignored).
 *
 * Cleanup deletes the test dog and all its runs.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = resolve(__dirname, "..", ".progtest-state.json");
const DEFAULT_API = "https://vep645bkmqblgemzy72psyrsju0mjgma.lambda-url.us-east-1.on.aws";

const VALID_CLASSES = ["Standard", "Jumpers", "FAST", "T2B", "Premier Std", "Premier JWW"];
const VALID_LEVELS = ["Novice", "Open", "Excellent", "Masters"];

// ----------------------------------------------------------------------------
// State
// ----------------------------------------------------------------------------

function readState() {
  if (!existsSync(STATE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ----------------------------------------------------------------------------
// Readline / prompts
// ----------------------------------------------------------------------------

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((res) => rl.question(question, (a) => res(a.trim())));
}

async function askChoice(question, choices, { default: dflt } = {}) {
  const display = choices.map((c, i) => `    ${i + 1}. ${c}`).join("\n");
  for (;;) {
    const prompt = dflt
      ? `${question}\n${display}\n  [1-${choices.length}, default ${dflt}]: `
      : `${question}\n${display}\n  [1-${choices.length}]: `;
    const a = (await ask(prompt)).trim();
    if (!a && dflt) return dflt;
    const n = Number(a);
    if (Number.isInteger(n) && n >= 1 && n <= choices.length) return choices[n - 1];
    const direct = choices.find((c) => c.toLowerCase() === a.toLowerCase());
    if (direct) return direct;
    console.log("  (invalid choice)");
  }
}

async function askInt(question, { min = 0, default: dflt } = {}) {
  for (;;) {
    const suffix = dflt !== undefined ? ` [default ${dflt}]` : "";
    const a = (await ask(`${question}${suffix}: `)).trim();
    if (!a && dflt !== undefined) return dflt;
    const n = Number(a);
    if (Number.isInteger(n) && n >= min) return n;
    console.log(`  (must be a non-negative integer >= ${min})`);
  }
}

async function askYesNo(question, { default: dflt = false } = {}) {
  const suffix = dflt ? " [Y/n]" : " [y/N]";
  const a = (await ask(`${question}${suffix}: `)).trim().toLowerCase();
  if (!a) return dflt;
  return a.startsWith("y");
}

async function askPassword(question) {
  // Hide password by toggling raw mode and echoing '*' for each char.
  if (!process.stdin.isTTY) {
    return ask(question);
  }
  return new Promise((res) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    let value = "";
    const handler = (chunk) => {
      const ch = chunk.toString("utf8");
      // Enter
      if (ch === "\n" || ch === "\r" || ch === "\r\n") {
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", handler);
        process.stdout.write("\n");
        res(value);
        return;
      }
      // Ctrl-C (0x03)
      if (ch === "\x03") {
        process.stdin.setRawMode(false);
        process.exit(130);
      }
      // Backspace (0x08) or DEL (0x7f)
      if (ch === "\x08" || ch === "\x7f") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }
      value += ch;
      process.stdout.write("*");
    };
    process.stdin.on("data", handler);
  });
}

// ----------------------------------------------------------------------------
// API
// ----------------------------------------------------------------------------

async function api(method, path, { token, body, baseUrl }) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = json?.message || json?.error || res.statusText;
    throw new Error(`${method} ${path} -> ${res.status}: ${msg}`);
  }
  if (json && json.success === false) {
    throw new Error(`${method} ${path}: ${json.message ?? json.error}`);
  }
  return json?.data ?? json;
}

function makeCaller(state, baseUrl) {
  if (!state.token) throw new Error("Not logged in.");
  return (method, path, body) => api(method, path, { token: state.token, body, baseUrl });
}

// ----------------------------------------------------------------------------
// Display
// ----------------------------------------------------------------------------

function printDog(dog) {
  console.log(`\nDog: ${dog.name} (${dog.id})  active=${dog.active}`);
  if (dog.classes?.length) {
    console.log(`  Classes:`);
    for (const c of dog.classes) console.log(`    - ${c.name}: ${c.level}`);
  }
  if (dog.baseline) {
    console.log(`  Baseline:`);
    if (dog.baseline.perClass) {
      for (const [name, b] of Object.entries(dog.baseline.perClass)) {
        const parts = [];
        if (b.level) parts.push(`level=${b.level}`);
        if (b.qs !== undefined) parts.push(`qs=${b.qs}`);
        if (b.top25 !== undefined) parts.push(`top25=${b.top25}`);
        console.log(`    ${name}: ${parts.join(", ") || "(empty)"}`);
      }
    }
    if (dog.baseline.machPoints) console.log(`    MACH points: ${dog.baseline.machPoints}`);
    if (dog.baseline.doubleQs) console.log(`    Double Qs: ${dog.baseline.doubleQs}`);
  } else {
    console.log(`  Baseline: (none)`);
  }
}

function printProgress(progress) {
  if (!progress) return;
  console.log(`\nProgress for ${progress.dogName}:`);

  if (progress.classProgress?.length) {
    console.log(`  Class Qs (logged + baseline):`);
    for (const cp of progress.classProgress) {
      const levels = Object.entries(cp.levels).map(([lvl, n]) => `${lvl}=${n}`).join(", ");
      console.log(`    ${cp.class}: ${levels || "(none)"}`);
    }
  }

  const fmtTitles = (arr) =>
    arr.map((x) => `${x.title}=${x.progress}/${x.needed}${x.earned ? " *" : ""}`).join(", ");

  if (progress.mastersTitles) {
    if (progress.mastersTitles.standardTitles?.length) {
      console.log(`  Standard titles: ${fmtTitles(progress.mastersTitles.standardTitles)}`);
    }
    if (progress.mastersTitles.jumpersTitles?.length) {
      console.log(`  Jumpers titles: ${fmtTitles(progress.mastersTitles.jumpersTitles)}`);
    }
  }
  if (progress.fastTitles?.length) console.log(`  FAST titles: ${fmtTitles(progress.fastTitles)}`);
  if (progress.t2bTitles?.length) console.log(`  T2B titles: ${fmtTitles(progress.t2bTitles)}`);

  if (progress.premierProgress?.length) {
    for (const p of progress.premierProgress) {
      console.log(`  Premier ${p.class}: totalQs=${p.totalQs}, top25=${p.topTwentyFivePercentQs}`);
      const tiers = p.tiers
        .map(
          (t) =>
            `${t.title}=${t.qsProgress}/${t.qsNeeded}+${t.top25Progress}/${t.top25Needed}${t.earned ? " *" : ""}`
        )
        .join(", ");
      console.log(`    ${tiers}`);
    }
  }

  if (progress.machProgress !== undefined) {
    console.log(
      `  MACH: ${progress.completeMachs ?? 0} complete, ${progress.machProgress} points, ${progress.doubleQs} DQs`
    );
  }
}

// ----------------------------------------------------------------------------
// Actions
// ----------------------------------------------------------------------------

async function login(state, baseUrl) {
  const email = (await ask(`Email${state.email ? ` [${state.email}]` : ""}: `)) || state.email;
  if (!email) {
    console.log("  (email required)");
    return;
  }
  const password = await askPassword("Password (hidden): ");
  if (!password) {
    console.log("  (password required)");
    return;
  }
  const data = await api("POST", "/auth/login", {
    body: { email, password },
    baseUrl,
  });
  if (!data?.idToken) throw new Error("Login response missing idToken");
  state.token = data.idToken;
  state.refreshToken = data.refreshToken;
  state.email = email;
  state.baseUrl = baseUrl;
  writeState(state);
  console.log(`Logged in as ${email}.`);
}

async function createDog(state, baseUrl) {
  const call = makeCaller(state, baseUrl);
  const name = (await ask("Dog name [ProgTest]: ")) || "ProgTest";

  console.log(`Available classes: ${VALID_CLASSES.join(", ")}`);
  console.log(`  Enter as comma-separated list.`);
  const classesInput = (await ask("Classes [Standard,Jumpers]: ")) || "Standard,Jumpers";
  const classes = classesInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((cls) => {
      if (!VALID_CLASSES.includes(cls)) {
        throw new Error(`Invalid class: "${cls}"`);
      }
      return { name: cls, level: "Novice" };
    });
  if (!classes.length) throw new Error("At least one class required");

  const dog = await call("POST", "/dogs", { name, classes });
  state.dogId = dog.id;
  state.dogName = dog.name;
  writeState(state);
  console.log(`\nCreated dog "${dog.name}" (${dog.id}).`);
  printDog(dog);
}

async function setBaseline(state, baseUrl) {
  const call = makeCaller(state, baseUrl);
  const dog = await call("GET", `/dogs/${state.dogId}`);

  const dogClassNames = dog.classes.map((c) => c.name);
  if (!dogClassNames.length) throw new Error("Dog has no classes");

  const cls = await askChoice("Which class?", dogClassNames);
  const isPremier = cls === "Premier Std" || cls === "Premier JWW";
  const isT2B = cls === "T2B";
  const isLevelGated = !isPremier && !isT2B;

  const baseline = dog.baseline ? structuredClone(dog.baseline) : {};
  baseline.perClass = baseline.perClass ?? {};
  const entry = baseline.perClass[cls] ?? {};

  if (isLevelGated) {
    entry.level = await askChoice("Current level?", VALID_LEVELS, {
      default: entry.level || "Novice",
    });
  } else {
    delete entry.level;
  }

  const qsLabel = isT2B ? "Total Qs" : isLevelGated ? "Qs at this level" : "Total Qs";
  entry.qs = await askInt(qsLabel, { default: entry.qs ?? 0 });
  if (entry.qs === 0) delete entry.qs;

  if (isPremier) {
    entry.top25 = await askInt("Top-25% placements", { default: entry.top25 ?? 0 });
    if (entry.top25 === 0) delete entry.top25;
  }

  baseline.perClass[cls] = entry;
  await call("PUT", `/dogs/${state.dogId}`, { baseline });
  console.log(`Baseline updated for ${cls}.`);

  const updated = await call("GET", `/dogs/${state.dogId}`);
  printDog(updated);
}

async function setBaselineTotals(state, baseUrl) {
  const call = makeCaller(state, baseUrl);
  const dog = await call("GET", `/dogs/${state.dogId}`);
  const baseline = dog.baseline ? structuredClone(dog.baseline) : {};

  baseline.machPoints = await askInt("MACH points", { default: baseline.machPoints ?? 0 });
  if (baseline.machPoints === 0) delete baseline.machPoints;
  baseline.doubleQs = await askInt("Double Qs", { default: baseline.doubleQs ?? 0 });
  if (baseline.doubleQs === 0) delete baseline.doubleQs;

  await call("PUT", `/dogs/${state.dogId}`, { baseline });
  console.log("Baseline totals updated.");
  const updated = await call("GET", `/dogs/${state.dogId}`);
  printDog(updated);
}

async function clearBaseline(state, baseUrl) {
  const call = makeCaller(state, baseUrl);
  const ok = await askYesNo("Clear all baseline data on this dog?");
  if (!ok) return;
  await call("PUT", `/dogs/${state.dogId}`, { baseline: null });
  console.log("Baseline cleared.");
  const updated = await call("GET", `/dogs/${state.dogId}`);
  printDog(updated);
}

async function addRun(state, baseUrl) {
  const call = makeCaller(state, baseUrl);
  const dog = await call("GET", `/dogs/${state.dogId}`);
  const dogClassNames = dog.classes.map((c) => c.name);

  const cls = await askChoice("Class?", dogClassNames);
  const isPremier = cls === "Premier Std" || cls === "Premier JWW";

  let level;
  if (isPremier) {
    level = "Masters";
  } else {
    level = await askChoice("Level?", VALID_LEVELS, { default: "Masters" });
  }

  const qualified = await askYesNo("Qualified?", { default: true });
  const today = new Date().toISOString().slice(0, 10);
  const date = (await ask(`Date YYYY-MM-DD [${today}]: `)) || today;

  const body = {
    dogId: state.dogId,
    date,
    class: cls,
    level,
    qualified,
    placement: null,
  };

  if (qualified && level === "Masters" && (cls === "Standard" || cls === "Jumpers")) {
    const mach = await askInt("MACH points (0 to skip)", { default: 0 });
    if (mach > 0) body.machPoints = mach;
  }

  if (qualified && isPremier) {
    body.topTwentyFivePercent = await askYesNo("Top-25% placement?", { default: false });
  }

  const result = await call("POST", "/runs", body);
  console.log(
    `Logged: ${cls} ${level} ${qualified ? "Q" : "NQ"}${body.machPoints ? ` mach=${body.machPoints}` : ""}${body.topTwentyFivePercent ? " top25" : ""} on ${date}`
  );
  if (result.levelProgression) {
    const lp = result.levelProgression;
    console.log(`  *** Level progression: ${lp.class} ${lp.fromLevel} -> ${lp.toLevel} ***`);
  }
  await showStatus(state, baseUrl);
}

async function showStatus(state, baseUrl) {
  const call = makeCaller(state, baseUrl);
  const dog = await call("GET", `/dogs/${state.dogId}`);
  printDog(dog);
  const allProgress = await call("GET", "/progress");
  const progress = allProgress.find((p) => p.dogId === state.dogId);
  printProgress(progress);
}

async function cleanup(state, baseUrl) {
  if (!state.dogId) {
    console.log("No dog in state.");
    return;
  }
  const ok = await askYesNo(
    `Permanently delete dog "${state.dogName}" (${state.dogId}) and all its runs?`
  );
  if (!ok) return;
  const call = makeCaller(state, baseUrl);
  try {
    await call("DELETE", `/dogs/${state.dogId}`);
    console.log(`Deleted dog "${state.dogName}".`);
  } catch (err) {
    console.warn(`Cleanup warning: ${err.message}`);
  }
  delete state.dogId;
  delete state.dogName;
  writeState(state);
}

// ----------------------------------------------------------------------------
// Menu
// ----------------------------------------------------------------------------

function header(state, baseUrl) {
  const lines = [];
  lines.push("");
  lines.push("=".repeat(60));
  lines.push(`progtest  |  ${baseUrl}`);
  lines.push(state.token ? `Logged in as ${state.email}` : "Not logged in");
  if (state.dogId) {
    lines.push(`Test dog: ${state.dogName} (${state.dogId})`);
  } else if (state.token) {
    lines.push("No test dog yet.");
  }
  lines.push("=".repeat(60));
  return lines.join("\n");
}

async function mainLoop(baseUrl) {
  let state = readState();
  if (state.baseUrl && !process.argv.includes("--server")) {
    baseUrl = state.baseUrl;
  }

  if (!state.token) {
    console.log(header(state, baseUrl));
    console.log("Login required.");
    try {
      await login(state, baseUrl);
    } catch (err) {
      console.error(`Login failed: ${err.message}`);
      rl.close();
      return;
    }
  }

  for (;;) {
    state = readState();
    console.log(header(state, baseUrl));

    const options = [];
    if (!state.dogId) {
      options.push({ key: "1", label: "Create test dog", action: createDog });
    } else {
      options.push({ key: "1", label: "Set per-class baseline", action: setBaseline });
      options.push({ key: "2", label: "Set baseline totals (MACH / Double Qs)", action: setBaselineTotals });
      options.push({ key: "3", label: "Clear baseline", action: clearBaseline });
      options.push({ key: "4", label: "Add run", action: addRun });
      options.push({ key: "5", label: "Show status", action: showStatus });
      options.push({ key: "6", label: "Cleanup (delete test dog)", action: cleanup });
    }
    options.push({ key: "L", label: "Re-login", action: login });
    options.push({ key: "Q", label: "Quit", action: null });

    for (const o of options) console.log(`  ${o.key}. ${o.label}`);
    const choice = (await ask("\n> ")).trim();

    if (!choice) continue;
    if (choice.toLowerCase() === "q") break;

    const opt = options.find((o) => o.key.toLowerCase() === choice.toLowerCase());
    if (!opt) {
      console.log(`Unknown choice: ${choice}`);
      continue;
    }
    if (!opt.action) break;

    try {
      await opt.action(state, baseUrl);
    } catch (err) {
      console.error(`\nError: ${err.message}`);
      if (err.message.includes("401")) {
        console.error("  (token may have expired — try Re-login)");
      }
    }
  }

  rl.close();
  console.log("Bye.");
}

// ----------------------------------------------------------------------------
// Entry
// ----------------------------------------------------------------------------

function getServerArg() {
  const i = process.argv.indexOf("--server");
  return i >= 0 ? process.argv[i + 1] : DEFAULT_API;
}

mainLoop(getServerArg()).catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
