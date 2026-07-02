import React from 'react'
import { useId } from 'react'
import styles from './PlatformField.module.css'

type SharedFieldProps = {
  label: string
  hint?: string
  error?: string
  multiline?: boolean
}

type InputFieldProps = SharedFieldProps & Omit<React.ComponentPropsWithoutRef<'input'>, 'size'>
type TextareaFieldProps = SharedFieldProps & Omit<React.ComponentPropsWithoutRef<'textarea'>, 'size'> & {
  multiline: true
}

export type PlatformFieldProps = InputFieldProps | TextareaFieldProps

export function PlatformField(props: PlatformFieldProps) {
  const generatedId = useId()
  const {
    label,
    hint,
    error,
    multiline,
    className,
    id,
    ...controlProps
  } = props

  const controlId = id ?? generatedId
  const hintId = hint ? `${controlId}-hint` : undefined
  const errorId = error ? `${controlId}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  const classes = [styles.field, className ?? ''].filter(Boolean).join(' ')

  return (
    <div className={classes} data-invalid={error ? 'true' : 'false'}>
      <label className={styles.label} htmlFor={controlId}>{label}</label>
      {multiline ? (
        <textarea
          {...(controlProps as React.ComponentPropsWithoutRef<'textarea'>)}
          id={controlId}
          className={styles.control}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      ) : (
        <input
          {...(controlProps as React.ComponentPropsWithoutRef<'input'>)}
          id={controlId}
          className={styles.control}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      )}
      {hint ? <p id={hintId} className={styles.hint}>{hint}</p> : null}
      {error ? <p id={errorId} className={styles.error}>{error}</p> : null}
    </div>
  )
}
