type MediaPolicyPost = {
  mediaMissingReason?: string | null
  media_missing_reason?: string | null
}

type MediaPolicyItem = {
  usedAsCover?: boolean
  used_as_cover?: boolean
}

export function hasCoverOrRecordedMediaException(
  post: MediaPolicyPost,
  media: MediaPolicyItem[],
) {
  const reason = post.mediaMissingReason ?? post.media_missing_reason
  return media.some(item => item.usedAsCover || item.used_as_cover) || Boolean(reason?.trim())
}
