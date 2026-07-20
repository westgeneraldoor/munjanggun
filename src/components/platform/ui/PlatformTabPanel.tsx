import React from 'react'

export interface PlatformTabPanelProps extends React.HTMLAttributes<HTMLElement> {
  tabsId: string
  value: string
  active: boolean
}

export function PlatformTabPanel({ tabsId, value, active, children, ...props }: PlatformTabPanelProps) {
  return (
    <section
      {...props}
      id={`${tabsId}-panel-${value}`}
      role="tabpanel"
      aria-labelledby={`${tabsId}-tab-${value}`}
      hidden={!active}
    >
      {active ? children : null}
    </section>
  )
}
