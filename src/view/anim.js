// Animation table (HD art pilot), view only: what HD frames an entity shows in each state, how fast, what to fall back
// to, and how strongly the code-made motion (src/view/hd.js, G.Rig) moves it. Frame names are frames of the HD atlas
// (tools/hd_atlas.py -> assets/hd_atlas.json); a state whose frames are all missing falls back (ent.fallback, then
// G.ANIM.fallback), and an entity with no HD frame at all keeps the chunky atlas and its old animation.
//
//   frames  HD frames, in order. One frame = a single pose that the motion keeps alive; several = a real frame animation.
//   fps     idle: frames per second; walk: frames per second at the entity's base speed (the walk is tied to the distance
//           walked, so a slowed or hasted walker steps slower or faster); attack: frames spread over the sim's wind-up,
//           the last one shown from the release (the sim's attack moment) for `hold` seconds; hurt: shown on damage.
//   cycle   walk frames per two steps (default: the frame count).
//   motion  bob (HD px), tilt (rad), squash (share), lean (wind-up, HD px back), lunge (release, HD px forward),
//           stretch (release, share), recoil (hit, HD px), breathe (share), breathT (s), dust (puffs per step, 0 = none),
//           faces (1: the art looks right / is front-facing, -1: it looks left), die (s of the death).
(function (G) {
  var M_SMALL = { bob: 2, tilt: 0.05, squash: 0.07, lean: 3, lunge: 5, stretch: 0.12, recoil: 4, breathe: 0.035, breathT: 1.5, dust: 1, faces: 1, die: 0.75 };
  var M_BIG = { bob: 3, tilt: 0.03, squash: 0.06, lean: 5, lunge: 8, stretch: 0.1, recoil: 3, breathe: 0.025, breathT: 2.2, dust: 3, faces: 1, die: 1.6 };
  var M_NPC = { bob: 0, tilt: 0, squash: 0, lean: 0, lunge: 0, stretch: 0, recoil: 0, breathe: 0.03, breathT: 2.6, dust: 0, faces: 1, die: 0 };

  G.ANIM = {
    // states to try when a state has no frame
    fallback: { walk: 'idle', attack: 'idle', hurt: 'idle', slam: 'attack', charge: 'attack', burst: 'attack', cast: 'attack' },
    // a chunky frame shown as an HD frame when the entity has no table entry (cages, static props)
    map: { cage_0: 'cage_0', cage_1: 'cage_1' },
    // The rarity glow of the hero's weapon (src/view/hd.js): colour (or `cycle` of colours, one turn in cycleT s), the
    // alpha it pulses between (min, max; one pulse in `period` s), sparks per second. glowByRarity: by an item's rarity
    // (0 common .. 4 legendary); 'mythic' and 'unique' are not item rarities yet (the art test previews them: ?glow=, DBG).
    glow: {
      magic:     { color: 0x6eaaff, min: 0.30, max: 0.55, period: 1.8 },
      rare:      { color: 0xffd84a, min: 0.35, max: 0.65, period: 1.6 },
      epic:      { color: 0xcc80ff, min: 0.40, max: 0.75, period: 1.5 },
      legendary: { color: 0xff9434, min: 0.50, max: 0.95, period: 1.2, sparks: 1.5, spark: 'r_legend' },
      mythic:    { cycle: [0xff4060, 0xc060ff, 0x40c8ff, 0x60ff90, 0xffd84a], cycleT: 3.2, min: 0.60, max: 1.0, period: 0.9, sparks: 3, spark: 'r_epic' },
      unique:    { color: 0xfff0b8, min: 0.45, max: 1.0, period: 0.7, sparks: 4, spark: 'gold' }
    },
    glowByRarity: [null, 'magic', 'rare', 'epic', 'legendary'],
    glowOrder: ['none', 'magic', 'rare', 'epic', 'legendary', 'mythic', 'unique'],
    ent: {
      // one imported pose (the bone blade raised): serves every skeleton frame, the motion does the rest
      skeleton: {
        idle: { frames: ['skeleton'] }, walk: { frames: ['skeleton'], fps: 9 }, attack: { frames: ['skeleton'], hold: 0.25 },
        motion: M_SMALL
      },
      // three imported poses; idle and walk = the burst pose (arms spread, the most upright and neutral) with its chest glow
      // repainted (tools/hd_atlas.py --calm), so the glow only shows when the burst comes
      tyrant: {
        idle: { frames: ['tyrant_idle'] }, walk: { frames: ['tyrant_idle'], fps: 7 },
        slam: { frames: ['tyrant_slam'], hold: 0.35 }, charge: { frames: ['tyrant_charge'], hold: 0.6 }, burst: { frames: ['tyrant_burst'], hold: 0.6 },
        motion: M_BIG
      },
      // Don Montoto in the city (two imported idle frames) and the classes once their sheets arrive
      npc_montoto: { idle: { frames: ['npc_montoto_0', 'npc_montoto_1'], fps: 0.8 }, motion: M_NPC },
      // the mage sheet (Grok, 4x2; walk row redrawn once): walk x4 (stride, feet together, stride, feet together),
      // idle x1, attack x2 (staff raised, staff thrust), hurt x1
      mage: {
        idle: { frames: ['mage_idle_0'] },
        walk: { frames: ['mage_walk_0', 'mage_walk_1', 'mage_walk_2', 'mage_walk_3'], fps: 9 },
        attack: { frames: ['mage_attack_0', 'mage_attack_1'], fps: 14, hold: 0.12 },
        hurt: { frames: ['mage_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.02, squash: 0.04, lean: 1, lunge: 2, stretch: 0.05, recoil: 3, breathe: 0.02, breathT: 1.6, dust: 1, faces: 1, die: 0.9 }
      },
      // the warrior sheet (Grok, 4x2): walk x4, idle, sword raised, sword swung, hurt. Plate armour, shield and sword are
      // drawn into the sheet: the chunky held weapon (w_<type>) is hidden while this art shows, whatever is equipped.
      warrior: {
        idle: { frames: ['warrior_idle_0'] },
        walk: { frames: ['warrior_walk_0', 'warrior_walk_1', 'warrior_walk_2', 'warrior_walk_3'], fps: 8 },
        attack: { frames: ['warrior_attack_0', 'warrior_attack_1'], fps: 14, hold: 0.14 },
        hurt: { frames: ['warrior_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.015, squash: 0.03, lean: 1, lunge: 3, stretch: 0.04, recoil: 2, breathe: 0.02, breathT: 1.8, dust: 2, faces: 1, die: 0.9 }
      }
    }
  };
})(globalThis.G = globalThis.G || {});
