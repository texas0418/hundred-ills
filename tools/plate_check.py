#!/usr/bin/env python3
"""
Measures a generated plate against the rules in docs/PROMPTS.txt.

Written because "does this look right" is not a decision procedure when
there are ~150 plates and drift is invisible one image at a time.

    python3 tools/plate_check.py <plate> [more plates...]

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
from plate_metrics import load, measure  # noqa: E402


def check(path, living):
    m = measure(load(path))
    fails = []
    if m["bare paper 留白"] < 25:
        fails.append(f"留白 {m['bare paper 留白']:.1f}% - under the 25% floor, "
                     "this is painted too close to the edges")
    if m["reserved red"] > 6:
        fails.append(f"red {m['reserved red']:.2f}% - over the 6% cap, "
                     "red is a sliver and is being saved for the ending")
    if m["saturation"] > 0.30:
        fails.append(f"saturation {m['saturation']:.3f} - over 0.30, the palette "
                     "is supposed to be drained")
    floor = 12.0 if living else 8.0
    if m["drain (painted)"] < floor:
        fails.append(f"drain {m['drain (painted)']:.2f} - under {floor:.0f}, there is "
                     "not enough colour in the painted area to lose, so the fires "
                     "will be hard to see")

    print(f"\n{path}")
    for k, v in m.items():
        print(f"  {k:18s} {v:7.2f}" if isinstance(v, float) else f"  {k:18s} {v}")
    if fails:
        print("  REJECT")
        for f in fails:
            print(f"    - {f}")
    else:
        print("  PASS")
    return not fails


def main():
    args = sys.argv[1:]
    living = "--living" in args
    paths = [a for a in args if not a.startswith("--")]
    ok = all([check(p, living) for p in paths])
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
