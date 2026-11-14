// Usage (run from the earthpulse folder):
//   node convert-data.mjs wasp  raw/wasp.csv
//   node convert-data.mjs ocean raw/chl.csv POWOW1 CTD02
import fs from "fs";

const [, , kind, input, cruise, cast] = process.argv;
const rows = fs.readFileSync(input, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
const head = rows[0].split(",");
const col = (n) => head.indexOf(n);
fs.mkdirSync("public/data", { recursive: true });

if (kind === "wasp") {
  // Keeps wavelength (µm) and the morning-limb Rp/R*. Rp/R* = planet radius / star radius.
  const iw = col("wave"), ir = col("rprs_morning");
  const out = ["wavelength_um,rprs"];
  for (const l of rows.slice(1)) { const c = l.split(","); out.push(`${c[iw]},${c[ir]}`); }
  fs.writeFileSync("public/data/wasp96b.csv", out.join("\n"));
  console.log(`wasp96b.csv written: ${out.length - 1} points`);
} else if (kind === "ocean") {
  // One CTD cast: average duplicate bottles per depth, skip "nd", sort shallow -> deep.
  const ic = col("cruise_name"), ik = col("cast"), id = col("depth"), iv = col("chl_tot");
  const by = new Map();
  for (const l of rows.slice(1)) {
    const c = l.split(",");
    if (c[ic] !== cruise || c[ik] !== cast) continue;
    const d = Number(c[id]), v = Number(c[iv]);
    if (Number.isNaN(d) || Number.isNaN(v)) continue;
    if (!by.has(d)) by.set(d, []);
    by.get(d).push(v);
  }
  const out = ["depth_m,chl_tot"];
  [...by.keys()].sort((a, b) => a - b).forEach((d) => {
    const v = by.get(d);
    out.push(`${d},${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(4)}`);
  });
  fs.writeFileSync("public/data/chlorophyll.csv", out.join("\n"));
  console.log(`chlorophyll.csv written: ${out.length - 1} depths for ${cruise} ${cast}`);
} else {
  console.log("Use: wasp <file>  or  ocean <file> <cruise_name> <cast>");
}
