// ============================================================
//  SISTEMA DE FISCALIZACIÓN — BANCO FAMILIAR
//  Código.gs · Google Apps Script · Backend
//  Repo: https://github.com/dmfadev/FAMILIAR-FORM
// ============================================================

const CONFIG = {
  SPREADSHEET_ID:    SpreadsheetApp.getActiveSpreadsheet().getId(),
  SHEET_RESPUESTAS:  'RESPUESTAS',
  SHEET_SUCURSALES:  'SUCURSALES',       // ← tu hoja real

  // ── CARPETA DE FOTOS EN DRIVE ─────────────────────────────
  // Paso 1: Creá una carpeta en drive.google.com
  // Paso 2: Abrila y copiá el ID de la URL:
  //   drive.google.com/drive/folders/ESTE-ES-EL-ID
  // Paso 3: Pegalo aquí abajo entre las comillas
  DRIVE_FOLDER_ID:   'PEGAR_ID_DE_CARPETA_AQUI',

  COL_FOTOS_START:   12,    // columnas L a Q (6 fotos)
  COL_OBSERV:        18,    // columna R
  MAX_FOTOS:         6,
  MIN_FOTOS:         2,
};

// ── LISTAS CONTROLADAS ────────────────────────────────────────
// Editá estos arrays con tus datos reales
const LISTAS = {
  fiscalizadores: [
    'Fiscalizador 1',
    'Fiscalizador 2',
    'Fiscalizador 3',
    'Fiscalizador 4',
    'Fiscalizador 5',
  ],
  beneficios: [
    'Beneficio A',
    'Beneficio B',
    'Beneficio C',
    'Beneficio D',
  ],
  tiposOferta: [
    'Oferta Estándar',
    'Oferta Premium',
    'Oferta Especial',
    'Sin Oferta',
  ],
  estadoVisual: [
    'Excelente',
    'Bueno',
    'Regular',
    'Deteriorado',
    'Sin Material',
  ],
  materialesA: [
    'Banner Tipo A',
    'Afiche A1',
    'Afiche A2',
    'Display A',
    'Stopper A',
    'Colgante A',
  ],
  materialesB: [
    'Banner Tipo B',
    'Afiche B1',
    'Afiche B2',
    'Display B',
    'Stopper B',
    'Colgante B',
  ],
};

