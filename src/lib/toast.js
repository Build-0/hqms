export const toast = msg => window.dispatchEvent(new CustomEvent('hqms-toast', { detail: msg }))
