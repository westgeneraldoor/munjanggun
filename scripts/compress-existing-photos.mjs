/**
 * 기존 시공사진 일괄 압축 스크립트
 * 1000px / 70% JPEG (mozjpeg)
 * 
 * 실행: node scripts/compress-existing-photos.mjs
 */
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

const SUPABASE_URL = 'https://cebafroyvmllbyivevjd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlYmFmcm95dm1sbGJ5aXZldmpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDU2ODEsImV4cCI6MjA4NTkyMTY4MX0.m2fHdZ3hnUouTPCU7tud0Nngrzn9NrNsfhffTGZY4pI'
const BUCKET = 'colorbook-images'
const MAX_DIM = 1000
const QUALITY = 70

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // 모든 시공사진 조회
  const { data: photos, error: dbErr } = await supabase
    .schema('colorbook')
    .from('installation_photos')
    .select('id, image_url')
    .order('created_at')

  if (dbErr) { console.error('DB 오류:', dbErr); process.exit(1) }
  console.log(`📷 총 ${photos.length}장 처리 시작\n`)

  let compressed = 0, skipped = 0, failed = 0
  let totalOriginal = 0, totalNew = 0

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i]
    const tag = `[${i + 1}/${photos.length}]`
    
    try {
      // 다운로드
      const res = await fetch(photo.image_url)
      if (!res.ok) { console.log(`${tag} ⚠️ 다운로드 실패`); failed++; continue }
      
      const buffer = Buffer.from(await res.arrayBuffer())
      const origSize = buffer.byteLength
      totalOriginal += origSize

      // 이미 작은 파일 스킵
      if (origSize <= 100 * 1024) {
        console.log(`${tag} ⏭️ 스킵 (${Math.round(origSize/1024)}KB - 이미 작음)`)
        totalNew += origSize
        skipped++
        continue
      }

      // 메타데이터 확인
      const meta = await sharp(buffer).metadata()
      if (!meta.width || !meta.height) {
        console.log(`${tag} ⚠️ 메타데이터 없음`); failed++; continue
      }

      // sharp 압축
      const compressedBuf = await sharp(buffer)
        .rotate() // EXIF 방향 보정
        .resize(MAX_DIM, MAX_DIM, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toBuffer()
      
      const newSize = compressedBuf.byteLength
      totalNew += newSize

      // 크기 차이 없으면 스킵
      if (newSize >= origSize * 0.85) {
        console.log(`${tag} ⏭️ 스킵 (${Math.round(origSize/1024)}KB → ${Math.round(newSize/1024)}KB, 차이 미미)`)
        skipped++
        continue
      }

      // 스토리지 경로 추출
      const path = photo.image_url.split(`/${BUCKET}/`)[1]
      if (!path) { console.log(`${tag} ⚠️ 경로 추출 실패`); failed++; continue }

      // 덮어쓰기
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .update(path, compressedBuf, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        })

      if (upErr) {
        console.log(`${tag} ❌ 업로드 실패: ${upErr.message}`)
        failed++
      } else {
        const pct = Math.round((1 - newSize / origSize) * 100)
        console.log(`${tag} ✅ ${Math.round(origSize/1024)}KB → ${Math.round(newSize/1024)}KB (-${pct}%) | ${meta.width}x${meta.height}`)
        compressed++
      }
    } catch (err) {
      console.log(`${tag} ❌ 오류: ${err.message}`)
      failed++
    }
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`📊 결과`)
  console.log(`   압축 완료: ${compressed}장`)
  console.log(`   스킵:     ${skipped}장`)
  console.log(`   실패:     ${failed}장`)
  console.log(`   원본 총용량: ${(totalOriginal / 1024 / 1024).toFixed(1)}MB`)
  console.log(`   압축 후:    ${(totalNew / 1024 / 1024).toFixed(1)}MB`)
  console.log(`   절감:      ${((totalOriginal - totalNew) / 1024 / 1024).toFixed(1)}MB (${Math.round((1 - totalNew/totalOriginal) * 100)}%)`)
  console.log(`${'='.repeat(50)}`)
}

main().catch(console.error)
