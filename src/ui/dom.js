// Tiny DOM helper. Everything in src/ui may touch the DOM; nothing in src/core may.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  append(node, children);
  return node;
}

export function append(node, children) {
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function card(className, children) {
  return el('div', { class: className ? `card ${className}` : 'card' }, children);
}

// Reads a numeric input, returning null for blank so "no weight" stays distinct from 0.
export function numberValue(input) {
  const raw = input.value.replace(',', '.').trim();
  if (raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
