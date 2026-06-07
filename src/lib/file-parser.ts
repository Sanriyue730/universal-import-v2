import * as XLSX from 'xlsx'

export interface RawSheet {
  name: string
  rows: (string | number | null | undefined)[][]
}

/** 解析 Excel 文件为原始二维数组 */
export function parseExcelBuffer(buffer: ArrayBuffer): RawSheet[] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheets: RawSheet[] = []

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

/** 解析 Word 文件为文本行 */
export async function parseWordBuffer(buffer: ArrayBuffer): Promise<RawSheet[]> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer: buffer })
  const lines = result.value.split('\n').map(line => [line])
  return [{ name: 'document', rows: lines }]
}

/** 获取文件前N行用于AI分析 */
export function getPreviewRows(sheets: RawSheet[], maxRows: number = 20): string {
  const preview: string[] = []
  for (const sheet of sheets) {
    preview.push(`=== Sheet: ${sheet.name} ===`)
    const rows = sheet.rows.slice(0, maxRows)
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row) {
        preview.push(`Row ${i}: ${JSON.stringify(row)}`)
      }
    }
  }
  return preview.join('\n')
}
