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
#   size          "drawn small and centred" was the first wording and it
#                 cost a whole batch: 10 of 19 came back under 700px on
#                 the long edge once trimmed to content, one of them 87px.
#                 A phone at 3x needs about 1000px for a creature. Ask
#                 for LARGE with a narrow margin, never "small".
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
        " Drawn LARGE, filling most of the frame, with only a narrow margin of "
        "empty paper around it - it must not be a small object floating in a "
        "big empty field. Centred, touching none of the edges. Seen flat and "
        "straight on with no perspective. Nothing else in the frame, no "
        "ground, no background. Isolated on bare paper."
    ),
    # Things that hang into frame from an edge - they cannot be centred
    # with clear paper all round, because the anchoring edge is the point.
    "overlay": (
        " Drawn LARGE, filling most of the frame, against completely empty "
        "paper so it can be cut out, entering from one edge only and touching "
        "none of the other three. Seen flat and straight on with no "
        "perspective. Nothing else in the frame, no ground, no background. "
        "Isolated on bare paper."
    ),
}

# Plates already landed in assets/plates/. Their definitions stay here -
# they are the record, and a plate can need redoing later - but they are
# NOT emitted into docs/PROMPTS.txt, so that file only ever contains
# work still to do.
LANDED = {
    "01": "docs/proof/LIVING-KEY.jpg",
    "02": "canal-far.png",
    "03": "canal-mid.png",
    "06": "bridge-two.png",
    "07": "bridge-three-covered.png",
    "08": "city-gate.png",
    "09": "her-door.png",
    "12": "door-gods-faded.png",
    "13": "door-gods-torn.png",
    "15": "guhuoniao.png",
    "16": "huapi.png",
    "19": "watchman.png",
    "04": "canal-near-kerb.png",
    "05": "bridge-one.png",
    "10": "door-gods-new.png",
    "14": "shuigui.png",
    "17": "shigandang.png",
    "18": "wutongshen.png",
    "20": "laundry.png",
    "21": "road-money.png",
    "22": "jiaobei.png",
    "24": "willow.png",
    "11": "door-gods-intact.png",
    "23": "lamp-in-window.png",
    "27": "lane-mouth.png",
    "31": "seg-bridge-a.png",
    "32": "seg-bridge-b.png  (third generation, single opening - the two-opening form failed twice)",
    "33": "night-water.png",
    "34": "screens/bridge.png  (the proof screen, accepted)",
    "35": "screens/mooring.png + screens/alley.png (bonus variant landed too)",
    "25": "baby-print.png",
    # [29] deliberately NOT here. The plate exists and is unused - the
    # prompt asked for something a side-on game cannot show. Left out of
    # LANDED so it stays visible as work, until someone decides to
    # delete the prompt instead.
    "28": "lane-wall.png",
    "30": "canal-far-b.png",
    "36": "screens/gate.png  (text panels flanked the raw; cropped out by column)",
    "37": "screens/water.png",
    "38": "screens/lantern.png",
    "39": "screens/alley-deep.png",
    "40": "screens/farbank.png",
    "41": "screens/gatelane.png",
    "43": "screens/bridge-b.png  (asset landed, not yet wired - needs [42] first)",
    "46": "screens/junction.png",
    "48": "screens/house-lamp.png  (asset landed, not yet wired - needs canal two's banks)",
    "51": "screens/neighbours-wall.png  (asset landed, placement in the graph pending)",
    "52": "screens/covered-bridge.png  (asset landed early; wired when its watch comes)",
    "42": "screens/bank-east.png",
    "44": "screens/bank-end.png",
    "47": "screens/inland-west.png",
    "49": "screens/inland-east.png",
    "50": "screens/inland-water.png",
    "45": "screens/east-water.png  (Gemini put two red SEALS on the stones - rule 5; windowed out at x875, ships with no red)",
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
     "Match LIVING-KEY.jpg for warmth. Run plate_check with --mid --tile.\n"
     "The floor is 10 rather than the 12 a whole scene needs - a plane is\n"
     "one band cropped out of a scene and carries less colour by\n"
     "construction.",
     "A narrow stone embankment running the full width of the image with a "
     "flagged lane along the top of it, the lane level all the way across. "
     "Worn steps "
     "descending into the water at two points, plain mooring posts. Exactly "
     "ONE small empty wooden boat tied up and no other boats anywhere. The "
     "stone washed with warm ochre and pale green across most of its "
     "surface so it reads warm and lived in, not white. Deserted, nobody "
     "outside. "),

    ("04", "CANAL BANK - NEAR PLANE, THE KERB",
     "plane",
     "Aspect 21:9. The DARKEST plate and the only one with no colour at all.\n"
     "It sits closest to the player, moves fastest and therefore repeats\n"
     "most often, so it must carry NO distinctive feature - anything\n"
     "memorable in here will visibly recur every screen width.\n"
     "The willow moved out to [24] for exactly that reason.\n"
     "Target: ink above 25%, saturation under 0.05, and a clean seam.\n"
     "Check with --near --tile.",
     "A low broken stone kerb running the full width along the very bottom "
     "edge, as a near-black silhouette in solid wet ink, no colour anywhere, "
     "no detail inside the shape, no single object standing out from it. "
     "Even along its whole length, nothing on one side that is not on the "
     "other. The upper three quarters of the image is completely empty bare "
     "paper."),

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

    ("25", "年畫 - THE AUSPICIOUS BABY PRINT",
     "object",
     "LOST IN THE WOODBLOCK-TO-INK REWRITE AND PUT BACK. The old prompt\n"
     "file called this the most important image in the game and the ink\n"
     "rewrite silently dropped it. It is item 4 on the 一更 planting list\n"
     "in ENDING-SITE.txt, so the first watch cannot be built without it.\n"
     "\n"
     "It is a PRINT INSIDE THE PAINTING - a cheap New Year woodblock\n"
     "pasted on a wall, drawn in our ink medium. Different register from\n"
     "everything around it, which is the point.\n"
     "\n"
     "PLAY IT COMPLETELY STRAIGHT. Do not make it creepy, do not add\n"
     "anything. It is seen plainly and warmly in the first watch with no\n"
     "music cue, and it does all its work at the end without being\n"
     "touched. Generate several and pick the sweetest.",
     "A cheap New Year woodblock print pasted on a whitewashed wall, "
     "showing a plump smiling baby boy in a red jacket holding a large "
     "carp in both arms - the classic auspicious New Year subject. "
     "Cheerful, round, warm, benign. The print itself is flat and "
     "graphic and slightly coarse, pasted crooked, its edges lifting. No "
     "text anywhere."),
    ("31", "SEGMENT - THE WALKWAY WITH BRIDGE A",
     "plane",
     "DECISIONS 107: a bridge is not an object placed on the walkway, it\n"
     "is a stretch of walkway WITH A BRIDGE IN IT, painted as one scene.\n"
     "This replaces every attempt to composite a bridge at runtime.\n"
     "\n"
     "ATTACH canal-mid.png. This segment must read as the SAME\n"
     "embankment: same stone, same height, same waterline, and its left\n"
     "and right edges must match canal-mid's edges so the segments join.\n"
     "\n"
     "THE ONE INSTRUCTION THE LAST PLATE IGNORED, now unmissable: the\n"
     "space under the arch is NEAR-BLACK. Nothing is visible through the\n"
     "bridge. If any wall, steps or water can be seen through the arch,\n"
     "the image is wrong.",
     "A long stone canal embankment with a flagged lane along its top, "
     "running the full width of the image and cut off by both the left and "
     "right edges at the same height. In the middle, the lane rises and "
     "crosses a short humpbacked stone footbridge over a narrow side "
     "channel, with a low parapet - all painted as one continuous scene. "
     "The opening beneath the bridge is filled with deep near-black ink "
     "shadow; nothing is visible through it. One small red paper lantern "
     "hangs from a post near the bridge. Deserted, one empty moored boat "
     "far from the bridge."),

    ("32", "SEGMENT - THE WALKWAY WITH BRIDGE B  (REROLL)",
     "plane",
     "Same rules as [31] - a DIFFERENT bridge, so the two read as\n"
     "landmarks apart; 走三桥 needs bridges the player can tell apart and\n"
     "name on paper.\n"
     "\n"
     "THIRD ATTEMPT, AND THE SHAPE CHANGED FOR A REASON: both earlier\n"
     "tries had two openings, and both times Gemini painted one dark and\n"
     "left the other bare paper. Two failures the same way is a pattern,\n"
     "so the failure surface is removed - bridge B now has EXACTLY ONE\n"
     "opening. One opening, near-black, or reject. Also reject any red\n"
     "seal stamps on the stonework - the last try grew two.",
     "A long stone canal embankment with a flagged lane along its top, "
     "running the full width of the image and cut off by both the left and "
     "right edges at the same height. In the middle, the lane rises over a "
     "low flat-decked stone slab bridge with a plain stone parapet - an "
     "older, squatter bridge than an arched one, all painted as one "
     "continuous scene. Beneath the deck there is EXACTLY ONE rectangular "
     "opening, and it is filled with deep near-black ink shadow; nothing "
     "is visible through it. No red marks or stamps anywhere on the stone. "
     "Deserted, no boat in this stretch."),

    ("33", "THE NIGHT WATER",
     "plane",
     "New with DECISIONS 108. The outermost depth strip: her last step\n"
     "toward the water, where she leans and counts her flames. Until now\n"
     "the reflection rendered over the ordinary scene; with the depth\n"
     "field it becomes a PLACE, and this is its ground.\n"
     "\n"
     "It must tile - check with --tile - and it must be DARK: the flames\n"
     "render on top of it in vermilion, and they only read against near-\n"
     "black. This is the one plate in the game where 留白 does not apply:\n"
     "night water holds ink, not paper. Expect plate_check to complain\n"
     "about 留白; that complaint is wrong here and is overridden.",
     "A wide band of still canal water at night, nearly black, seen "
     "flat from just above its surface, running the full width of the "
     "image and cut off by both the left and right edges at the same "
     "height so it repeats without a join. Deep ink wash, almost solid, "
     "with the faintest horizontal breathing of lighter grey where the "
     "surface moves, and one soft smudge of reflected lamplight far off. "
     "No shore, no boat, no object, no reflection of any figure. The top "
     "quarter fades into pale mist."),

    ("27", "弄口 - THE MOUTH OF A LANE  (SECOND ATTEMPT)",
     "plane",
     "THE ONLY BRANCHING IN THE GAME, per DECISIONS 105, and the first\n"
     "attempt was at the WRONG DEPTH. It came back as a standalone alley\n"
     "- two whole buildings, their roofs, sky above - and laying that\n"
     "over the bank gave two sets of architecture at two distances.\n"
     "\n"
     "Think about where she actually is: she walks the embankment with\n"
     "the houses BEHIND her and the water in front. So a lane off her\n"
     "bank is A GAP IN THAT ROW OF HOUSES - the same row as\n"
     "canal-far.png, at the same scale, with the same roofline.\n"
     "\n"
     "So this is a FAR-PLANE plate, not an object. It replaces a stretch\n"
     "of the terrace. ATTACH canal-far.png and match it exactly: same\n"
     "roof height, same wall height, same pallor.\n"
     "\n"
     "It must read as a way THROUGH and never as a doorway - a door is\n"
     "the lock system at 60 and the two cannot be confused.",
     "A row of whitewashed water town houses with black tile roofs seen "
     "from across a canal, identical to a plain terrace except that at "
     "the centre a narrow gap runs between two of them where an alley "
     "leads away. The gap is tall and very narrow and dark inside, with "
     "no door, no gate and no frame of any kind. Every house is the same "
     "size and the roofline is level all the way across. Very pale and "
     "washed out, ink only in the roof lines. The top two thirds is bare "
     "paper. Deserted."),

    ("28", "弄 - THE LANE WALL",
     "plane",
     "Aspect 21:9. The far plane of a LANE strip - the wall on the other\n"
     "side of the alley. A lane is narrow, so this is CLOSE and TALL and\n"
     "fills much more of the frame than the far bank does.\n"
     "Run plate_check with --mid --tile: it is close, so it carries\n"
     "colour like the mid plane rather than being drained by distance.",
     "A long whitewashed wall running the full width of the image, close "
     "to the viewer, the other side of a narrow alley. Damp and stained "
     "near the ground, a few shuttered windows set high, one plain closed "
     "door. Black tile eaves along the top edge. The upper quarter is "
     "bare paper. Deserted, nobody about."),

    ("34", "SCREEN - THE BRIDGE AT NIGHT  (PROOF 1 of 2)",
     "scene",
     "DECISIONS 109: the unit of art is now the whole SCREEN, judged as\n"
     "a picture someone would hang. This is not a plate and not a strip:\n"
     "it is the entire view, composed - water, bank, bridge, houses,\n"
     "mist, sky - in ONE painting. Fill the frame edge to edge; the 留白\n"
     "lives INSIDE the composition as mist and water, not as empty\n"
     "margin around a band of art.\n"
     "\n"
     "PORTRAIT. Set the aspect control to 9:16 if it exists; otherwise\n"
     "generate square and compose for a tall centre.\n"
     "\n"
     "Generate [34] and [35] in ONE session so they are the same night.",
     "A night view of a Jiangnan water town canal, composed as one "
     "complete vertical painting. In the foreground the dark still canal "
     "water crosses the bottom of the frame, holding broken reflections. "
     "Above it a stone embankment with a flagged lane, and a low arched "
     "stone footbridge crossing a side channel, the space beneath its arch "
     "filled with deep near-black shadow. One small red paper lantern on a "
     "post beside the bridge, its light smudged in the water. Behind, a "
     "row of whitewashed houses with black tile roofs, softening into mist "
     "toward the top of the frame. Deep winter, deserted, one empty moored "
     "boat. The whole frame is painted: mist and night fill what stone and "
     "water do not."),

    ("35", "SCREEN - ALONG THE BANK  (PROOF 2 of 2)",
     "scene",
     "The screen one step along the bank from [34] - same night, same\n"
     "palette, same session. DIFFERENT composition: no bridge here. The\n"
     "two must feel like neighbouring pages of one book, not tiles of\n"
     "one image - nothing needs to line up between them, they are joined\n"
     "by a phase transition, never by an edge.",
     "A night view of a Jiangnan water town canal, composed as one "
     "complete vertical painting. Dark still water low in the frame, a "
     "stone embankment with worn steps descending to a small mooring, a "
     "single empty flat boat tied up. Above, whitewashed houses with black "
     "tile roofs close over a narrow gap where an alley leads away into "
     "darkness, one warm lamplit window high in a wall. Mist takes the "
     "rooflines toward the top of the frame. Deep winter, deserted. The "
     "whole frame is painted: mist and night fill what stone and water do "
     "not."),

    ("36", "SCREEN - THE CITY GATE",
     "scene",
     "The game's FIRST screen: where she touches the bronze studs (摸釘)\n"
     "in the opening five minutes. Full-frame vertical painting, same\n"
     "rules as the accepted screens: whole frame painted, mist and night\n"
     "filling what stone does not.\n"
     "EXITS RULE (DECISIONS 109): the way onward must be VISIBLE - the\n"
     "lane leaving the gate to one side.",
     "A night view of a walled Jiangnan town gate seen from just outside, "
     "composed as one complete vertical painting. A heavy closed wooden "
     "gate studded with rows of round bronze nails, set in a plain stone "
     "gatehouse. A flagged lane runs from the foreground to the gate and "
     "away along the wall to the right, wet with mist. One small red "
     "lantern by the gate arch. Bare winter willow to one side. Mist takes "
     "the wall's top and the sky. Deserted."),

    ("37", "SCREEN - THE WATER'S EDGE",
     "scene",
     "The reflection screen: swiping down by the water arrives HERE, and\n"
     "her flames render on this painting. The lower half must be near-\n"
     "black still water for the vermilion to read.",
     "Looking down a stone embankment edge to dark still canal water that "
     "fills the lower half of the frame, composed as one complete vertical "
     "painting. Worn steps enter the water at one side. The water is deep "
     "near-black ink, calm, holding one faint smudge of distant lamplight. "
     "Above, the stone edge, a mooring post with rope, and the lowest "
     "courses of a whitewashed wall fading up into mist. Deserted, no "
     "boat, no figure and no reflection of any figure."),

    ("38", "SCREEN - UNDER THE LANTERN",
     "scene",
     "The relight screen - the warm place on the bank. Warmth must READ:\n"
     "this is the one screen allowed to feel kind.",
     "A night corner of a Jiangnan lane where a red paper lantern hangs "
     "from a wooden post bracket, its warm light pooling on wet flagstones "
     "and up a whitewashed wall, composed as one complete vertical "
     "painting. A small shuttered stall counter under the lantern, a "
     "bench, a stack of baskets. The lane continues into darkness both "
     "left and right. Mist above the tiled eaves. Deserted."),

    ("39", "SCREEN - DEEPER IN THE ALLEY",
     "scene",
     "What the accepted alley screen leads UP to: the alley's far end.\n"
     "Exits visible: the passage back (down) and a turn deeper (up or a\n"
     "side). This is the screen where the town starts pressing in.",
     "The narrow end of a Jiangnan alley at night, walls close on both "
     "sides, composed as one complete vertical painting. Wet flagstones, "
     "a shallow drain channel, high shuttered windows, one door recessed "
     "in shadow. The alley bends out of sight ahead where the dark "
     "thickens. A thin strip of misted sky far above between the eaves. "
     "Deserted."),

    ("40", "SCREEN - THE FAR BANK",
     "scene",
     "Across the first bridge: the other side of the canal, for when the\n"
     "rite pushes her over. Same night, one more red accent only.",
     "A night view along the far bank of a Jiangnan canal, composed as "
     "one complete vertical painting. The stone embankment runs into the "
     "frame with a flagged lane above it, a row of darker, meaner houses "
     "with sagging tile roofs, one lit window high up. Across the water, "
     "faint, the roofline of the side she came from dissolving into mist. "
     "One red scrap on a doorpost. Deserted, one moored boat."),

    ("41", "SCREEN - THE GATE LANE",
     "scene",
     "Between the city gate [36] and the mooring: the first walking\n"
     "screen of the game. Exits visible: the gate one way, the open\n"
     "bank the other.",
     "A night view along a flagged lane just inside a Jiangnau town "
     "wall, composed as one complete vertical painting. The lane runs "
     "from the foreground away to both sides, the stone wall high on one "
     "hand with mist taking its top, low house-backs on the other. A "
     "single bare willow. Wet stone catching faint light. Deserted."),

    ("42", "SCREEN - THE BANK, EAST STRETCH",
     "scene",
     "The stretch of her bank past bridge A, before bridge B. A plain\n"
     "breathing screen - most of a district is ordinary night, and the\n"
     "ordinary screens are what make the strange ones land.",
     "A night view along a Jiangnan canal bank, composed as one complete "
     "vertical painting. The flagged lane runs left and right, the dark "
     "canal below it, a row of shuttered house fronts above with one "
     "narrow gap between two houses showing deeper darkness. A stack of "
     "crab pots by a doorway, a coiled rope. Mist over the water and "
     "eaves. Deserted."),

    ("43", "SCREEN - BRIDGE B, THE FLAT BRIDGE",
     "scene",
     "The second of the three rite bridges, AS A SCREEN. Distinct from\n"
     "bridge A's arch: squat, flat-decked, older. The space under the\n"
     "deck near-black - nothing visible through it. Exits: the lane\n"
     "continuing both ways over it.",
     "A night view of a low flat-decked stone slab bridge carrying a "
     "flagged lane over a narrow side channel of a Jiangnan canal, "
     "composed as one complete vertical painting. A plain stone parapet, "
     "one short square pier, the single opening beneath the deck filled "
     "with deep near-black shadow. Dark water below holding a faint "
     "reflection. Houses rising into mist behind. Deserted."),

    ("44", "SCREEN - THE BANK'S FAR END",
     "scene",
     "Where her bank runs out: the district's eastern edge, and the turn\n"
     "of the canal. A quiet dead-end that says the town continues where\n"
     "she cannot yet go.",
     "A night view of a Jiangnan canal bank ending at a turn of the "
     "water, composed as one complete vertical painting. The flagged "
     "lane narrows and stops at a low stone rail above the black canal, "
     "which bends away out of sight between house walls. A mooring ring, "
     "no boat. One distant lit window across the turn. Heavy mist "
     "closing the view. Deserted."),

    ("46", "SCREEN - THE ALLEY JUNCTION",
     "scene",
     "Where the deep alley [39] opens toward the second canal: the first\n"
     "true CHOICE in the inland dark. Exits visible three ways - back\n"
     "down the alley, and onward left and right along a cross-lane.",
     "The meeting of two narrow Jiangnan alleys at night, composed as "
     "one complete vertical painting. The near alley opens into a "
     "slightly wider cross-lane running left and right, walls close and "
     "high, wet flagstones, a stone corner post worn round. One paper "
     "charm pasted at the corner, pale not red. Thin mist between the "
     "eaves, a strip of night sky. Deserted."),

    ("47", "SCREEN - SECOND CANAL, WEST",
     "scene",
     "The inland canal's bank - the town behind the town. Meaner and\n"
     "closer than her own bank; the houses lean.",
     "A night view along a narrower inland Jiangnan canal, composed as "
     "one complete vertical painting. The bank lane is tighter, the "
     "houses lean closer over the black water, their plaster more "
     "stained, laundry poles crossing overhead with nothing on them. A "
     "stone edge with no rail. Mist low over the water. Deserted."),

    ("48", "SCREEN - THE HOUSE WITH THE LAMP",
     "scene",
     "STORY SCREEN, planted in the first watch and never remarked on:\n"
     "her own house, though the game never says so. ONE window lamplit -\n"
     "warm, steady, the only true warmth in the district that is not\n"
     "the lantern. She passes; the player can never enter here. The\n"
     "composition should make the lit window impossible to miss and\n"
     "impossible to read as important.",
     "A night view of a modest Jiangnan house front on an inland canal "
     "lane, composed as one complete vertical painting. Whitewashed "
     "wall, a plain closed double door with a fresh pair of door god "
     "prints pasted bright and uncreased, and ONE small window above "
     "glowing warm lamplight into the mist. The lane passes left and "
     "right. A bare tree beside the door. Everything else cold, dark, "
     "shuttered. Deserted."),

    ("49", "SCREEN - SECOND CANAL, EAST",
     "scene",
     "The inland bank's other stretch, completing the second canal's\n"
     "walk. A shrine niche hints at what lives inland.",
     "A night view along a narrow inland Jiangnan canal bank, composed "
     "as one complete vertical painting. Close leaning houses, a small "
     "stone shrine niche set into a wall with a dark opening and cold "
     "ash before it, steps down to the black water. A narrow gap between "
     "houses leading away from the canal. Low mist. Deserted."),

    ("45", "SCREEN - THE EAST WATER",
     "scene",
     "The water's edge below [42] bank east - the near bank's second\n"
     "water screen, decided NEW rather than a [37] reuse (Simon,\n"
     "2026-08-21). Flames render here too, so the lower half must be\n"
     "near-black still water. Same canal as [37], one stretch east:\n"
     "same night, same water, DIFFERENT furniture - no steps, no\n"
     "mooring post.",
     "Looking down a stone embankment edge to dark still canal water "
     "that fills the lower half of the frame, composed as one complete "
     "vertical painting. A flat stone washing slab juts over the water "
     "at one side, worn smooth, with a wooden beating paddle left "
     "lying on it. The water is deep near-black ink, calm, holding one "
     "faint smudge of distant lamplight. Above, the stone edge and the "
     "lowest courses of a whitewashed wall fading up into mist. "
     "Deserted, no boat, no figure and no reflection of any figure."),

    ("50", "SCREEN - THE SECOND WATER",
     "scene",
     "The inland canal's water's edge - like [37] but meaner: closer\n"
     "walls, darker water. Flames render here too. Lower half near-\n"
     "black.",
     "Looking down a tight stone edge to the black water of a narrow "
     "inland Jiangnan canal at night, water filling the lower half of "
     "the frame, composed as one complete vertical painting. No steps "
     "here - just the sheer stone edge and an iron mooring ring. The "
     "water utterly still and near-black, walls of the leaning houses "
     "rising close on the far side into mist. No boat, no figure, no "
     "reflection of any figure."),

    ("51", "SCREEN - THE NEIGHBOUR'S WALL",
     "scene",
     "STORY SCREEN, ENDING-SITE item 4: the auspicious baby print seen\n"
     "plainly and warmly, with no music cue, in the first watch. The\n"
     "happiest object in Chinese popular art, pasted on an ordinary\n"
     "wall. Play it completely straight.",
     "A night view of a stretch of whitewashed Jiangnan wall beside a "
     "lane, composed as one complete vertical painting. Pasted on the "
     "wall, slightly crooked with edges lifting, a cheap New Year "
     "woodblock print of a plump smiling baby boy in a red jacket "
     "holding a large carp - cheerful, round, benign, its colours the "
     "brightest thing in the frame. Below it a stone bench and a broom "
     "leant against the wall. The lane runs left and right into mist. "
     "Deserted."),

    ("52", "SCREEN - THE COVERED BRIDGE  (LATER SET PIECE)",
     "scene",
     "BRIDGE THREE. Do not generate until the night's late screens are\n"
     "being made - it belongs to the hour she crosses it dead. The only\n"
     "bridge you cannot see through: a roofed corridor, the far end\n"
     "lost. Midway there is a gap in the boards where people look down\n"
     "at the water. ENDING-SEQUENCE movement one happens here.",
     "The mouth of a long covered wooden bridge at night, seen from just "
     "before its entrance, composed as one complete vertical painting. "
     "A low tiled roof over a plank corridor, timber posts, the far end "
     "swallowed in darkness - nothing visible through it. Black water "
     "under the entrance planks. The lane arrives from both sides. One "
     "cold unlit lantern frame hanging at the mouth. Deserted."),

    ("29", "弄 - THE LANE GROUND  ** DO NOT GENERATE **",
     "plane",
     "THIS PROMPT IS WRONG AND IS KEPT ONLY SO NOBODY WRITES IT AGAIN.\n"
     "\n"
     "It asks for flagstones \"seen from slightly above so the ground\n"
     "reads flat\", which is a contradiction. A SIDE-ON GAME NEVER DRAWS\n"
     "THE GROUND SHE WALKS ON. Look at the canal strip: far bank,\n"
     "embankment seen from across, near kerb - the surface under her\n"
     "feet is not a plate and never was. A lane is the same: the wall\n"
     "opposite and the kerb, and nothing between.\n"
     "\n"
     "It was generated once and came back a handsome receding pavement\n"
     "with nowhere to put it. If a lane ever needs a floor, the answer\n"
     "is a near kerb, not a ground plane.",
     "Wet stone flagging running the full width of the image, worn "
     "smooth and uneven, a shallow drainage channel down the middle "
     "catching a little light. Seen from slightly above so the ground "
     "reads flat. No steps, no objects, nothing standing on it."),

    ("30", "THE SECOND BANK",
     "plane",
     "Aspect 21:9. A far bank that is NOT the one already built, so that\n"
     "moving to another strip changes what she sees and not only where\n"
     "she is. Check with --far --tile.\n"
     "Attach canal-far.png so it is recognisably the same town, and then\n"
     "make it a DIFFERENT part of it.",
     "A long low row of whitewashed water town houses with black tile "
     "roofs seen from across a canal, all at the same distance with a "
     "level roofline and no recession. Taller and narrower buildings than "
     "an even terrace - two of them stand a storey higher than the rest, "
     "and one has a small covered landing at the water. Very pale and "
     "washed out, ink only in the roof lines. The top two thirds is bare "
     "paper. No boat, no lane, no figures."),

    ("24", "WILLOW BRANCHES - NEAR OVERLAY",
     "overlay",
     "Not part of the kerb strip. This hangs over the near plane\n"
     "occasionally, so it can be distinctive - that is the whole point of\n"
     "pulling it out of [04]. Pure ink, no colour: it sits closest to the\n"
     "player of anything in the game.",
     "A few bare winter willow branches hanging down from above, brushed in "
     "solid wet ink as a near-black silhouette, no colour anywhere, no leaves, "
     "no detail inside the strokes. They enter from the top edge and hang "
     "into the upper part of the frame only."),
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

