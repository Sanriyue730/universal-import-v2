import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: '没有上传文件' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const fileName = file.name.toLowerCase()

    let sheets: { name: string; rows: (string | number | null)[][] }[] = []

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      sheets = parseExcel(buffer)
    } else if (fileName.endsWith('.docx')) {
      sheets = await parseWord(buffer)
    } else if (fileName.endsWith('.pdf')) {
      sheets = await parsePdf(buffer)
    } else {
      return NextResponse.json({ success: false, error: '不支持的文件格式' }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: sheets })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}

function parseExcel(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheets: { name: string; rows: (string | number | null)[][] }[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
      header: 1,
      defval: null,
      raw: true,
    })
    sheets.push({ name: sheetName, rows })
  }
  return sheets
}

async function parseWord(buffer: ArrayBuffer) {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  const lines = result.value.split('\n').map((line: string) => [line])
  return [{ name: 'document', rows: lines }]
}

async function parsePdf(buffer: ArrayBuffer) {
  // 使用 pdf-parse 在服务端解析
  // pdfjs-dist 在 Node.js 环境中也能工作
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  const rows: (string | null)[][] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    let lastY: number | null = null
    let currentLine: string[] = []

    // 按Y坐标分行
    const items = content.items.filter((item) => 'str' in item && (item as Record<string, unknown>).str)
    // Sort by Y desc (PDF坐标系Y轴向上), then X asc
    items.sort((a, b) => {
      const aT = (a as unknown as { transform: number[] }).transform
      const bT = (b as unknown as { transform: number[] }).transform
      const yDiff = bT[5] - aT[5]
      if (Math.abs(yDiff) > 3) return yDiff
      return aT[4] - bT[4]
    })

    for (const item of items) {
      const t = (item as unknown as { transform: number[] }).transform
      const str = (item as unknown as { str: string }).str
      const y = Math.round(t[5])
      if (lastY !== null && Math.abs(y - lastY) > 5) {
        if (currentLine.length > 0) {
          rows.push([currentLine.join(' ')])
        }
        currentLine = []
      }
      if (str.trim()) {
        currentLine.push(str.trim())
      }
      lastY = y
    }
    if (currentLine.length > 0) {
      rows.push([currentLine.join(' ')])
    }
    // 页面分隔标记
    if (i < pdf.numPages) {
      rows.push(['--- PAGE BREAK ---'])
    }
  }

  return [{ name: 'pdf', rows }]
}
