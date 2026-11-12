# Grok prompts and the import pipeline

Everything in the build today is drawn in code by `tools/pixelart.py`. Use generated art only
for things code draws badly (large creatures with a lot of anatomy, key art). Imported art must
come out at the game's pixel size and in the game's palette, so it always goes through
`tools/import_asset.py`; never drop a generated image into the atlas by hand.

## Rules for every prompt

- Flat **pure magenta background (#FF00FF)**, no gradient, no floor, no cast shadow, no text.
- One sprite per image, or an evenly spaced grid of frames (say which: `4x4 grid`).
- Top-down 3/4 view, facing right or facing the camera, whole body inside the frame.
- Flat colours, 2-3 shades per material, readable silhouette, bright accents on a mid-tone body.
  Dark-on-dark sprites turn to mud when they are reduced to 20-36 art pixels.
- Own designs only: no characters, logos or UI from existing games.

## Prompts

**Rift Tyrant (boss, imports at 34 px tall)**
> Pixel art game sprite sheet, 4x4 grid, evenly spaced, pure magenta #FF00FF background. A hulking
> horned demon, front view, top-down 3/4 perspective. Crimson skin in three flat shades, bone
> coloured horns and claws, a glowing green crack down the chest, yellow eyes. Thick dark outline,
> flat colours, no gradients, no shadow on the ground. Row 1 idle, row 2 walk, row 3 slam wind-up,
> row 4 roar.

**Warden (elite, 20-22 px tall)**
> Pixel art game sprite sheet, 4x4 grid, pure magenta #FF00FF background. A stone golem brute,
> front view, top-down 3/4 perspective, grey-green rock in three flat shades with glowing green
> cracks, small head, huge fists. Dark outline, flat colours, no ground shadow.

**Hound (14 px tall, faces right)**
> Pixel art game sprite sheet, 4x1 grid, pure magenta #FF00FF background. A spiky purple wolf-like
> beast running to the right, side view from slightly above, three flat purple shades, red eye,
> white teeth. Dark outline, flat colours, no ground shadow.

**Title key art (not a sprite: imported at 240x135 as a backdrop)**
> Pixel art, 16:9, dark fantasy dungeon hall seen from above, cracked flagstone floor split by a
> glowing green fissure with ember-orange edges, torches on the walls, a small blue-robed mage in
> the centre. Limited palette of slate greys, toxic green, ember orange. No text, no UI.

### Step 9 (content audit): what code still draws badly

The game reads these frame names; an import must keep them (and the frame meaning) to drop in.

**Rift Tyrant attack poses (`tyrant_2` claws raised for the slam, `tyrant_3` head down for the charge, `tyrant_4` arms spread for the burst; 34-36 px tall)**
> Pixel art game sprite sheet, 3x1 grid, evenly spaced, pure magenta #FF00FF background. The same
> hulking horned crimson demon in three poses, front view, top-down 3/4 perspective: 1) both fists
> raised high above the horns, glowing green light in the fists, about to smash the ground;
> 2) crouched with head lowered and horns pointing forward, about to charge; 3) arms spread wide,
> chest crack glowing, roaring. Bone horns, yellow eyes, thick dark outline, flat colours, no ground shadow.
> (Step 9b redrew the hands in code as three-clawed hands in every pose; import only if the user wants painted art.)

**Don Montoto (city NPC `npc_montoto_0/1`, 20 px tall; also the caged frame `cage_0/1`)**
> Pixel art game sprite sheet, 2x1 grid, pure magenta #FF00FF background. A very old, slightly bent
> man in a deep purple hooded robe, long white beard down to his rope belt, bushy white eyebrows,
> leaning on a tall wooden walking stick with a gold knob, front view, top-down 3/4 perspective,
> two idle frames (breathing). Three flat shades of purple, warm skin, dark outline, no ground shadow.

**Don Montoto portrait (panel art, imported at 64x62 as `portrait_montoto`, shown in his talk panel)**
> Pixel art portrait, square, pure magenta #FF00FF background. Head and shoulders of a kind,
> mischievous old man in a purple hood, long white beard, white eyebrows, one eye half closed,
> candle light from below. Flat colours, 3 shades per material, dark outline.

**Skeleton throw (`skeleton_2`, 20 px tall)**
> Pixel art game sprite, pure magenta #FF00FF background. A thin bone-white skeleton, front view,
> top-down 3/4, one arm drawn back over its head holding a sharp bone shard, green glowing eye
> sockets. Flat cream and grey shades, dark outline, no ground shadow.

## Importing

```
python3 tools/import_asset.py raw/tyrant.jpg --name tyrant --grid 4x4 --cells 0,1 \
        --height 34 --colors 8 --keys ty,horn,em,rg,eye,outline --gamma 0.8
python3 tools/pixelart.py --sheet      # repacks the atlas; look at qa/out/artsheet.png
python3 tools/build.py
```

