#!/usr/bin/env python3
"""
Generates docs/PROMPTS.txt with every prompt written out IN FULL.

docs/PROMPTS.txt rule 1 says the style preamble must be byte-identical
across every generation, because that is where consistency across ~150
plates actually comes from. Hand-maintaining 23 copies of it guarantees
drift, so the file is generated and this script is the source.

    python3 tools/build_prompts.py

Edit PREAMBLE, NEGATIVE or PLATES here, never docs/PROMPTS.txt directly.
"""
import textwrap

PREAMBLE = (
    "Chinese ink and colour painting on xuan paper, 水墨設色, in the manner "
    "of a late Qing Jiangnan water town. Brush and wash: soft graded ink, "
    "wet blooming edges, visible brush direction, the paper showing through. "
    "Large areas of the paper left completely unpainted to stand for mist, "
    "water and sky. Muted and drained palette - ink black, warm grey, pale "
    "ochre, washed-out green. One small area of vermilion red and no other "
    "saturated colour. Flat frontal composition, no camera perspective, no "
    "photographic realism. Quiet, plain, unspectacular."
)

NEGATIVE = (
    "Negative: Japanese, ukiyo-e, vermilion lacquer bridge, torii, gold leaf, "
    "stone lantern, pagoda, cherry blossom, koi, zen garden, raked gravel, "
    "mountains, karst peaks, cliffs, airbrush, digital painting, concept art, "
    "3D render, anime, oversaturated, neon, HDR, glow, bloom, lens flare, "
    "photorealistic, perspective, vanishing point, receding row, diagonal recession, foreshortening, three-quarter view, converging lines, "
    "painted to the edges, no white space, busy, ornate, "
    "dragons, red paper lanterns everywhere, large mass of red foliage, red "
    "canopy, fleet of boats, many boats, crowded boats, harbour, festival, "
    "market, market stalls, string lights, bunting, crowd, text, characters, "
    "calligraphy, inscription, seal, signature, watermark, frame, border."
)

# Constraints that apply to a WHOLE CLASS of plate, appended automatically
# so they cannot drift between prompts. Hard-won:
#
#   perspective   the first far plane came back in one-point perspective
#                 with the houses receding to a vanishing point. A plane
#                 with a vanishing point cannot slide, and a plate that
#                 empties out on one side cannot repeat.
#   margin        objects get composited, and a shape touching the frame
#                 edge cannot be cut out cleanly.
#   tiling        the three canal planes repeat as she walks.
KIND_CLAUSE = {
    "plane": (
        " Seen straight on from directly across the water, as flat as a stage "
        "backdrop, with no perspective and no vanishing point, everything at "
        "the same distance. Cut off at both the left and right edges at the "
        "same height so the image could be repeated end to end without a join "
        "showing. Isolated on bare paper."
    ),
    "scene": (
        " Seen straight on and flat, with no perspective and no vanishing "
        "point. Isolated on bare paper."
    ),
    "object": (
        " Drawn small and centred with clear empty paper on all four sides so "
        "it can be cut out, touching none of the edges. Seen flat and straight "
        "on with no perspective. Nothing else in the frame, no ground, no "
        "background. Isolated on bare paper."
    ),
}

