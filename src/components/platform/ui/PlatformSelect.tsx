import React, { useId } from 'react'
import styles from './PlatformSelect.module.css'

export interface PlatformSelectOption {
  value: string
  label: string
}

export interface PlatformSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  id?: string
  label: string
  options: ReadonlyArray<PlatformSelectOption>
  hint?: string
  error?: string
  containerClassName?: string
}

export function PlatformSelect({
  id,
  label,
  options,
  hint,
  error,
  containerClassName,
  className,
  'aria-describedby': callerDescribedBy,
  'aria-invalid': callerInvalid,
  ...selectProps
}: PlatformSelectProps) {
  const generatedId = useId().replaceAll(':', '')
  const controlId = id ?? `platform-select-${generatedId}`
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [callerDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined
  const classes = [styles.field, containerClassName ?? ''].filter(Boolean).join(' ')
  const controlClasses = [styles.control, className ?? ''].filter(Boolean).join(' ')

  return (
    <div className={classes} data-invalid={error ? 'true' : 'false'}>
      <label className={styles.label} htmlFor={controlId}>{label}</label>
      <select
        {...selectProps}
        id={controlId}
        className={controlClasses}
        aria-invalid={error ? true : callerInvalid}
        aria-describedby={describedBy}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      {hint ? <p id={hintId} className={styles.hint}>{hint}</p> : null}
      {error ? <p id={errorId} className={styles.error}>{error}</p> : null}
    </div>
  )
}
