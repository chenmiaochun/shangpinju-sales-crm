import { useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, CheckCircle2, ClipboardCheck, Home, Sofa, Sparkles } from 'lucide-react'
import { salesApi } from '../../api/salesApi'
import { SHANGPINJU_LOGO } from '../../assets/shangpinju-brand'
import type { ExperienceStation } from '../../types'
import './experience.css'

const HOUSING_STAGES = ['新房准备', '装修进行中', '已入住焕新', '局部补购', '其他']
const FAMILY = ['一个人居住', '夫妻', '有儿童', '与老人同住', '三代同堂', '其他']
const SPACES = ['客厅', '餐厅', '主卧', '儿童房', '老人房', '书房', '全屋']
const PAINS = ['家具尺寸/摆放', '空间不好用', '收纳不足', '风格不统一', '睡感不合适', '旧家具更新', '暂不清楚']
const SLEEP = ['偏软', '偏硬', '需要双面睡感', '儿童使用', '老人使用', '多间卧室', '暂不确定']
const STATIONS: { value: ExperienceStation; title: string; detail: string }[] = [
  { value:'家具与动线体验', title:'家具与动线', detail:'判断家具尺寸、摆放和通行风险' },
  { value:'重点空间诊断', title:'重点空间诊断', detail:'梳理最值得先解决的空间问题' },
  { value:'全家睡眠体验', title:'全家睡眠体验', detail:'记录不同家庭成员的睡感需求' },
]

