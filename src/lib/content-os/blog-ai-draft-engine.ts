import 'server-only'

import {
  BLOG_AI_DRAFT_RESPONSE_SCHEMA,
  normalizeBlogAiDraftOutput,
  type BlogAiDraftInput,
  type BlogAiDraftNormalized,
} from './blog-ai-draft-schema'

export type BlogAiDraftConfig = {
  enabled: boolean
  reason: string | null
  model: string | null
}

export type BlogAiDraftEngineResult =
  | {
      ok: true
      draft: BlogAiDraftNormalized
      model: string
      responseId: string | null
    }
  | {
      ok: false
      message: string
      issues?: string[]
      status?: number
    }

type OpenAiResponseShape = {
  id?: string
  status?: string
  error?: { message?: string } | null
  incomplete_details?: { reason?: string } | null
  output_text?: string
  output?: Array<{
    type?: string
    content?: Array<{
      type?: string
      text?: string
    }>
  }>
}

export function getBlogAiDraftConfig(): BlogAiDraftConfig {
  if (process.env.CONTENT_OS_AI_DRAFTS_ENABLED !== 'enabled') {
    return {
      enabled: false,
      reason: 'CONTENT_OS_AI_DRAFTS_ENABLED=enabled 설정이 필요합니다.',
      model: null,
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    return {
      enabled: false,
      reason: 'OPENAI_API_KEY가 설정되어 있지 않습니다.',
      model: null,
    }
  }

  const model = process.env.OPENAI_BLOG_DRAFT_MODEL?.trim() ?? ''
  if (!model) {
    return {
      enabled: false,
      reason: 'OPENAI_BLOG_DRAFT_MODEL이 설정되어 있지 않습니다.',
      model: null,
    }
  }

  return {
    enabled: true,
    reason: null,
    model,
  }
}

function buildSystemPrompt() {
  return [
    'You write Korean blog draft content for Munjanggun.',
    'You must write only a safe draft for human review, never a final publication.',
    'Do not invent prices, schedules, review counts, A/S terms, travel fees, events, discounts, customer names, phone numbers, or detailed addresses.',
    'Use only the supplied evidence refs. If evidence is insufficient, keep language conditional and mark needed photos in paragraph metadata.',
    'Do not request or attach images. Only write text blocks.',
    'Every draft must include one measure consultation CTA to /portal/measure/new.',
  ].join('\n')
}

function buildUserPrompt(input: BlogAiDraftInput) {
  return JSON.stringify({
    task: 'Create a Korean AI draft for the Munjanggun Content OS. Output must match the JSON schema exactly.',
    input: {
      category: input.category,
      topic: input.topic,
      targetQuestion: input.targetQuestion,
      primaryKeyword: input.primaryKeyword ?? null,
      serviceArea: input.serviceArea ?? null,
      productType: input.productType ?? null,
      writingIntent: input.writingIntent ?? null,
      needsImageSlots: input.needsImageSlots,
      evidenceRefs: input.evidenceRefs.map(evidence => ({
        ref: evidence.ref ?? null,
        claim_id: evidence.claim_id ?? null,
        proof_id: evidence.proof_id ?? null,
        asset_id: evidence.asset_id ?? null,
        source_id: evidence.source_id ?? null,
        status: evidence.status,
        type: evidence.type ?? null,
        checked_at: evidence.checked_at ?? null,
      })),
    },
    constraints: [
      'Save-worthy draft only, not publish-ready.',
      'Use cautious field-confirmation language.',
      'No fixed price claims.',
      'No customer private data.',
      'No automatic photo usage.',
      'Paragraph metadata may include required_media/photo_slot_label when a human should attach a photo later.',
    ],
  })
}

function extractOutputText(response: OpenAiResponseShape) {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text
  }

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && content.text?.trim()) {
        return content.text
      }
    }
  }

  return null
}

export async function generateBlogAiDraft(input: BlogAiDraftInput): Promise<BlogAiDraftEngineResult> {
  const config = getBlogAiDraftConfig()
  if (!config.enabled || !config.model) {
    return {
      ok: false,
      message: config.reason ?? 'AI 초안 생성이 비활성화되어 있습니다.',
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45_000)

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        store: false,
        instructions: buildSystemPrompt(),
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: buildUserPrompt(input),
              },
            ],
          },
        ],
        temperature: 0.4,
        max_output_tokens: 4200,
        text: {
          format: {
            type: 'json_schema',
            name: 'munjanggun_blog_ai_draft',
            strict: true,
            schema: BLOG_AI_DRAFT_RESPONSE_SCHEMA,
          },
        },
      }),
    })

    const responseJson = await response.json().catch(() => null) as OpenAiResponseShape | null
    if (!response.ok || !responseJson) {
      return {
        ok: false,
        message: 'AI 초안 생성 요청이 실패했습니다.',
        status: response.status,
        issues: [responseJson?.error?.message ?? response.statusText],
      }
    }

    if (responseJson.status !== 'completed') {
      return {
        ok: false,
        message: 'AI 초안 생성이 완료되지 않았습니다.',
        issues: [responseJson.incomplete_details?.reason ?? responseJson.error?.message ?? responseJson.status ?? 'unknown'],
      }
    }

    const text = extractOutputText(responseJson)
    if (!text) {
      return {
        ok: false,
        message: 'AI 응답에서 구조화된 텍스트를 찾지 못했습니다.',
      }
    }

    const parsed = JSON.parse(text) as unknown
    const normalized = normalizeBlogAiDraftOutput(parsed, input)
    if (!normalized.ok) {
      return {
        ok: false,
        message: 'AI 응답이 블로그 초안 스키마를 통과하지 못했습니다.',
        issues: normalized.issues,
      }
    }

    return {
      ok: true,
      draft: normalized.draft,
      model: config.model,
      responseId: responseJson.id ?? null,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.name === 'AbortError'
        ? 'AI 초안 생성 요청 시간이 초과되었습니다.'
        : 'AI 초안 생성 중 오류가 발생했습니다.',
    }
  } finally {
    clearTimeout(timeout)
  }
}
