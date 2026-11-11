// Don Montoto's stories (step 8): one line each time the player talks to him, in this order, cycling. Data only: no code reads the text except G.montotoStory. Entries are { en } so more languages can be added as extra fields.
(function (G) {
  G.MONTOTO_STORIES = [
    { en: 'Before the first crack, the rooms were only rooms. Now every wall remembers the day it split.' },
    { en: 'A fissure is not a door, boy: doors lead somewhere. A fissure only wants to come through.' },
    { en: 'Every crack in the floor is a mouth. The monsters are not born in the dark, they are breathed out of it.' },
    { en: 'When a fissure closes it leaves a scar. Count the scars on a room and you know how many times it was lied to.' },
    { en: 'The scars never heal, they only go quiet. I have walked on quiet scars for forty years and I still hear them.' },
    { en: 'Cut the network and the rift starves. Starve it long enough and the super fissure opens, because it will not die hungry.' },
    { en: 'The super fissure is the rift\'s heart. It beats once, opens wide, and everything it was saving comes out at once.' },
    { en: 'Close the heart and the whole room exhales. That is the only quiet worth fighting for.' },
    { en: 'Gold from the rift is a loan: carry it out and it is yours, die with it and the rift collects.' },
    { en: 'The sealed bag keeps what you found, as long as you leave on your own feet. The rift does not return what the dead are holding.' },
    { en: 'Unnamed things are dangerous things. An item you have not identified is still dreaming of its old owner.' },
    { en: 'I was caged in room five because I looked too long into a super fissure. It looked back, and it was patient.' },
    { en: 'Some say the rift came from the sky, some from under the city. I say it came from something we forgot to bury.' },
    { en: 'The deeper rooms are older. The cracks there do not split the stone, they split the light.' },
    { en: 'The Rift Tyrant is not a king. It is the last scar the rift could not close, and it learned to walk.' },
    { en: 'Come back alive and tell me what you saw. A story told is a scar that finally closes.' }
  ];
  // every player-facing string of Don Montoto's feature (the cage, the city stall, his panel), in one place. Tokens in {braces} are filled by the caller.
  G.MONTOTO_UI = {
    en: {
      name: 'DON MONTOTO',
      clearFirst: 'Clear the room first',
      freed: 'DON MONTOTO FREED',
      freeHim: 'FREE HIM',
      locked: 'LOCKED',
      emptyStall: 'An empty stall. Someone is missing: look for a cage in room 5 of the rift.',
      examining: 'Let me see...',
      next: 'NEXT ({n} more)',
      ok: 'OK',
      skip: 'SKIP',
      hidden: 'UNIDENTIFIED IN YOUR KEPT BAG: {n}',
      identifyAll: 'IDENTIFY ALL (FREE)',
      nothingToIdentify: 'NOTHING TO IDENTIFY',
      again: 'Talk to me again for another story.',
      sellHint: 'Don Montoto identifies them for free.'
    }
  };
  G.montotoText = function (key, vars) {
    var t = G.MONTOTO_UI.en[key];
    if (vars) for (var k in vars) t = t.replace('{' + k + '}', vars[k]);
    return t;
  };
})(globalThis.G = globalThis.G || {});
