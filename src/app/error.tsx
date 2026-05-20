'use client';

import { useEffect } from 'react';
import styles from './error.module.css';

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
    <div className={styles.container}>
      <h2 className={styles.title}>일시적인 오류가 발생했습니다</h2>
      <p className={styles.description}>
        페이지를 불러오는 중 문제가 발생했습니다.
      </p>
      <button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
        className={styles.button}
      >
        다시 시도
      </button>
    </div>
  );
}
