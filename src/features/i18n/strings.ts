/**
 * Every user-facing string, in the two languages the design ships with.
 *
 * Spanish is the default (the design's own default) and English is the toggle.
 * The tables are declared as `const` so `Strings` is the type of a language
 * table and TypeScript flags a key that exists in one language but not the
 * other — the usual way these drift.
 *
 * Access strings through `useT()` (`features/i18n/store.ts`), never by
 * importing a table directly, so a language change re-renders the screen.
 */

export type Lang = 'es' | 'en';

const es = {
  // shell
  appName: 'Shareboard',
  langLabel: 'ES · EN',
  language: 'Idioma',
  cancel: 'Cancelar',
  save: 'Guardar',
  close: 'Cerrar',
  back: 'Atrás',
  retry: 'Reintentar',
  deleteDigit: 'Borrar un dígito',

  // tools
  pencil: 'Lápiz',
  eraser: 'Borrador',
  shapes: 'Figuras',
  text: 'Texto',
  fill: 'Relleno',
  color: 'Color',
  filled: 'Relleno',
  custom: 'Otro',
  size: 'Grosor',
  typeHere: 'Escribe…',
  undo: 'Deshacer',
  redo: 'Rehacer',
  resetZoom: 'Restablecer zoom',
  shapeRectangle: 'Rectángulo',
  shapeEllipse: 'Círculo',
  shapeTriangle: 'Triángulo',
  shapeLine: 'Línea',
  shapeArrow: 'Flecha',
  bold: 'Negrita',
  italic: 'Cursiva',
  smaller: 'Más pequeño',
  bigger: 'Más grande',

  // home
  homeTitle: 'Una pizarra para todos, en segundos.',
  homeSub: 'Crea una pizarra y comparte el código. Sin registro.',
  createBoard: 'Crear pizarra',
  newBoardName: 'Pizarra sin título',
  importedBoardName: 'Pizarra importada',
  joinTitle: 'Entrar con un código',
  codeFieldLabel: 'Código de la pizarra',
  enter: 'Entrar',
  joinHint: '6 caracteres. Si la pizarra es privada te pediremos un PIN.',
  recent: 'Recientes',
  importBoard: 'Importar una pizarra',
  noRecent: 'Las pizarras que abras aparecerán aquí.',
  forget: 'Quitar de recientes',
  justNow: 'ahora mismo',
  minutesAgo: 'hace #N min',
  hoursAgo: 'hace #N h',
  yesterday: 'ayer',
  daysAgo: 'hace #N d',

  // nickname
  nickTitle: '¿Cómo te llamamos?',
  nickSub: 'Tu nombre aparecerá junto a tu cursor en la pizarra.',
  nickPlaceholder: 'Tu nombre',
  yourColor: 'Tu color',
  continue: 'Continuar',

  // pin
  pinTitle: 'Pizarra privada',
  pinSub: 'Pide el PIN de 4 dígitos a quien la creó.',
  pinWrong: 'PIN incorrecto. Inténtalo otra vez.',

  // board header
  code: 'Código',
  privacyShort: 'Permisos',
  share: 'Compartir',
  onlineOne: '1 en línea',
  onlineMany: '#N en línea',
  connecting: 'Conectando…',
  offline: 'Sin conexión',
  viewOnly: 'Solo lectura',
  boardMenu: 'Menú de la pizarra',
  connectedPeople: 'Personas conectadas',

  // sheets
  sheetShare: 'Compartir pizarra',
  sheetPeople: 'Conectados',
  sheetPrivacy: 'Permisos de edición',
  sheetExport: 'Exportar',
  sheetImport: 'Importar',
  sheetMenu: 'Pizarra',
  sheetSettings: 'Ajustes',
  sheetRename: 'Nombre de la pizarra',

  // share
  qrHint: 'Escanea para entrar desde otro dispositivo.',
  copyLink: 'Copiar enlace',
  exportImage: 'Exportar',
  permissions: 'Permisos',

  // people
  peopleHint: 'Toca un nombre para dar o quitar permiso de edición.',
  roleOwner: 'Creador · tú',
  roleOwnerOther: 'Creador',
  roleGuest: 'Invitado',
  roleYou: 'Tú',
  pillCan: 'Puede editar',
  pillCannot: 'Solo ve',
  pillOwner: 'Siempre',
  aloneHere: 'Todavía no hay nadie más aquí.',

  // privacy
  visibility: 'Visibilidad',
  publicLabel: 'Pública',
  privateLabel: 'Privada',
  visibilityHint: 'Una pizarra privada solo se abre con el PIN.',
  pinLabel: 'PIN de acceso',
  pinHidden: 'Solo lo ve quien lo creó',
  newPin: 'Generar otro',
  whoEdits: 'Quién puede editar',
  chooseEditors: 'Elegir quién edita',
  modeAll: 'Todos',
  modeAllDesc: 'Cualquiera que entre puede dibujar.',
  modeSome: 'Seleccionados',
  modeSomeDesc: 'Solo las personas que elijas.',
  modeMe: 'Solo yo',
  modeMeDesc: 'Los demás solo pueden mirar.',
  ownerOnlyHint: 'Solo quien creó la pizarra puede cambiar esto.',

  // export
  previewEmpty: 'La pizarra está vacía',
  transparentBg: 'Fondo transparente',
  download: 'Descargar',
  shareImage: 'Compartir imagen',
  exportFile: 'Exportar archivo .json',
  exportSize: '#W × #H px · #N elementos',

  // import
  pickFile: 'Elegir archivo',
  importHint: 'PNG o JPG exportado desde Shareboard, o un archivo .json.',
  importEditable: 'Recuperar trazos y textos editables',
  importEditableHint:
    'Las imágenes exportadas desde Shareboard llevan la pizarra dentro. Si lo desactivas se añade como una imagen plana.',
  addImage: 'Añadir una imagen',

  // settings
  settingGrid: 'Cuadrícula de puntos',
  settingGridDesc: 'Guía visual en el lienzo.',
  settingPeers: 'Cursores de otros',
  settingPeersDesc: 'Mostrar quién dibuja y dónde.',
  settingSmooth: 'Suavizar trazo',
  settingSmoothDesc: 'Reduce las líneas entrecortadas.',
  settingHaptics: 'Vibración al tocar',
  settingHapticsDesc: 'Respuesta táctil en las herramientas.',
  boardName: 'Nombre',
  rename: 'Cambiar el nombre',
  clearBoard: 'Vaciar la pizarra',
  deleteBoard: 'Eliminar la pizarra',

  // confirms
  clearTitle: '¿Vaciar la pizarra?',
  clearBody:
    'Se borrarán todos los trazos, figuras y textos para todas las personas conectadas. Se puede deshacer una vez.',
  clearCta: 'Vaciar',
  deleteTitle: '¿Eliminar la pizarra?',
  deleteBody: 'La pizarra #CODE y su código dejarán de funcionar. Esta acción no se puede deshacer.',
  deleteCta: 'Eliminar',

  // toasts
  toastCopied: 'Código copiado',
  toastLink: 'Enlace copiado',
  toastExport: 'Imagen guardada',
  toastShared: 'Imagen compartida',
  toastImport: 'Pizarra importada',
  toastImportImage: 'Imagen añadida',
  toastCleared: 'Pizarra vacía',
  toastDeleted: 'Pizarra eliminada',
  toastRenamed: 'Nombre actualizado',
  toastPermissions: 'Permisos actualizados',
  toastNoEdit: 'No tienes permiso para editar',

  // errors
  errCreate: 'No se pudo crear la pizarra',
  errJoin: 'No se pudo abrir esa pizarra',
  errCodeInvalid: 'Escribe un código de 6 caracteres o un enlace',
  errOpen: 'No se pudo abrir la pizarra',
  errExport: 'No se pudo exportar',
  errImport: 'No se pudo importar',
  errPermissions: 'No se pudieron guardar los permisos',
  errRename: 'No se pudo cambiar el nombre',
  errDelete: 'No se pudo eliminar la pizarra',
  errNicknameTaken: 'Ese nombre ya está en uso en esta pizarra',
} as const;

