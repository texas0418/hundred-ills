"""
Shared measurement for HUNDRED ILLS plates.

Lives here because plate_check.py and inkstate_test.py both need the
vermilion mask, and two copies of it drifted apart once already - the
first version caught warm lamplight and the drain test left every window
in the town still glowing at zero fires.
"""
import numpy as np
from PIL import Image

# Vermilion is separated from lamplight by GREEN, not by red.
#
# Measured on a real plate:
#   lamplight / ochre wash   rgb(204,161,100)   g/r = 0.79
#   vermilion door strip     rgb(130, 57,   8)  g/r = 0.44
#
# 0.60 sits in the gap. Above it is the warm living world, which MUST
# drain; below it is the reserved red, which never does.
GREEN_OVER_RED = 0.60


def load(path):
    return np.asarray(Image.open(path).convert("RGB")).astype(np.float32)


def luminance(a):
    return 0.299 * a[:, :, 0] + 0.587 * a[:, :, 1] + 0.114 * a[:, :, 2]


def vermilion_mask(a):
    """True vermilion only. Lamplight, ochre and warm grey are excluded."""
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    chroma = a.max(axis=2) - a.min(axis=2)
    return (
        (r > g * 1.18)
        & (r > b * 1.18)
        & (r > 70)
        & (chroma > 22)
        & (g < r * GREEN_OVER_RED)
    )


def measure(a):
    lum = luminance(a)
    r, b = a[:, :, 0], a[:, :, 2]
    mx, mn = a.max(axis=2), a.min(axis=2)
    grey = np.repeat(lum[..., None], 3, axis=2)
    dist = np.abs(a - grey).mean(axis=2)
    paper = lum > 225
    painted = ~paper

    # DRAIN IS MEASURED ON THE PAINTED AREA ONLY.
    #
    # The first version averaged over the whole frame, which quietly
    # punished 留白 - and 留白 is required at 25% minimum. Bare paper
    # cannot drain, so a plate that correctly leaves half the sheet
    # empty was being failed for doing the right thing. Measured:
    #
    #                     留白    whole-frame   painted-only
    #   dead-world       39.6%       3.97           5.83
    #   living plate     46.5%       8.52          11.45
    #   style key        26.6%      14.93          18.10
    #
    # Painted-only separates living from dead cleanly at every 留白
    # level. Whole-frame is kept for reference but nothing gates on it.
    return {
        "bare paper 留白": 100 * paper.mean(),
        "reserved red": 100 * vermilion_mask(a).mean(),
        "warm light": 100 * ((r > b * 1.15) & (lum > 140) & (mx - mn > 30)).mean(),
        "ink": 100 * (lum < 70).mean(),
        "saturation": float(np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0).mean()),
        # How black the plate GETS, as the mean of its darkest 5%.
        #
        # Two earlier attempts at this were both wrong. Ink FRACTION
        # failed the kerb, because the prompt requires three quarters of
        # a near plane to be empty paper. Mean luminance of the painted
        # area then failed the willow, because thin branches on a big
        # sheet drag the average up towards the paper. A silhouette is a
        # claim about how dark the darkest strokes are, so measure that.
        "ink darkness": float(np.percentile(lum, 5)),
        "drain (painted)": float(dist[painted].mean()) if painted.any() else 0.0,
        "drain (whole frame)": float(dist.mean()),
    }


def seam(a):
    """How badly the left edge disagrees with the right edge.

    A plane that slides has to repeat, so its two vertical edges must be
    continuous with each other. Returns (mismatch, falloff):

      mismatch  difference in mean luminance between the edge columns.
                Under about 8 it tiles without a visible seam.
      falloff   ratio of content density in the last quarter to the
                first. Near 1.0 is even; a plate that drifts to empty on
                one side - which is what perspective recession does -
                comes back far below 1.
    """
    lum = luminance(a)
    h, w = lum.shape
    k = max(2, w // 64)
    mismatch = abs(lum[:, :k].mean() - lum[:, -k:].mean())
    density = 255 - lum
    first = density[:, : w // 4].mean()
    last = density[:, -w // 4:].mean()
    return float(mismatch), float(last / first) if first > 0 else 0.0