# (id, title, kind, note shown above the block, body)
PLATES = [
    ("01", "THE LIVING-WORLD KEY",
     "scene",
     "GENERATE THIS FIRST. Nothing else until it is right. Every reference\n"
     "we have is already the dead world; this sets the warm end that the\n"
     "colour drains FROM. See DECISIONS 99.",
     "A row of whitewashed water town houses at night above a narrow stone "
     "embankment with a flagged lane running along the canal in front of "
     "them, black tile roofs. Strong warm lamplight "
     "burning in five or six windows, and the walls washed with warm ochre "
     "and pale green across most of their surface so the whole row reads "
     "warm and lived in, not white. Exactly ONE "
     "small empty wooden boat moored below and no other boats anywhere. The "
     "lower third is calm water holding the reflection of the lit windows. "
     "The top third is bare unpainted paper for mist. One small scrap of "
     "vermilion on a door. The lane is deserted, every other door shut, "
     "nobody outside."),

    ("02", "CANAL BANK - FAR PLANE",
     "plane",
     "Aspect 21:9. ATTACH BOTH STYLE-KEY.jpg AND LIVING-KEY.jpg - 02, 03 and\n"
     "04 must look like the same town on the same night, and the key is now\n"
     "what that town looks like. Generate all three in ONE session.\n"
     "\n"
     "This is the PALEST of the three. Depth in this medium comes from\n"
     "atmospheric perspective, not from scale tricks: far is washed out and\n"
     "mostly mist, near is almost solid ink. Target: 留白 above 50%, ink\n"
     "below 5%, drain under 8. A far plane SHOULD fail the living gate.",
     "A long low row of whitewashed water town houses with black tile roofs, "
     "seen straight on from directly across the water, as flat as a stage "
     "backdrop. Every house is the same size and stands at the same "
     "distance - none larger, none smaller, no row running away into the "
     "distance. The roofline is level all the way across. Small square "
     "windows, two of them faintly lit. Very pale and washed out, the ink "
     "used only for the roof lines, the walls barely tinted with the "
     "faintest ochre. The top two thirds is bare unpainted paper. No boat, "
     "no lane, no embankment, no figures. The row fills the full width and "
     "is cut through the middle of a house at both edges."),

    ("03", "CANAL BANK - MID PLANE",
     "plane",
     "Aspect 21:9. This is the plane she walks on, so it carries the colour.\n"
     "Match LIVING-KEY.jpg for warmth - target drain 12 or better, 留白\n"
     "around 30%. Run plate_check with --living on this one.",
     "A narrow stone embankment running the full width of the image with a "
     "flagged lane along the top of it, the lane level all the way across. "
     "Worn steps "
     "descending into the water at two points, plain mooring posts. Exactly "
     "ONE small empty wooden boat tied up and no other boats anywhere. The "
     "stone washed with warm ochre and pale green across most of its "
     "surface so it reads warm and lived in, not white. Deserted, nobody "
     "outside. "),

    ("04", "CANAL BANK - NEAR PLANE",
     "plane",
     "Aspect 21:9. The DARKEST of the three and the only one with no colour\n"
     "at all. It sits closest to the player, so it reads as shape rather\n"
     "than as detail. Target: ink above 25%, saturation under 0.05.\n"
     "It occupies only the bottom band - most of the plate is empty so the\n"
     "planes behind it show through.",
     "A few bare winter willow branches and a low stone kerb along the very "
     "bottom edge, as near-black silhouette shapes in solid wet ink, no "
     "colour anywhere, no detail inside the shapes. The branches hang down "
     "from the top edge at one side only. The upper three quarters of the "
     "image is completely empty bare paper."),

    ("05", "BRIDGE ONE",
     "object", "Generate 05, 06 and 07 in one session, same seed family.",
     "A modest low single arch stone footbridge, worn and plain and "
     "unornamented, seen from the side, its reflection in still water below. "),

    ("06", "BRIDGE TWO",
     "object", "",
     "A taller humpbacked stone arch bridge with stepped sides and a plain "
     "stone post at each end, seen from the side, reflected in still water. "),

    ("07", "BRIDGE THREE - THE COVERED BRIDGE",
     "object",
     "Where she sees her body. It must be the only bridge in the game you\n"
     "cannot see through.",
     "A long covered bridge with a low tiled roof over its walkway, dark and "
     "enclosed, the far end lost in mist and not visible, seen from the side. "),

    ("08", "THE CITY GATE",
     "scene", "The 摸釘 site. First five minutes of the game.",
     "A heavy closed wooden city gate with rows of large round bronze studs in "
     "a grid across it, framed by plain stone, seen straight on. No "
     "inscription, no plaque."),

    ("09", "HER DOOR",
     "scene", "The last image in the game. The wards on it hold.",
     "A plain wooden double door in a whitewashed wall at night, closed, a "
     "paper door god print freshly pasted on each leaf, crisp and new and "
     "uncreased. Warm lamplight falling from a small window beside it. One "
     "scrap of vermilion."),

    ("10", "DOOR GODS - NEW",
     "object",
     "The lock system, DECISIONS 60. Generate this one FIRST, then make 11,\n"
     "12 and 13 as edits of it so it is recognisably one print decaying.\n"
     "This is the pair on her own door and the only perfect one in the game.",
     "A pair of Chinese door god warrior figures printed on paper and pasted "
     "on a wooden door, one facing left and one facing right, armoured, stern, "
     "symmetrical, seen straight on, freshly pasted, crisp and bright and "
     "uncreased. No text anywhere."),

    ("11", "DOOR GODS - INTACT",
     "object", "Edit of 10.",
     "A pair of Chinese door god warrior figures printed on paper and pasted "
     "on a wooden door, one facing left and one facing right, armoured, stern, "
     "symmetrical, seen straight on, pasted up some time ago, slightly dulled "
     "but whole. No text anywhere."),

    ("12", "DOOR GODS - FADED",
     "object", "Edit of 10. Her way in.",
     "A pair of Chinese door god warrior figures printed on paper and pasted "
     "on a wooden door, one facing left and one facing right, armoured, stern, "
     "symmetrical, seen straight on, sun bleached and washed pale, colours "
     "weak, edges lifting from the wood. No text anywhere."),

    ("13", "DOOR GODS - TORN",
     "object", "Edit of 10.",
     "A pair of Chinese door god warrior figures printed on paper and pasted "
     "on a wooden door, torn and hanging in strips, most of the print missing, "
     "only fragments still stuck to the wood. No text anywhere."),

    ("14", "水鬼 - THE DROWNED",
     "object",
     "Cannot leave the water until it finds a substitute. Its whole existence\n"
     "is one obligation aimed at the player.",
     "A human figure standing waist deep in still water seen from the front, "
     "wet hair hanging flat over the face, arms at its sides, completely "
     "motionless, brushed in wet ink. Not gory."),

    ("15", "姑獲鳥 - THE NIGHT BIRD WOMAN",
     "object",
     "This one is her. Keep it dignified - the ending is ruined if the player\n"
     "spent eight hours looking at a gargoyle.",
     "A large bird with a woman's face and long hair, wings spread, seen "
     "frontally and symmetrically like an emblem, calm expression, not "
     "snarling. Brushed in ink."),

    ("16", "畫皮 - THE PAINTED SKIN",
     "object", "",
     "An empty human skin held up flat and spread like a garment on a line, a "
     "face painted on it, hollow and limp. Stylised and flat, not bloody. "),

    ("17", "石敢當 - THE STONE",
     "object", "A locked door with three thousand years of documentation.",
     "A short upright weathered stone slab set into the ground at the end of a "
     "lane, plain and blank with no inscription, leaning slightly."),

    ("18", "五通神 - THE LOCAL GOD",
     "object", "The god you bargain with, who is not good.",
     "A small seated enshrined folk deity figure, robed, frontal and "
     "symmetrical, with an expression that is pleasant but not kind. A crude "
     "village shrine idol. No text."),

    ("19", "打更人 - THE NIGHTWATCHMAN",
     "object",
     "He must never look sinister. He is a cold man doing a tedious job, and\n"
     "the moment he reads as an omen he stops working. DECISIONS 89.",
     "An old man in a padded winter coat walking alone at night carrying a "
     "small paper lantern and a bamboo clapper, seen from the side, ordinary "
     "and tired, not sinister."),

    ("20", "LAUNDRY ON A LINE",
     "object",
     "姑獲鳥 marks children by touching clothing left out overnight. The\n"
     "player must handle this at their own initiative. DECISIONS 79.",
     "Small children's clothes hanging still on a pole over water, seen flat "
     "from the front."),

    ("21", "買路錢 - ROAD MONEY",
     "object", "Scattered to clear a route for the dead. It is hers.",
     "Round paper spirit money coins scattered loose on wet flagstones seen "
     "from above. No text or markings on the coins."),

    ("22", "擲筊 - THE DIVINATION BLOCKS",
     "object", "The game's only way to ask a question.",
     "Two small crescent shaped wooden blocks, one flat face and one curved "
     "face each, lying on stone."),

    ("23", "THE LAMP IN HER WINDOW",
     "object",
     "Visible from the first watch onward, in every scene it could plausibly\n"
     "appear in, and NEVER remarked on by anyone. If it is mentioned once,\n"
     "the ending is spoiled.",
     "A small oil lamp burning behind a paper window at night, seen from "
     "outside, warm. Nothing else in frame."),
]

