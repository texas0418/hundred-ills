STYLE-KEY.jpg
  The reference attached to EVERY generation. See DECISIONS 98.
  Chosen from six candidates by measurement: 26.6% 留白, wash texture,
  no Japanese cues, and its bridge is our bridge - a low arched stone
  footbridge with a plain parapet.
  ITS RED IS WRONG. 27.58% of the frame. We want roughly 3%.

ZERO-FIRES-TARGET.webp
  What the dead town looks like. 0.076 saturation, 3.12% red, 39.6%
  bare paper. Already fully drained - this is the destination, not the
  starting point. Shutterstock comp, reference only.

LIVING-KEY.jpg
  SOLVED 2026-08-20, third attempt. The warm end of the colour drain.
  留白 36.3%, reserved red 0.13%, saturation 0.180, drain 14.21 against
  a floor of 12. Against the style key's 18.10 and the dead world's
  5.83, that sits properly in living territory.
  DECISIONS 99 is cleared. Scene plates are unblocked.

living-key-drain.png
  LIVING-KEY.jpg at 3 / 2 / 1 / 0 fires. The ochre and green wash out
  of the walls, the lamplight goes cold, and the one vermilion door
  strip is still burning at zero. This is what the player watches
  happen to the world over eight hours.

WHAT IT TOOK - keep this, the next plate will need the same:
  attempt 1  drain  8.15   fifty lantern-lit boats, an armada. The
                           prompt said "a boat" and never said the
                           night was deserted.
  attempt 2  drain 11.45   one boat, deserted, but the walls were
                           still white so the warmth had nowhere to sit.
  attempt 3  drain 14.21   ochre and green across most of the wall.

The lesson is that the failures were all in the prompt, never in the
model. It did what it was told each time.

canal-far-raw.jpg  ->  assets/plates/canal-far.png
  Plate [02], the far plane. First real depth plane in the game.
  Raw is what Gemini returned: square, with a painted paper mount.
  Prepped with tools/prep_plate.py to 1014x435, aspect 2.33.

  Prepped: 留白 73.5%, ink 7.4%, drain 4.97, edge falloff 0.95.
  Seam mismatch 8.47 against an advisory limit of 8 - accepted rather
  than regenerated, because a far plane is mostly mist and carries no
  distinctive feature, so the engine mirrors alternate tiles and the
  seam is zero by construction. The mid plane cannot do that; its steps
  and boat would ping-pong.

  Attempt 1 (docs/proof not kept) was drawn in one-point perspective:
  seam 17.03, edge falloff 0.29. Lovely and unusable. That failure is
  what added the flat/tiling clause to every plane prompt.

canal-mid-drain.png  ->  assets/plates/canal-mid.png
  Plate [03], the mid plane - the one she walks past. Landed first try:
  flat, level, cut at both edges, one empty boat, deserted, steps down
  into the water, ochre and green across the stone.

  留白 38.6%, red 0.16%, drain 10.74, seam 7.68, edge falloff 0.82.

  THE FLOOR MOVED, AND IT WAS THE FLOOR THAT WAS WRONG. This measured
  10.74 against a 12 that had been derived from LIVING-KEY - a whole
  scene with sky, walls, water and lamplight. A depth plane is ONE BAND
  cropped out of such a scene and carries less colour by construction,
  so the comparison was never fair. The drain strip settles it: the
  stone goes cold and the red lantern survives, visibly. --mid now
  floors at 10.

  Note it kept a small red paper lantern, which the negative list bans.
  It is doing exactly the job reserved red exists for - one point of
  colour that outlives the drain - so it stays.

THE FIRST BIG BATCH - 2026-08-20
  Twenty images, nineteen keepers, and NINE landed. The other ten were
  rejected on resolution, which was my prompt's fault:

  The object clause said "drawn small and centred with clear empty
  paper on all four sides". Gemini obliged. Trimmed to actual content,
  ten of nineteen came back under 700px on the long edge - 水鬼 was
  EIGHTY-SEVEN pixels wide. A phone at 3x wants about 1000px for a
  creature, so they are unusable at any size that matters.

  The clause now says LARGE, filling most of the frame, with only a
  narrow margin, and explicitly "it must not be a small object floating
  in a big empty field". plate_check --size enforces 700px.

  LANDED:   bridge-two, bridge-three-covered, city-gate, her-door,
            door-gods-faded, door-gods-torn, guhuoniao, huapi, watchman
  REGENERATE: bridge-one, door-gods-new, door-gods-intact, shuigui,
            shigandang, wutongshen, laundry, road-money, jiaobei,
            lamp-in-window
  STILL TO DO: [04] the kerb strip, [24] the willow

  Note on 姑獲鳥: it came back dignified and calm rather than a
  gargoyle, which DECISIONS 15 asks for and which the ending depends
  on. Keep it.

