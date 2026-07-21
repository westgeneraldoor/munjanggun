import React, { useId } from 'react'
import styles from './PlatformEditorSection.module.css'

export interface PlatformEditorSectionProps extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  contentClassName?: string
}

export function PlatformEditorSection({
  title,
  description,
  contentClassName,
  className,
  children,
  disabled,
  'aria-describedby': callerDescribedBy,
  ...props
}: PlatformEditorSectionProps) {
  const generatedId = useId().replaceAll(':', '')
  const descriptionId = description ? `platform-editor-section-${generatedId}-description` : undefined
  const describedBy = [callerDescribedBy, descriptionId].filter(Boolean).join(' ') || undefined
  const sectionClasses = [styles.section, className ?? ''].filter(Boolean).join(' ')
  const contentClasses = [styles.content, contentClassName ?? ''].filter(Boolean).join(' ')

  return (
    <fieldset {...props} className={sectionClasses} disabled={disabled} aria-describedby={describedBy}>
      <legend className={styles.legend}>{title}</legend>
      {description ? <p id={descriptionId} className={styles.description}>{description}</p> : null}
      <div className={contentClasses}>{children}</div>
    </fieldset>
  )
}
