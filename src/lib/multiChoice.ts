/**
 * Field type "multi_choice" (checklist, several ticks — e.g. विवाद का प्रकार).
 * Options come from dropdown_options like a dropdown ({value,label} or strings, plus showIf).
 * Value = the ticked option values in the options' order, joined by ", " — so {{Key}} in the
 * format prints "भूमि विवाद, जुआ" and {{if:Key|…}} works (empty = nothing ticked).
 * Option values must not contain ", ".
 */
export const MULTI_SEP = ', ';

export function multiChoiceSelected(value: string | null | undefined): string[] {
  return String(value ?? '').split(MULTI_SEP).map((x) => x.trim()).filter(Boolean);
}

export function multiChoiceToggle(value: string | null | undefined, optionValue: string, optionOrder: string[]): string {
  const sel = new Set(multiChoiceSelected(value));
  if (sel.has(optionValue)) sel.delete(optionValue); else sel.add(optionValue);
  // known options in their own order, then any unknown old values
  const ordered = optionOrder.filter((o) => sel.has(o));
  for (const s of sel) if (!optionOrder.includes(s)) ordered.push(s);
  return ordered.join(MULTI_SEP);
}