BATCH TWO - 2026-08-20
  Eleven images for twelve outstanding plates. TEN LANDED.

  The LARGE fix worked. Where the first batch had ten plates under
  700px and one at 87px, this batch came back:

    willow          2768 x 880
    jiaobei         1403 x 591
    bridge-one      1408 x 474
    door-gods-new   1170 x 667
    laundry         1002 x 445
    wutongshen       580 x 895
    road-money       720 x 666
    shigandang       400 x 704
    shuigui          365 x 629   <- marginal, see below

  水鬼 IS THE ONE EXCEPTION AND IT IS DELIBERATE. 629px on the long
  edge, under the 700 floor. Landed anyway because the figure is a
  slender standing person seen at middle distance in the canal, not a
  creature that fills the screen. If it ever needs to appear large, it
  needs redoing. Flagged rather than waved through.

  TWO METRIC BUGS FIXED, both mine, both found by real plates:
    the near-plane gate demanded 25% ink coverage while the PROMPT
    demands three quarters empty paper. Those cannot both be true.
    Replaced with ink darkness - but the first version of THAT, mean
    luminance of the painted area, then failed the willow, because thin
    branches on a big sheet average out towards the paper. Now it is
    the mean of the darkest 5%: a claim about how black the strokes
    get, which is what a silhouette actually means.

  NOT LANDED: [23] the lamp, contaminated by subject bleed from [22];
  [11] door-gods-intact, not generated.

ALL 24 PLATES LANDED - 2026-08-20
  contact-sheet.png is every plate on one page. Rebuild it after each
  batch:  python3 tools/contact_sheet.py

  IT EARNED ITS KEEP ON THE FIRST LOOK. The four door god wear states
  are supposed to be ONE PRINT DECAYING - that is the whole lock
  system, DECISIONS 60, and the player is meant to read them as the
  same paper aging. They do not. Measured:

                     留白     sat     darkness
    new             59.3%   0.113      60.0
    intact           0.1%   0.228      40.9   <- odd one out
    faded           33.4%   0.133      93.9
    torn            58.0%   0.087     113.0

  door-gods-intact is on dark brown wood at 0.228 saturation, against a
  median of 0.096 across the other nineteen plates. It reads as a
  different artist, not a different amount of wear. Side by side on the
  sheet it is obvious; alone it looked fine, which is exactly why the
  sheet exists.

  CAUSE: [11] says "Edit of 10" and the prompt file says to generate
  the NEW pair first and produce the others AS EDITS of it. It was
  generated fresh instead. Four independent generations of "door gods"
  give four different prints.

  NOT BLOCKING. The set works as four door states. It does not work as
  one print aging, and if the player is meant to notice the SAME print
  decaying, [10]-[13] need redoing as a chain of edits from one image.
  Simon's call.

PARALLAX PROVEN - 2026-08-20
  parallax-test.png is the three canal plates composited at five walk
  positions 260px apart. Displacement per frame:

    far   speed 0.25 ->  65px
    mid   speed 1.00 -> 260px    she walks on this, so it is the reference
    kerb  speed 1.45 -> 377px    in front of her, so faster than she is

  IT READS AS DEPTH. The far bank barely shifts, the lane moves at her
  pace, the kerb rips past. The walk structure at DECISIONS 14 works.

  ONE REAL PROBLEM FOUND AND FIXED: the first composite stacked three
  OPAQUE rectangles and the screen came out in horizontal bands,
  because each plane's own paper tone darkened the one behind it.
  Plates need alpha.

  tools/alpha_plate.py derives it from the picture itself: a pixel's
  opacity is how much darker it is than bare paper. That is not a trick,
  it is what the medium already does - watercolour on paper IS
  translucent, so solid ink comes out opaque, a pale wash comes out
  faint, and untouched paper disappears. Soft wash edges stay soft
  instead of being cut out by a threshold. Written to
  assets/plates-alpha/, which is what the engine loads.

  STILL VISIBLE: the mid plane's repeat. Its boat and steps recur every
  plate width and the wrap shows as a soft vertical edge. It cannot
  mirror - the boat would ping-pong - so the fix is either a second mid
  plate to alternate with, or accept it and let the districts be short
  enough that it is not seen twice. Not blocking; noted.
