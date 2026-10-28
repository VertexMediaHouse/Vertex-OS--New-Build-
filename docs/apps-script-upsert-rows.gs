function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const postData = e.postData ? JSON.parse(e.postData.contents) : null;
    const action = (postData && postData.action) || (e.parameter && e.parameter.action) || "getAll";

    // 1. GET ALL DATA: Returns all tabs as JSON objects { clients: [...], tasks: [...] }
    if (action === "getAll") {
      const sheets = ss.getSheets();
      const result = {};

      sheets.forEach(sheet => {
        const name = sheet.getName();
        const data = sheet.getDataRange().getValues();
        if (data.length < 2) {
          result[name] = [];
          return;
        }
        const headers = data[0];
        const rows = data.slice(1).map(row => {
          const obj = {};
          headers.forEach((h, i) => {
            let val = row[i];
            if (typeof val === "string" && (val.startsWith("{") || val.startsWith("["))) {
              try { val = JSON.parse(val); } catch(_) {}
            }
            obj[h] = val;
          });
          return obj;
        });
        result[name] = rows;
      });

      return ContentService.createTextOutput(JSON.stringify({ ok: true, data: result }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. SAVE / SYNC MODEL (legacy, full-table overwrite): kept for backward compat.
    //    Prefer upsertRows/deleteRows below — syncTable wipes and rewrites the whole
    //    tab, so two concurrent writers can clobber each other's rows.
    if (action === "syncTable") {
      const table = postData.table;
      const rows = postData.rows; // Array of objects
      if (!table || !Array.isArray(rows)) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Invalid payload" }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      let sheet = ss.getSheetByName(table);
      if (!sheet) {
        sheet = ss.insertSheet(table);
      }

      if (rows.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({ ok: true }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // Collect all keys as headers
      const headers = Object.keys(rows[0]);
      sheet.clearContents();
      sheet.appendRow(headers);

      const matrix = rows.map(r =>
        headers.map(h => {
          const val = r[h];
          if (val && typeof val === "object") return JSON.stringify(val);
          return val === undefined || val === null ? "" : val;
        })
      );

      sheet.getRange(2, 1, matrix.length, headers.length).setValues(matrix);

      return ContentService.createTextOutput(JSON.stringify({ ok: true, count: rows.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2b. UPSERT ROWS: update rows that already exist (by id), append new ones.
    //     Row-level — does not touch any row not included in the payload, so
    //     concurrent writers touching different rows don't clobber each other.
    if (action === "upsertRows") {
      const table = postData.table;
      const rows = postData.rows;
      if (!table || !Array.isArray(rows)) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Invalid payload" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const count = upsertRowsIntoSheet(ss, table, rows);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, count }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2c. DELETE ROWS: remove rows by id. Row-level — leaves every other row untouched.
    if (action === "deleteRows") {
      const table = postData.table;
      const ids = postData.ids;
      if (!table || !Array.isArray(ids)) {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Invalid payload" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const count = deleteRowsFromSheet(ss, table, ids);
      return ContentService.createTextOutput(JSON.stringify({ ok: true, count }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 3. SEED / INITIALIZE ALL TABLES AT ONCE
    if (action === "seedAll") {
      const allData = postData.data; // { clients: [...], tasks: [...] }
      for (const [table, rows] of Object.entries(allData)) {
        let sheet = ss.getSheetByName(table);
        if (!sheet) sheet = ss.insertSheet(table);
        if (Array.isArray(rows) && rows.length > 0) {
          const headers = Object.keys(rows[0]);
          sheet.clearContents();
          sheet.appendRow(headers);
          const matrix = rows.map(r =>
            headers.map(h => {
              const val = r[h];
              if (val && typeof val === "object") return JSON.stringify(val);
              return val === undefined || val === null ? "" : val;
            })
          );
          sheet.getRange(2, 1, matrix.length, headers.length).setValues(matrix);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Unknown action" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Upserts rows into `table`'s tab by matching the "id" column. Existing rows are
 * overwritten in place (their row position doesn't move); unmatched rows are appended.
 * New columns present in `rows` but not yet in the sheet are added to the header row.
 */
function upsertRowsIntoSheet(ss, table, rows) {
  if (rows.length === 0) return 0;

  let sheet = ss.getSheetByName(table);
  if (!sheet) sheet = ss.insertSheet(table);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  let headers = lastRow > 0 && lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  // Grow the header row if any incoming row has a key we haven't seen yet.
  const seen = new Set(headers);
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (!seen.has(k)) {
        seen.add(k);
        headers.push(k);
      }
    }
  }
  if (headers.length === 0) headers = Object.keys(rows[0]);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  const idCol = headers.indexOf("id");
  const existingIds = new Map(); // id -> 1-based sheet row number
  if (idCol !== -1 && lastRow > 1) {
    const idValues = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
    idValues.forEach((row, i) => existingIds.set(String(row[0]), i + 2));
  }

  const toAppend = [];
  for (const r of rows) {
    const line = headers.map((h) => serializeCell(r[h]));
    const rowNum = idCol !== -1 ? existingIds.get(String(r.id)) : undefined;
    if (rowNum) {
      sheet.getRange(rowNum, 1, 1, headers.length).setValues([line]);
    } else {
      toAppend.push(line);
    }
  }
  if (toAppend.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, toAppend.length, headers.length).setValues(toAppend);
  }
  return rows.length;
}

/** Deletes rows matching any of `ids` (by the "id" column) from `table`'s tab. */
function deleteRowsFromSheet(ss, table, ids) {
  const sheet = ss.getSheetByName(table);
  if (!sheet || ids.length === 0) return 0;

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2) return 0;

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idCol = headers.indexOf("id");
  if (idCol === -1) return 0;

  const idSet = new Set(ids.map(String));
  const idValues = sheet.getRange(2, idCol + 1, lastRow - 1, 1).getValues();

  // Delete bottom-up so row numbers above the cursor stay valid as rows are removed.
  let count = 0;
  for (let i = idValues.length - 1; i >= 0; i--) {
    if (idSet.has(String(idValues[i][0]))) {
      sheet.deleteRow(i + 2);
      count++;
    }
  }
  return count;
}

function serializeCell(val) {
  if (val && typeof val === "object") return JSON.stringify(val);
  return val === undefined || val === null ? "" : val;
}
