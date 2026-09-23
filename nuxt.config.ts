import { compileScript } from "vue/compiler-sfc";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  typescript: {
    tsConfig: {
      compilerOptions: {
        strict: true,
        typecheck: true,
      }
    }
  },

  modules: ["@nuxt/eslint"]
})