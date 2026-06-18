// ============================================================
// api/contacts.js
// Vercel Serverless Function — reads HNT-CRM Google Sheet
// and returns all contacts as JSON to the frontend.
//
// Place this file at: api/contacts.js in your repo root.
// Vercel auto-deploys it as: https://your-app.vercel.app/api/contacts
// ============================================================

const { google } = require('googleapis')

const SHEET_ID = '1QgTAGOQARxwyxCQyZkzwCiMtZYNzJGGp'
const SHEET_NAME = 'HNT-CRM Master'

// Column header → JS key mapping (matches your sheet columns)
// We'll use the raw headers from row 1 of the sheet directly.

async function getSheetsClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  auth.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  })
  return google.sheets({ version: 'v4', auth })
}

module.exports = async function handler(req, res) {
  // CORS headers so your HTML page can call this from the browser
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const sheets = await getSheetsClient()

    // ── GET: fetch all contacts ──────────────────────────────
    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A:AH`,
      })

      const [headers, ...rows] = response.data.values ?? []

      if (!headers) {
        return res.status(200).json({ contacts: [] })
      }

      const contacts = rows
        .filter(row => row[2]) // must have Contact Name (column C)
        .map((row, i) => {
          const contact = {}
          headers.forEach((header, j) => {
            contact[header] = row[j] ?? ''
          })
          contact._rowIndex = i + 2 // 1-indexed + 1 for header row
          return contact
        })

      return res.status(200).json({ contacts, count: contacts.length })
    }

    // ── PATCH: update a contact row ──────────────────────────
    // Body: { rowIndex: 5, updates: { "Pipeline Status": "Contacted", "Last Contact Notes": "..." } }
    if (req.method === 'PATCH') {
      const { rowIndex, updates } = req.body

      if (!rowIndex || !updates) {
        return res.status(400).json({ error: 'rowIndex and updates are required' })
      }

      // Get headers to find column positions
      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A:AH`,
      })
      const headers = headerRes.data.values[0]

      // Build cell-by-cell update data
      const data = []
      for (const [colName, value] of Object.entries(updates)) {
        const colIndex = headers.indexOf(colName)
        if (colIndex === -1) continue // skip unknown columns
        const colLetter = indexToLetter(colIndex + 1)
        data.push({
          range: `${SHEET_NAME}!${colLetter}${rowIndex}`,
          values: [[value]],
        })
      }

      if (data.length === 0) {
        return res.status(400).json({ error: 'No valid columns to update' })
      }

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data,
        },
      })

      return res.status(200).json({ success: true, updated: Object.keys(updates) })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (err) {
    console.error('Sheets API error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

// Convert 1-based column index to letter (e.g. 1→A, 28→AB)
function indexToLetter(index) {
  let letter = ''
  while (index > 0) {
    const mod = (index - 1) % 26
    letter = String.fromCharCode(65 + mod) + letter
    index = Math.floor((index - mod - 1) / 26)
  }
  return letter
}
