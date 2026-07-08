import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DELETE_ACCOUNT_CONFIRMATION,
  DELETE_CLOUD_DATA_CONFIRMATION,
  validateDeleteAccountConfirmation,
  validateDeleteCloudDataConfirmation,
} from '../../constants/accountControls.js'

describe('account deletion confirmations', () => {
  it('requires exact delete account confirmation text', () => {
    assert.equal(validateDeleteAccountConfirmation(DELETE_ACCOUNT_CONFIRMATION), true)
    assert.equal(validateDeleteAccountConfirmation('delete my account'), false)
    assert.equal(validateDeleteAccountConfirmation(''), false)
    assert.equal(validateDeleteAccountConfirmation(null), false)
  })

  it('requires exact delete cloud data confirmation text', () => {
    assert.equal(validateDeleteCloudDataConfirmation(DELETE_CLOUD_DATA_CONFIRMATION), true)
    assert.equal(validateDeleteCloudDataConfirmation('DELETE CLOUD'), false)
    assert.equal(validateDeleteCloudDataConfirmation(undefined), false)
  })
})
