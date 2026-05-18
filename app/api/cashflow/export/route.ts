import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

export const dynamic = 'force-dynamic'

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function slugify(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
}

interface CampaignRow {
  name: string
  budget: number
  spend: number
  deviation: number   // raw number, e.g. -10.5 means -10.5%
  status: 'Activa' | 'Pausada'
}

interface ExportPayload {
  client: string
  source: 'facebook' | 'google'
  month: number
  year: number
  pctExpected: number
  userName?: string
  campaigns: CampaignRow[]
  totalBudget: number
  totalSpend: number
}

// Deviation → fill + font color
function deviationColors(dev: number): { fill: string; font: string } {
  const abs = Math.abs(dev)
  if (abs <= 5)  return { fill: 'F0FDF4', font: '15803D' }  // green
  if (abs <= 15) return { fill: 'FFFBEB', font: 'B45309' }  // amber
  return           { fill: 'FEF2F2', font: 'B91C1C' }        // red
}

function argb(hex: string) { return `FF${hex.toUpperCase()}` }

export async function POST(req: NextRequest) {
  const body: ExportPayload = await req.json()
  const { client, source, month, year, pctExpected, userName, campaigns, totalBudget, totalSpend } = body

  const platform    = source === 'facebook' ? 'Meta Ads' : 'Google Ads'
  const headerColor = source === 'facebook' ? '1877F2' : '4285F4'
  const monthName   = MONTHS[month - 1] ?? String(month)
  const exportDate  = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const fileName    = `cashflow_${slugify(client)}_${source === 'facebook' ? 'meta' : 'google'}_${slugify(monthName)}_${year}.xlsx`

  const wb = new ExcelJS.Workbook()
  wb.creator  = 'Brote AD'
  wb.created  = new Date()
  wb.modified = new Date()

  const ws = wb.addWorksheet('Cashflow', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  })

  // ── Column widths ─────────────────────────────────────────────────────────────
  ws.columns = [
    { width: 46 },  // A: Campaña
    { width: 14 },  // B: Plataforma
    { width: 18 },  // C: Presupuesto
    { width: 18 },  // D: Gasto real
    { width: 14 },  // E: Desvío
    { width: 12 },  // F: Estado
  ]

  // ── Row 1: Title ──────────────────────────────────────────────────────────────
  ws.mergeCells('A1:F1')
  const title = ws.getCell('A1')
  title.value     = `Reporte Cashflow — ${client} — ${monthName} ${year}`
  title.font      = { name: 'Calibri', bold: true, size: 18, color: { argb: argb('111827') } }
  title.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  ws.getRow(1).height = 42

  // ── Row 2: Metadata ───────────────────────────────────────────────────────────
  ws.mergeCells('A2:F2')
  const meta = ws.getCell('A2')
  meta.value     = `${platform}   ·   Exportado: ${exportDate}   ·   Usuario: ${userName ?? 'Administrador'}   ·   Consumo ideal del mes: ${pctExpected.toFixed(1)}%`
  meta.font      = { name: 'Calibri', size: 10, color: { argb: argb('6B7280') } }
  meta.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }
  ws.getRow(2).height = 22

  // ── Row 3: Spacer ─────────────────────────────────────────────────────────────
  ws.getRow(3).height = 10

  // ── Row 4: Header ─────────────────────────────────────────────────────────────
  const HEADERS = ['Campaña', 'Plataforma', 'Presupuesto', 'Gasto real', 'Desvío', 'Estado']
  const ALIGNMENTS: ExcelJS.Alignment['horizontal'][] = ['left', 'left', 'right', 'right', 'right', 'center']
  const hRow = ws.getRow(4)
  HEADERS.forEach((h, i) => {
    const c = hRow.getCell(i + 1)
    c.value     = h
    c.font      = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(headerColor) } }
    c.alignment = { horizontal: ALIGNMENTS[i], vertical: 'middle', indent: i < 2 ? 1 : 0 }
    c.border    = {
      top:    { style: 'thin', color: { argb: 'FFFFFFFF' } },
      bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
    }
  })
  hRow.height = 30

  // ── Rows 5+: Campaign data ────────────────────────────────────────────────────
  campaigns.forEach((cam, idx) => {
    const rowIdx  = 5 + idx
    const isEven  = idx % 2 === 0
    const rowBg   = isEven ? 'F9FAFB' : 'FFFFFF'
    const dc      = deviationColors(cam.deviation)
    const isPaused = cam.status === 'Pausada'

    const row = ws.getRow(rowIdx)
    row.height = 26

    // A: Campaña
    const a = row.getCell(1)
    a.value     = cam.name
    a.font      = { name: 'Calibri', size: 10, color: { argb: argb(isPaused ? '9CA3AF' : '111827') } }
    a.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(rowBg) } }
    a.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

    // B: Plataforma
    const b = row.getCell(2)
    b.value     = platform
    b.font      = { name: 'Calibri', size: 10, color: { argb: argb('6B7280') } }
    b.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(rowBg) } }
    b.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 }

    // C: Presupuesto
    const c = row.getCell(3)
    c.value     = cam.budget
    c.numFmt    = '$#,##0'
    c.font      = { name: 'Calibri', size: 10, color: { argb: argb(isPaused ? '9CA3AF' : '374151') } }
    c.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(rowBg) } }
    c.alignment = { horizontal: 'right', vertical: 'middle' }

    // D: Gasto real
    const d = row.getCell(4)
    d.value     = cam.spend
    d.numFmt    = '$#,##0'
    d.font      = { name: 'Calibri', size: 10, bold: true, color: { argb: argb(isPaused ? '9CA3AF' : '111827') } }
    d.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(rowBg) } }
    d.alignment = { horizontal: 'right', vertical: 'middle' }

    // E: Desvío — colored background chip
    const e = row.getCell(5)
    const sign = cam.deviation >= 0 ? '+' : ''
    e.value     = `${sign}${cam.deviation.toFixed(1)}%`
    e.font      = { name: 'Calibri', size: 10, bold: true, color: { argb: argb(isPaused ? '9CA3AF' : dc.font) } }
    e.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: isPaused ? argb(rowBg) : argb(dc.fill) } }
    e.alignment = { horizontal: 'right', vertical: 'middle' }

    // F: Estado
    const f = row.getCell(6)
    f.value     = cam.status
    f.font      = { name: 'Calibri', size: 10, bold: !isPaused, color: { argb: argb(isPaused ? '9CA3AF' : '15803D') } }
    f.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(rowBg) } }
    f.alignment = { horizontal: 'center', vertical: 'middle' }

    // Subtle bottom border on every row
    ;[a, b, c, d, e, f].forEach(cell => {
      cell.border = { bottom: { style: 'hair', color: { argb: argb('E5E7EB') } } }
    })
  })

  // ── Totals row ────────────────────────────────────────────────────────────────
  const totIdx = 5 + campaigns.length + 1
  const totRow = ws.getRow(totIdx)
  totRow.height = 32

  const totalDeviationAll = totalBudget > 0
    ? ((totalSpend / totalBudget) * 100) - pctExpected
    : 0
  const totalDc = deviationColors(totalDeviationAll)

  const tCells = [
    { col: 1, val: 'TOTALES', fmt: null,      bold: true,  color: '111827', align: 'left'   as const, indent: 1 },
    { col: 2, val: '',        fmt: null,      bold: false, color: '111827', align: 'left'   as const, indent: 0 },
    { col: 3, val: totalBudget, fmt: '$#,##0', bold: true, color: '111827', align: 'right'  as const, indent: 0 },
    { col: 4, val: totalSpend,  fmt: '$#,##0', bold: true, color: '111827', align: 'right'  as const, indent: 0 },
    { col: 5, val: `${totalDeviationAll >= 0 ? '+' : ''}${totalDeviationAll.toFixed(1)}%`, fmt: null, bold: true, color: totalDc.font, align: 'right' as const, indent: 0 },
    { col: 6, val: '',        fmt: null,      bold: false, color: '111827', align: 'center' as const, indent: 0 },
  ]

  tCells.forEach(({ col, val, fmt, bold, color, align, indent }) => {
    const cell      = totRow.getCell(col)
    cell.value      = val
    if (fmt) cell.numFmt = fmt
    cell.font       = { name: 'Calibri', size: 11, bold, color: { argb: argb(color) } }
    cell.fill       = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb('F3F4F6') } }
    cell.alignment  = { horizontal: align, vertical: 'middle', indent }
    cell.border     = {
      top:    { style: 'medium', color: { argb: argb('D1D5DB') } },
      bottom: { style: 'medium', color: { argb: argb('D1D5DB') } },
    }
  })

  // ── Generate buffer and return ─────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
