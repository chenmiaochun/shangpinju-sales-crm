import * as XLSX from 'xlsx'
import { templateRows } from './csv'

export async function customerImportFileToCsv(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'csv') return file.text()
  if (extension !== 'xlsx' && extension !== 'xls') throw new Error('仅支持 Excel 或 CSV 文件')

  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) throw new Error('Excel 文件中没有可导入的工作表')
  return XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet], { blankrows: false })
}

export function customerTemplateXlsx(): ArrayBuffer {
  const worksheet = XLSX.utils.aoa_to_sheet(templateRows(), { cellDates: true })
  worksheet['!cols'] = [
    { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
    { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 18 },
    { wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 20 }, { wch: 28 },
  ]
  if (worksheet.B2) worksheet.B2.z = '@'
  if (worksheet.R2) worksheet.R2.z = 'yyyy-mm-dd'
  if (worksheet.S2) worksheet.S2.z = '#,##0'
  worksheet['!autofilter'] = { ref: worksheet['!ref'] || 'A1:W2' }
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '客户导入模板')
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}