W = 68
RULE = "-" * 62


def wrap(t):
    return "\n".join(textwrap.wrap(t, W))


def block(pid, title, kind, note, body):
    out = [f"[{pid}] {title}"]
    if note:
        out += ["      " + ln for ln in note.split("\n")]
    out += [
        "",
        f"{RULE}  copy from here",
        wrap(PREAMBLE),
        "",
        wrap(body.rstrip() + KIND_CLAUSE[kind]),
        "",
        wrap(NEGATIVE),
        f"{RULE}  to here",
        "", "",
    ]
    return "\n".join(out)


HEAD = """HUNDRED ILLS - IMAGE PROMPTS
Rewritten 2026-08-19 for the INK medium. The woodblock version is dead;
see DECISIONS 58.

GENERATED FILE. Edit tools/build_prompts.py and re-run it, never this
file directly - the style preamble has to stay byte-identical across all
23 prompts and hand-editing guarantees drift.

EVERY PROMPT BELOW IS COMPLETE. Copy one block between its rules and
paste it. Nothing needs assembling.


=============================================================
BEFORE YOU START
=============================================================

1. ATTACH THE STYLE REFERENCE to every single generation:
   docs/proof/STYLE-KEY.jpg. Chosen from six candidates by measurement -
   26.6% bare paper, wash texture, no Japanese cues, and its bridge is
   our bridge. ITS RED IS WRONG: 27.58% of the frame where we want
   about 3%. Use it for touch and palette, never for how much red.

2. 留白 IS NOT OPTIONAL. At least a quarter of every plate is bare
   paper standing for mist, water and sky. This is the one measurable
   thing separating a Chinese painting from a generic "oriental"
   render - two candidate references were rejected purely for having
   0.8% and 3.9% white. Painted to all four edges is a reject however
   pretty it is.

3. RED IS A SLIVER, NOT A MASS. One small area of vermilion and no
   other saturated colour anywhere. A door couplet, a scrap of cloth,
   one lantern. Never a canopy of red maple. Red is being saved for the
   last twenty minutes of the game and it does not work if the player
   has been soaking in it for eight hours.

4. NOT JAPAN. The most damaging drift available. No vermilion lacquer
   bridges, no torii, no gold leaf, no stone lanterns, no pagodas, no
   cherry blossom, no koi, no raked gravel. One Japanese cue in a
   reference propagates into every plate after it.

5. NO TEXT, EVER. No characters, no couplets, no seals, no signature.
   Models produce garbage characters and a nonsense inscription would
   destroy this game's central claim. All type is set live in the app.

6. ONE ELEMENT PER PLATE, on bare paper. A scene is assembled in the
   engine from three to five separately generated planes. Do not ask
   for a finished composed scene.


=============================================================
WHAT JIANGNAN ACTUALLY LOOKS LIKE - read once before starting
=============================================================

Every reference we looked at was a garden, a temple or a mountain
beauty spot. Ours is none of those. It is a WORKING TOWN.

  whitewashed walls going straight down into the canal, no bank
  black tile roofs, low, close together, sagging
  stone steps descending into the water at intervals
  flat wooden boats moored and empty
  low arched stone footbridges, plain, worn, unornamented
  willows, bare in the first lunar month
  laundry on poles over the water
  narrow lanes between houses, stone flagged, wet
  NO MOUNTAINS. Jiangnan is flat. The horizon is roofs and mist.

Get a photograph of Zhouzhuang, Wuzhen or Tongli in front of you before
you start, or the architecture will drift scenic.


=============================================================
THE PROMPTS
=============================================================

"""

