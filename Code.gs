/**
 * NISPEDIA — Google Apps Script Web App endpoint
 *
 * Fungsi:
 * 1. Menerima ringkasan Checklist dari microsite melalui POST JSON.
 * 2. Memvalidasi nama koperasi, jenis koperasi, kontak, dan item checklist.
 * 3. Menyimpan data secara opsional ke Google Sheets.
 * 4. Mengembalikan respons JSON yang konsisten.
 *
 * Catatan penting:
 * - Script ini TIDAK membuat atau mengaktifkan Google Form.
 * - Alur microsite saat ini tetap mengirim pertanyaan/checklist ke WhatsApp admin.
 * - Endpoint ini dapat diaktifkan jika koperasi ingin menyimpan arsip checklist.
 */

const CONFIG = {
  spreadsheetIdProperty: 'NISPEDIA_SPREADSHEET_ID',
  sheetNameProperty: 'NISPEDIA_SHEET_NAME',
  defaultSheetName: 'Checklist NISPEDIA',
  allowedTypes: ['KSP', 'USP'],
  maxQuestionLength: 2000,
};

/**
 * Health check sederhana.
 */
function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'NISPEDIA Checklist API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Menerima payload JSON dari microsite.
 *
 * Contoh payload:
 * {
 *   "cooperativeName": "Koperasi Sejahtera Ambon",
 *   "cooperativeType": "KSP",
 *   "contactName": "Nama Pengurus",
 *   "contactPhone": "082197599306",
 *   "progress": 75,
 *   "completedCount": 9,
 *   "totalCount": 12,
 *   "items": [
 *     {"number":"01", "title":"Rencana Kerja", "checked":true}
 *   ],
 *   "source": "nispedia-microsite"
 * }
 */
function doPost(e) {
  try {
    const payload = parsePayload_(e);
    const data = validatePayload_(payload);
    const row = appendChecklistRecord_(data);

    return jsonResponse_({
      ok: true,
      message: 'Checklist berhasil dicatat.',
      recordId: row.recordId,
      recordedAt: row.recordedAt,
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : 'Permintaan tidak dapat diproses.',
    });
  }
}

function parsePayload_(event) {
  if (!event || !event.postData || !event.postData.contents) {
    throw new Error('Payload JSON tidak ditemukan.');
  }

  let payload;
  try {
    payload = JSON.parse(event.postData.contents);
  } catch (error) {
    throw new Error('Payload harus berupa JSON yang valid.');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Format payload tidak valid.');
  }

  return payload;
}

function validatePayload_(payload) {
  const cooperativeName = cleanText_(payload.cooperativeName, 160);
  const cooperativeType = cleanText_(payload.cooperativeType, 10).toUpperCase();
  const contactName = cleanText_(payload.contactName, 120);
  const contactPhone = cleanPhone_(payload.contactPhone);
  const progress = toNumber_(payload.progress, 0, 100);
  const completedCount = toInteger_(payload.completedCount, 0);
  const totalCount = toInteger_(payload.totalCount, 0);

  if (!cooperativeName) throw new Error('Nama koperasi wajib diisi.');
  if (CONFIG.allowedTypes.indexOf(cooperativeType) === -1) {
    throw new Error('Jenis koperasi harus KSP atau USP.');
  }
  if (!contactName) throw new Error('Nama pengisi wajib diisi.');
  if (!/^(?:08|628)\d{8,11}$/.test(contactPhone)) {
    throw new Error('Nomor kontak tidak valid.');
  }
  if (totalCount < 1 || completedCount > totalCount) {
    throw new Error('Jumlah checklist tidak valid.');
  }

  const items = Array.isArray(payload.items)
    ? payload.items.slice(0, 100).map(function (item, index) {
        return {
          number: cleanText_(item && item.number, 20) || String(index + 1).padStart(2, '0'),
          title: cleanText_(item && item.title, 240) || 'Dokumen checklist',
          checked: Boolean(item && item.checked),
        };
      })
    : [];

  return {
    cooperativeName: cooperativeName,
    cooperativeType: cooperativeType,
    contactName: contactName,
    contactPhone: contactPhone,
    progress: progress,
    completedCount: completedCount,
    totalCount: totalCount,
    items: items,
    source: cleanText_(payload.source, 80) || 'nispedia-microsite',
  };
}

function appendChecklistRecord_(data) {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty(CONFIG.spreadsheetIdProperty);
  const sheetName = properties.getProperty(CONFIG.sheetNameProperty) || CONFIG.defaultSheetName;

  if (!spreadsheetId) {
    throw new Error('Spreadsheet belum dikonfigurasi. Isi NISPEDIA_SPREADSHEET_ID pada Script Properties.');
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  ensureHeader_(sheet);

  const recordId = Utilities.getUuid();
  const recordedAt = new Date();
  const itemSummary = data.items.map(function (item) {
    return (item.checked ? '[x] ' : '[ ] ') + item.number + ' ' + item.title;
  }).join('\n');

  sheet.appendRow([
    recordedAt,
    recordId,
    data.cooperativeName,
    data.cooperativeType,
    data.contactName,
    data.contactPhone,
    data.completedCount + '/' + data.totalCount,
    data.progress + '%',
    itemSummary,
    data.source,
  ]);

  return {
    recordId: recordId,
    recordedAt: recordedAt.toISOString(),
  };
}

function ensureHeader_(sheet) {
  if (sheet.getLastRow() > 0) return;

  sheet.appendRow([
    'Recorded At',
    'Record ID',
    'Nama Koperasi',
    'Jenis',
    'Nama Pengisi',
    'Nomor Kontak',
    'Progress',
    'Persentase',
    'Rincian Checklist',
    'Sumber',
  ]);
  sheet.setFrozenRows(1);
}

function cleanText_(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanPhone_(value) {
  return String(value == null ? '' : value).replace(/[^0-9]/g, '').slice(0, 15);
}

function toInteger_(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(fallback, Math.floor(number)) : fallback;
}

function toNumber_(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function jsonResponse_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Jalankan satu kali dari editor Apps Script untuk membuat Script Properties.
 * Ganti nilai spreadsheetId dengan ID Google Sheet tujuan.
 */
function setConfiguration() {
  const spreadsheetId = 'GANTI_DENGAN_ID_GOOGLE_SHEET';
  const sheetName = 'Checklist NISPEDIA';

  if (spreadsheetId === 'GANTI_DENGAN_ID_GOOGLE_SHEET') {
    throw new Error('Ganti spreadsheetId terlebih dahulu sebelum menjalankan setConfiguration().');
  }

  PropertiesService.getScriptProperties().setProperties({
    NISPEDIA_SPREADSHEET_ID: spreadsheetId,
    NISPEDIA_SHEET_NAME: sheetName,
  }, true);
}
