import './next-action-picker.css'

export const NEXT_ACTION_OPTIONS = [
  '微信继续沟通', '电话回访', '邀请到店', '预约量尺', '发送产品资料',
  '发送报价', '发送设计方案', '调整方案', '确认预算', '确认产品',
  '确认签约时间', '收取定金', '跟进付款', '确认送货时间', '售后回访',
] as const

export function buildNextAction(selected: string[], customAction: string) {
  const custom = selected.includes('其他') ? customAction.trim() : ''
  return [...selected.filter((item) => item !== '其他'), custom].filter(Boolean).join('、')
}

interface NextActionPickerProps {
  selected: string[]
  customAction: string
  onSelectedChange: (selected: string[]) => void
  onCustomActionChange: (value: string) => void
}

export function NextActionPicker({ selected, customAction, onSelectedChange, onCustomActionChange }: NextActionPickerProps) {
  const toggle = (option: string) => onSelectedChange(selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option])
  return <fieldset className="next-action-picker">
    <legend>下次动作 <small>可多选</small></legend>
    <div className="next-action-options">
      {[...NEXT_ACTION_OPTIONS, '其他'].map((option) => <label className={selected.includes(option) ? 'selected' : ''} key={option}>
        <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
        <span>{option}</span>
      </label>)}
    </div>
    {selected.includes('其他') && <label className="next-action-custom">其他特殊情况
      <input autoFocus value={customAction} onChange={(event) => onCustomActionChange(event.target.value)} placeholder="请输入特殊的下次动作" />
    </label>}
  </fieldset>
}
