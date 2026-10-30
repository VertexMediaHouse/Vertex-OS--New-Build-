function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  // tryLock returns false on timeout instead of throwing; ignoring it meant a write
  // proceeded with no lock held and two concurrent writers could interleave.
  if (!lock.tryLock(10000)) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Busy, retry" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

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

    // 4. ENSURE COLUMNS: add any missing header cells to a tab, in place.
    //    Existing headers keep their column positions and every data cell stays put —
    //    new names are appended to the right of the header row only. Use this to bring
    //    a tab up to the full row shape the app writes, instead of waiting for the
    //    first write that happens to carry each field (see upsertRowsIntoSheet).
    if (action === "ensureColumns") {
      const spec = postData.tables; // { tableName: ["col", ...], ... }
      if (!spec || typeof spec !== "object") {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Invalid payload" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const added = {};
      for (const table in spec) {
        const want = spec[table];
        if (!Array.isArray(want) || want.length === 0) continue;
        added[table] = ensureColumnsOnSheet(ss, table, want);
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true, added }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 5. DROP COLUMNS: remove named columns from a tab, cells and all.
    //    Used to clear out `_placeholder`, the marker an empty tab carried before it
    //    had real columns. deleteColumns() moves every cell to its right across as one
    //    operation, so rows stay aligned with their headers.
    if (action === "dropColumns") {
      const spec = postData.tables; // { tableName: ["col", ...], ... }
      if (!spec || typeof spec !== "object") {
        return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "Invalid payload" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const dropped = {};
      for (const table in spec) {
        const cols = spec[table];
        if (!Array.isArray(cols) || cols.length === 0) continue;
        dropped[table] = dropColumnsOnSheet(ss, table, cols);
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true, dropped }))
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

  // Collect the 1-based sheet rows to drop, then delete them as contiguous blocks.
  // deleteRow() per row costs one Sheets API call each; deleteRows(start, n) folds a
  // run into one. Still bottom-up, so row numbers above the cursor stay valid.
  const targets = [];
  for (let i = 0; i < idValues.length; i++) {
    if (idSet.has(String(idValues[i][0]))) targets.push(i + 2);
  }
  if (targets.length === 0) return 0;

  let count = 0;
  for (let i = targets.length - 1; i >= 0; ) {
    const end = targets[i];
    // Walk down while the rows stay consecutive (targets is ascending).
    let j = i;
    while (j > 0 && targets[j - 1] === targets[j] - 1) j--;
    const start = targets[j];
    sheet.deleteRows(start, end - start + 1);
    count += end - start + 1;
    i = j - 1;
  }
  return count;
}

function serializeCell(val) {
  if (val && typeof val === "object") return JSON.stringify(val);
  return val === undefined || val === null ? "" : val;
}

/**
 * Adds any of `want` that the tab's header row doesn't already have, appending them
 * to the right. Returns the names actually added.
 *
 * Deliberately never moves or rewrites an existing header: the column order in a tab
 * is whatever past writes produced, and data cells are addressed by that order, so
 * reordering here would silently shift every value into the wrong column.
 *
 * `_placeholder` is the marker an empty tab carries. Once a tab gains real columns the
 * marker is meaningless, so it's dropped — but only when the tab holds no data rows,
 * since removing a column from a populated tab would shift its cells.
 */
function ensureColumnsOnSheet(ss, table, want) {
  let sheet = ss.getSheetByName(table);
  if (!sheet) sheet = ss.insertSheet(table);

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  let headers = lastRow > 0 && lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  // Trailing blanks are padding, not columns; drop them so new names land flush.
  while (headers.length > 0 && String(headers[headers.length - 1]).trim() === "") headers.pop();

  // An empty tab's "_placeholder" column has no meaning once real columns exist.
  if (lastRow <= 1) {
    const ph = headers.indexOf("_placeholder");
    if (ph !== -1) {
      sheet.clear();
      headers.splice(ph, 1);
    }
  }

  const seen = {};
  for (let i = 0; i < headers.length; i++) seen[String(headers[i]).trim()] = true;

  const added = [];
  for (let i = 0; i < want.length; i++) {
    const col = String(want[i]).trim();
    if (col === "" || seen[col]) continue;
    seen[col] = true;
    headers.push(col);
    added.push(col);
  }

  if (added.length > 0 || headers.length !== lastCol) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return added;
}

/**
 * Deletes each of `drop` from the tab, by header name. Returns the names removed.
 *
 * Also clears rows that only ever existed to carry the marker: a `_placeholder` row
 * has no value in any other column, so once the column goes it would linger as a blank
 * record. Rows with content in any surviving column are never touched.
 *
 * Right-to-left: deleting a column renumbers the ones after it, so going left-to-right
 * would delete the wrong column on the second pass.
 */
function dropColumnsOnSheet(ss, table, drop) {
  const sheet = ss.getSheetByName(table);
  if (!sheet) return [];

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const targets = [];
  for (let i = 0; i < headers.length; i++) {
    if (drop.indexOf(String(headers[i]).trim()) !== -1) targets.push(i);
  }
  if (targets.length === 0) return [];

  // Drop rows that are empty once these columns are gone, before the indices shift.
  if (lastRow > 1) {
    const body = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (let r = body.length - 1; r >= 0; r--) {
      let hasOther = false;
      for (let c = 0; c < body[r].length; c++) {
        if (targets.indexOf(c) !== -1) continue;
        if (String(body[r][c]).trim() !== "") { hasOther = true; break; }
      }
      if (!hasOther) sheet.deleteRow(r + 2);
    }
  }

  const removed = [];
  for (let i = targets.length - 1; i >= 0; i--) {
    sheet.deleteColumns(targets[i] + 1, 1);
    removed.push(String(headers[targets[i]]).trim());
  }
  return removed;
}