// ── PUNTO DE ENTRADA WEB ──────────────────────────────────────
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Fiscalización · Banco Familiar')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ── DATOS INICIALES ───────────────────────────────────────────
// Llamado desde el cliente al cargar el formulario
function getDatosIniciales() {
  try {
    const ss  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const hoja = ss.getSheetByName(CONFIG.SHEET_SUCURSALES);

    if (!hoja) {
      return { ok: false, error: 'No se encontró la hoja SUCURSALES.' };
    }

    const lastRow = Math.max(1, hoja.getLastRow() - 1);
    // Lee columnas A (TIENDA) y B (SHOPPING) desde fila 2
    const datos = hoja.getRange(2, 1, lastRow, 2).getValues();

    // Formato: "ADIDAS — ADIDAS CARMELITAS"
    const locales = datos
      .map(r => {
        const tienda   = String(r[0]).trim();
        const shopping = String(r[1]).trim();
        if (!tienda && !shopping) return '';
        if (!shopping) return tienda;
        if (!tienda)   return shopping;
        return tienda + ' — ' + shopping;
      })
      .filter(Boolean);

    return {
      ok: true,
      locales,
      fiscalizadores: LISTAS.fiscalizadores,
      beneficios:     LISTAS.beneficios,
      tiposOferta:    LISTAS.tiposOferta,
      estadoVisual:   LISTAS.estadoVisual,
      materialesA:    LISTAS.materialesA,
      materialesB:    LISTAS.materialesB,
    };

  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── SUBIR FOTO A DRIVE ────────────────────────────────────────
function guardarFoto_(base64Data, nombreArchivo) {
  try {
    const raw  = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const blob = Utilities.newBlob(
      Utilities.base64Decode(raw),
      'image/jpeg',
      nombreArchivo
    );

    const carpeta = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    const file    = carpeta.createFile(blob);

    // Cualquier persona con el link puede ver (necesario para =IMAGE())
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      ok:  true,
      url: 'https://drive.google.com/uc?export=view&id=' + file.getId(),
    };

  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── GUARDAR REGISTRO COMPLETO ─────────────────────────────────
// payload = {
//   fiscalizador, fechaEncuesta, local,
//   tieneMateriales, beneficio, tipoOferta,
//   tipoMaterial, materialesColocados[],
//   estadoVisual, observaciones,
//   fotos: [{ base64, nombre }]   ← ya redimensionadas en cliente
// }
function guardarRegistro(payload) {
  try {

    // ── Validaciones ────────────────────────────────────────
    if (!payload.fotos || payload.fotos.length < CONFIG.MIN_FOTOS) {
      return {
        ok:    false,
        error: 'Se requieren al menos ' + CONFIG.MIN_FOTOS + ' fotos.'
      };
    }
    if (payload.fotos.length > CONFIG.MAX_FOTOS) {
      return {
        ok:    false,
        error: 'Máximo ' + CONFIG.MAX_FOTOS + ' fotos permitidas.'
      };
    }

    // ── Subir fotos ─────────────────────────────────────────
    const urls = [];
    for (let i = 0; i < payload.fotos.length; i++) {
      const f   = payload.fotos[i];
      const res = guardarFoto_(f.base64, f.nombre);
      if (!res.ok) {
        return { ok: false, error: 'Error en foto ' + (i + 1) + ': ' + res.error };
      }
      urls.push(res.url);
    }

    // ── Construir fila ──────────────────────────────────────
    const tz      = Session.getScriptTimeZone();
    const ahora   = new Date();
    const matsStr = Array.isArray(payload.materialesColocados)
      ? payload.materialesColocados.join(', ')
      : (payload.materialesColocados || '');

    const fila = [
      Utilities.formatDate(ahora, tz, 'dd/MM/yyyy'),  // A  FECHA
      Utilities.formatDate(ahora, tz, 'HH:mm:ss'),    // B  HORA
      payload.fiscalizador    || '',                   // C  FISCALIZADOR
      payload.fechaEncuesta   || '',                   // D  FECHA ENCUESTA
      payload.local           || '',                   // E  LOCAL
      payload.tieneMateriales || '',                   // F  TIENE MATERIALES
      payload.beneficio       || '',                   // G  BENEFICIO
      payload.tipoOferta      || '',                   // H  TIPO OFERTA
      payload.tipoMaterial    || '',                   // I  TIPO MATERIAL
      matsStr,                                         // J  MATERIALES COLOCADOS
      payload.estadoVisual    || '',                   // K  ESTADO VISUAL
      // L-Q: fotos (6 slots)
      ...Array.from({ length: CONFIG.MAX_FOTOS }, (_, i) => urls[i] || ''),
      payload.observaciones   || '',                   // R  OBSERVACIONES
    ];

    // ── Obtener / crear hoja RESPUESTAS ─────────────────────
    const ss  = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = ss.getSheetByName(CONFIG.SHEET_RESPUESTAS);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_RESPUESTAS);
      const headers = [
        'FECHA', 'HORA', 'FISCALIZADOR', 'FECHA ENCUESTA', 'LOCAL',
        'CUENTA CON MATERIALES?', 'BENEFICIO', 'TIPO OFERTA',
        'TIPO MATERIAL', 'MATERIALES COLOCADOS (A/B)', 'ESTADO VISUAL',
        'FOTO 1', 'FOTO 2', 'FOTO 3', 'FOTO 4', 'FOTO 5', 'FOTO 6',
        'OBSERVACIONES',
      ];
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setValues([headers]);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#1a73e8');
      headerRange.setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    // ── Escribir fila ───────────────────────────────────────
    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, fila.length).setValues([fila]);

    // ── Insertar =IMAGE() en columnas de fotos ──────────────
    for (let i = 0; i < urls.length; i++) {
      sheet
        .getRange(row, CONFIG.COL_FOTOS_START + i)
        .setFormula('=IMAGE("' + urls[i] + '",4,80,80)');
    }
    if (urls.length > 0) sheet.setRowHeight(row, 90);

    return { ok: true, fila: row, fotos: urls };

  } catch (e) {
    return { ok: false, error: e.message };
  }
}
