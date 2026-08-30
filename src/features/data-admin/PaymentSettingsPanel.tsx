import { useRef, useState, type ChangeEvent } from 'react'
import { Plus, Trash2, Upload, X } from 'lucide-react'
import type { BankAccount, CustomerFile, StorePaymentSettings } from '../../types'
import { useSalesData } from '../../store/SalesDataContext'

const emptyBank = (): BankAccount => ({ bankName: '', accountName: '', accountNo: '' })

function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function PaymentSettingsPanel() {
  const { paymentSettings, updatePaymentSettings } = useSalesData()
  const current = paymentSettings ?? { enabled: false, banks: [] as BankAccount[] }
  const [enabled, setEnabled] = useState(current.enabled)
  const [wechatQr, setWechatQr] = useState<CustomerFile | undefined>(current.wechatQr)
  const [alipayQr, setAlipayQr] = useState<CustomerFile | undefined>(current.alipayQr)
  const [banks, setBanks] = useState<BankAccount[]>(current.banks?.length ? current.banks : [emptyBank()])
  const [payNote, setPayNote] = useState(current.payNote ?? '')
  const [savedAt, setSavedAt] = useState<string | undefined>(current.updatedAt)
  const [notice, setNotice] = useState('')
  const wechatRef = useRef<HTMLInputElement>(null)
  const alipayRef = useRef<HTMLInputElement>(null)

  async function handleQr(event: ChangeEvent<HTMLInputElement>, kind: 'wechat' | 'alipay') {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const dataUrl = await readImage(file)
      const attachment: CustomerFile = {
        id: `${kind}-qr-${Date.now()}`,
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl,
        category: '其他',
        uploadedAt: new Date().toISOString(),
      }
      if (kind === 'wechat') setWechatQr(attachment)
      else setAlipayQr(attachment)
    } catch {
      setNotice('收款码读取失败，请换一张图片重试')
    }
  }

  function updateBank(index: number, key: keyof BankAccount, value: string) {
    setBanks((rows) => rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
  }

  function save() {
    const next: StorePaymentSettings = {
      enabled,
      wechatQr,
      alipayQr,
      banks: banks.filter((bank) => bank.bankName.trim() || bank.accountNo.trim()),
      payNote: payNote.trim() || undefined,
      updatedAt: new Date().toISOString(),
    }
    updatePaymentSettings(next)
    setSavedAt(next.updatedAt)
    setNotice('收款设置已保存，销售单底部将按此显示')
  }

  return (
    <section className="payment-settings" aria-label="门店收款设置">
      <header className="payment-settings-head">
        <div>
          <h2>门店收款设置</h2>
          <span>配置后，销售单（客户联）底部会显示收款码与银行卡，客户签单即可扫码付款</span>
        </div>
        <label className="payment-enabled-toggle">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          在销售单显示收款区块
        </label>
      </header>

      <div className="payment-qr-row">
        <div className="payment-qr-card">
          <b>微信商家收款码</b>
          {wechatQr?.dataUrl
            ? <figure><img src={wechatQr.dataUrl} alt="微信收款码" /><button type="button" className="payment-qr-clear" onClick={() => setWechatQr(undefined)}><X size={14} />移除</button></figure>
            : <button type="button" className="payment-qr-upload" onClick={() => wechatRef.current?.click()}><Upload size={16} />上传图片</button>}
          <input ref={wechatRef} type="file" accept="image/*" hidden onChange={(event) => handleQr(event, 'wechat')} />
        </div>
        <div className="payment-qr-card">
          <b>支付宝商家收款码</b>
          {alipayQr?.dataUrl
            ? <figure><img src={alipayQr.dataUrl} alt="支付宝收款码" /><button type="button" className="payment-qr-clear" onClick={() => setAlipayQr(undefined)}><X size={14} />移除</button></figure>
            : <button type="button" className="payment-qr-upload" onClick={() => alipayRef.current?.click()}><Upload size={16} />上传图片</button>}
          <input ref={alipayRef} type="file" accept="image/*" hidden onChange={(event) => handleQr(event, 'alipay')} />
        </div>
      </div>

      <div className="payment-banks">
        <div className="payment-banks-head">
          <b>银行卡（可多张，如工行 + 农行）</b>
          <button type="button" className="payment-bank-add" onClick={() => setBanks((rows) => [...rows, emptyBank()])}><Plus size={14} />添加银行卡</button>
        </div>
        {banks.map((bank, index) => (
          <div className="payment-bank-row" key={index}>
            <input placeholder="开户行，如 中国工商银行" value={bank.bankName} onChange={(event) => updateBank(index, 'bankName', event.target.value)} />
            <input placeholder="户名" value={bank.accountName} onChange={(event) => updateBank(index, 'accountName', event.target.value)} />
            <input placeholder="卡号" value={bank.accountNo} onChange={(event) => updateBank(index, 'accountNo', event.target.value.replace(/\s/g, ''))} />
            <button type="button" className="payment-bank-del" aria-label="删除该行" onClick={() => setBanks((rows) => rows.filter((_, i) => i !== index))}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      <label className="payment-note-field">
        <b>付款提示语（选填）</b>
        <textarea value={payNote} placeholder="留空则使用默认文案：请扫码付款并备注订单号……" onChange={(event) => setPayNote(event.target.value)} />
      </label>

      <div className="payment-actions">
        <button type="button" className="payment-save" onClick={save}>保存收款设置</button>
        {notice && <span role="status" className="payment-notice">{notice}</span>}
        {savedAt && !notice && <span className="payment-saved-at">上次保存：{savedAt.slice(0, 16).replace('T', ' ')}</span>}
      </div>
    </section>
  )
}
