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
    // the colour of an armour's trim (frames trim_<frame>) by the item's rarity: common brass, then the rarity colours
    trimByRarity: [0xb08850, 0x6eaaff, 0xffd84a, 0xcc80ff, 0xff9434],
    // the body sheet by the body armour's material (item.mat: 0 light, 1 medium, 2 heavy; an item without one counts as heavy)
    armorLook: ['leather', 'chain', 'plate'],
    // helmets and shields (visible equipment): the art per class and material (0 light, 1 medium, 2 heavy). Helmets sit on the
    // head the frame meta `cap` gives (tools/gear_points.py): `top` = their top this many HD px above the crown; hats sit on
    // their brim: `brim` = the share of their height where the brim meets the head, put `drop` px below the crown.
    // A shield is held in the free hand (meta `off`), in front of the body when that hand is the front one.
    helmArt: { warrior: ['helm_fur', 'helm_coif', 'helm_plate'], archer: ['helm_ranger', 'helm_coif', 'helm_plate'], mage: ['helm_hood', 'helm_wizard', 'helm_wizard'] },
    helmFit: { helm_fur: { top: 3 }, helm_coif: { top: 3 }, helm_plate: { top: 3 }, helm_hood: { top: 3 }, helm_wizard: { brim: 0.78, drop: 5 }, helm_ranger: { brim: 0.7, drop: 4 } },
    shieldArt: ['shield_round', 'shield_banded', 'shield_kite'],
    // held weapon art by weapon type (frames wpn_<name> of the HD atlas); `any`: the one drawn for a type with no art yet
    wpnArt: { sword: 'wpn_sword', staff: 'wpn_staff', any: null },      // fallback art by type when the rarity set is missing; null = nothing in the hand
    // held weapons by rarity (tools/weapon_sheet.py): wpn_<type>_<n>, n = 0 common, 1 magic, 2 rare, 3 legendary, 4 mythic, 5 unique.
    // item rarity -> n (the game has epic between rare and legendary and no mythic / unique yet: epic shows the legendary art)
    wpnByRarity: [0, 1, 2, 3, 3],
    wpnByGlow: { none: 0, magic: 1, rare: 2, epic: 3, legendary: 3, mythic: 4, unique: 5 },      // the ?glow= / DBG preview picks the art too
    // where the fist holds a weapon type, as a share of its sprite's height from the top
    wpnGripByType: { sword: 0.86, axe: 0.82, mace: 0.82, hammer: 0.78, staff: 0.58, bow: 0.5 },
    // where the fist holds each weapon sprite, as a share of its height from the top (default 1: the bottom end, a sword's guard)
    wpnGrip: { wpn_staff: 0.46 },
    glowOrder: ['none', 'magic', 'rare', 'epic', 'legendary', 'mythic', 'unique'],
    ent: {
      // monsters (Grok 4x2 / 4x3 sheets in the chosen style, 2026-11-13): walk x4, idle, wind-up, strike, hurt
      skeleton: {
        idle: { frames: ['skeleton_idle'] }, walk: { frames: ['skeleton_walk_0', 'skeleton_walk_1', 'skeleton_walk_2', 'skeleton_walk_3'], fps: 8 },
        attack: { frames: ['skeleton_atk_0', 'skeleton_atk_1'], hold: 0.25 },
        hurt: { frames: ['skeleton_hurt'], hold: 0.2 },
        motion: M_SMALL
      },
      imp: {
        idle: { frames: ['imp_idle'] }, walk: { frames: ['imp_walk_0', 'imp_walk_1', 'imp_walk_2', 'imp_walk_3'], fps: 11 },
        attack: { frames: ['imp_atk_0', 'imp_atk_1'], hold: 0.25 },
        hurt: { frames: ['imp_hurt'], hold: 0.2 },
        motion: M_SMALL
      },
      cultist: {
        idle: { frames: ['cultist_idle'] }, walk: { frames: ['cultist_walk_0', 'cultist_walk_1', 'cultist_walk_2', 'cultist_walk_3'], fps: 6 },
        attack: { frames: ['cultist_atk_0', 'cultist_atk_1'], hold: 0.25 },
        hurt: { frames: ['cultist_hurt'], hold: 0.2 },
        motion: M_SMALL
      },
      hound: {
        idle: { frames: ['hound_idle'] }, walk: { frames: ['hound_walk_0', 'hound_walk_1', 'hound_walk_2', 'hound_walk_3'], fps: 10 },
        attack: { frames: ['hound_atk_0', 'hound_atk_1'], hold: 0.25 },
        motion: M_BIG
      },
      warden: {
        idle: { frames: ['warden_idle'] }, walk: { frames: ['warden_walk_0', 'warden_walk_1', 'warden_walk_2', 'warden_walk_3'], fps: 6 },
        attack: { frames: ['warden_atk_0', 'warden_atk_1'], hold: 0.25 },
        hurt: { frames: ['warden_hurt'], hold: 0.2 },
        motion: M_BIG
      },
      bat: {
        idle: { frames: ['bat_idle'] }, walk: { frames: ['bat_walk_0', 'bat_walk_1', 'bat_walk_2', 'bat_walk_3'], fps: 12 },
        attack: { frames: ['bat_atk_0', 'bat_atk_1'], hold: 0.25 }, hurt: { frames: ['bat_x3'], hold: 0.2 },
        motion: M_SMALL
      },
      tyrant: {
        idle: { frames: ['tyrant_idle'] }, walk: { frames: ['tyrant_walk_0', 'tyrant_walk_1', 'tyrant_walk_2', 'tyrant_walk_3'], fps: 6 },
        slam: { frames: ['tyrant_slam'], hold: 0.35 }, charge: { frames: ['tyrant_charge'], hold: 0.6 }, burst: { frames: ['tyrant_burst'], hold: 0.6 },
        motion: M_BIG
      },
      // Don Montoto in the city (two imported idle frames) and the classes once their sheets arrive
      // the town's keepers (Grok, chosen style, 4 poses each): idle loops slowly; `talk` while the hero is in reach (city.js)
      npc_montoto: { idle: { frames: ['npc_montoto_0', 'npc_montoto_0', 'npc_montoto_1', 'npc_montoto_3'], fps: 0.6 }, talk: { frames: ['npc_montoto_2'] }, motion: M_NPC },
      npc_smith: { idle: { frames: ['npc_smith_0', 'npc_smith_1'], fps: 0.6 }, talk: { frames: ['npc_smith_2'] }, motion: M_NPC },
      npc_trainer: { idle: { frames: ['npc_trainer_0', 'npc_trainer_1', 'npc_trainer_0', 'npc_trainer_3'], fps: 0.6 }, talk: { frames: ['npc_trainer_2'] }, motion: M_NPC },
      // the merchant met in the rooms (game.js draws him with these frames): idle loop, the open hand while the hero is in reach
      merchant: { idle: { frames: ['merchant_0', 'merchant_0', 'merchant_1', 'merchant_0', 'merchant_3'], fps: 0.6 }, talk: { frames: ['merchant_2'] } },
      // the mage sheet (Grok, 4x2; walk row redrawn once): walk x4 (stride, feet together, stride, feet together),
      // idle x1, attack x2 (staff raised, staff thrust), hurt x1
      mage: {
        idle: { frames: ['mage_idle_0'] },
        walk: { frames: ['mage_walk_0', 'mage_walk_1', 'mage_walk_2', 'mage_walk_3'], fps: 9 },
        attack: { frames: ['mage_attack_0', 'mage_attack_1'], fps: 14, hold: 0.12 },
        hurt: { frames: ['mage_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.02, squash: 0.04, lean: 1, lunge: 2, stretch: 0.05, recoil: 3, breathe: 0.02, breathT: 1.6, dust: 1, faces: 1, die: 0.9 }
      },
      // the mage with no gear on (Grok, 4x2, chibi style, a plain blue apprentice robe, no hat, the green rod as the staff)
      mage_bare: {
        hands: true,
        skills: ['mage_bare_skill_0', 'mage_bare_skill_1', 'mage_bare_skill_2', 'mage_bare_skill_3'],      // skill poses (Grok extra row), not used by the game yet
        idle: { frames: ['mage_bare_idle_0'] },
        walk: { frames: ['mage_bare_walk_0', 'mage_bare_walk_1', 'mage_bare_walk_2', 'mage_bare_walk_3'], fps: 8 },
        attack: { frames: ['mage_bare_attack_0', 'mage_bare_attack_1'], fps: 14, hold: 0.14, dur: 0.38, split: 0.5 },
        hurt: { frames: ['mage_bare_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.015, squash: 0.03, lean: 1, lunge: 2, stretch: 0.04, recoil: 2, breathe: 0.02, breathT: 1.7, dust: 1, faces: 1, die: 0.9 }
      },
      // the mage in the light robe (blue cloth, wide sleeves, sash): the mage's leather weight (robes, not armour), green rod -> fist, trim recoloured by rarity
      mage_leather: {
        hands: true,
        idle: { frames: ['mage_leather_idle_0'] },
        walk: { frames: ['mage_leather_walk_0', 'mage_leather_walk_1', 'mage_leather_walk_2', 'mage_leather_walk_3'], fps: 8 },
        attack: { frames: ['mage_leather_attack_0', 'mage_leather_attack_1'], fps: 14, hold: 0.14, dur: 0.38, split: 0.5 },
        hurt: { frames: ['mage_leather_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.015, squash: 0.03, lean: 1, lunge: 2, stretch: 0.04, recoil: 2, breathe: 0.02, breathT: 1.7, dust: 1, faces: 1, die: 0.9 }
      },
      // the mage in the reinforced robe (purple, leather mantle, belt with pouches): the mage's chain weight (robes, not armour), green rod -> fist, trim recoloured by rarity
      mage_chain: {
        hands: true,
        idle: { frames: ['mage_chain_idle_0'] },
        walk: { frames: ['mage_chain_walk_0', 'mage_chain_walk_1', 'mage_chain_walk_2', 'mage_chain_walk_3'], fps: 8 },
        attack: { frames: ['mage_chain_attack_0', 'mage_chain_attack_1'], fps: 14, hold: 0.14, dur: 0.38, split: 0.5 },
        hurt: { frames: ['mage_chain_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.015, squash: 0.03, lean: 1, lunge: 2, stretch: 0.04, recoil: 2, breathe: 0.02, breathT: 1.7, dust: 1, faces: 1, die: 0.9 }
      },
      // the mage in the battle robe (purple, gems and shoulder plates): the mage's plate weight (robes, not armour), green rod -> fist, trim recoloured by rarity
      mage_plate: {
        hands: true,
        idle: { frames: ['mage_plate_idle_0'] },
        walk: { frames: ['mage_plate_walk_0', 'mage_plate_walk_1', 'mage_plate_walk_2', 'mage_plate_walk_3'], fps: 8 },
        attack: { frames: ['mage_plate_attack_0', 'mage_plate_attack_1'], fps: 14, hold: 0.14, dur: 0.38, split: 0.5 },
        hurt: { frames: ['mage_plate_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.015, squash: 0.03, lean: 1, lunge: 2, stretch: 0.04, recoil: 2, breathe: 0.02, breathT: 1.7, dust: 1, faces: 1, die: 0.9 }
      },
      // the archer with no gear on (Grok, 4x2, chibi, green hunter's shirt, the green rod as the bow)
      archer_bare: {
        hands: true,
        skills: ['archer_bare_skill_0', 'archer_bare_skill_1', 'archer_bare_skill_2', 'archer_bare_skill_3'],
        backstep: 'archer_bare_skill_3',      // the quick shot while stepping back: shooting behind the walk
        idle: { frames: ['archer_bare_idle_0'] },
        walk: { frames: ['archer_bare_walk_0', 'archer_bare_walk_1', 'archer_bare_walk_2', 'archer_bare_walk_3'], fps: 8 },
        attack: { frames: ['archer_bare_attack_0', 'archer_bare_attack_1'], fps: 14, hold: 0.14, dur: 0.38, split: 0.5 },
        hurt: { frames: ['archer_bare_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.015, squash: 0.03, lean: 1, lunge: 1, stretch: 0.03, recoil: 2, breathe: 0.02, breathT: 1.7, dust: 1, faces: 1, die: 0.9 }
      },
      // the warrior with no gear on (Grok, 4x2, generated holding a green rod that tools/hand_weapon.py took out): the same
      // eight poses; `hands`: its frames carry the fist, so the equipped weapon is drawn into it (G.HD.heroWeapon)
      warrior_bare: {
        hands: true,
        skills: ['warrior_bare_skill_0', 'warrior_bare_skill_1', 'warrior_bare_skill_2', 'warrior_bare_skill_3'],      // skill poses (Grok extra row), not used by the game yet
        idle: { frames: ['warrior_bare_idle_0'] },
        walk: { frames: ['warrior_bare_walk_0', 'warrior_bare_walk_1', 'warrior_bare_walk_2', 'warrior_bare_walk_3'], fps: 8 },
        attack: { frames: ['warrior_bare_attack_0', 'warrior_bare_attack_1'], fps: 14, hold: 0.14, dur: 0.38, split: 0.5 },
        hurt: { frames: ['warrior_bare_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.015, squash: 0.03, lean: 1, lunge: 3, stretch: 0.04, recoil: 2, breathe: 0.02, breathT: 1.8, dust: 1, faces: 1, die: 0.9 }
      },
      // the warrior in leather (light) armour (chibi, 2026-11-13): the bare sheet's poses, head and hands bare, the trim recoloured by rarity (tools/trim_fx.py)
      warrior_leather: {
        hands: true,
        idle: { frames: ['warrior_leather_idle_0'] },
        walk: { frames: ['warrior_leather_walk_0', 'warrior_leather_walk_1', 'warrior_leather_walk_2', 'warrior_leather_walk_3'], fps: 8 },
        attack: { frames: ['warrior_leather_attack_0', 'warrior_leather_attack_1'], fps: 14, hold: 0.14, dur: 0.38, split: 0.5 },
        hurt: { frames: ['warrior_leather_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.015, squash: 0.03, lean: 1, lunge: 3, stretch: 0.04, recoil: 2, breathe: 0.02, breathT: 1.8, dust: 1, faces: 1, die: 0.9 }
      },
      // the warrior in chainmail (medium) armour: the bare sheet's poses, head and hands bare, the trim recoloured by rarity (tools/trim_fx.py)
      warrior_chain: {
        hands: true,
        idle: { frames: ['warrior_chain_idle_0'] },
        walk: { frames: ['warrior_chain_walk_0', 'warrior_chain_walk_1', 'warrior_chain_walk_2', 'warrior_chain_walk_3'], fps: 8 },
        attack: { frames: ['warrior_chain_attack_0', 'warrior_chain_attack_1'], fps: 14, hold: 0.14, dur: 0.38, split: 0.5 },
        hurt: { frames: ['warrior_chain_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.015, squash: 0.03, lean: 1, lunge: 3, stretch: 0.04, recoil: 2, breathe: 0.02, breathT: 1.8, dust: 1, faces: 1, die: 0.9 }
      },
      // the warrior in plate (heavy) armour: the bare sheet's poses, head and hands bare, the trim recoloured by rarity (tools/trim_fx.py)
      warrior_plate: {
        hands: true,
        idle: { frames: ['warrior_plate_idle_0'] },
        walk: { frames: ['warrior_plate_walk_0', 'warrior_plate_walk_1', 'warrior_plate_walk_2', 'warrior_plate_walk_3'], fps: 8 },
        attack: { frames: ['warrior_plate_attack_0', 'warrior_plate_attack_1'], fps: 14, hold: 0.14, dur: 0.38, split: 0.5 },
        hurt: { frames: ['warrior_plate_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.015, squash: 0.03, lean: 1, lunge: 3, stretch: 0.04, recoil: 2, breathe: 0.02, breathT: 1.8, dust: 1, faces: 1, die: 0.9 }
      },
      // the archer (Grok, 4x2, the chosen chibi style): walk x4 (no bow in hand), idle, bow drawn, released, a third shot as hurt
      archer: {
        idle: { frames: ['archer_idle_0'] },
        walk: { frames: ['archer_walk_0', 'archer_walk_1', 'archer_walk_2', 'archer_walk_3'], fps: 8 },
        attack: { frames: ['archer_attack_0', 'archer_attack_1'], fps: 14, hold: 0.14 },
        hurt: { frames: ['archer_hurt'], hold: 0.25 },
        motion: { bob: 1, tilt: 0.015, squash: 0.03, lean: 1, lunge: 1, stretch: 0.03, recoil: 2, breathe: 0.02, breathT: 1.7, dust: 1, faces: 1, die: 0.9 }
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
