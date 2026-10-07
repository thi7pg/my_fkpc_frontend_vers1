import 'vue'

declare module 'vue' {
  interface ComponentCustomProperties {
    $t: typeof import('../languages/index.js').t
  }
}

export {}
