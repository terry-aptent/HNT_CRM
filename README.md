# HNT-CRM Google Sheets Backend — Setup Guide

## Your Sheet ID
```
1QgTAGOQARxwyxCQyZkzwCiMtZYNzJGGp
```

---

## Step 1 — Install the Google APIs package

```bash
npm install googleapis
```

---

## Step 2 — Create a Service Account in Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → your HNT project
2. **IAM & Admin → Service Accounts → Create Service Account**
3. Name it (e.g. `hnt-crm-backend`) → click **Create and Continue**
4. Skip roles for now → click **Done**
5. Click the new service account → **Keys → Add Key → Create New Key → JSON**
6. Download the JSON file — it contains your credentials

From the JSON file, copy:
- `client_email` → looks like `hnt-crm-backend@your-project.iam.gserviceaccount.com`
- `private_key` → the long `-----BEGIN PRIVATE KEY-----...` string

---

## Step 3 — Share your Google Sheet with the service account

1. Open your HNT-CRM Google Sheet
2. Click **Share** (top right)
3. Paste the `client_email` from above
4. Set permission to **Editor**
5. Uncheck "Notify people" → click **Share**

---

## Step 4 — Add environment variables to Vercel

In Vercel → your project → Settings → Environment Variables, add:

| Name | Value |
|------|-------|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `hnt-crm-backend@your-project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` (paste the full key, keep the \n characters) |
| `NEXT_PUBLIC_SHEET_ID` | `1QgTAGOQARxwyxCQyZkzwCiMtZYNzJGGp` |

For local development, add these to `.env.local` in your project root:
```
GOOGLE_SERVICE_ACCOUNT_EMAIL=hnt-crm-backend@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
NEXT_PUBLIC_SHEET_ID=1QgTAGOQARxwyxCQyZkzwCiMtZYNzJGGp
```

---

## Step 5 — Add the files to your repo

```
your-repo/
├── lib/
│   └── hnt-crm-sheets-api.js     ← the API layer
└── app/
    └── api/
        └── crm/
            ├── contacts/
            │   ├── route.js       ← GET all / POST new contact
            │   └── [rowIndex]/
            │       └── route.js   ← PATCH update contact
```

---

## Step 6 — Use the API from your frontend

```js
// Fetch all contacts
const res = await fetch('/api/crm/contacts')
const { contacts } = await res.json()

// Filter by type
const influencers = await fetch('/api/crm/contacts?type=Influencer').then(r => r.json())

// Filter by pipeline status
const active = await fetch('/api/crm/contacts?status=Active Partner').then(r => r.json())

// Update pipeline status (rowIndex comes from contact._rowIndex)
await fetch(`/api/crm/contacts/${contact._rowIndex}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'pipeline', status: 'In Discussion' }),
})

// Log a contact interaction
await fetch(`/api/crm/contacts/${contact._rowIndex}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'log',
    notes: 'Had intro call, sending proposal next week.',
    rep: 'Sarah',
  }),
})

// Set next action
await fetch(`/api/crm/contacts/${contact._rowIndex}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'next-action',
    nextAction: 'Send partnership proposal',
    date: '2026-06-25',
  }),
})
```

---

## Pipeline Status Values
- `Prospect`
- `Contacted`
- `In Discussion`
- `Proposal Sent`
- `Active Partner`
- `On Hold`
- `Declined`

---

## Contact Types
- `Influencer`
- `White Label`
- `NAD Dealer`
