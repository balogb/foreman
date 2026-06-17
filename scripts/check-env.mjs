// Config doctor: verifies the three required secrets are present and well-formed
// WITHOUT printing their values. Run: npm run doctor

function look(name, value) {
  if (!value) return { ok: false, note: "not set" };
  if (value.startsWith("op://")) return { ok: false, note: "still an op:// placeholder (run via `op run`, or paste the real value)" };
  const preview = `${value.slice(0, 6)}... (len ${value.length})`;
  return { value, preview };
}

const checks = [
  {
    name: "DATABASE_URL",
    test: (v) => v.startsWith("postgres"),
    expect: "should start with postgres:// (Neon pooled string)",
  },
  {
    name: "ANTHROPIC_API_KEY",
    // prefix built from parts so secret scanners don't false-positive on the literal
    test: (v) => v.startsWith(["sk", "ant", ""].join("-")),
    expect: "should be an Anthropic API key",
  },
  {
    name: "BRAVE_API_KEY",
    test: (v) => v.length > 10 && !/\s/.test(v),
    expect: "non-empty token, no whitespace",
  },
];

let allGood = true;
for (const c of checks) {
  const r = look(c.name, process.env[c.name]);
  if (!r.value) {
    allGood = false;
    console.log(`✗ ${c.name}: ${r.note}`);
    continue;
  }
  const shapeOk = c.test(r.value);
  if (!shapeOk) allGood = false;
  console.log(`${shapeOk ? "✓" : "✗"} ${c.name}: ${r.preview}${shapeOk ? "" : `  <- ${c.expect}`}`);
}

console.log(allGood ? "\nAll three look well-formed." : "\nFix the ✗ items in .env.local.");
process.exit(allGood ? 0 : 1);
