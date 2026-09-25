<script setup lang="ts">
defineProps<{ title: string }>();
</script>

<template>
  <div class="rounded-lg bg-brand-500 text-gray-900">{{ title }}</div>
</template>

<style scoped>
.card :deep(.inner) {
  color: #465fff;
}
</style>
