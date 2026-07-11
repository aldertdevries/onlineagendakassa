const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg} verwacht ${e}, kreeg ${a}`);
}

export function assertTrue(value, msg = '') {
  if (!value) throw new Error(`${msg} verwacht true, kreeg ${JSON.stringify(value)}`);
}

export function runAll(log = console.log) {
  let passed = 0;
  const failures = [];
  for (const t of tests) {
    try {
      t.fn();
      passed++;
    } catch (err) {
      failures.push({ name: t.name, error: err.message });
    }
  }
  for (const f of failures) log(`FAIL ${f.name}: ${f.error}`);
  log(`${passed} geslaagd, ${failures.length} gefaald`);
  return { passed, failed: failures.length };
}
