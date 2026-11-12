// Texts of the first-time hints (src/view/hints.js) and of the save backup (src/view/backup.js), added to the tables of i18n.js.
// Kept in their own file so the big tables stay easy to merge. Same rules: every key in both languages, same {placeholders}.
(function (G) {
  Object.assign(G.LANG.en, {
    'set.hdOn': 'HD TEST: ON', 'set.hdOff': 'HD TEST: OFF', 'dbg.spawnBoss': 'BOSS HERE', 'dbg.spawnSkel': 'SKELETONS',
    'bak.label': 'Save code',
    'set.export': 'EXPORT SAVE', 'set.import': 'IMPORT SAVE',
    'bak.exportHint': 'Copy this code and keep it safe. It holds all your characters, gold and items.',
    'bak.importHint': 'Paste a save code, then press CHECK. Nothing changes until you confirm.',
    'bak.copy': 'COPY', 'bak.download': 'DOWNLOAD', 'bak.paste': 'PASTE', 'bak.check': 'CHECK', 'bak.back': 'BACK', 'bak.cancel': 'CANCEL', 'bak.replace': 'REPLACE SAVE',
    'bak.copied': 'Copied to the clipboard.', 'bak.copyBlocked': 'Clipboard blocked: the code is selected, press Ctrl+C.',
    'bak.downloaded': 'File riftscar-save.txt sent to your downloads.', 'bak.noDownload': 'Download is not available here: copy the text instead.',
    'bak.pasteBlocked': 'Paste is blocked here: click the box and press Ctrl+V.',
    'bak.err.empty': 'There is no code to check.', 'bak.err.format': 'This is not a Riftscar save code. Nothing changed.',
    'bak.err.checksum': 'The code is damaged or cut short: bad checksum. Nothing changed.',
    'bak.err.data': 'The code could not be read. Nothing changed.', 'bak.err.shape': 'This code does not hold a Riftscar save. Nothing changed.',
    'bak.err.version': 'This save comes from a newer version of the game. Nothing changed.',
    'bak.found': 'This code holds:', 'bak.char': '{name}: {items}, {gold} gold', 'bak.none': 'No characters yet.',
    'bak.total': 'Total: {items}, {gold} gold, {runs} runs.', 'bak.warn': 'Replacing erases the save on this device.',
    'hint.unid': 'Unidentified item: its stats are hidden. Read a Scroll of Identification on it in your bag.',
    'hint.scroll': 'A Scroll of Identification. Open your bag, pick a hidden item and read it.',
    'hint.gold': 'Run gold is kept if you leave or win, and lost if you die.',
    'hint.montoto': 'Don Montoto tells stories and identifies your kept items for free.',
    'hint.montotoEmpty': 'An empty stall. Free Don Montoto from his cage in room 5 of a run.'
  });
  Object.assign(G.LANG.es, {
    'set.hdOn': 'HD PRUEBA: SÍ', 'set.hdOff': 'HD PRUEBA: NO', 'dbg.spawnBoss': 'JEFE AQUÍ', 'dbg.spawnSkel': 'ESQUELETOS',
    'bak.label': 'Código de partida',
    'set.export': 'EXPORTAR', 'set.import': 'IMPORTAR',
    'bak.exportHint': 'Copia este código y guárdalo bien. Incluye todos tus personajes, oro y objetos.',
    'bak.importHint': 'Pega un código de partida y pulsa REVISAR. Nada cambia hasta que confirmes.',
    'bak.copy': 'COPIAR', 'bak.download': 'DESCARGAR', 'bak.paste': 'PEGAR', 'bak.check': 'REVISAR', 'bak.back': 'VOLVER', 'bak.cancel': 'CANCELAR', 'bak.replace': 'REEMPLAZAR',
    'bak.copied': 'Copiado al portapapeles.', 'bak.copyBlocked': 'Portapapeles bloqueado. Pulsa Ctrl+C con el código seleccionado.',
    'bak.downloaded': 'Archivo riftscar-save.txt enviado a tus descargas.', 'bak.noDownload': 'Descarga no disponible aquí: copia el texto.',
    'bak.pasteBlocked': 'Pegar está bloqueado: haz clic en el cuadro y pulsa Ctrl+V.',
    'bak.err.empty': 'No hay ningún código que revisar.', 'bak.err.format': 'Este no es un código de partida de Riftscar. No cambió nada.',
    'bak.err.checksum': 'Código dañado o cortado (suma de control mala). No cambió nada.',
    'bak.err.data': 'No se pudo leer el código. No cambió nada.', 'bak.err.shape': 'Este código no contiene una partida de Riftscar. No cambió nada.',
    'bak.err.version': 'Esta partida es de una versión más nueva del juego. No cambió nada.',
    'bak.found': 'Este código contiene:', 'bak.char': '{name}: {items}, {gold} de oro', 'bak.none': 'Aún no hay personajes.',
    'bak.total': 'Total: {items}, {gold} de oro, {runs} incursiones.', 'bak.warn': 'Reemplazar borra la partida de este dispositivo.',
    'hint.unid': 'Objeto sin identificar: sus estadísticas están ocultas. Usa un Pergamino de Identificación en tu bolsa.',
    'hint.scroll': 'Un Pergamino de Identificación. Abre tu bolsa, elige un objeto oculto y léelo.',
    'hint.gold': 'El oro de la incursión se conserva si sales o ganas, y se pierde si mueres.',
    'hint.montoto': 'Don Montoto cuenta historias e identifica gratis los objetos de tu bolsa guardada.',
    'hint.montotoEmpty': 'Un puesto vacío. Libera a Don Montoto de su jaula en la sala 5 de una incursión.'
  });
})(globalThis.G = globalThis.G || {});
