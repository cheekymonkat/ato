// The app uses only this stable portal API; native bundles never import react-dom.
declare module 'react-dom' {
  export function createPortal(children: import('react').ReactNode, container: Element | DocumentFragment, key?: string | null): import('react').ReactPortal;
}
