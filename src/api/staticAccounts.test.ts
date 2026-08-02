import { describe, expect, it } from 'vitest'
import { STATIC_TEST_ACCOUNTS, STATIC_TEST_PASSWORD } from './salesApi'

describe('shared static test accounts', () => {
  it('bundles the employee logins needed on fresh browsers', () => {
    expect(STATIC_TEST_PASSWORD).toBe('123456')
    expect(STATIC_TEST_ACCOUNTS.filter((account) => account.username.startsWith('spj')).map((account) => account.username)).toEqual([
      'spj001', 'spj002', 'spj003', 'spj004', 'spj005',
    ])
    expect(STATIC_TEST_ACCOUNTS.every((account) => account.active)).toBe(true)
  })
})
