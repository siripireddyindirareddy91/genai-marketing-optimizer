import test from "node:test";
import assert from "node:assert/strict";
import {
  seed,
  metrics,
  kmeans,
  conversionScore,
  abResult,
  recommendations,
} from "../lib/domain";
test("demo dataset meets requested volume and uses reserved email domain", () => {
  const s = seed();
  assert.equal(s.customers.length, 120);
  assert.equal(s.products.length, 20);
  assert.equal(s.campaigns.length, 12);
  assert.ok(s.customers.every((c) => c.email.endsWith("@example.com")));
  assert.ok(s.customers.some((c) => !c.consent));
});
test("metrics handle empty campaigns and aggregate actual values", () => {
  assert.equal(metrics([]).cvr, 0);
  const c = seed().campaigns[0];
  const m = metrics([c]);
  assert.equal(m.revenue, c.revenue);
  assert.equal(m.cvr, (c.conversions / c.clicks) * 100);
});
test("KMeans preserves customer identity and partitions current data", () => {
  const cs = seed().customers;
  const result = kmeans(cs);
  assert.equal(result.length, cs.length);
  assert.deepEqual(
    result.map((c) => c.id),
    cs.map((c) => c.id),
  );
  assert.ok(new Set(result.map((c) => c.segment)).size > 1);
  assert.deepEqual(kmeans([]), []);
  assert.equal(kmeans(cs.slice(0, 1))[0].segment, "Cluster 1");
});
test("conversion heuristic is bounded and responds to recency", () => {
  const c = seed().customers[0];
  assert.ok(conversionScore(c) > 0 && conversionScore(c) < 1);
  assert.ok(
    conversionScore({ ...c, recency: 0 }) >
      conversionScore({ ...c, recency: 180 }),
  );
});
test("AB test refuses conclusions on small samples and invalid data", () => {
  const t = seed().tests[0];
  assert.equal(
    abResult({ ...t, visitorsA: 10, conversionsA: 1 }).sufficient,
    false,
  );
  assert.equal(abResult({ ...t, visitorsA: 0 }).significant, false);
  assert.equal(abResult({ ...t, conversionsA: 2000 }).winner, "Invalid counts");
  assert.equal(
    abResult({
      ...t,
      visitorsA: 1000,
      visitorsB: 1000,
      conversionsA: 100,
      conversionsB: 200,
    }).winner,
    "Variation B",
  );
});
test("recommendations derive from existing records", () => {
  const s = seed();
  const r = recommendations({ ...s, customers: [] });
  assert.match(r[0].detail, /0 opted-in/);
  assert.equal(r.length, 3);
});
