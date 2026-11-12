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
      // the mage sheet (Grok, 4x2): walk x4, idle x1, attack x2 (staff raised, staff thrust), hurt x1. The walk frames
      // of this sheet keep the same leg in front, so the loop is lift (3) -> wide (0, 2) -> narrow (1), not a true swap.
      mage: {
        idle: { frames: ['mage_idle_0'] },
        walk: { frames: ['mage_walk_3', 'mage_walk_0', 'mage_walk_2', 'mage_walk_1'], fps: 9 },
        attack: { frames: ['mage_attack_0', 'mage_attack_1'], fps: 14, hold: 0.12 },
        hurt: { frames: ['mage_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.02, squash: 0.04, lean: 1, lunge: 2, stretch: 0.05, recoil: 3, breathe: 0.02, breathT: 1.6, dust: 1, faces: 1, die: 0.9 }
      }
    }
  };
})(globalThis.G = globalThis.G || {});
