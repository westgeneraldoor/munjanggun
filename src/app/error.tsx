'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service if needed
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="mg-root-fallback">
      <h2 className="mg-root-fallback__title">일시적인 오류가 발생했습니다</h2>
      <p className="mg-root-fallback__description">
        페이지를 불러오는 중 문제가 발생했습니다.
      </p>
      <button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
        className="mg-root-fallback__action"
      >
        다시 시도
      </button>
    </div>
  );
}
