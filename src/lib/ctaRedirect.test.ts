import assert from 'node:assert/strict'
import test from 'node:test'

import { selectCtaUrl } from './ctaRedirect.ts'

test('selectCtaUrl returns the admin configured value for each button', () => {
  const settings = {
    reservation_url: ' https://booking.naver.com/booking/5/bizes/654913/items/6032347 ',
    store_url: ' http://smartstore.naver.com/doorgeneral ',
  }

  assert.equal(selectCtaUrl(settings, 'reservation'), 'https://booking.naver.com/booking/5/bizes/654913/items/6032347')
  assert.equal(selectCtaUrl(settings, 'store'), 'http://smartstore.naver.com/doorgeneral')
})
