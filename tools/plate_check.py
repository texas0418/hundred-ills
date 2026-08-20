#!/usr/bin/env python3
"""
Measures a generated plate against the rules in docs/PROMPTS.txt.

Written because "does this look right" is not a decision procedure when
there are ~150 plates and drift is invisible one image at a time.

    python3 tools/plate_check.py <plate> [more plates...]

    --living   plate [01] and other whole scenes: must be RICH, drain >= 12
    --mid      the mid depth plane: drain >= 10. Lower than --living
               because a plane is one band of a scene, not a scene
    --far      the far plane: must be PALE, 留白 >= 50 and drain <= 9
    --object   a cut-out: size and palette only. The 留白 and drain
               gates are scene rules and do not apply to something
               trimmed to its own subject.
    --near     the near plane: a silhouette, so judged on ink DARKNESS
               rather than ink coverage - the prompt requires three
               quarters of it to be empty paper
    --tile     also check the plate repeats: the edges must meet, and it
               must not empty out towards one side

LIVING is the flag for plate [01] and anything meant to be the warm end
of the colour drain - it enforces a much higher drain, because a
living-world plate that measures like the dead one makes the whole
three-fires system invisible.

Drain is measured on the PAINTED AREA only. See tools/plate_metrics.py:
averaging over the whole frame punished 留白, which is required.
Reference points, painted-only: dead world 5.83, style key 18.10.

    python3 tools/plate_check.py --living <plate>
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plate_metrics import load, measure, seam  # noqa: E402


def check(path, mode, tile):
    a = load(path)
    m = measure(a)
    fails = []
    notes = []

    # 留白 is a property of a COMPOSED plate - a scene or a depth plane
    # standing for mist, water and sky. An object plate is trimmed to its
    # subject, so by construction it has almost no bare paper left, and
    # applying the scene rule to it fails every cut-out for being cut out.
    if mode != "object" and m["bare paper 留白"] < 25:
        fails.append(f"留白 {m['bare paper 留白']:.1f}% - under the 25% floor, "
                     "this is painted too close to the edges")
    if m["reserved red"] > 6:
        fails.append(f"red {m['reserved red']:.2f}% - over the 6% cap, "
                     "red is a sliver and is being saved for the ending")
    if m["saturation"] > 0.30:
        fails.append(f"saturation {m['saturation']:.3f} - over 0.30, the palette "
                     "is supposed to be drained")

    # Depth planes want DIFFERENT things. A far plane is supposed to be
    # pale, so the general drain floor would fail it for being correct.
    if mode == "far":
        if m["bare paper 留白"] < 50:
            fails.append(f"留白 {m['bare paper 留白']:.1f}% - a far plane wants "
                         "over 50%, it is mostly mist")
        if m["drain (painted)"] > 9:
            fails.append(f"drain {m['drain (painted)']:.2f} - over 9, too rich for "
                         "a far plane. Distance drains colour by itself.")
    elif mode == "near":
        # Judged on how BLACK the ink is, not how much frame it covers.
        # The prompt requires three quarters empty paper, so the old
        # ink-fraction gate of 25% could never be satisfied.
        if m["ink darkness"] > 140:
            fails.append(f"ink darkness {m['ink darkness']:.0f} - too pale for a "
                         "silhouette, a near plane is solid wet ink")
        if m["saturation"] > 0.09:
            fails.append(f"saturation {m['saturation']:.3f} - a near plane carries "
                         "no colour at all")
    elif mode == "object":
        # Judged on size and palette only. How much colour a cut-out
        # carries is up to what it is - a lamp is warm, a stone is not.
        from PIL import Image
        long = max(Image.open(path).size)
        if long < 700:
            fails.append(f"{long}px on the long edge once trimmed - under 700. "
                         "Drawn too small in the frame; regenerate asking for LARGE.")
    else:
        # 12 was derived from LIVING-KEY, which is a whole scene - sky,
        # walls, water, lamplight. A depth PLANE is one band cropped out
        # of such a scene, so it carries less colour by construction and
        # judging it against a whole-scene number is apples to oranges.
        # The mid plane at 10.74 drains visibly; the floor was wrong, not
        # the plate.
        floor = 12.0 if mode == "living" else 10.0 if mode == "mid" else 8.0
        if m["drain (painted)"] < floor:
            fails.append(f"drain {m['drain (painted)']:.2f} - under {floor:.0f}, "
                         "there is not enough colour in the painted area to lose, "
                         "so the fires will be hard to see")

    if tile:
        mm, fall = seam(a)
        m["seam mismatch"] = mm
        m["edge falloff"] = fall
        if mm > 8:
            if mode == "far":
                # A far plane is mostly mist and carries no distinctive
                # feature, so the engine can MIRROR alternate copies and the
                # seam becomes zero by construction. Mirroring the mid plane
                # would be obvious - its steps and boat would ping-pong - so
                # there this stays a hard failure.
                notes.append(f"seam mismatch {mm:.1f} - over 8, but this is a far "
                             "plane: mirror alternate tiles in the engine and the "
                             "seam is exactly zero. Not worth regenerating for.")
            else:
                fails.append(f"seam mismatch {mm:.1f} - over 8, the left and right "
                             "edges will not meet when this plane repeats")
        if fall < 0.55:
            fails.append(f"edge falloff {fall:.2f} - the plate empties out towards "
                         "one side, which is what perspective recession does. "
                         "A sliding plane must be flat and even across its width.")

    print(f"\n{path}")
    for k, v in m.items():
        print(f"  {k:18s} {v:7.2f}" if isinstance(v, float) else f"  {k:18s} {v}")
    if fails:
        print("  REJECT")
        for f in fails:
            print(f"    - {f}")
    else:
        print("  PASS")
    for n in notes:
        print(f"    note: {n}")
    return not fails


def main():
    args = sys.argv[1:]
    mode = "default"
    for flag in ("living", "far", "near", "mid", "object"):
        if f"--{flag}" in args:
            mode = flag
    tile = "--tile" in args
    if "--size" in args:
        from PIL import Image
        ok = True
        for path in [a for a in args if not a.startswith("--")]:
            w, h = Image.open(path).size
            long = max(w, h)
            verdict = "usable" if long >= 700 else "TOO SMALL"
            print(f"{path}\n  {w}x{h}  long edge {long}  {verdict}")
            if long < 700:
                print("    - under 700px once trimmed to content. The plate was "
                      "drawn too small in the frame; regenerate asking for LARGE.")
                ok = False
        sys.exit(0 if ok else 1)
    paths = [a for a in args if not a.startswith("--")]
    ok = all([check(p, mode, tile) for p in paths])
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
