<script setup lang="ts">
import { ref } from 'vue';
const query = ref('');
</script>

<template>
  <div class="filter-card">
    <el-input v-model="query" placeholder="Cari" class="filter-card__field" />
    <button class="filter-card__action" @click="onSearch">Cari</button>
  </div>
</template>

<style scoped lang="scss">
.filter-card {
  display: flex;
}
:deep(.el-input__wrapper) {
  border-radius: 6px;
}
:deep(.inner) {
  color: #101828;
}
</style>
