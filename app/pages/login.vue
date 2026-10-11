<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { authClient, getAuthErrorMessage } from '~/utils/auth-client'

const toast = useToast()
const router = useRouter()
const route = useRoute()
const { refreshSession } = useCurrentSession()
const { fetchProfile, hasValidRole, isActive } = useUserProfile()

definePageMeta({
  layout: false,
  middleware: ['guest-guard']
})

const glassCardClass = 'group flex cursor-pointer flex-col items-start justify-between rounded-3xl border border-white/60 bg-white/45 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.04)] backdrop-blur-2xl hover:border-white/80 hover:bg-white/65 hover:shadow-[0_24px_48px_rgba(15,23,42,0.08)]'

const schema = z.object({
  email: z.string('Email wajib diisi').trim().pipe(z.email('Format email tidak valid')),
  password: z.string('Password wajib diisi').min(1, 'Password wajib diisi')
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  email: '',
  password: ''
})

const show = ref(false)
const isLoading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isLoading.value = true

  try {
    const { error } = await authClient.signIn.email({
      email: event.data.email,
      password: event.data.password
    })

    if (error) throw error

    await refreshSession()
    await fetchProfile()

    if (!hasValidRole.value || !isActive.value) {
      await router.push('/403')
      return
    }

    toast.add({
      title: 'Login berhasil',
      color: 'success',
      icon: 'i-lucide-circle-check'
    })

    const redirect = typeof route.query.redirect === 'string'
      && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : '/'

    await router.push(redirect)
  } catch (error) {
    toast.add({
      title: getErrorMessage(error),
      color: 'error',
      icon: 'i-lucide-circle-alert'
    })
  } finally {
    isLoading.value = false
  }
}

function getErrorMessage(error: unknown) {
  const authMessage = getAuthErrorMessage(error)
  if (authMessage) return authMessage

  const message = extractErrorMessage(error)
  if (message) return message

  return 'Login gagal. Periksa email dan password.'
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (!error || typeof error !== 'object') return String(error || '')

  const payload = error as Record<string, unknown>
  const keys = ['message', 'statusMessage', 'statusText', 'error']

  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value
  }

  const dataMessage = extractErrorMessage(payload.data)
  if (dataMessage && dataMessage !== '[object Object]') return dataMessage

  return ''
}
</script>

<template>
  <section class="mx-auto my-auto flex w-full max-w-6xl flex-col items-center justify-center py-10 md:py-0 h-screen">
    <main :class="glassCardClass" class="w-full max-w-sm">
      <div class="relative w-full overflow-hidden rounded-3xl p-6">
        <div class="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-linear-to-br from-blue-200/50 to-transparent blur-2xl" />

        <div class="mb-8">
          <h2 class="mb-1 text-2xl font-bold text-slate-900">
            Selamat Datang 👋
          </h2>
          <p class="text-sm text-slate-500">
            Silakan masuk ke akun Anda untuk melanjutkan.
          </p>
        </div>

        <UForm
          :schema="schema"
          :state="state"
          class="space-y-4"
          @submit="onSubmit"
        >
          <UFormField
            label="Email"
            name="email"
            size="lg"
          >
            <UInput
              v-model="state.email"
              class="w-full"
              autocomplete="email"
              type="email"
            />
          </UFormField>

          <UFormField
            label="Password"
            name="password"
            size="lg"
          >
            <UInput
              v-model="state.password"
              :type="show ? 'text' : 'password'"
              :ui="{ trailing: 'pe-1' }"
              class="w-full"
              autocomplete="current-password"
            >
              <template #trailing>
                <UButton
                  color="neutral"
                  variant="link"
                  size="sm"
                  :icon="show ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="show ? 'Hide password' : 'Show password'"
                  :aria-pressed="show"
                  aria-controls="password"
                  @click="show = !show"
                />
              </template>
            </UInput>
          </UFormField>

          <UButton
            type="submit"
            size="xl"
            class="mt-4 w-full justify-center text-sm"
            trailing-icon="i-lucide-arrow-right"
            :loading="isLoading"
            :disabled="isLoading"
          >
            Masuk Sekarang
          </UButton>
        </UForm>

        <p class="mt-8 text-center text-sm text-slate-500">
          Belum punya akun?
          <a
            href="#"
            class="font-bold text-slate-900 underline-offset-4 decoration-2 decoration-slate-400/30 hover:underline"
          >
            Hubungi Admin
          </a>
        </p>
      </div>
    </main>
  </section>
</template>
