<script setup>
import LanguageSelector from '../components/ui/LanguageSelector.vue'
import { ref, watch, computed } from 'vue'
import { useRestaurantStore } from '../stores/restaurant'
import defaultBrand from '../assets/restaurant-brand.json'
import { ArrowUpRightIcon } from '@heroicons/vue/24/outline'
const restaurant = useRestaurantStore()
const logoFailed = ref(false)
const logo = computed(() =>
  logoFailed.value ? defaultBrand.logo : restaurant.logo || defaultBrand.logo,
)
watch(
  () => restaurant.logo,
  () => {
    logoFailed.value = false
  },
)
</script>
<template>
  <div class="staff-login-page">
    <div class="auth-frame">
      <header class="auth-topbar">
        <div class="auth-brand">
          <img :src="logo" :alt="restaurant.name + ' logo'" @error="logoFailed = true" />
        </div>
        <LanguageSelector />
      </header>
      <main class="auth-window">
        <section class="staff-login-card">
          <div class="staff-login-heading">
            <h1>{{ $t('Welcome back') }}</h1>
          </div>
          <RouterView />
          <RouterLink class="auth-customer-link" :to="{ name: 'landing' }"
            ><span>{{ $t('View menu') }}<ArrowUpRightIcon /></span
          ></RouterLink>
        </section>
      </main>
    </div>
  </div>
</template>
<style scoped>
.staff-login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  padding: 36px 32px;
  background: #f4f3f0;
  color: #29272a;
}
.auth-frame {
  width: 100%;
  max-width: 480px;
}
.auth-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 26px;
}
.auth-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.auth-brand img {
  width: 54px;
  height: 54px;
  object-fit: contain;
  mix-blend-mode: multiply;
}
.auth-window {
  display: block;
  background: white;
  border: 1px solid #e7e4df;
  border-radius: 26px;
  overflow: hidden;
  box-shadow: 0 22px 65px #38302608;
}
.staff-login-card {
  align-self: center;
  padding: 48px;
  min-width: 0;
}
.staff-login-heading {
  margin-bottom: 32px;
}
.staff-login-heading h1 {
  font-size: 30px;
  font-weight: 750;
  letter-spacing: -0.9px;
  margin: 10px 0;
}
.staff-login-heading h1:lang(ko) {
  word-break: keep-all;
  font-size: 26px;
}
.auth-customer-link {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 34px;
  padding-top: 20px;
  border-top: 1px solid #eee9e9;
  font-size: 11px;
  color: #968c91;
}
.auth-customer-link > span {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #ce0233;
  font-weight: 650;
}
.auth-customer-link svg {
  width: 13px;
  height: 13px;
}
:deep(input) {
  min-height: 52px;
  border-radius: 12px;
  font-size: 15px;
  background: #fdfcfc;
  color: #29272a;
  border-color: #e9e3e5;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
:deep(input:focus) {
  border-color: #ce0233;
  box-shadow: 0 0 0 3px #ce023308;
}
:deep(label:not(.language-selector)) {
  color: #62575d;
  font-size: 12px;
  font-weight: 600;
}
:deep(button[type='submit']) {
  min-height: 50px;
  margin-top: 10px;
  border-radius: 12px;
  box-shadow: 0 5px 12px #ce023312;
}
@media (max-width: 800px) {
  .staff-login-card {
    padding: 36px 28px;
  }
}
@media (max-width: 640px) {
  .staff-login-page {
    padding: 30px 20px;
  }
  .auth-frame {
    max-width: 420px;
  }
  .auth-topbar {
    margin-bottom: 28px;
    align-items: flex-start;
  }
  .auth-brand {
    gap: 8px;
  }
  .auth-brand img {
    width: 48px;
    height: 48px;
  }
  .auth-window {
    display: block;
    border-radius: 22px;
  }
  .staff-login-card {
    padding: 32px 26px;
  }
  .staff-login-heading h1 {
    font-size: 29px;
  }
  :deep(input) {
    font-size: 16px;
  }
}
@media (max-width: 360px) {
  .staff-login-page {
    padding: 24px 14px;
  }
  .staff-login-card {
    padding: 28px 20px;
  }
  .auth-brand img {
    width: 38px;
    height: 44px;
  }
}
</style>