const en: Record<keyof typeof es, string> = {
  appName: 'Shareboard',
  langLabel: 'EN · ES',
  language: 'Language',
  cancel: 'Cancel',
  save: 'Save',
  close: 'Close',
  back: 'Back',
  retry: 'Try again',
  deleteDigit: 'Delete a digit',

  pencil: 'Pencil',
  eraser: 'Eraser',
  shapes: 'Shapes',
  text: 'Text',
  fill: 'Fill',
  color: 'Colour',
  filled: 'Filled',
  custom: 'More',
  size: 'Width',
  typeHere: 'Type…',
  undo: 'Undo',
  redo: 'Redo',
  resetZoom: 'Reset zoom',
  shapeRectangle: 'Rectangle',
  shapeEllipse: 'Circle',
  shapeTriangle: 'Triangle',
  shapeLine: 'Line',
  shapeArrow: 'Arrow',
  bold: 'Bold',
  italic: 'Italic',
  smaller: 'Smaller',
  bigger: 'Bigger',

  homeTitle: 'One board for everyone, in seconds.',
  homeSub: 'Create a board and share the code. No sign-up.',
  createBoard: 'Create board',
  newBoardName: 'Untitled board',
  importedBoardName: 'Imported board',
  joinTitle: 'Join with a code',
  codeFieldLabel: 'Board code',
  enter: 'Join',
  joinHint: '6 characters. Private boards will ask for a PIN.',
  recent: 'Recent',
  importBoard: 'Import a board',
  noRecent: 'Boards you open will show up here.',
  forget: 'Remove from recent',
  justNow: 'just now',
  minutesAgo: '#N min ago',
  hoursAgo: '#N h ago',
  yesterday: 'yesterday',
  daysAgo: '#N d ago',

  nickTitle: 'What should we call you?',
  nickSub: 'Your name shows next to your cursor on the board.',
  nickPlaceholder: 'Your name',
  yourColor: 'Your colour',
  continue: 'Continue',

  pinTitle: 'Private board',
  pinSub: 'Ask the creator for the 4-digit PIN.',
  pinWrong: 'Wrong PIN. Give it another go.',

  code: 'Code',
  privacyShort: 'Access',
  share: 'Share',
  onlineOne: '1 online',
  onlineMany: '#N online',
  connecting: 'Connecting…',
  offline: 'Offline',
  viewOnly: 'View only',
  boardMenu: 'Board menu',
  connectedPeople: 'Connected people',

  sheetShare: 'Share board',
  sheetPeople: 'Connected',
  sheetPrivacy: 'Editing access',
  sheetExport: 'Export',
  sheetImport: 'Import',
  sheetMenu: 'Board',
  sheetSettings: 'Settings',
  sheetRename: 'Board name',

  qrHint: 'Scan to join from another device.',
  copyLink: 'Copy link',
  exportImage: 'Export',
  permissions: 'Access',

  peopleHint: 'Tap a name to grant or remove editing.',
  roleOwner: 'Creator · you',
  roleOwnerOther: 'Creator',
  roleGuest: 'Guest',
  roleYou: 'You',
  pillCan: 'Can edit',
  pillCannot: 'View only',
  pillOwner: 'Always',
  aloneHere: 'Nobody else is here yet.',

  visibility: 'Visibility',
  publicLabel: 'Public',
  privateLabel: 'Private',
  visibilityHint: 'A private board only opens with the PIN.',
  pinLabel: 'Access PIN',
  pinHidden: 'Only its creator can see it',
  newPin: 'New PIN',
  whoEdits: 'Who can edit',
  chooseEditors: 'Choose who edits',
  modeAll: 'Everyone',
  modeAllDesc: 'Anyone who joins can draw.',
  modeSome: 'Selected people',
  modeSomeDesc: 'Only the people you pick.',
  modeMe: 'Only me',
  modeMeDesc: 'Everyone else can watch.',
  ownerOnlyHint: 'Only the board creator can change this.',

  previewEmpty: 'The board is empty',
  transparentBg: 'Transparent background',
  download: 'Download',
  shareImage: 'Share image',
  exportFile: 'Export .json file',
  exportSize: '#W × #H px · #N elements',

  pickFile: 'Choose file',
  importHint: 'A PNG or JPG exported from Shareboard, or a .json file.',
  importEditable: 'Restore editable strokes and text',
  importEditableHint:
    'Images exported from Shareboard carry the board inside them. Turn this off to add the file as a flat picture.',
  addImage: 'Add an image',

  settingGrid: 'Dot grid',
  settingGridDesc: 'Visual guide on the canvas.',
  settingPeers: 'Other cursors',
  settingPeersDesc: 'Show who is drawing and where.',
  settingSmooth: 'Smooth strokes',
  settingSmoothDesc: 'Reduces jagged lines.',
  settingHaptics: 'Haptics',
  settingHapticsDesc: 'Tactile feedback on tools.',
  boardName: 'Name',
  rename: 'Rename',
  clearBoard: 'Clear the board',
  deleteBoard: 'Delete the board',

  clearTitle: 'Clear the board?',
  clearBody:
    'Every stroke, shape and text will be removed for everyone connected. You can undo once.',
  clearCta: 'Clear',
  deleteTitle: 'Delete the board?',
  deleteBody: 'Board #CODE and its code will stop working. This cannot be undone.',
  deleteCta: 'Delete',

  toastCopied: 'Code copied',
  toastLink: 'Link copied',
  toastExport: 'Image saved',
  toastShared: 'Image shared',
  toastImport: 'Board imported',
  toastImportImage: 'Image added',
  toastCleared: 'Board cleared',
  toastDeleted: 'Board deleted',
  toastRenamed: 'Name updated',
  toastPermissions: 'Access updated',
  toastNoEdit: 'You do not have editing access',

  errCreate: 'Could not create the board',
  errJoin: 'Could not open that board',
  errCodeInvalid: 'Enter a 6-character code or a link',
  errOpen: 'Could not open the board',
  errExport: 'Export failed',
  errImport: 'Import failed',
  errPermissions: 'Could not save the access settings',
  errRename: 'Could not rename the board',
  errDelete: 'Could not delete the board',
  errNicknameTaken: 'That name is already used on this board',
};

export type Strings = typeof es;
export type StringKey = keyof Strings;

export const STRINGS: Record<Lang, Strings> = { es, en: en as Strings };

/** Replaces the `#N` / `#W` / `#H` / `#CODE` placeholders used in the tables. */
export function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (out, [key, value]) => out.split(`#${key}`).join(String(value)),
    template,
  );
}
