import CollapsibleSection from './CollapsibleSection'

/**
 * Settings footer panels — same chrome as API Keys (collapsible toggle, badge, hints).
 */
export default function SettingsCollapsiblePanel({
  id,
  title,
  badge,
  hint,
  hintOpen = 'Tap again to collapse.',
  defaultOpen = false,
  open,
  onOpenChange,
  children,
}) {
  return (
    <CollapsibleSection
      id={id}
      className="ai-settings-wrap collapsible-section--setup"
      title={title}
      badge={badge}
      hint={hint}
      hintOpen={hintOpen}
      defaultOpen={defaultOpen}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="ai-settings">{children}</div>
    </CollapsibleSection>
  )
}