What the importer does: keys out the backdrop by hue (the colour is read from the image border, so
magenta #FF00FF and hot pink #FF0088 both work; `--key #RRGGBB` and `--key-tol` (degrees, default 20) override;
the window is narrow so a purple robe at hue ~270 survives a pink backdrop; a layer PNG's own alpha is kept too),
cuts the grid (`--grid`, `--cells`) or the figures side by side (`--split cols`: columns with nothing in them
separate figures, any spacing), crops all chosen frames to one shared box so the animation stays aligned
(`--own-box`: each frame to its own figure, one scale for all, the tallest is `--height`), reduces to `--height`
art pixels, snaps every pixel to the nearest colour of the game palette (`--keys` limits it to named ramps from
`assets/palette.json`, `--colors` caps the count, `--gamma` below 1 lifts dark sources), removes stray pixels and
adds the same 1 px outline the code-drawn sprites have. A preview is written to `qa/out/import_<name>.png`.

Reduction: `--method box` averages (painted sources); `--method mode` (pixel-art sources like Grok's) votes:
each art pixel takes the palette colour most of its 4x4 sub-pixels have, so flat areas and outlines survive;
`--accent` keys (eyes, glows) win a pixel with 2 votes and are never dropped by `--colors`. `--smooth N` flattens
shading noise (a lone pixel takes its neighbours' colour, only inside the same material ramp). `--names a,b,c`
names the frames (`tyrant_2,tyrant_3,tyrant_4`).

Frames land in `assets/imported/<name>_<n>.png`. `pixelart.py` packs that folder into the atlas,
and an imported frame replaces a code-drawn frame with the same name (`tyrant_0`, `tyrant_1`, ...).
Delete the file to go back to the code-drawn version. Sub-folders are not packed:
`assets/imported/rejected/` keeps imports judged worse than the code-drawn frame (move one up to use it), and
`assets/imported/parts/cage_montoto_<f>.png`, when present, is drawn behind the bars of `cage_<f>` by `pixelart.py`.

## Status

Step 9 imports (2026-11-12, the user's Grok images; each judged at game size against the code-drawn frame,
comparison image `/tmp/art_compare.png`):

| Frame | Source used | Result |
|---|---|---|
| `npc_montoto_0/1` | composite JPEG (hot pink backdrop); the layer PNG `wizard-1/2` has no staff | **Kept.** Reads as the bent old man with the tall gold-knob staff; robe in the stall's purple (`tome`); a little noisier than the code one, 18x23 |
| `portrait_montoto` (new) | composite JPEG (the layers have no single full figure) | **Kept.** 64x62 (48 lost the eyes); left of the story in the talk panel, both sizes, both languages |
| `cage_0/1` | composite JPEG at 14 px (`rejected/parts/`) | **Rejected**: behind the bars the code-drawn figure reads better; cage unchanged |
| `tyrant_2/3/4` | composite JPEG (the layers split the orbs and chest glow off) | **Rejected** (`rejected/`): darker and noisy at 36 px, the slam orbs melt into the green super fissure, the charge pose is a red blob, and the idle (`tyrant_0/1`, no import) is the code-drawn style, so the boss would change style when it attacks. To use painted poses, ask for idle + walk in the same sheet |
| `skeleton_2` | composite JPEG (the PNG has a magenta fringe, same result) | **Rejected** (`rejected/`): too thin at 22 px, low contrast on the floor, the ribcage is lost |

Commands used (sources outside the repo; run Python on them with `-I`):

```
python3 -I tools/import_asset.py montoto.jpg --name npc_montoto --split cols --cells 0,1 --height 21 --colors 12 \
        --keys tome,skin,sk,wood,gold,boot,outline --method mode --accent gold,sk3 --smooth 1 --gamma 0.8
python3 -I tools/import_asset.py portrait.jpg --name portrait_montoto --single --height 60 --colors 14 \
        --keys tome,hd,skin,sk,outline,f,wood,gold,ch --method mode --accent sk3,ch0 --smooth 1
python3 -I tools/import_asset.py boss.jpg --name tyrant_pose --names tyrant_2,tyrant_3,tyrant_4 --split cols --cells 0,1,2 \
        --own-box --height 36 --colors 10 --keys ty,horn,eye_y,rg,em,tooth,outline --accent eye_y,em2,em3,rg --method mode --smooth 2
python3 -I tools/import_asset.py skeleton.jpg --name skeleton_throw --names skeleton_2 --height 22 --colors 6 \
        --keys sk,rg,outline,wt --accent rg --method mode --smooth 1
```

Earlier: the pipeline was tested on the raw sheets from the earlier Grok workspace (tyrant, chest, portal);
those sources are dark and low-contrast and read worse than the code-drawn sprites, so none of them ships.
