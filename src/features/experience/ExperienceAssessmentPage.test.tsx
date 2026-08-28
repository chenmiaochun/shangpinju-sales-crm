import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salesApi } from '../../api/salesApi'
import { ExperienceAssessmentPage } from './ExperienceAssessmentPage'

describe('ExperienceAssessmentPage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('submits the standardized assessment and shows the diagnostic result', async () => {
    const submit = vi.spyOn(salesApi, 'submitExperienceAssessment').mockResolvedValue({ ok:true, leadId:'L-1', assessmentId:'EXP-1', recommendedStations:['家具与动线体验','重点空间诊断'], summary:'建议先检查家具尺寸与重点空间' })
    render(<ExperienceAssessmentPage />)
    fireEvent.change(screen.getByLabelText('您的称呼 *'), { target:{ value:'陈女士' } })
    fireEvent.change(screen.getByLabelText('手机号码 *'), { target:{ value:'13800138000' } })
    fireEvent.click(screen.getByRole('button', { name:'夫妻' }))
    fireEvent.click(screen.getByRole('button', { name:'客厅' }))
    fireEvent.click(screen.getByRole('button', { name:'家具尺寸/摆放' }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name:/提交并生成体验建议/ }))
    expect(await screen.findByText('您的家庭空间体验建议')).toBeTruthy()
    expect(screen.getByText('诊断编号：EXP-1')).toBeTruthy()
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ name:'陈女士', phone:'13800138000', familyMembers:['夫妻'], focusSpaces:['客厅'], painPoints:['家具尺寸/摆放'], consent:true }))
  })

  it('requires core diagnostic answers before submission', () => {
    render(<ExperienceAssessmentPage />)
    fireEvent.click(screen.getByRole('button', { name:/提交并生成体验建议/ }))
    expect(screen.getByRole('alert').textContent).toContain('请填写称呼和正确的11位手机号')
  })
})