export function ExperienceAssessmentPage() {
  const params = useMemo(() => new URLSearchParams(window.location.hash.split('?')[1] || ''), [])
  const [form, setForm] = useState({ name:'', phone:'', cityArea:'', houseLayout:'', houseArea:'', housingStage:'新房准备', familyMembers:[] as string[], focusSpaces:[] as string[], painPoints:[] as string[], budget:'待确认', moveInPlan:'', sleepNeeds:[] as string[], preferredStations:[] as ExperienceStation[], consent:false })
  const [result, setResult] = useState<{ leadId:string; assessmentId:string; recommendedStations:ExperienceStation[]; summary:string } | null>(null)
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const update = <K extends keyof typeof form>(key:K, value:(typeof form)[K]) => setForm(current => ({...current,[key]:value}))
  const toggle = (key:'familyMembers'|'focusSpaces'|'painPoints'|'sleepNeeds'|'preferredStations', value:string) => setForm(current => ({...current,[key]:current[key].includes(value as never) ? current[key].filter(item => item !== value) : [...current[key],value] as never}))
  async function submit(event:FormEvent) {
    event.preventDefault(); setNotice('')
    if (!form.name.trim() || !/^1\d{10}$/.test(form.phone.trim())) { setNotice('请填写称呼和正确的11位手机号'); return }
    if (!form.familyMembers.length || !form.focusSpaces.length || !form.painPoints.length) { setNotice('请完成家庭成员、重点空间和主要问题'); return }
    if (!form.consent) { setNotice('请先同意用于本次体验预约和服务联系'); return }
    setSubmitting(true)
    try {
      const response = await salesApi.submitExperienceAssessment({ ...form, houseArea:Number(form.houseArea) || undefined, source:params.get('source') || '活动扫码测评', contentId:params.get('content_id') || undefined })
      setResult(response)
    } catch (error) { setNotice(error instanceof Error ? error.message : '提交失败，请工作人员协助登记') }
    finally { setSubmitting(false) }
  }
  if (result) return <main className="experience-page"><section className="experience-result"><CheckCircle2/><p>测评已提交</p><h1>您的家庭空间体验建议</h1><div className="result-id">诊断编号：{result.assessmentId}</div><div className="station-result">{result.recommendedStations.map((item,index)=><article key={item}><span>{index+1}</span><strong>{item}</strong></article>)}</div><p className="result-summary">{result.summary}</p><div className="experience-boundary">本结果用于到店体验和需求沟通，不是正式设计方案、报价或产品承诺。工作人员将按您留下的方式联系确认到店时间。</div></section></main>
  return <main className="experience-page"><header className="experience-hero"><img className="experience-logo" src={SHANGPINJU_LOGO} alt="尚品居"/><span>尚品居整屋焕新季</span><h1>10分钟家庭空间体验诊断</h1><p>带着真实生活需求来，不急着选产品。先看家具尺寸、重点空间和全家睡眠该从哪里开始。</p><div><span><Sofa/>家具动线</span><span><Home/>空间诊断</span><span><Sparkles/>睡眠体验</span></div></header><form className="experience-form" onSubmit={submit}>
    <Section number="01" title="基础资料" hint="用于安排对应体验和顾问"><label>您的称呼 *<input value={form.name} onChange={e=>update('name',e.target.value)} placeholder="例如：陈女士"/></label><label>手机号码 *<input inputMode="tel" value={form.phone} onChange={e=>update('phone',e.target.value)} placeholder="用于确认预约"/></label><label>所在城市<input value={form.cityArea} onChange={e=>update('cityArea',e.target.value)} placeholder="例如：揭阳"/></label><label>户型<input value={form.houseLayout} onChange={e=>update('houseLayout',e.target.value)} placeholder="例如：四房两厅"/></label><label>建筑面积（㎡）<input type="number" min="1" value={form.houseArea} onChange={e=>update('houseArea',e.target.value)}/></label><label>计划入住/调整时间<input value={form.moveInPlan} onChange={e=>update('moveInPlan',e.target.value)} placeholder="例如：今年国庆前"/></label></Section>
    <Section number="02" title="家庭与房屋" hint="选择最符合当前情况的项目"><Choice title="房屋阶段" options={HOUSING_STAGES} selected={[form.housingStage]} onToggle={value=>update('housingStage',value)}/><Choice title="家庭成员 *" options={FAMILY} selected={form.familyMembers} onToggle={value=>toggle('familyMembers',value)}/><Choice title="重点关注空间 *" options={SPACES} selected={form.focusSpaces} onToggle={value=>toggle('focusSpaces',value)}/></Section>
    <Section number="03" title="现在最想解决什么" hint="可多选，现场会按优先级诊断"><Choice title="主要问题 *" options={PAINS} selected={form.painPoints} onToggle={value=>toggle('painPoints',value)}/><label>整体预算范围<select value={form.budget} onChange={e=>update('budget',e.target.value)}><option>待确认</option><option>2万以下</option><option>2-5万</option><option>5-8万</option><option>8-15万</option><option>15万以上</option></select></label><Choice title="睡眠需求（如有）" options={SLEEP} selected={form.sleepNeeds} onToggle={value=>toggle('sleepNeeds',value)}/></Section>
    <Section number="04" title="想优先体验什么" hint="系统还会根据答案给出建议"><div className="station-options">{STATIONS.map(item=><button className={form.preferredStations.includes(item.value)?'selected':''} type="button" key={item.value} onClick={()=>toggle('preferredStations',item.value)}><ClipboardCheck/><span><strong>{item.title}</strong><small>{item.detail}</small></span></button>)}</div></Section>
    <label className="experience-consent"><input type="checkbox" checked={form.consent} onChange={e=>update('consent',e.target.checked)}/><span>我同意尚品居将以上资料用于本次体验预约、需求诊断和后续服务联系。未经授权不会用于公开展示。</span></label>
    {notice&&<p className="experience-notice" role="alert">{notice}</p>}<button className="experience-submit" disabled={submitting}>{submitting?'正在生成诊断...':'提交并生成体验建议'}<ArrowRight/></button><p className="experience-disclaimer">体验诊断不构成正式设计、报价、库存、交期或效果承诺。</p>
  </form></main>
}

function Section({number,title,hint,children}:{number:string;title:string;hint:string;children:React.ReactNode}) { return <section className="experience-section"><header><span>{number}</span><div><h2>{title}</h2><p>{hint}</p></div></header><div className="experience-fields">{children}</div></section> }
function Choice({title,options,selected,onToggle}:{title:string;options:string[];selected:string[];onToggle:(value:string)=>void}) { return <fieldset className="experience-choice"><legend>{title}</legend><div>{options.map(item=><button type="button" className={selected.includes(item)?'selected':''} key={item} onClick={()=>onToggle(item)}>{item}</button>)}</div></fieldset> }

export default ExperienceAssessmentPage
