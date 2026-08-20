Two failures kept deliberately, downscaled to reference size. The
numbers are in ../README.txt; these are here because seeing the failure
is faster than reading about it.

living-key-armada.jpg
  Plate [01], attempt 1. The prompt said "a flat wooden boat moored
  below" and got roughly fifty of them, lantern-lit, filling the
  midground. Nothing was wrong with the model - the prompt had never
  said the night was deserted, and a singular noun is not an
  instruction. drain 8.15.

  THE LESSON: state quantities as numbers, and state absences out loud.
  "Exactly ONE small empty wooden boat and no other boats anywhere",
  "the lane is deserted, every other door shut, nobody outside".

far-plane-perspective.jpg
  Plate [02], attempt 1. Drawn in one-point perspective with the houses
  receding to a vanishing point on the right. Lovely, and unusable: a
  plane with a vanishing point cannot slide, because the vanishing
  point slides with it, and a plate that empties out on one side cannot
  repeat. seam mismatch 17.03 against a limit of 8, edge falloff 0.29
  where even is 1.0.

  Its PALETTE passed - 留白 74.6%, ink 4.4%, drain 7.2, all correct for
  a far plane. Only the geometry was wrong, which is exactly why the
  eye is not enough and plate_check has a --tile mode.

  THE LESSON: the style preamble had said "flat frontal composition, no
  camera perspective" from the beginning and it was ignored. A
  constraint that matters has to appear in the negative list AND in
  positive per-plate language, not just in the preamble.

near-plane-with-landmark.jpg
  Plate [04], attempt 1. A willow baked into one side of a strip that
  has to repeat every screen width, plus a red scrap on the kerb and
  colour wash in the mist.

  Prepped: ink 27.9% (fine), saturation 0.137 against a 0.05 ceiling,
  seam mismatch 18.53 against a limit of 8.

  The diagnosis is the useful part. Ink density across the width, in
  eighths: 102.7 96.3 93.8 87.9 78.5 81.2 88.8 89.5 - the KERB is
  almost perfectly even. The seam was not the strip's fault at all. One
  lump of ink on one side was doing all the damage.

  THE LESSON, and it changed the plate list: A TILING STRIP CANNOT
  CONTAIN A LANDMARK. Anything memorable in a plate that repeats every
  screen width will be seen to repeat. [04] is now a featureless kerb
  and the willow became [24], an overlay placed by hand here and there.
  That also needed a fourth prompt class - "overlay" - because a thing
  that hangs into frame from an edge cannot be centred with clear paper
  on all four sides the way a cut-out object is.

shigandang-as-scene.jpg
  Plate [17], one of two attempts. The other one - a stone alone on
  bare paper - was right. This one drew the stone inside a whole
  landscape: houses, willows, a red sunset, and perspective recession
  down a path. Every one of those is banned, and the object clause
  says "nothing else in the frame, no ground, no background".

  Worth keeping because it is the failure mode of a prompt that is
  ALREADY CORRECT. Two generations from the same text went opposite
  ways, so some of this is just variance and the answer is to generate
  a couple and check, not to keep rewording.

lamp-contaminated.jpg
  Plate [23], the lamp in her window. The prompt was correct and the
  lamp is there - and so are the two divination blocks from [22], the
  prompt generated immediately before it, floating over the window in
  full size.

  SUBJECT BLEED. The set instructions say to generate related plates in
  ONE session so they share a seed family and look like the same night.
  That is right for the three canal planes. It is a liability for a run
  of unrelated objects, where the previous subject can survive into the
  next image.

  THE LESSON: batch by set, not by convenience. Generate the things
  that must match together, and start a fresh session between unrelated
  objects.
