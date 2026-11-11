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

**Rift Tyrant attack poses (`tyrant_2` fists raised for slam / burst, `tyrant_3` head down for the charge; 34-36 px tall)**
> Pixel art game sprite sheet, 3x1 grid, evenly spaced, pure magenta #FF00FF background. The same
> hulking horned crimson demon in three poses, front view, top-down 3/4 perspective: 1) both fists
> raised high above the horns, glowing green light in the fists, about to smash the ground;
> 2) crouched with head lowered and horns pointing forward, about to charge; 3) arms spread wide,
> chest crack glowing, roaring. Bone horns, yellow eyes, thick dark outline, flat colours, no ground shadow.
> (The code-drawn fists are square blocks: the pose reads, the hands do not.)

**Don Montoto (city NPC `npc_montoto_0/1`, 20 px tall; also the caged frame `cage_0/1`)**
> Pixel art game sprite sheet, 2x1 grid, pure magenta #FF00FF background. A very old, slightly bent
> man in a deep purple hooded robe, long white beard down to his rope belt, bushy white eyebrows,
> leaning on a tall wooden walking stick with a gold knob, front view, top-down 3/4 perspective,
> two idle frames (breathing). Three flat shades of purple, warm skin, dark outline, no ground shadow.

**Don Montoto portrait (panel art, 48x48, for his talk panel; no frame exists yet: needs code to show it)**
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

What the importer does: keys out the magenta by hue (tolerates JPEG noise and gradients), cuts
the grid, crops all chosen frames to one shared box so the animation stays aligned, area-averages
down to `--height` art pixels, hardens the alpha, snaps every pixel to the nearest colour of the
game palette (`--keys` limits it to named ramps from `assets/palette.json`, `--colors` caps the
count, `--gamma` below 1 lifts dark sources), removes stray pixels and adds the same 1 px outline
the code-drawn sprites have. A preview is written to `qa/out/import_<name>.png`.

Frames land in `assets/imported/<name>_<n>.png`. `pixelart.py` packs that folder into the atlas,
and an imported frame replaces a code-drawn frame with the same name (`tyrant_0`, `tyrant_1`, ...).
Delete the file to go back to the code-drawn version.

## Status

The pipeline was tested on the raw sheets from the earlier Grok workspace (tyrant, chest, portal).
They import cleanly, but those sources are dark and low-contrast, and after reduction they read
worse than the code-drawn sprites, so nothing imported ships in the current build.
