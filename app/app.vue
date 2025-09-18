<script setup lang="ts">
const colorMode = useColorMode();

const color = computed(() =>
  colorMode.value === "dark" ? "#1b1718" : "white"
);

useHead({
  meta: [
    { charset: "utf-8" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { key: "theme-color", name: "theme-color", content: color },
  ],
  link: [{ rel: "icon", href: "/favicon.png" }],
  htmlAttrs: {
    lang: "en",
  },
});

const title = "QRCC Data Center";
const description =
  "Sebuah aplikasi dashboard berbasis web yang berisikan data-data yang berkaitan dengan departemen QRCC termasuk PPM, F-Cost, Sales, Quality Issue dan lain-lain";

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: "https://ui4.nuxt.com/assets/templates/nuxt/dashboard-light.png",
  twitterImage:
    "https://ui4.nuxt.com/assets/templates/nuxt/dashboard-light.png",
  twitterCard: "summary_large_image",
});
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator />

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
