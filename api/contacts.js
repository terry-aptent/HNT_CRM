const { google } = require('googleapis')

const SHEET_ID = '1JVNoNZoXqgytWPOJNiSK3QTyd8fSBiN2YHIGCis_J9w'
const SHEET_NAME = 'HNT-CRM Master'

async function getSheetsClient() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  )
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })
  const { token } = await auth.getAccessToken()
  if (!token) throw new Error('Could not obtain access token from refresh token')
  return google.sheets({ version: 'v4', auth })
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const sheets = await getSheetsClient()

    // ── GET: fetch all contacts ──────────────────────────────
    if (req.method === 'GET') {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A:AH`,
      })
      const [headers, ...rows] = response.data.values ?? []
      if (!headers) return res.status(200).json({ contacts: [] })
      const contacts = rows
        .filter(row => row[2])
        .map((row, i) => {
          const contact = {}
          headers.forEach((header, j) => { contact[header] = row[j] ?? '' })
          contact._rowIndex = i + 2
          return contact
        })
      return res.status(200).json({ contacts, count: contacts.length })
    }

    // ── POST: add a new contact ──────────────────────────────
    if (req.method === 'POST') {
      const { contact } = req.body
      if (!contact || !contact['Contact Name']) {
        return res.status(400).json({ error: 'Contact Name is required' })
      }

      // Get headers to build the row in correct column order
      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!1:1`,
      })
      const headers = headerRes.data.values[0]

      // Build row array matching header order
      const row = headers.map(h => contact[h] ?? '')

      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A:AH`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] },
      })

      return res.status(201).json({ success: true })
    }

    // ── PATCH: update a contact row ──────────────────────────
    if (req.method === 'PATCH') {
      const { rowIndex, updates } = req.body
      if (!rowIndex || !updates) {
        return res.status(400).json({ error: 'rowIndex and updates are required' })
      }

      const headerRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!1:1`,
      })
      const headers = headerRes.data.values[0]

      const data = []
      for (const [colName, value] of Object.entries(updates)) {
        const colIndex = headers.indexOf(colName)
        if (colIndex === -1) continue
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
        requestBody: { valueInputOption: 'USER_ENTERED', data },
      })

      return res.status(200).json({ success: true, updated: Object.keys(updates) })
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (err) {
    console.error('Sheets API error:', err)
    return res.status(500).json({
      error: err.message,
      code: err.code,
      details: err.errors || err.response?.data || null
    })
  }
}

function indexToLetter(index) {
  let letter = ''
  while (index > 0) {
    const mod = (index - 1) % 26
    letter = String.fromCharCode(65 + mod) + letter
    index = Math.floor((index - mod - 1) / 26)
  }
  return letter
}
