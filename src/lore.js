// Don Montoto's stories (step 8): one line each time the player talks to him, in this order, cycling. Data only: no code reads the text except G.montotoStory. Entries are { en, es } (G.storyText picks the current language). His UI strings are in src/i18n.js (keys mon.*).
(function (G) {
  G.MONTOTO_STORIES = [
    { en: 'Before the first crack, the rooms were only rooms. Now every wall remembers the day it split.', es: 'Antes de la primera grieta, las salas eran solo salas. Ahora cada muro recuerda el día en que se partió.' },
    { en: 'A fissure is not a door, boy: doors lead somewhere. A fissure only wants to come through.', es: 'Una fisura no es una puerta, muchacho: las puertas llevan a alguna parte. La fisura solo quiere pasar.' },
    { en: 'Every crack in the floor is a mouth. The monsters are not born in the dark, they are breathed out of it.', es: 'Cada grieta del suelo es una boca. Los monstruos no nacen en la oscuridad: ella los exhala.' },
    { en: 'When a fissure closes it leaves a scar. Count the scars on a room and you know how many times it was lied to.', es: 'Cuando una fisura se cierra deja una cicatriz. Cuenta las cicatrices de una sala y sabrás cuántas veces la engañaron.' },
    { en: 'The scars never heal, they only go quiet. I have walked on quiet scars for forty years and I still hear them.', es: 'Las cicatrices nunca sanan, solo se callan. Llevo cuarenta años pisando cicatrices calladas y aún las oigo.' },
    { en: 'Cut the network and the rift starves. Starve it long enough and the super fissure opens, because it will not die hungry.', es: 'Corta la red y la brecha se muere de hambre. Hambréala lo bastante y se abre la fisura mayor, porque no morirá con hambre.' },
    { en: 'The super fissure is the rift\'s heart. It beats once, opens wide, and everything it was saving comes out at once.', es: 'La fisura mayor es el corazón de la brecha. Late una vez, se abre de par en par y sale todo lo que guardaba.' },
    { en: 'Close the heart and the whole room exhales. That is the only quiet worth fighting for.', es: 'Cierra el corazón y la sala entera exhala. Esa es la única calma por la que vale la pena pelear.' },
    { en: 'Gold from the rift is a loan: carry it out and it is yours, die with it and the rift collects.', es: 'El oro de la brecha es un préstamo: sácalo y es tuyo; muere con él y la brecha lo cobra.' },
    { en: 'The sealed bag keeps what you found, as long as you leave on your own feet. The rift does not return what the dead are holding.', es: 'La bolsa sellada guarda lo que encontraste, mientras salgas por tu propio pie. La brecha no devuelve lo que sostienen los muertos.' },
    { en: 'Unnamed things are dangerous things. An item you have not identified is still dreaming of its old owner.', es: 'Lo que no tiene nombre es peligroso. Un objeto sin identificar aún sueña con su antiguo dueño.' },
    { en: 'I was caged in room five because I looked too long into a super fissure. It looked back, and it was patient.', es: 'Me encerraron en la sala cinco por mirar demasiado una fisura mayor. Ella me devolvió la mirada, y es paciente.' },
    { en: 'Some say the rift came from the sky, some from under the city. I say it came from something we forgot to bury.', es: 'Unos dicen que la brecha vino del cielo, otros que de debajo de la ciudad. Yo digo que vino de algo que olvidamos enterrar.' },
    { en: 'The deeper rooms are older. The cracks there do not split the stone, they split the light.', es: 'Las salas más hondas son más viejas. Las grietas de allí no parten la piedra, parten la luz.' },
    { en: 'The Rift Tyrant is not a king. It is the last scar the rift could not close, and it learned to walk.', es: 'El Tirano de la Brecha no es un rey. Es la última cicatriz que la brecha no pudo cerrar, y aprendió a caminar.' },
    { en: 'Come back alive and tell me what you saw. A story told is a scar that finally closes.', es: 'Vuelve con vida y cuéntame lo que viste. Una historia contada es una cicatriz que por fin se cierra.' }
  ];
})(globalThis.G = globalThis.G || {});
