export type UploadReviewChecks = {
  privacyChecked: true
  promotionConsentChecked: true
}

export function readUploadReviewChecks(formData: Pick<FormData, 'get'>): UploadReviewChecks | null {
  const privacyChecked = formData.get('privacyChecked') === 'on'
  const promotionConsentChecked = formData.get('promotionConsentChecked') === 'on'

  if (!privacyChecked || !promotionConsentChecked) return null

  return {
    privacyChecked: true,
    promotionConsentChecked: true,
  }
}
