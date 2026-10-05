import 'vue'

declare module 'vue' {
  interface ComponentCustomProperties {
    $t: typeof import('../i18n/index.js').t
  }
}

export {}
