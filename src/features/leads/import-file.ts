import * as XLSX from 'xlsx'

export async function customerImportFileToCsv(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'csv') return file.text()
  if (extension !== 'xlsx' && extension !== 'xls') throw new Error('仅支持 Excel 或 CSV 文件')

  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true })
  const firstSheet = workbook.SheetNames[0]
  if (!firstSheet) throw new Error('Excel 文件中没有可导入的工作表')
  return XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheet], { blankrows: false })
}
