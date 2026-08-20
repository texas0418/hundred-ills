import { PLANES, tilesFor, planeRect, scaledWidth } from './src/engine/parallax';

let n = 0;
function ok(cond: boolean, msg: string) {
  n++;
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const far = PLANES[0], mid = PLANES[1], kerb = PLANES[2];

ok(far.speed < mid.speed, 'the far bank moves slower than the lane she walks on');
ok(kerb.speed > mid.speed, 'the kerb is in front of her, so it moves faster');
ok(mid.speed === 1.0, 'the lane is the reference');
ok(far.mirror && !mid.mirror, 'only the featureless far plane may mirror');
ok(far.top < mid.top && mid.top < kerb.top, 'planes stack far to near down the screen');

// Coverage: the viewport is always filled, at any walk position.
for (const w of [0, 137, 1000, -450, 99999]) {
  for (const p of PLANES) {
    const t = tilesFor(p, w, 400, 390);
    ok(t.length > 0, `tiles exist at walkX ${w} on ${p.id}`);
    ok(t[0].x <= 0, `first tile covers the left edge at ${w} on ${p.id}`);
    const last = t[t.length - 1];
    ok(last.x + 400 >= 390, `last tile covers the right edge at ${w} on ${p.id}`);
  }
}

// No gaps and no overlaps between neighbouring tiles.
const seq = tilesFor(mid, 733, 400, 390);
for (let i = 1; i < seq.length; i++) {
  ok(Math.abs(seq[i].x - (seq[i - 1].x + 400)) < 1e-9, 'tiles are flush');
  ok(seq[i].index === seq[i - 1].index + 1, 'indices run consecutively');
}

// Mirroring alternates, including to the LEFT of the origin where a
// naive % would return negative and break the parity.
const left = tilesFor(far, -2000, 400, 390);
for (let i = 1; i < left.length; i++) {
  ok(left[i].mirrored !== left[i - 1].mirrored, 'mirroring alternates left of origin');
}
ok(tilesFor(far, 0, 400, 390)[0].mirrored === false, 'tile 0 is unmirrored');

// Cost is constant however far she walks.
ok(tilesFor(mid, 0, 400, 390).length === tilesFor(mid, 5_000_000, 400, 390).length,
   'tile count does not grow with distance walked');

// Standing still means standing still.
ok(tilesFor(mid, 0, 400, 390)[0].x === tilesFor(mid, 0, 400, 390)[0].x, 'stable');
ok(tilesFor(far, 100, 400, 390)[0].x !== tilesFor(far, 200, 400, 390)[0].x, 'walking moves it');

// Geometry
const r = planeRect(mid, 844);
ok(Math.abs(r.y - 0.44 * 844) < 1e-9, 'plane y is a fraction of screen height');
ok(Math.abs(scaledWidth(mid, 1024, 439, 844) - (0.24 * 844 * 1024) / 439) < 1e-9,
   'plates scale to their band, aspect preserved');

ok(tilesFor(mid, 0, 0, 390).length === 0, 'a zero-width plate yields no tiles');

console.log(`test-parallax: ${n} assertions passed`);
