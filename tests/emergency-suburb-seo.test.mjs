import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const locations = {
  'byron-bay': 'Byron Bay',
  'brunswick-heads': 'Brunswick Heads',
  'mullumbimby': 'Mullumbimby',
  'ocean-shores': 'Ocean Shores',
  bangalow: 'Bangalow',
  'lennox-head': 'Lennox Head',
  ballina: 'Ballina',
};
const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
for (const [slug, suburb] of Object.entries(locations)) {
  test('emergency SEO in ' + suburb, () => {
    const page = read('areas/electrician-' + slug + '/index.html');
    const canonical = 'https://www.berrymanelectrical.com.au/areas/electrician-' + slug + '/';
    assert.ok(page.includes('rel="canonical"') && page.includes(canonical), 'missing canonical');
    assert.ok(page.includes('<title>Electrician ' + suburb), 'missing original suburb page title');
    assert.ok(page.includes('Emergency electrician ' + suburb), 'missing emergency suburb heading');
    assert.ok(page.includes('tel:+61424157002'), 'missing click-to-call link');
    assert.ok(page.includes('services/fault-finding-electrical-repairs/'), 'missing related service link');
    assert.equal((page.match(/<h1\b/g) || []).length, 1, 'requires exactly one H1');
    assert.equal((page.match(/<main\b/g) || []).length, 1, 'requires exactly one main element');
    assert.equal((page.match(/<\/main>/g) || []).length, 1, 'requires closing main element');
    assert.ok(!page.includes('guaranteed 15 minute response'), 'no unverified arrival claim');
  });
}
test('services index links to all seven suburb pages', () => {
  const page = read('services/index.html');
  for (const slug of Object.keys(locations)) {
    assert.ok(page.includes('../areas/electrician-' + slug + '/'), 'missing ' + slug);
  }
  assert.ok(page.includes('https://emergencyelectricianbyronbay.com.au/'), 'separate emergency website remains linked');
});