THIS FILE ONLY CONTAINS WORK STILL TO DO. Plates already landed are
listed by name and then dropped. Regenerate this file after each batch
lands:  python3 tools/build_prompts.py


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
  The subject is small in the frame with a lot of empty paper around
  it - trimmed to content it must be at least 700px on the long edge,
  and about 1000px for a creature. Check with:
      python3 tools/plate_check.py --size <plate>

The last two are the ones you will be tempted to let through.

=============================================================
THE THREE CANAL PLANES ARE A SET
=============================================================

02, 03 and 04 stack on top of each other and slide at different speeds
to make the walk. [24], the willow, is an overlay dropped on top of 04
here and there - it is NOT part of the strip.

A TILING STRIP CANNOT CONTAIN A LANDMARK. The first near plane baked a
willow into one side and the seam went to 18.5 while the kerb itself
measured almost perfectly even across its width. Anything memorable in
a plate that repeats every screen width will be seen to repeat. Strips
carry texture; features are separate plates placed by hand. They are the first real test of whether separately
generated plates will parallax, so treat them as one job:

  Generate all three in ONE session, same seed family.
  Attach BOTH STYLE-KEY.jpg and LIVING-KEY.jpg to each.
  DO NOT FIGHT THE ASPECT CONTROL. Gemini returns a square with a
  painted paper mount around it whatever you ask for. Generate square,
  compose the band low in the frame with mist above, and crop after:

      python3 tools/prep_plate.py <in.jpg> <out.png>

  It finds and drops the mount, then crops to 21:9 anchored at the
  bottom so the ground is kept and the empty sky goes.
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


def done_list():
    lines = ["", "=" * 61, "ALREADY DONE - not repeated below", "=" * 61, ""]
    for pid, title, _kind, _note, _body in PLATES:
        if pid in LANDED:
            lines.append(f"  [{pid}] {title}")
            lines.append(f"        {LANDED[pid]}")
    lines += ["", "Definitions for these are kept in tools/build_prompts.py.",
              "If one needs redoing, remove its id from LANDED and re-run.", "", ""]
    return "\n".join(lines)


def main():
    todo = [p for p in PLATES if p[0] not in LANDED]
    body = "".join(block(*p) for p in todo)
    open("docs/PROMPTS.txt", "w", encoding="utf-8").write(
        HEAD + done_list() + "=" * 61 + "\nSTILL TO MAKE\n" + "=" * 61 + "\n\n"
        + body + TAIL)
    print(f"docs/PROMPTS.txt written: {len(todo)} outstanding "
          f"({len(LANDED)} landed, hidden)")


if __name__ == "__main__":
    main()
