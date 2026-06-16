// ============================================================
// HNT-CRM Google Sheets API Layer
// Sheet ID: 1QgTAGOQARxwyxCQyZkzwCiMtZYNzJGGp
// ============================================================

import { google } from 'googleapis'

const SHEET_ID = '1QgTAGOQARxwyxCQyZkzwCiMtZYNzJGGp'
const SHEET_NAME = 'HNT-CRM Master'
const RANGE = `'${SHEET_NAME}'!A:AH`

// ── Auth ─────────────────────────────────────────────────────
function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

function getSheetsClient() {
  return google.sheets({ version: 'v4', auth: getAuth() })
}

// ── Read all contacts ─────────────────────────────────────────
export async function getAllContacts() {
  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RANGE,
  })

  const [headers, ...rows] = res.data.values ?? []
  return rows
    .filter(row => row[2]) // must have a Contact Name
    .map((row, i) => ({
      _rowIndex: i + 2, // 1-indexed, offset by header row
      ...Object.fromEntries(headers.map((h, j) => [h, row[j] ?? ''])),
    }))
}

// ── Filter helpers ────────────────────────────────────────────
export async function getContactsByType(type) {
  // type: 'Influencer' | 'White Label' | 'NAD Dealer'
  const all = await getAllContacts()
  return all.filter(c => c['Contact Type'] === type)
}

export async function getContactsByPipelineStatus(status) {
  const all = await getAllContacts()
  return all.filter(c => c['Pipeline Status'] === status)
}

export async function getContactsByRep(repName) {
  const all = await getAllContacts()
  return all.filter(c => c['Assigned Rep'] === repName)
}

// ── Update a contact row ──────────────────────────────────────
// Pass rowIndex from the contact object (_rowIndex)
// and an object of column → new value pairs
export async function updateContact(rowIndex, updates) {
  const sheets = getSheetsClient()

  // First, get the current headers so we know column positions
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${SHEET_NAME}'!1:1`,
  })
  const headers = headerRes.data.values[0]

  // Build individual cell updates
  const data = Object.entries(updates).map(([col, value]) => {
    const colIndex = headers.indexOf(col)
    if (colIndex === -1) throw new Error(`Column not found: ${col}`)
    const colLetter = columnIndexToLetter(colIndex + 1)
    return {
      range: `'${SHEET_NAME}'!${colLetter}${rowIndex}`,
      values: [[value]],
    }
  })

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data },
  })
}

// ── Common CRM update shortcuts ───────────────────────────────
export async function updatePipelineStatus(rowIndex, status) {
  return updateContact(rowIndex, { 'Pipeline Status': status })
}

export async function logContact(rowIndex, { notes, rep }) {
  const today = new Date().toISOString().split('T')[0]
  return updateContact(rowIndex, {
    'Last Contacted Date': today,
    'Last Contact Notes': notes,
    ...(rep ? { 'Assigned Rep': rep } : {}),
  })
}

export async function setNextAction(rowIndex, { action, date }) {
  return updateContact(rowIndex, {
    'Next Action': action,
    'Next Action Date': date,
  })
}

// ── Append a new contact ──────────────────────────────────────
export async function addContact(contact) {
  const sheets = getSheetsClient()

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${SHEET_NAME}'!1:1`,
  })
  const headers = headerRes.data.values[0]
  const row = headers.map(h => contact[h] ?? '')
  row[headers.indexOf('Date Added')] = new Date().toISOString().split('T')[0]

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: RANGE,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  })
}

// ── Utility ───────────────────────────────────────────────────
function columnIndexToLetter(index) {
  let letter = ''
  while (index > 0) {
    const mod = (index - 1) % 26
    letter = String.fromCharCode(65 + mod) + letter
    index = Math.floor((index - mod - 1) / 26)
  }
  return letter
}
