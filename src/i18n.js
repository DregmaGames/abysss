// Languages (step 8b): every player-facing string goes through G.t(key, params). One flat table per language: G.LANG.en and G.LANG.es.
// The sim stays language-free: it hands out ids and keys (S.objective returns 'obj.*', events carry 'msg.*'), the view translates.
// English texts of the data tables (abilities, families, ranks, doors, classes, weapon bases) are copied from src/balance.js when this file loads,
// so there is one source for them; the Spanish table has the same keys (tools/check_i18n.js checks both).
// Item names are not stored text: G.itemName(item) assembles them from slot, weapon type, rarity and first bonus stat, with one rule per language.
(function (G) {
  var B = G.BAL;
  G.lang = 'en';
  G.LANGS = ['en', 'es'];

  // ------------------------------------------------------------------ English
  var en = {
    // title
    'menu.play': 'PLAY',
    'menu.settings': 'SETTINGS',
    'menu.credits': 'CREDITS',
    'menu.quit': 'QUIT',
    'menu.quitMsg': 'Close the tab to quit. See you in the rifts.',
    'menu.choose': 'CHOOSE YOUR HERO',
    'menu.pick': 'CHOOSE',
    'menu.back': 'BACK',
    'menu.gear': 'Gear score {gs}',
    'menu.creditsTitle': 'CREDITS',
    'menu.creditsBody': 'A game by DregmaGames||Design and direction: the DregmaGames brothers|Art: made with Grok, directed by DregmaGames|Code: written with Claude (Anthropic)|Engine: Phaser 3||Thank you for playing!',
    'cdesc.warrior': 'Heavy hits up close. Tough.',
    'cdesc.mage': 'Fire bolts from afar. Fragile.',
    'cdesc.archer': 'Long range, arrow volleys. Fast.',
    'title.tag': 'Seal the rifts. Keep what you find.',
    'title.enter': 'ENTER THE CITY',
    'title.reroll': 'REROLL',
    'title.test': 'TEST ROOM (PRACTICE)',
    'title.helpTouch': 'Drag to move.  Buttons: dodge, {skill}.',
    'title.helpKeys': 'WASD move    SPACE dodge    Q {skill}    I inventory',
    'title.helpKeys1': 'WASD move   SPACE dodge',
    'title.helpKeys2': 'Q {skill}   I inventory',
    'title.gear': 'Gear score {gs}   Monsters x{k}',
    'title.seed': 'Seed {n}',
    // city
    'city.smith': 'BLACKSMITH', 'city.trainer': 'TRAINER', 'city.mageQuarter': 'MAGE QUARTER', 'city.emptyStall': 'EMPTY STALL', 'city.rift': 'THE RIFT',
    'city.talk': 'TALK', 'city.read': 'READ', 'city.look': 'LOOK',
    'city.closer': 'Walk closer',
    'city.mageSign': 'Mage quarter: nothing built here yet.',
    'city.neutralQuarter': 'NEUTRAL QUARTER', 'city.neutralSign': 'Neutral quarter: room for more stalls.',
    'city.end': 'END',
    // Don Montoto
    'mon.name': 'DON MONTOTO',
    'mon.clearFirst': 'Clear the room first',
    'mon.freed': 'DON MONTOTO FREED',
    'mon.freeHim': 'FREE HIM',
    'mon.locked': 'LOCKED',
    'mon.emptyStall': 'An empty stall. Someone is missing: look for a cage in room 5 of the rift.',
    'mon.examining': 'Let me see...',
    'mon.next': 'NEXT ({n} more)',
    'mon.ok': 'OK',
    'mon.skip': 'SKIP',
    'mon.hidden': 'UNIDENTIFIED IN YOUR KEPT BAG: {n}',
    'mon.identifyAll': 'IDENTIFY ALL (FREE)',
    'mon.nothingToIdentify': 'NOTHING TO IDENTIFY',
    'mon.again': 'Talk to me again for another story.',
    'mon.sellHint': 'Don Montoto identifies them for free.',
    // objectives (from the sim) and the HUD
    'obj.fissures': 'Seal the fissures', 'obj.super': 'Close the super fissure', 'obj.boss': 'Slay the Rift Tyrant', 'obj.chest': 'Open the chest',
    'obj.gate': 'Leave through the gate', 'obj.exit': 'Take the exit',
    'hud.room': 'Room {n}/{m}', 'hud.test': 'Test #{n}', 'hud.level': 'LV {n}',
    'msg.bagFull': 'Bag is full',
    'toast.scroll': 'Scroll of Identification', 'toast.tome': 'Ability tome', 'toast.famBonus': '{fam} bonus {n}!',
    'toast.scrollBought': 'Scroll bought (sealed)', 'toast.potion': 'You feel better',
    'game.trade': 'TRADE', 'game.dodgeToCross': 'DODGE TO CROSS',
    'phase.fissures': 'fissures', 'phase.super': 'super', 'phase.chest': 'chest', 'phase.exit': 'exit',
    // merchant
    'merch.title': 'MERCHANT', 'merch.gold': 'Run gold: {n}', 'merch.scroll': 'Scroll of Identification', 'merch.scrollDesc': 'Reveals an item',
    'merch.potion': 'Healing potion', 'merch.potionDesc': 'Heals {n}% HP', 'merch.left': '{desc} - {n} left', 'merch.close': 'CLOSE',
    // after-room choice
    'choice.title': 'ROOM {n} CLEARED', 'choice.bag': 'Sealed bag: {items}', 'choice.best': 'best: {r}', 'choice.loot': '+{n}% loot',
    'choice.leave': 'LEAVE WITH THE BAG', 'choice.note': 'Leaving or winning keeps the bag. Dying loses it.',
    // doors
    'door.crackLonger': 'Cracks {p} longer', 'door.crackShorter': 'Cracks {p} shorter',
    'door.extraOne': '+{n} crack', 'door.extraMany': '+{n} cracks', 'door.extraNeg': '{n} cracks',
    'door.spawnFaster': 'Monsters come {p} faster', 'door.spawnSlower': 'Monsters come {p} slower',
    'door.aliveMore': '{p} more monsters alive at once', 'door.aliveFewer': '{p} fewer monsters alive at once',
    'door.eliteLine': 'An extra {name} in the super fissure',
    'door.threatUp': 'Monsters {p} stronger', 'door.threatDown': 'Monsters {p} weaker',
    // level up
    'lvl.level': 'LEVEL {n}', 'lvl.tome': 'ABILITY TOME', 'lvl.choose': 'Choose one', 'lvl.active': 'ACTIVE', 'lvl.passive': 'PASSIVE',
    'lvl.new': 'NEW', 'lvl.rank': 'Rank {r}/{m}', 'lvl.replaces': 'Replaces a slot', 'lvl.slots': 'ACTIVE SLOTS', 'lvl.empty': 'Empty',
    'lvl.families': 'FAMILIES', 'lvl.replaceWhich': 'Replace which active?',
    'lvl.replaceNote': 'It replaces one of your actives. The old one loses all its ranks.', 'lvl.back': 'BACK',
    'lvl.loses': '{fam} {a} -> {b}: loses {bn}',
    // abilities panel
    'abil.title': 'ABILITIES', 'abil.actives': 'ACTIVE', 'abil.passives': 'PASSIVE', 'abil.emptySlot': 'Empty slot', 'abil.none': 'None yet',
    'abil.nextAt': 'next at 2: {desc}',
    // inventory
    'inv.gear': 'GEAR', 'inv.equipment': 'EQUIPMENT',
    'inv.rowGear': 'Gear', 'inv.rowHp': 'HP', 'inv.rowArmor': 'Armor', 'inv.rowDamage': 'Damage', 'inv.rowAtk': 'Atk/s', 'inv.rowCrit': 'Crit',
    'inv.rowMove': 'Move', 'inv.rowRange': 'Range', 'inv.rowRegen': 'Regen',
    'inv.sealedBag': 'SEALED BAG {n}/{m}', 'inv.sealedBagRun': 'SEALED BAG OF THIS RUN {n}/{m}', 'inv.bag': 'BAG {n}/{m}',
    'inv.sealedScrolls': '({n} sealed)', 'inv.foundNote': 'Found in this run. Lost if you die.',
    'inv.tapRun': 'Tap an item for its stats. Tap it again to equip.', 'inv.tapWide': 'Tap an item to see its stats. Tap it again to equip.', 'inv.tapNarrow': 'Tap an item for its stats. Tap again to equip.',
    'inv.foreign': '{cls} weapon', 'inv.itemLevel': 'Item level {n}', 'inv.lv': 'Lv {n}',
    'inv.unid': 'UNIDENTIFIED', 'inv.hiddenScroll': 'Stats are hidden. Use a scroll to reveal them.', 'inv.hiddenNeed': 'Stats are hidden. Needs a Scroll of Identification.',
    'inv.identify': 'IDENTIFY', 'inv.equip': 'EQUIP', 'inv.drop': 'DROP', 'inv.unequip': 'UNEQUIP', 'inv.sell': 'SELL {n}g',
    // shop
    'shop.smith': 'BLACKSMITH', 'shop.trainer': 'TRAINER', 'shop.buy': 'BUY', 'shop.sell': 'SELL', 'shop.upgrade': 'UPGRADE',
    'shop.forSale': 'FOR SALE', 'shop.scroll': 'Scroll of Identification', 'shop.scrollDesc': 'Reveals the stats of one unidentified item.', 'shop.have': 'You have {n}',
    'shop.buyPrice': 'BUY {n}g', 'shop.bagFull': 'BAG IS FULL',
    'shop.tapBuy': 'Tap an item for its stats and price. A rare costs a lot: only one is ever in stock.',
    'shop.sellOne': 'SELL 1 +{n}', 'shop.sellsFor': 'Sells for {n} ({m} if identified)', 'shop.tapSell': 'Tap an item to sell it. Unidentified items sell for less:',
    'shop.upList': 'WORN AND KEPT ITEMS YOU FOUND', 'shop.upLevel': 'Level {a} > {b}   Upgrades {n}/{m}', 'shop.upPrice': 'UPGRADE {n}g',
    'shop.tapUp': 'Tap an item: +1 item level for gold. Shop items cannot be upgraded. Identify unknown items first.',
    'shop.nothingUp': 'Nothing to upgrade. Only identified items you found can be upgraded.',
    'shop.unidCard': 'Unidentified: stats hidden', 'shop.slotEmpty': 'Slot is empty', 'shop.better': 'Better than worn', 'shop.notBetter': 'Not better than worn',
    'shop.ranks': 'PERMANENT RANKS (this class)', 'shop.rankNow': '(now +{n})', 'shop.max': 'MAX', 'shop.rankBuy': 'BUY {n}', 'shop.ranksNote': 'Ranks apply to every run of this class.',
    // settings
    'set.title': 'SETTINGS', 'set.language': 'Language', 'set.zoom': 'Zoom', 'set.zoomNone': 'Screen too small to zoom in.', 'set.zoomHint': 'Bigger pixels, closer view.',
    'set.music': 'Music', 'set.sfx': 'Effects', 'set.shake': 'Shake', 'set.shakeHint': 'Set to 0% to turn shake off.', 'set.resume': 'RESUME', 'set.close': 'CLOSE', 'set.quit': 'QUIT RUN', 'set.reset': 'RESET SAVE',
    // debug
    'dbg.title': 'DEBUG', 'dbg.god': 'GOD {s}', 'dbg.noCd': 'NO CD {s}', 'dbg.on': 'ON', 'dbg.off': 'OFF', 'dbg.speed': 'SPEED x{n}', 'dbg.killAll': 'KILL ALL',
    'dbg.skip': 'SKIP PHASE', 'dbg.level': 'LEVEL UP', 'dbg.restart': 'RESTART ROOM', 'dbg.next': 'NEXT ROOM', 'dbg.boss': 'BOSS ROOM', 'dbg.loot': 'GIVE LOOT',
    'dbg.doors': 'DOORS', 'dbg.merchant': 'MERCHANT', 'dbg.cage': 'CAGE', 'dbg.abilities': 'ABILITIES', 'dbg.glow': 'GLOW: {s}',
    'dbg.info': 'Room {n}  {phase}  seed {s}',
    // DBG > SIZES (step size panel): a test tool for the developers
    'dbg.sizes': 'SIZES', 'size.title': 'SIZES (TEST)', 'size.hero': 'HERO', 'size.monsters': 'MONSTERS', 'size.room': 'ROOM', 'size.city': 'CITY',
    'size.obstacles': 'OBSTACLES', 'size.fissures': 'FISSURES', 'size.now': 'now', 'size.next': 'next room',
    'size.visual': 'Hero, monsters: drawn size only, same hitboxes.', 'size.reset': 'RESET', 'size.copy': 'COPY', 'size.copied': 'COPIED',
    'size.newRoom': 'NEW ROOM', 'size.back': 'BACK',
    // result
    'res.won': 'RIFT SEALED', 'res.left': 'YOU LEFT', 'res.dead': 'YOU DIED',
    'res.allCleared': 'All {n} rooms cleared', 'res.leftAfter': 'Left after room {a} of {b}', 'res.fellTest': 'Fell in the test room (clears: {n})', 'res.fell': 'Fell in room {a} of {b}',
    'res.stats': 'Level {l}   Kills {k}   {t}',
    'res.bagLost': 'The bag was lost: {items}', 'res.wornKept': '  (worn gear kept)', 'res.wornLost': '  (worn gear lost)', 'res.bagEmpty': 'The bag was empty',
    'res.kept': '{items} kept in your bag', 'res.keptLost': ', {n} lost (bag full)',
    'res.goldLost': 'Gold: {n} lost', 'res.goldNone': 'Gold: none earned', 'res.goldKept': 'Gold: +{n} kept', 'res.gear': 'Gear score {n}',
    'res.again': 'RUN AGAIN', 'res.city': 'BACK TO CITY',
    'title.daily': 'DAILY RIFT', 'city.daily': 'DAILY RIFT',
    'daily.title': 'DAILY RIFT', 'daily.date': 'Today (UTC): {d}', 'daily.class': 'Class: {c}',
    'daily.rules': 'Same seed, class and doors for everyone today. Fixed starting kit.',
    'daily.kept': 'Practice run: nothing found is kept.',
    'daily.start': 'START', 'daily.again': 'TRY AGAIN', 'daily.copy': 'COPY SHARE TEXT', 'daily.copied': 'Copied to the clipboard', 'daily.copyFail': 'Could not copy',
    'daily.manual': 'Copy this text by hand (select it, then Ctrl+C or long press):',
    'daily.score': 'SCORE {n}', 'daily.parts': 'Rooms {r} + kills {k} + win {w}',
    'daily.share': 'Riftscar Daily Rift {d} - {c} - {res} - {k} kills - {t} - score {n}',
    'daily.shareWon': 'rift sealed', 'daily.shareDead': 'fell in room {a}/{b}', 'daily.shareLeft': 'left after room {a}/{b}', 'daily.shareOn': 'in room {a}/{b}',
    // counts
    'items.one': '{n} item', 'items.other': '{n} items',
    // item parts (English assembly: [adjective] base)
    'base.helmet': 'Cowl', 'base.armor': 'Robe', 'base.gloves': 'Wraps', 'base.boots': 'Treads', 'base.belt': 'Sash', 'base.weapon': 'Staff', 'base.shield': 'Ward',
    'adj.worn': 'Worn', 'adj.hp': 'Stalwart', 'adj.dmgPct': 'Savage', 'adj.atkPct': 'Swift', 'adj.movePct': 'Fleet', 'adj.armor': 'Warded', 'adj.crit': 'Keen',
    'adj.rangePct': 'Far', 'adj.pulsePct': 'Resonant', 'adj.cdrPct': 'Lucid', 'adj.regen': 'Mending', 'adj.expPct': 'Sage',
    'slot.helmet': 'Helmet', 'slot.armor': 'Armor', 'slot.gloves': 'Gloves', 'slot.boots': 'Boots', 'slot.belt': 'Belt', 'slot.weapon': 'Weapon', 'slot.shield': 'Shield',
    'wt.staff': 'Staff', 'wt.sword': 'Sword', 'wt.axe': 'Axe', 'wt.mace': 'Mace', 'wt.hammer': 'Hammer', 'wt.bow': 'Bow',
    'stat.hp': 'Max HP', 'stat.dmgPct': 'Damage', 'stat.atkPct': 'Atk speed', 'stat.movePct': 'Move speed', 'stat.armor': 'Armor', 'stat.crit': 'Crit chance',
    'stat.rangePct': 'Range', 'stat.pulsePct': 'Skill dmg', 'stat.cdrPct': 'Cooldowns', 'stat.regen': 'HP regen', 'stat.expPct': 'EXP gain',
    'rar.0': 'Common', 'rar.1': 'Magic', 'rar.2': 'Rare', 'rar.3': 'Epic', 'rar.4': 'Legendary',
    'mat.0': 'Light (leather)', 'mat.1': 'Medium (chainmail)', 'mat.2': 'Heavy (plate)',
    'mob.imp': 'Imp', 'mob.bat': 'Bat', 'mob.skeleton': 'Skeleton', 'mob.hound': 'Hound', 'mob.cultist': 'Cultist', 'mob.warden': 'Warden', 'mob.tyrant': 'Rift Tyrant'
  };

  // ------------------------------------------------------------------ Spanish (neutral Latin American, "tú")
  // Rift = "brecha", fissure = "fisura", super fissure = "fisura mayor", crack = "grieta", run = "incursión", item = "objeto".
  var es = {
    'menu.play': 'JUGAR',
    'menu.settings': 'AJUSTES',
    'menu.credits': 'CRÉDITOS',
    'menu.quit': 'SALIR',
    'menu.quitMsg': 'Cierra la pestaña para salir. Nos vemos en las fisuras.',
    'menu.choose': 'ELIGE TU HÉROE',
    'menu.pick': 'ELEGIR',
    'menu.back': 'VOLVER',
    'menu.gear': 'Equipo {gs}',
    'menu.creditsTitle': 'CRÉDITOS',
    'menu.creditsBody': 'Un juego de DregmaGames||Diseño y dirección: los hermanos DregmaGames|Arte: hecho con Grok, dirigido por DregmaGames|Código: escrito con Claude (Anthropic)|Motor: Phaser 3||¡Gracias por jugar!',
    'cdesc.warrior': 'Golpes pesados de cerca. Resistente.',
    'cdesc.mage': 'Fuego a distancia. Frágil.',
    'cdesc.archer': 'Largo alcance, salvas de flechas. Veloz.',
    'title.tag': 'Sella las fisuras. Quédate con lo que encuentres.',
    'title.enter': 'ENTRAR A LA CIUDAD',
    'title.reroll': 'CAMBIAR',
    'title.test': 'SALA DE PRUEBA',
    'title.helpTouch': 'Arrastra para moverte.  Botones: esquivar, {skill}.',
    'title.helpKeys': 'WASD mover    ESPACIO esquivar    Q {skill}    I inventario',
    'title.helpKeys1': 'WASD mover   ESPACIO esquivar',
    'title.helpKeys2': 'Q {skill}   I inventario',
    'title.gear': 'Equipo {gs}   Monstruos x{k}',
    'title.seed': 'Semilla {n}',
    'city.smith': 'HERRERO', 'city.trainer': 'ENTRENADOR', 'city.mageQuarter': 'BARRIO DEL MAGO', 'city.emptyStall': 'PUESTO VACÍO', 'city.rift': 'LA BRECHA',
    'city.talk': 'HABLAR', 'city.read': 'LEER', 'city.look': 'MIRAR',
    'city.closer': 'Acércate más',
    'city.mageSign': 'Barrio del Mago: aún no hay nada construido.',
    'city.neutralQuarter': 'BARRIO NEUTRAL', 'city.neutralSign': 'Barrio Neutral: hay lugar para más puestos.',
    'city.end': 'FIN',
    'mon.name': 'DON MONTOTO',
    'mon.clearFirst': 'Limpia la sala primero',
    'mon.freed': 'DON MONTOTO LIBRE',
    'mon.freeHim': 'LIBÉRALO',
    'mon.locked': 'CERRADO',
    'mon.emptyStall': 'Un puesto vacío. Falta alguien: busca una jaula en la sala 5 de la brecha.',
    'mon.examining': 'Déjame ver...',
    'mon.next': 'SIGUIENTE ({n} más)',
    'mon.ok': 'LISTO',
    'mon.skip': 'SALTAR',
    'mon.hidden': 'SIN IDENTIFICAR EN TU BOLSA: {n}',
    'mon.identifyAll': 'IDENTIFICAR TODO (GRATIS)',
    'mon.nothingToIdentify': 'NADA QUE IDENTIFICAR',
    'mon.again': 'Háblame otra vez para otra historia.',
    'mon.sellHint': 'Don Montoto los identifica gratis.',
    'obj.fissures': 'Sella las fisuras', 'obj.super': 'Cierra la fisura mayor', 'obj.boss': 'Mata al Tirano de la Brecha', 'obj.chest': 'Abre el cofre',
    'obj.gate': 'Sal por la puerta', 'obj.exit': 'Toma la salida',
    'hud.room': 'Sala {n}/{m}', 'hud.test': 'Prueba #{n}', 'hud.level': 'NV {n}',
    'msg.bagFull': 'Bolsa llena',
    'toast.scroll': 'Pergamino de Identificación', 'toast.tome': 'Tomo de habilidad', 'toast.famBonus': '¡Bono de {fam} {n}!',
    'toast.scrollBought': 'Pergamino comprado (sellado)', 'toast.potion': 'Te sientes mejor',
    'game.trade': 'COMERCIAR', 'game.dodgeToCross': 'ESQUIVA PARA CRUZAR',
    'phase.fissures': 'fisuras', 'phase.super': 'mayor', 'phase.chest': 'cofre', 'phase.exit': 'salida',
    'merch.title': 'MERCADER', 'merch.gold': 'Oro de la incursión: {n}', 'merch.scroll': 'Pergamino de Identificación', 'merch.scrollDesc': 'Revela un objeto',
    'merch.potion': 'Poción de curación', 'merch.potionDesc': 'Cura {n}% de vida', 'merch.left': '{desc} - quedan {n}', 'merch.close': 'CERRAR',
    'choice.title': 'SALA {n} LIMPIA', 'choice.bag': 'Bolsa sellada: {items}', 'choice.best': 'mejor: {r}', 'choice.loot': '+{n}% de botín',
    'choice.leave': 'SALIR CON LA BOLSA', 'choice.note': 'Salir o ganar conserva la bolsa. Morir la pierde.',
    'door.crackLonger': 'Grietas {p} más largas', 'door.crackShorter': 'Grietas {p} más cortas',
    'door.extraOne': '+{n} grieta', 'door.extraMany': '+{n} grietas', 'door.extraNeg': '{n} grietas',
    'door.spawnFaster': 'Los monstruos llegan {p} más rápido', 'door.spawnSlower': 'Los monstruos llegan {p} más lento',
    'door.aliveMore': '{p} más monstruos vivos a la vez', 'door.aliveFewer': '{p} menos monstruos vivos a la vez',
    'door.eliteLine': 'Un {name} extra en la fisura mayor',
    'door.threatUp': 'Monstruos {p} más fuertes', 'door.threatDown': 'Monstruos {p} más débiles',
    'lvl.level': 'NIVEL {n}', 'lvl.tome': 'TOMO DE HABILIDAD', 'lvl.choose': 'Elige una', 'lvl.active': 'ACTIVA', 'lvl.passive': 'PASIVA',
    'lvl.new': 'NUEVA', 'lvl.rank': 'Rango {r}/{m}', 'lvl.replaces': 'Reemplaza una ranura', 'lvl.slots': 'RANURAS ACTIVAS', 'lvl.empty': 'Vacía',
    'lvl.families': 'FAMILIAS', 'lvl.replaceWhich': '¿Cuál activa reemplazar?',
    'lvl.replaceNote': 'Reemplaza una de tus activas. La anterior pierde todos sus rangos.', 'lvl.back': 'VOLVER',
    'lvl.loses': '{fam} {a} -> {b}: pierdes {bn}',
    'abil.title': 'HABILIDADES', 'abil.actives': 'ACTIVAS', 'abil.passives': 'PASIVAS', 'abil.emptySlot': 'Ranura vacía', 'abil.none': 'Ninguna aún',
    'abil.nextAt': 'con 2: {desc}',
    'inv.gear': 'EQUIPO', 'inv.equipment': 'EQUIPO',
    'inv.rowGear': 'Equipo', 'inv.rowHp': 'Vida', 'inv.rowArmor': 'Armadura', 'inv.rowDamage': 'Daño', 'inv.rowAtk': 'Atq/s', 'inv.rowCrit': 'Crít.',
    'inv.rowMove': 'Mov.', 'inv.rowRange': 'Alcance', 'inv.rowRegen': 'Regen.',
    'inv.sealedBag': 'BOLSA SELLADA {n}/{m}', 'inv.sealedBagRun': 'BOLSA SELLADA DE LA INCURSIÓN {n}/{m}', 'inv.bag': 'BOLSA {n}/{m}',
    'inv.sealedScrolls': '({n} selladas)', 'inv.foundNote': 'Hallados en esta incursión. Se pierden si mueres.',
    'inv.tapRun': 'Toca un objeto para ver sus estadísticas. Tócalo otra vez para equiparlo.', 'inv.tapWide': 'Toca un objeto para ver sus estadísticas. Tócalo otra vez para equiparlo.', 'inv.tapNarrow': 'Toca un objeto para ver sus estadísticas. Otra vez para equiparlo.',
    'inv.foreign': 'Arma de {cls}', 'inv.itemLevel': 'Nivel de objeto {n}', 'inv.lv': 'Nv {n}',
    'inv.unid': 'SIN IDENTIFICAR', 'inv.hiddenScroll': 'Estadísticas ocultas. Usa un pergamino para revelarlas.', 'inv.hiddenNeed': 'Estadísticas ocultas. Necesita un Pergamino de Identificación.',
    'inv.identify': 'IDENTIFICAR', 'inv.equip': 'EQUIPAR', 'inv.drop': 'TIRAR', 'inv.unequip': 'QUITAR', 'inv.sell': 'VENDER {n}g',
    'shop.smith': 'HERRERO', 'shop.trainer': 'ENTRENADOR', 'shop.buy': 'COMPRAR', 'shop.sell': 'VENDER', 'shop.upgrade': 'MEJORAR',
    'shop.forSale': 'EN VENTA', 'shop.scroll': 'Pergamino de Identificación', 'shop.scrollDesc': 'Revela las estadísticas de un objeto sin identificar.', 'shop.have': 'Tienes {n}',
    'shop.buyPrice': 'COMPRAR {n}g', 'shop.bagFull': 'BOLSA LLENA',
    'shop.tapBuy': 'Toca un objeto para ver sus estadísticas y precio. Un raro cuesta mucho: solo hay uno en existencia.',
    'shop.sellOne': 'VENDER 1 +{n}', 'shop.sellsFor': 'Se vende por {n} ({m} si está identificado)', 'shop.tapSell': 'Toca un objeto para venderlo. Los no identificados valen menos:',
    'shop.upList': 'EQUIPADOS Y GUARDADOS QUE HALLASTE', 'shop.upLevel': 'Nivel {a} > {b}   Mejoras {n}/{m}', 'shop.upPrice': 'MEJORAR {n}g',
    'shop.tapUp': 'Toca un objeto: +1 nivel de objeto por oro. Los de la tienda no se pueden mejorar. Identifica antes los desconocidos.',
    'shop.nothingUp': 'Nada que mejorar. Solo se pueden mejorar los objetos hallados e identificados.',
    'shop.unidCard': 'Sin identificar: estadísticas ocultas', 'shop.slotEmpty': 'Ranura vacía', 'shop.better': 'Mejor que el equipado', 'shop.notBetter': 'No es mejor que el equipado',
    'shop.ranks': 'RANGOS PERMANENTES (esta clase)', 'shop.rankNow': '(ahora +{n})', 'shop.max': 'MÁX', 'shop.rankBuy': 'COMPRAR {n}', 'shop.ranksNote': 'Los rangos valen en cada incursión de esta clase.',
    'set.title': 'AJUSTES', 'set.language': 'Idioma', 'set.zoom': 'Zoom', 'set.zoomNone': 'Pantalla muy pequeña para acercar.', 'set.zoomHint': 'Vista más cercana.',
    'set.music': 'Música', 'set.sfx': 'Efectos', 'set.shake': 'Temblor', 'set.shakeHint': 'Pon 0% para quitar el temblor.', 'set.resume': 'SEGUIR', 'set.close': 'CERRAR', 'set.quit': 'ABANDONAR', 'set.reset': 'BORRAR DATOS',
    'dbg.title': 'DEPURAR', 'dbg.god': 'DIOS {s}', 'dbg.noCd': 'SIN RECARGA {s}', 'dbg.on': 'SÍ', 'dbg.off': 'NO', 'dbg.speed': 'VELOCIDAD x{n}', 'dbg.killAll': 'MATAR TODO',
    'dbg.skip': 'SALTAR FASE', 'dbg.level': 'SUBIR NIVEL', 'dbg.restart': 'REINICIAR SALA', 'dbg.next': 'SIGUIENTE SALA', 'dbg.boss': 'SALA DEL JEFE', 'dbg.loot': 'DAR BOTÍN',
    'dbg.doors': 'PUERTAS', 'dbg.merchant': 'MERCADER', 'dbg.cage': 'JAULA', 'dbg.abilities': 'HABILIDADES', 'dbg.glow': 'BRILLO: {s}',
    'dbg.info': 'Sala {n}  {phase}  semilla {s}',
    'dbg.sizes': 'TAMAÑOS', 'size.title': 'TAMAÑOS (PRUEBA)', 'size.hero': 'HÉROE', 'size.monsters': 'MONSTRUOS', 'size.room': 'SALA', 'size.city': 'CIUDAD',
    'size.obstacles': 'OBSTÁCULOS', 'size.fissures': 'FISURAS', 'size.now': 'ya', 'size.next': 'próx. sala',
    'size.visual': 'Héroe, monstruos: solo el dibujo; el golpe no cambia.', 'size.reset': 'ORIGINAL', 'size.copy': 'COPIAR', 'size.copied': 'COPIADO',
    'size.newRoom': 'OTRA SALA', 'size.back': 'VOLVER',
    'res.won': 'BRECHA SELLADA', 'res.left': 'SALISTE', 'res.dead': 'MORISTE',
    'res.allCleared': 'Las {n} salas limpias', 'res.leftAfter': 'Saliste tras la sala {a} de {b}', 'res.fellTest': 'Caíste en la sala de prueba (limpias: {n})', 'res.fell': 'Caíste en la sala {a} de {b}',
    'res.stats': 'Nivel {l}   Bajas {k}   {t}',
    'res.bagLost': 'Perdiste la bolsa: {items}', 'res.wornKept': '  (conservas lo que llevas puesto)', 'res.wornLost': '  (pierdes lo que llevas puesto)', 'res.bagEmpty': 'La bolsa estaba vacía',
    'res.kept': '{items} en tu bolsa', 'res.keptLost': ', {n} perdidos (bolsa llena)',
    'res.goldLost': 'Oro: {n} perdido', 'res.goldNone': 'Oro: nada ganado', 'res.goldKept': 'Oro: +{n} conservado', 'res.gear': 'Equipo {n}',
    'res.again': 'OTRA INCURSIÓN', 'res.city': 'A LA CIUDAD',
    'title.daily': 'RETO DIARIO', 'city.daily': 'RETO DIARIO',
    'daily.title': 'RETO DIARIO', 'daily.date': 'Hoy (UTC): {d}', 'daily.class': 'Clase: {c}',
    'daily.rules': 'La misma semilla, clase y puertas para todos hoy. Equipo inicial fijo.',
    'daily.kept': 'Incursión de práctica: no conservas nada.',
    'daily.start': 'EMPEZAR', 'daily.again': 'REINTENTAR', 'daily.copy': 'COPIAR PARA COMPARTIR', 'daily.copied': 'Copiado al portapapeles', 'daily.copyFail': 'No se pudo copiar',
    'daily.manual': 'Copia este texto a mano (selecciónalo y pulsa Ctrl+C o mantén pulsado):',
    'daily.score': 'PUNTOS {n}', 'daily.parts': 'Salas {r} + bajas {k} + victoria {w}',
    'daily.share': 'Riftscar Reto Diario {d} - {c} - {res} - {k} bajas - {t} - {n} puntos',
    'daily.shareWon': 'brecha sellada', 'daily.shareDead': 'caí en la sala {a}/{b}', 'daily.shareLeft': 'salí tras la sala {a}/{b}', 'daily.shareOn': 'en la sala {a}/{b}',
    'items.one': '{n} objeto', 'items.other': '{n} objetos',
    // item parts (Spanish assembly: noun + intrinsic adjective + bonus adjective + complement, all agreeing with the noun)
    // base value: 'Noun;gender (m/f + s/p);intrinsic adjective (masculine singular);complement'
    'base.helmet': 'Capucha;fs;;', 'base.armor': 'Túnica;fs;;', 'base.gloves': 'Vendas;fp;;', 'base.boots': 'Botines;mp;;', 'base.belt': 'Faja;fs;;', 'base.weapon': 'Bastón;ms;;', 'base.shield': 'Égida;fs;;',
    'adj.worn': 'Gastado', 'adj.hp': 'Robusto', 'adj.dmgPct': 'Salvaje', 'adj.atkPct': 'Veloz', 'adj.movePct': 'Ágil', 'adj.armor': 'Protegido', 'adj.crit': 'Certero',
    'adj.rangePct': 'Lejano', 'adj.pulsePct': 'Resonante', 'adj.cdrPct': 'Lúcido', 'adj.regen': 'Sanador', 'adj.expPct': 'Sabio',
    'slot.helmet': 'Casco;ms', 'slot.armor': 'Armadura;fs', 'slot.gloves': 'Guantes;mp', 'slot.boots': 'Botas;fp', 'slot.belt': 'Cinturón;ms', 'slot.weapon': 'Arma;fs', 'slot.shield': 'Escudo;ms',
    'wt.staff': 'Bastón;ms', 'wt.sword': 'Espada;fs', 'wt.axe': 'Hacha;fs', 'wt.mace': 'Maza;fs', 'wt.hammer': 'Martillo;ms', 'wt.bow': 'Arco;ms',
    'stat.hp': 'Vida máx.', 'stat.dmgPct': 'Daño', 'stat.atkPct': 'Vel. de ataque', 'stat.movePct': 'Vel. de mov.', 'stat.armor': 'Armadura', 'stat.crit': 'Prob. de crítico',
    'stat.rangePct': 'Alcance', 'stat.pulsePct': 'Daño de hab.', 'stat.cdrPct': 'Recargas', 'stat.regen': 'Regen. de vida', 'stat.expPct': 'EXP ganada',
    'rar.0': 'Común', 'rar.1': 'Mágico', 'rar.2': 'Raro', 'rar.3': 'Épico', 'rar.4': 'Legendario',
    'mat.0': 'Ligero (cuero)', 'mat.1': 'Medio (malla)', 'mat.2': 'Pesado (placas)',
    'mob.imp': 'Diablillo', 'mob.bat': 'Murciélago', 'mob.skeleton': 'Esqueleto', 'mob.hound': 'Sabueso', 'mob.cultist': 'Cultista', 'mob.warden': 'Guardián', 'mob.tyrant': 'Tirano de la Brecha'
  };

  // Spanish names of the data tables, by id
  var esCls = { mage: 'Mago', warrior: 'Guerrero', archer: 'Arquero' };
  var esSkill = { mage: 'Pulso', warrior: 'Choque', archer: 'Salva' };
  var esWbase = { staff: 'Bastón;ms;;', sword: 'Espada;fs;;de Hierro', axe: 'Hacha;fs;;de Hierro', mace: 'Maza;fs;Viejo;', hammer: 'Martillo;ms;Pesado;', bow: 'Arco;ms;Corto;',
    'bow.rare': 'Arco;ms;Largo;de Tejo' };
  var esFam = {
    fire: ['Fuego', '+20% de daño de quemadura y veneno', 'Pira: los enemigos en llamas explotan al morir (60% de daño, queman)'],
    frost: ['Hielo', 'Enfriamiento 20% más fuerte', 'Quiebre: +25% de daño a enemigos enfriados; estallan en escarcha al morir'],
    storm: ['Tormenta', '+8% de velocidad de ataque, +5% de velocidad de movimiento', 'Sobrecarga: cada 6 ataques lanzas también un rayo a 4 enemigos (60%)'],
    arcane: ['Arcano', '-10% de recargas, +15% de área', 'Motas arcanas: 2 motas orbitan a tu alrededor (40% de daño)'],
    steel: ['Acero', '+8 de armadura, +15% de daño crítico', 'Hendidura: los críticos marcan al enemigo (+20% de daño recibido, 3 s); +15% contra élites'],
    blood: ['Sangre', '+30 de vida máx.', 'Sed de sangre: las bajas curan 1.5% de vida y dan +4% de velocidad de ataque (5 acumulaciones, 4 s)'],
    venom: ['Veneno', '+15% de daño de veneno y quemadura, +15% de duración de estados', 'Plaga: los enemigos envenenados dejan una nube tóxica al morir']
  };
  var esRank = {
    vitality: ['Vitalidad', '+6 de vida máx.'], might: ['Poder', '+3 % de daño'], haste: ['Prisa', '+2 % de velocidad de ataque'],
    guard: ['Guardia', '+3 de armadura'], insight: ['Intuición', '+4 % de EXP ganada']
  };
  var esDoor = { longCracks: 'Grietas largas', manyCracks: 'Más grietas', fastSpawns: 'Aparición rápida', crowd: 'Multitud', elite: 'Élite extra', hardened: 'Enemigos duros' };
  var esAb = {
    mg_ignite: ['Ignición', 'Los proyectiles prenden fuego: {0.dps%}% del golpe por segundo durante {0.t} s'],
    mg_fireball: ['Bola de fuego', 'El primer enemigo que golpea un proyectil explota: {0.dmg%}% en radio {0.r}'],
    mg_meteor: ['Meteoro', 'Cada {0.every} ataques cae un meteoro sobre un enemigo al azar en alcance: {0.dmg%}%, quema'],
    mg_frostbolt: ['Rayo gélido', 'Los proyectiles enfrían: {0.slow%}% más lentos durante {0.t} s. +{s.dmgPct}% de daño'],
    mg_icelance: ['Lanza de hielo', 'Los proyectiles perforan +{s.pierce}; +{s.chilledPct}% de daño a enemigos enfriados'],
    mg_blizzard: ['Ventisca', '{0.chance%}% de probabilidad: una ventisca sobre el objetivo, {0.dps%}% por segundo durante {0.t} s, enfría'],
    mg_chain: ['Rayo en cadena', 'Los proyectiles saltan a {0.jumps} enemigos más: {0.dmg%}%, menos con cada salto'],
    mg_twin: ['Lanzamiento doble', '{0.chance%}% de probabilidad de lanzar otra vez al instante ({0.dmg%}% de daño)'],
    mg_ball: ['Rayo esférico', 'Cada ataque añade una chispa orbitante (máx. {0.max}, {0.life} s): {0.dmg%}% al tocar'],
    mg_fracture: ['Fractura', 'Los proyectiles se rompen en el primer enemigo en {0.n} esquirlas ({0.dmg%}% cada una)'],
    mg_missiles: ['Misiles arcanos', '+{s.multi} proyectil lateral a cada lado'],
    mg_singularity: ['Singularidad', 'Cada {0.every} ataques el objetivo colapsa: atrae enemigos, {0.dmg%}%, los marca'],
    mg_p_fire: ['Fuego interior', '+{s.dmgPct}% de daño'],
    mg_p_pyro: ['Piromancia', '+{s.dotPct}% de daño de quemadura y veneno'],
    mg_p_wild: ['Fuego salvaje', '+{s.areaPct}% de área de explosiones y zonas'],
    mg_p_cold: ['Frío profundo', 'Enfriamiento {s.chillPct}% más fuerte'],
    mg_p_icearmor: ['Armadura de hielo', '+{s.armor} de armadura'],
    mg_p_shatter: ['Punto de quiebre', '+{s.critDmg}% de daño crítico'],
    mg_p_haste: ['Lanzamiento veloz', '+{s.atkPct}% de velocidad de ataque'],
    mg_p_conduct: ['Conducción', '+{s.procPct}% de probabilidad de efectos de habilidad'],
    mg_p_static: ['Enfoque estático', '+{s.crit}% de probabilidad de crítico'],
    mg_p_reach: ['Vista lejana', '+{s.rangePct}% de alcance'],
    mg_p_mind: ['Mente arcana', '+{s.fxPct}% de daño de efectos de habilidad'],
    mg_p_shield: ['Escudo de maná', '+{s.hp} de vida máx.'],
    wr_cleave: ['Hendedura', 'Los golpes abarcan {s.arcPct}% más, +{s.knockPct}% de empuje'],
    wr_whirl: ['Torbellino', 'Cada {0.every} golpes es un círculo completo con {0.dmg%}% de daño'],
    wr_execute: ['Verdugo', 'Los golpes matan a enemigos normales con menos de {0.below%}% de vida. +{s.elitePct}% contra élites'],
    wr_rend: ['Desgarro', 'Los golpes sangran: {0.dps%}% del golpe por segundo, se acumula {0.stacks}x, {0.t} s'],
    wr_drain: ['Bebedor de sangre', 'Curas {0.pct%}% del daño de tus golpes. +{s.hp} de vida máx.'],
    wr_frenzy: ['Frenesí', 'Cada baja da +{0.v}% de velocidad de ataque durante {0.t} s (se acumula {0.stacks}x)'],
    wr_flame: ['Hoja ardiente', 'Los golpes queman: {0.dps%}% del golpe por segundo durante {0.t} s'],
    wr_eruption: ['Erupción', '{0.chance%}% de probabilidad: el suelo bajo el objetivo erupciona, {0.dmg%}%, quema'],
    wr_inferno: ['Infierno', 'Cada {0.every} golpes, el suelo a tu alrededor arde: {0.dps%}% por segundo, {0.t} s'],
    wr_wave: ['Onda de trueno', 'Los golpes lanzan una onda hacia delante entre los enemigos: {0.dmg%}%, {0.range} px'],
    wr_arc: ['Golpe voltaico', 'Los golpes lanzan rayos a {0.jumps} enemigos más: {0.dmg%}%'],
    wr_slam: ['Azote de trueno', 'Cada {0.every} golpes, truena a tu alrededor: {0.dmg%}% en radio {0.r}, empuja'],
    wr_p_heavy: ['Golpes pesados', '+{s.dmgPct}% de daño'],
    wr_p_plate: ['Armadura de placas', '+{s.armor} de armadura'],
    wr_p_giant: ['Matagigantes', '+{s.elitePct}% de daño a élites y jefes'],
    wr_p_iron: ['Cuerpo de hierro', '+{s.hp} de vida máx.'],
    wr_p_berserk: ['Berserker', '+{s.lowHpPct}% de daño con menos de la mitad de vida'],
    wr_p_wind: ['Segundo aliento', '+{s.regen} de vida por segundo'],
    wr_p_smolder: ['Acero humeante', '+{s.dotPct}% de daño de quemadura y sangrado'],
    wr_p_wild: ['Fuego salvaje', '+{s.areaPct}% de área de explosiones y zonas'],
    wr_p_fury: ['Furia ardiente', '+{s.fxPct}% de daño de efectos de habilidad'],
    wr_p_quick: ['Golpes rápidos', '+{s.atkPct}% de velocidad de ataque'],
    wr_p_charge: ['Maestría de carga', '-{s.dodgeCdPct}% de recarga de la carga'],
    wr_p_crit: ['Instinto asesino', '+{s.crit}% de probabilidad de crítico'],
    ar_poison: ['Puntas envenenadas', 'Las flechas envenenan: {0.dps%}% del golpe por segundo por acumulación, {0.stacks} acumulaciones, {0.t} s'],
    ar_cloud: ['Nube tóxica', '{0.chance%}% de probabilidad: una nube tóxica sobre el objetivo, {0.dps%}% por segundo, envenena'],
    ar_plague: ['Flecha de plaga', 'Las bajas estallan en veneno: {0.dmg%}% en radio {0.r}, envenena'],
    ar_ricochet: ['Rebote', 'Las flechas rebotan a {0.n} enemigos más ({0.fall%}% de daño en cada rebote)'],
    ar_mark: ['Marca del cazador', 'El primer enemigo golpeado queda marcado: +{0.pct%}% de daño recibido durante {0.t} s'],
    ar_split: ['Tiro dividido', '+{s.multi} flecha lateral a cada lado'],
    ar_frost: ['Flecha de hielo', 'Las flechas enfrían: {0.slow%}% más lentos durante {0.t} s. +{s.dmgPct}% de daño'],
    ar_shatter: ['Tiro quebrador', 'Un objetivo enfriado se rompe: {0.dmg%}% en radio {0.r}, enfría'],
    ar_trap: ['Trampa de hielo', 'Cada {0.every} disparos, un campo de hielo en el objetivo: {0.dps%}% por segundo, enfría'],
    ar_double: ['Disparo doble', '{0.chance%}% de probabilidad de disparar otra vez al instante ({0.dmg%}% de daño)'],
    ar_fan: ['Abanico de flechas', 'Cada {0.every} disparos, +{0.side} flechas a cada lado ({0.dmg%}%)'],
    ar_thunder: ['Flecha de trueno', 'Cada {0.every} disparos, un rayo cae sobre un enemigo al azar en alcance: {0.dmg%}%'],
    ar_p_tox: ['Toxicología', '+{s.dotPct}% de daño de veneno y quemadura'],
    ar_p_linger: ['Veneno persistente', '+{s.durPct}% de duración de estados y zonas'],
    ar_p_feast: ['Festín del cazador', 'Curas {s.leech} de vida por baja'],
    ar_p_draw: ['Tensión fuerte', '+{s.dmgPct}% de daño'],
    ar_p_deadeye: ['Ojo certero', '+{s.crit}% de probabilidad de crítico'],
    ar_p_pierce: ['Flecha perforante', 'Las flechas perforan +{s.pierce} enemigo'],
    ar_p_coat: ['Abrigo invernal', '+{s.armor} de armadura'],
    ar_p_precise: ['Precisión gélida', '+{s.critDmg}% de daño crítico'],
    ar_p_bite: ['Congelación', 'Enfriamiento {s.chillPct}% más fuerte'],
    ar_p_quick: ['Encaje rápido', '+{s.atkPct}% de velocidad de ataque'],
    ar_p_eagle: ['Ojo de águila', '+{s.rangePct}% de alcance'],
    ar_p_tail: ['Viento de cola', '+{s.procPct}% de probabilidad de efectos de habilidad'],
    sh_kindle: ['Encender', '{0.chance%}% de probabilidad por golpe de quemar: {0.dps%}% del golpe por segundo, {0.t} s'],
    sh_chill: ['Toque helado', '{0.chance%}% de probabilidad por golpe de enfriar: {0.slow%}% más lentos durante {0.t} s'],
    sh_vigor: ['Vitalidad', '+{s.hp} de vida máx.'],
    sh_mend: ['Remedio', '+{s.regen} de vida por segundo'],
    sh_ward: ['Protección', '+{s.armor} de armadura'],
    sh_swift: ['Rapidez', '+{s.movePct}% de velocidad de movimiento'],
    sh_reflex: ['Reflejos', '-{s.dodgeCdPct}% de recarga de esquiva'],
    sh_wisdom: ['Sabiduría', '+{s.expPct}% de EXP ganada'],
    sh_focus: ['Concentración', '+{s.pulsePct}% de daño de habilidad, -{s.pulseCdPct}% de recarga de habilidad']
  };

  // fill the data-table keys: English from balance.js, Spanish from the tables above
  Object.keys(B.classes).forEach(function (c) {
    en['cls.' + c] = B.classes[c].name; en['skill.' + c] = B.classes[c].skill.name;
    es['cls.' + c] = esCls[c]; es['skill.' + c] = esSkill[c];
  });
  B.loot.weaponTypes.forEach(function (w) {
    en['wbase.' + w.id] = w.item; es['wbase.' + w.id] = esWbase[w.id];
    if (w.itemRare) { en['wbase.' + w.id + '.rare'] = w.itemRare; es['wbase.' + w.id + '.rare'] = esWbase[w.id + '.rare']; }
  });
  // armour pieces by material (B.items.material.base): 'mbase.<slot>.<mat>', the same 'Noun;gender;adjective;complement' form in Spanish
  var esMbase = {
    helmet: ['Gorro;ms;;de Cuero', 'Cofia;fs;;de Malla', 'Yelmo;ms;;de Placas'],
    armor: ['Jubón;ms;;de Cuero', 'Cota;fs;;de Malla', 'Coraza;fs;;de Placas'],
    shield: ['Broquel;ms;;de Cuero', 'Rodela;fs;;de Malla', 'Escudo;ms;;de Placas'],
    gloves: ['Guantes;mp;;de Cuero', 'Manoplas;fp;;de Malla', 'Guanteletes;mp;;de Placas'],
    boots: ['Botas;fp;;de Cuero', 'Botas;fp;;de Malla', 'Grebas;fp;;de Placas']
  };
  B.items.material.slots.forEach(function (sl) {
    B.items.material.base[sl].forEach(function (nm, m) { en['mbase.' + sl + '.' + m] = nm; es['mbase.' + sl + '.' + m] = esMbase[sl][m]; });
  });
  // the starter weapons (B.items.starter.names): their own names, the same 'Noun;gender;adjective;complement' form in Spanish
  var esStarter = { staff: 'Bastón;ms;;de Aprendiz', sword: 'Espada;fs;Gastado;', bow: 'Arco;ms;;de Práctica' };
  Object.keys(B.items.starter.names).forEach(function (w) { en['starter.' + w] = B.items.starter.names[w]; es['starter.' + w] = esStarter[w]; });
  Object.keys(B.families).forEach(function (f) {
    var F = B.families[f];
    en['fam.' + f + '.name'] = F.name; en['fam.' + f + '.t2'] = F.t2.desc; en['fam.' + f + '.t4'] = F.t4.desc;
    es['fam.' + f + '.name'] = esFam[f][0]; es['fam.' + f + '.t2'] = esFam[f][1]; es['fam.' + f + '.t4'] = esFam[f][2];
  });
  Object.keys(B.economy.ranks).forEach(function (r) {
    en['rank.' + r + '.name'] = B.economy.ranks[r].name; en['rank.' + r + '.text'] = B.economy.ranks[r].text;
    es['rank.' + r + '.name'] = esRank[r][0]; es['rank.' + r + '.text'] = esRank[r][1];
  });
  Object.keys(B.doors.mods).forEach(function (d) { en['door.' + d] = B.doors.mods[d].name; es['door.' + d] = esDoor[d]; });
  Object.keys(B.abilities).forEach(function (a) {
    en['ab.' + a + '.name'] = B.abilities[a].name; en['ab.' + a + '.desc'] = B.abilities[a].desc;
    es['ab.' + a + '.name'] = esAb[a][0]; es['ab.' + a + '.desc'] = esAb[a][1];
  });

  G.LANG = { en: en, es: es };

  // ------------------------------------------------------------------ lookup
  G.setLang = function (l) { G.lang = G.LANG[l] ? l : 'en'; if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = G.lang; };
  // first launch: the browser language; ?lang=en|es wins for the session (QA) and is not saved
  G.detectLang = function (saved, param) {
    if (param === 'en' || param === 'es') return param;
    if (saved === 'en' || saved === 'es') return saved;
    var nav = (typeof navigator !== 'undefined' && (navigator.language || (navigator.languages && navigator.languages[0]))) || 'en';
    return /^es/i.test(nav) ? 'es' : 'en';
  };
  G.t = function (key, params) {
    var s = G.LANG[G.lang][key];
    if (s === undefined) s = G.LANG.en[key];
    if (s === undefined) return key;
    if (params) s = s.replace(/\{(\w+)\}/g, function (m, k) { return params[k] === undefined ? m : params[k]; });
    return s;
  };
  G.plural = function (base, n) { return G.t(base + (n === 1 ? '.one' : '.other'), { n: n }); };
  // Don Montoto's feature strings (kept as a short alias)
  G.montotoText = function (key, vars) { return G.t('mon.' + key, vars); };
  G.storyText = function (i) { var e = G.MONTOTO_STORIES[i]; return e[G.lang] || e.en; };

  // ------------------------------------------------------------------ Spanish agreement
  // adjective in its masculine singular form -> gender 'ms' | 'fs' | 'mp' | 'fp'
  function agree(w, g) {
    if (!w) return '';
    var f = g.charAt(0) === 'f', p = g.charAt(1) === 'p';
    if (/o$/.test(w)) { if (f) w = w.slice(0, -1) + 'a'; } else if (/or$/.test(w) && f) w += 'a';
    if (p) w = /[áéíóú]n$/.test(w) ? w.slice(0, -2) + {'á':'a','é':'e','í':'i','ó':'o','ú':'u'}[w.charAt(w.length - 2)] + 'nes' : /[aeiouáéíóú]$/.test(w) ? w + 's' : (/z$/.test(w) ? w.slice(0, -1) + 'ces' : w + 'es');
    return w;
  }
  G.agree = agree;

  // ------------------------------------------------------------------ items
  // the weapon type entry of an item (null for non-weapons and old items without a type)
  function wtypeOf(it) {
    if (!it.wtype) return null;
    for (var i = 0; i < B.loot.weaponTypes.length; i++) if (B.loot.weaponTypes[i].id === it.wtype) return B.loot.weaponTypes[i];
    return null;
  }
  // name parts: the bonus adjective key (null for none) and the base key
  function nameParts(it) {
    var wd = wtypeOf(it), keys = Object.keys(it.stats || {}), adj = null;
    if (it.starter && wd && G.LANG.en['starter.' + wd.id]) return { adj: null, base: 'starter.' + wd.id };      // the starter weapon has its own name
    if (it.rarity === 0) { if (!wd || wd.worn) adj = 'adj.worn'; } else adj = 'adj.' + keys[1];
    var base = wd ? 'wbase.' + wd.id + (it.rarity >= 2 && wd.itemRare ? '.rare' : '') : 'base.' + it.slot;
    if (!wd && G.LANG.en['mbase.' + it.slot + '.' + it.mat]) base = 'mbase.' + it.slot + '.' + it.mat;      // an armour piece: its base name says the material
    return { adj: adj && G.LANG.en[adj] ? adj : null, base: base };
  }
  var NAME_RULE = {
    en: function (p) { return (p.adj ? G.t(p.adj) + ' ' : '') + G.t(p.base); },
    es: function (p) {
      var b = G.t(p.base).split(';'), g = b[1], parts = [b[0]];
      if (b[2]) parts.push(agree(b[2], g));
      if (p.adj) parts.push(agree(G.t(p.adj), g));
      if (b[3]) parts.push(b[3]);
      return parts.join(' ');
    }
  };
  G.itemName = function (it) { return NAME_RULE[G.lang](nameParts(it)); };
  // "Rare Sword" / "Espada rara": the type (weapon type or slot) with the rarity
  G.itemType = function (it) {
    var key = it.wtype && wtypeOf(it) ? 'wt.' + it.wtype : 'slot.' + it.slot, r = G.t('rar.' + it.rarity);
    if (G.lang === 'es') { var b = G.t(key).split(';'); return b[0] + ' ' + agree(r, b[1]).toLowerCase(); }
    return r + ' ' + G.t(key);
  };
  G.rarityName = function (r) { return G.t('rar.' + r); };
  // "Light (leather)": the material line of an armour piece's card ('' for a belt, a weapon, or an item without one)
  G.itemMat = function (it) { return it && G.hasMat(B, it.slot) && G.LANG.en['mat.' + it.mat] ? G.t('mat.' + it.mat) : ''; };
  // "+12% Damage"
  G.statLine = function (k, v) {
    var unit = G.STAT_LABEL[k][1];
    return '+' + (k === 'regen' ? v.toFixed(1) : v) + unit + ' ' + G.t('stat.' + k);
  };
  G.classLabel = function (id) { return G.t('cls.' + G.classDef(B, id).id); };
  G.skillLabel = function (id) { return G.t('skill.' + G.classDef(B, id).id); };

  // ------------------------------------------------------------------ abilities
  // ability card data with translated name, family name and description (numbers come from the sim's G.abilityInfo)
  G.abilityText = function (id, B2, rank, clsId, wtype) {
    var info = G.abilityInfo(id, B2, rank, clsId, wtype), R = G.resolveAbility(B2, id, Math.max(1, rank), wtype);
    info.name = G.t('ab.' + id + '.name'); info.famName = G.t('fam.' + info.fam + '.name');
    info.desc = G.fillDesc(G.t('ab.' + id + '.desc'), R);
    return info;
  };
  G.famName = function (f) { return G.t('fam.' + f + '.name'); };

  // ------------------------------------------------------------------ doors
  // what a door does, in words (same numbers as G.doorEffects in the sim, text from the language table)
  G.doorLines = function (B2, id) {
    var m = G.doorMod(B2, id), out = [];
    if (!m) return out;
    function pct(x) { return Math.round(Math.abs(x - 1) * 100) + '%'; }
    if (m.crackLen) out.push(G.t(m.crackLen > 1 ? 'door.crackLonger' : 'door.crackShorter', { p: pct(m.crackLen) }));
    if (m.extraCracks) out.push(m.extraCracks > 0 ? G.t(m.extraCracks > 1 ? 'door.extraMany' : 'door.extraOne', { n: m.extraCracks }) : G.t('door.extraNeg', { n: m.extraCracks }));
    if (m.spawnEvery) out.push(m.spawnEvery < 1 ? G.t('door.spawnFaster', { p: Math.round((1 / m.spawnEvery - 1) * 100) + '%' }) : G.t('door.spawnSlower', { p: pct(m.spawnEvery) }));
    if (m.aliveThreat) out.push(G.t(m.aliveThreat > 1 ? 'door.aliveMore' : 'door.aliveFewer', { p: pct(m.aliveThreat) }));
    if (m.extraElite) out.push(G.t('door.eliteLine', { name: G.t('mob.' + m.extraElite) }));
    if (m.threat) out.push(G.t(m.threat > 1 ? 'door.threatUp' : 'door.threatDown', { p: pct(m.threat) }));
    return out;
  };
})(globalThis.G = globalThis.G || {});
