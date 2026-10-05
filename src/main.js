import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import './style.css'
import App from './App.vue'
import router from './router'
import i18n from './i18n'

const app = createApp(App)

app.use(createPinia())
app.use(i18n)
app.use(router)
app.use(Toast, {
  position: 'bottom-center',
  timeout: 3000,
  closeOnClick: true,
  pauseOnHover: true,
  hideProgressBar: true,
})

app.mount('#app')