TAIL = """=============================================================
QA - reject a plate if ANY of these are true
=============================================================

  Less than a quarter of it is bare unpainted paper.
  It is painted to all four edges.
  Red covers more than a small area.
  There is any saturated colour other than that red.
  There is a mountain in it.
  Anything about it reads Japanese.
  There is text, a character, a seal or a signature.
  It looks rendered, airbrushed or 3D rather than brushed.
  It is a composed scene rather than one isolated element.
  It looks like a beauty spot rather than a place people live.

The last two are the ones you will be tempted to let through.

=============================================================
THE THREE CANAL PLANES ARE A SET
=============================================================

02, 03 and 04 stack on top of each other and slide at different speeds
to make the walk. They are the first real test of whether separately
generated plates will parallax, so treat them as one job:

  Generate all three in ONE session, same seed family.
  Attach BOTH STYLE-KEY.jpg and LIVING-KEY.jpg to each.
  SET 21:9 IN GEMINI'S ASPECT CONTROL. Asking for it in the prompt does
  not work - the first far-plane attempt came back square.
  Keep the horizon at the same height in 02 and 03 or they will not sit
  together. If they disagree, regenerate rather than trying to fix it
  in the engine.

DEPTH COMES FROM ATMOSPHERE, NOT SCALE. In this medium the far plane is
pale and mostly mist and the near plane is almost solid ink. Expected
numbers, and they are deliberately different from each other:

              留白      ink       drain      note
  02 far     >50%      <5%       <8         pale, should FAIL --living
  03 mid     ~30%      ~8%       >12        run it WITH --living
  04 near    low       >25%      <2         near-black, no colour

A far plane that measures like the mid plane will flatten the walk.


=============================================================
CHECK EVERY PLATE BEFORE YOU KEEP IT
=============================================================

    python3 tools/plate_check.py <plate>
    python3 tools/plate_check.py --living <plate>     for [01]

It measures what the eye cannot judge one image at a time:

    留白            at least 25%
    reserved red    6% hard cap, aim for about 3
    saturation      0.30 hard cap
    drain distance  at least 6, and at least 10 for [01]

DRAIN DISTANCE is the one that will bite. It is how far the plate
travels when the colour is pulled out of it, which is exactly how
visible the three fires are on it. A beautiful plate with a drain of 5
is already the dead world and the player will never see the fires go
out on it.

For reference: the style key measures 14.93, the dead-world target
measures 3.97.

    python3 tools/inkstate_test.py <plate>

renders 3 / 2 / 1 / 0 fires so you can look at the journey yourself.
"""


def main():
    body = "".join(block(*p) for p in PLATES)
    open("docs/PROMPTS.txt", "w", encoding="utf-8").write(HEAD + body + TAIL)
    print(f"docs/PROMPTS.txt written: {len(PLATES)} complete prompts")


if __name__ == "__main__":
    main()
