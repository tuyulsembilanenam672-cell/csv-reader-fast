// csv-reader-fast: a fast drop-in for make.fun's csv-reader 1.0.0.
//
// run(input) returns exactly what csv-reader 1.0.0's readCsv returns for {text, header}:
// {columns, rows, errors}. The semantics are csv-reader's own: a U+FEFF at the very start is
// dropped; a record ends at LF or CRLF and a line left with no characters is no record; outside
// quotes a CR not followed by LF is dropped (stray_cr); a field that opens with a quote runs to
// the next quote that is not doubled, "" inside it is one quote and each CRLF or lone CR inside
// it reads as LF; what follows its closing quote, up to the next comma or line break, is appended
// as it stands (quote_junk, when the field ends); a quote that never closes is a literal
// character and the text after it is read again as unquoted (unterminated_quote); a quote inside
// an unquoted field is a literal character; fields stay strings, never trimmed or converted;
// columns is the first record when header is true, else null; rows holds the records after it,
// each padded with "" (short_row, with fields: its field count) or cut (long_row, with extra:
// the cut fields) to the first record's width; each error is {code, line, row}, in the order
// met, a record's short_row or long_row when it ends, line the 1-based line its record starts on
// and row its record's index in rows (null for the header).
//
// Only the reading is different: fields are taken as slices between delimiters found by one
// scan, instead of one character at a time.

/** How a field ended: at a comma (the record goes on), at a line break or at the end of the text. */
const COMMA = 0;
const LB = 1;
const END = 2;

/**
 * Scan an unquoted field starting at `pos`, appending the kept characters to `prefix`.
 * A lone CR is dropped and reported (stray_cr). Returns [value, ended, pos, line, added]:
 * ended is COMMA/LB/END, and added counts the characters kept during this scan.
 */
function scanUnquoted(text, pos, line, n, errors, recordLine, recordRow, prefix) {
  let v = prefix;
  let added = 0;
  for (;;) {
    let end = pos;
    let cc = 0;
    while (end < n) {
      cc = text.charCodeAt(end);
      if (cc === 44 || cc === 10 || cc === 13) break;
      end++;
    }
    if (end > pos) {
      const seg = text.slice(pos, end);
      v += seg;
      added += seg.length;
    }
    if (end >= n) return [v, END, n, line, added];
    if (cc === 44) return [v, COMMA, end + 1, line, added];
    if (cc === 10) return [v, LB, end + 1, line + 1, added];
    if (text.charCodeAt(end + 1) === 10) return [v, LB, end + 2, line + 1, added];
    errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
    pos = end + 1;
  }
}

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === 0xFEFF ? 1 : 0;
  let line = 1;

  while (true) {
    // A line left with no characters is no record.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    const recordLine = line;
    const recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    let ended = COMMA;

    do {
      let v;
      if (text.charCodeAt(pos) === 34) {
        quoted = true;
        const open = pos;
        const openLine = line;
        // Find the closing quote; a quote followed by another quote is one literal quote.
        let segStart = pos + 1;
        let close = -1;
        let parts = null;
        let q = text.indexOf('"', segStart);
        while (q !== -1) {
          if (text.charCodeAt(q + 1) === 34) {
            if (parts === null) parts = [text.slice(segStart, q)];
            else parts.push(text.slice(segStart, q));
            segStart = q + 2;
            q = text.indexOf('"', segStart);
          } else {
            close = q;
            break;
          }
        }
        if (close === -1) {
          // The quote never closes: it is a literal character, and the text after it is
          // read again as unquoted.
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          const r = scanUnquoted(text, open + 1, openLine, n, errors, recordLine, recordRow, '"');
          v = r[0];
          ended = r[1];
          pos = r[2];
          line = r[3];
        } else {
          let content;
          if (parts === null) content = text.slice(pos + 1, close);
          else {
            parts.push(text.slice(segStart, close));
            content = parts.join('"');
          }
          // Line breaks inside quotes: each CRLF or lone CR reads as one LF.
          if (content.indexOf('\n') !== -1 || content.indexOf('\r') !== -1) {
            let breaks = 0;
            for (let i = 0; i < content.length; i++) {
              const cc = content.charCodeAt(i);
              if (cc === 10) breaks += 1;
              else if (cc === 13) {
                breaks += 1;
                if (content.charCodeAt(i + 1) === 10) i += 1;
              }
            }
            line += breaks;
            if (content.indexOf('\r') !== -1) content = content.replace(/\r\n?/g, '\n');
          }
          pos = close + 1;
          if (pos >= n) {
            v = content;
            ended = END;
          } else {
            const c = text.charCodeAt(pos);
            if (c === 44) {
              pos += 1;
              v = content;
              ended = COMMA;
            } else if (c === 10) {
              pos += 1;
              line += 1;
              v = content;
              ended = LB;
            } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
              pos += 2;
              line += 1;
              v = content;
              ended = LB;
            } else {
              // What follows the closing quote is appended as it stands.
              const r = scanUnquoted(text, pos, line, n, errors, recordLine, recordRow, content);
              if (r[4] > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
              v = r[0];
              ended = r[1];
              pos = r[2];
              line = r[3];
            }
          }
        }
      } else {
        quoted = false;
        let end = pos;
        let cc = 0;
        while (end < n) {
          cc = text.charCodeAt(end);
          if (cc === 44 || cc === 10 || cc === 13) break;
          end++;
        }
        if (end >= n) {
          v = text.slice(pos);
          pos = n;
          ended = END;
        } else if (cc === 44) {
          v = text.slice(pos, end);
          pos = end + 1;
          ended = COMMA;
        } else if (cc === 10) {
          v = text.slice(pos, end);
          pos = end + 1;
          line += 1;
          ended = LB;
        } else if (text.charCodeAt(end + 1) === 10) {
          v = text.slice(pos, end);
          pos = end + 2;
          line += 1;
          ended = LB;
        } else {
          // A lone CR is dropped (stray_cr); the field goes on after it.
          errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
          const r = scanUnquoted(text, end + 1, line, n, errors, recordLine, recordRow, text.slice(pos, end));
          v = r[0];
          ended = r[1];
          pos = r[2];
          line = r[3];
        }
      }
      fields.push(v);
    } while (ended === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
