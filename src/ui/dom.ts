type Attr = string | number | boolean | undefined | null;
type Child = Node | string | null | undefined | false;

/** Small helper for building DOM: h('button', { class: 'primary', type: 'button' }, 'Send'). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, Attr> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

export function button(
  label: string,
  onClick: () => void,
  attrs: Record<string, Attr> = {},
): HTMLButtonElement {
  const el = h('button', { type: 'button', ...attrs }, label);
  el.addEventListener('click', onClick);
  return el;
}
