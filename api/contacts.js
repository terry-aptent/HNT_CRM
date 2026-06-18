const { google } = require('googleapis')

const SHEET_ID = '1JVNoNZoXqgytWPOJNiSK3QTyd8fSBiN2YHIGCis_J9w'
const SHEET_NAME = 'HNT-CRM Master'

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  
  if (req.method === 'OPTIONS') return res.status(200).end()
// DEBUG - remove after fixing
return res.status(200).json({
  hasClientId: !!process.env.GOOGLE_CLIENT_ID,
  hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
  hasRefreshToken: !!process.env.GOOGLE_REFRESH_TOKEN,
  clientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) || 'MISSING',
})
  try {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN })

    // Step 1: verify which Google account the token belongs to
    const oauth2 = google.oauth2({ version: 'v2', auth })
    const me = await oauth2.userinfo.get()

    // Step 2: try to access the sheet metadata
    const sheets = google.sheets({ version: 'v4', auth })
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    })

    return res.status(200).json({
      authenticatedAs: me.data.email,
      sheetTitle: meta.data.properties.title,
      tabs: meta.data.sheets.map(s => s.properties.title),
    })

  } catch (err) {
    return res.status(500).json({
      error: err.message,
      code: err.code,
      details: err.errors || err.response?.data || null
    })
  }
}
