// ============================================================
// HNT-CRM API Routes  (Next.js App Router style)
// Place these files under: app/api/crm/
// ============================================================

// ── app/api/crm/contacts/route.js ────────────────────────────
// GET  /api/crm/contacts            → all contacts
// GET  /api/crm/contacts?type=...   → filter by type
// GET  /api/crm/contacts?status=... → filter by pipeline status
// GET  /api/crm/contacts?rep=...    → filter by assigned rep
// POST /api/crm/contacts            → add new contact

import { NextResponse } from 'next/server'
import {
  getAllContacts,
  getContactsByType,
  getContactsByPipelineStatus,
  getContactsByRep,
  addContact,
} from '@/lib/hnt-crm-sheets-api'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const type   = searchParams.get('type')
    const status = searchParams.get('status')
    const rep    = searchParams.get('rep')

    let contacts
    if (type)   contacts = await getContactsByType(type)
    else if (status) contacts = await getContactsByPipelineStatus(status)
    else if (rep)    contacts = await getContactsByRep(rep)
    else             contacts = await getAllContacts()

    return NextResponse.json({ contacts, count: contacts.length })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    await addContact(body)
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// ── app/api/crm/contacts/[rowIndex]/route.js ─────────────────
// PATCH /api/crm/contacts/42             → update any fields
// PATCH /api/crm/contacts/42/pipeline    → update pipeline status only
// PATCH /api/crm/contacts/42/log         → log a contact interaction
// PATCH /api/crm/contacts/42/next-action → set next action

import {
  updateContact,
  updatePipelineStatus,
  logContact,
  setNextAction,
} from '@/lib/hnt-crm-sheets-api'

// General update
export async function PATCH(request, { params }) {
  try {
    const rowIndex = parseInt(params.rowIndex)
    const body = await request.json()

    // Route to the right helper based on action field
    if (body.action === 'pipeline') {
      await updatePipelineStatus(rowIndex, body.status)
    } else if (body.action === 'log') {
      await logContact(rowIndex, { notes: body.notes, rep: body.rep })
    } else if (body.action === 'next-action') {
      await setNextAction(rowIndex, { action: body.nextAction, date: body.date })
    } else {
      // Generic field update — pass any column:value pairs
      const { action, ...updates } = body
      await updateContact(rowIndex, updates)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
