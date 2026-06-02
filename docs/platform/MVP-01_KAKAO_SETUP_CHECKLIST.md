---
document_type: "MVP External Setup Checklist"
version: "1.0.0"
status: "active"
last_updated: "2026-06-02"
owner: "Codex PM"
scope: "MVP-01 Kakao OAuth external setup"
---

# MVP-01 Kakao Setup Checklist

이 문서는 MVP-01 카카오 로그인 실제 테스트를 위해 Supabase Dashboard와 Kakao Developers에서 확인해야 하는 외부 설정 체크리스트다.

## 1. Supabase Project

- Project: `munjanggun-apt`
- Project ref: `cebafroyvmllbyivevjd`
- Project URL: `https://cebafroyvmllbyivevjd.supabase.co`
- Supabase OAuth callback URL:

```text
https://cebafroyvmllbyivevjd.supabase.co/auth/v1/callback
```

## 2. Supabase Auth 설정

Supabase Dashboard에서 확인한다.

경로:

```text
Authentication > Providers > Kakao
```

확인 항목:

- [ ] Kakao provider Enabled = ON
- [ ] Client ID에 Kakao REST API key 입력
- [ ] Client Secret에 Kakao Login Client Secret 입력
- [ ] 저장 완료

경로:

```text
Authentication > URL Configuration
```

확인 항목:

- [ ] Site URL이 실제 앱 URL로 설정되어 있음
- [ ] Redirect URLs에 로컬 테스트 URL 추가

```text
http://localhost:3000/auth/callback
```

- [ ] Redirect URLs에 배포 앱 URL 추가

```text
https://<문장군 플랫폼 배포 도메인>/auth/callback
```

## 3. Kakao Developers 설정

Kakao Developers에서 확인한다.

경로:

```text
내 애플리케이션 > 앱 설정 > 앱 키
```

확인 항목:

- [ ] REST API 키 확인

경로:

```text
내 애플리케이션 > 제품 설정 > 카카오 로그인
```

확인 항목:

- [ ] 카카오 로그인 활성화 = ON
- [ ] Redirect URI에 Supabase OAuth callback URL 등록

```text
https://cebafroyvmllbyivevjd.supabase.co/auth/v1/callback
```

경로:

```text
내 애플리케이션 > 제품 설정 > 카카오 로그인 > 보안
```

확인 항목:

- [ ] Client Secret 코드 발급
- [ ] Client Secret 활성화 = ON

경로:

```text
내 애플리케이션 > 제품 설정 > 카카오 로그인 > 동의항목
```

MVP-01 권장 동의항목:

- [ ] 닉네임
- [ ] 프로필 사진
- [ ] 카카오계정 이메일

주의:

- 이메일 동의항목은 Kakao Biz App 전환이 필요할 수 있다.
- 전화번호는 Kakao OAuth만으로 안정적으로 받기 어렵다. MVP-02 신청 폼에서 필수 입력으로 확보한다.

## 4. 사장님이 Codex에게 알려줄 것

비밀값을 그대로 채팅에 붙여넣지 않는다.

아래처럼 상태만 알려주면 된다.

```text
Kakao 앱 생성/선택 완료
REST API 키 확인 완료
Client Secret 발급/활성화 완료
Supabase Kakao provider 입력/저장 완료
Kakao Redirect URI 등록 완료
Supabase Redirect URLs 등록 완료
이메일 동의항목 가능/불가능: 가능 또는 불가능
테스트할 배포 도메인: https://...
```

Client Secret 원문은 가능한 Dashboard에 직접 입력하고, 채팅에는 보내지 않는다.

## 5. Codex 확인 기준

설정 완료 후 Codex가 확인할 항목:

- [ ] `/login`에서 카카오 로그인 버튼 클릭
- [ ] 카카오 인증 화면으로 이동
- [ ] 인증 후 `/auth/callback`으로 복귀
- [ ] 최종 `/portal` 진입
- [ ] `platform.profiles`에 사용자 row 생성
- [ ] 생성된 profile role이 `customer`
