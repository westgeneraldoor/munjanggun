import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCtaRedirectUrl } from './ctaRedirect.ts'
import { buildKakaoFeedTemplate, buildNativeShareData, buildShareDescription, SHARE_MENU_ITEMS } from './share.ts'

test('buildShareDescription includes the browsing stage before the node copy', () => {
  assert.equal(
    buildShareDescription({
      breadcrumbItems: [
        { name: '홈', href: '/' },
        { name: 'Design', href: '/design' },
        { name: '라운드아치', href: '/design/round-arch' },
      ],
      description: '상하 아치, 갤러리, 우아함',
    }),
    '단계: 홈 > Design > 라운드아치\n상하 아치, 갤러리, 우아함'
  )
})

test('buildShareDescription falls back cleanly when there is no breadcrumb or body copy', () => {
  assert.equal(buildShareDescription({ breadcrumbItems: [], description: '' }), '문장군 디지털 쇼룸')
})

test('buildNativeShareData omits text so chat apps do not create a separate message body', () => {
  assert.deepEqual(
    buildNativeShareData({
      title: '라운드아치',
      url: 'https://munjanggun.vercel.app/design/round-arch',
    }),
    {
      title: '라운드아치',
      url: 'https://munjanggun.vercel.app/design/round-arch',
    }
  )
})

test('SHARE_MENU_ITEMS keeps the customer share menu to Kakao and native share only', () => {
  assert.deepEqual(
    SHARE_MENU_ITEMS.map(item => item.label),
    ['카카오톡으로 공유', '다른 방법으로 공유']
  )
})

test('buildKakaoFeedTemplate restores feed card buttons without breadcrumb text', () => {
  const origin = 'https://munjanggun.vercel.app'

  assert.deepEqual(
    buildKakaoFeedTemplate({
      title: '라운드아치',
      description: '상하 아치, 갤러리, 우아함',
      imageUrl: 'https://example.com/round-arch.jpg',
      pageUrl: 'https://munjanggun.vercel.app/design/round-arch',
      reservationUrl: buildCtaRedirectUrl(origin, 'reservation'),
      storeUrl: buildCtaRedirectUrl(origin, 'store'),
    }),
    {
      objectType: 'feed',
      content: {
        title: '라운드아치',
        description: '상하 아치, 갤러리, 우아함',
        imageUrl: 'https://example.com/round-arch.jpg',
        link: {
          mobileWebUrl: 'https://munjanggun.vercel.app/design/round-arch',
          webUrl: 'https://munjanggun.vercel.app/design/round-arch',
        },
      },
      buttons: [
        {
          title: '무료방문견적',
          link: {
            mobileWebUrl: 'https://munjanggun.vercel.app/go/reservation',
            webUrl: 'https://munjanggun.vercel.app/go/reservation',
          },
        },
        {
          title: '브랜드스토어',
          link: {
            mobileWebUrl: 'https://munjanggun.vercel.app/go/store',
            webUrl: 'https://munjanggun.vercel.app/go/store',
          },
        },
      ],
    }
  )
})
