<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { bladeList } from '@/constants/bladeList'

const props = defineProps<{
  modelValue: string
  slotIndex: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  quickPaste: [value: string, slotIndex: number]
}>()
const { t } = useI18n()

const isOpen = ref(false)

const normalizedQuery = computed(() => props.modelValue.trim().toLowerCase())
const suggestions = computed(() => {
  const query = normalizedQuery.value
  if (!query) return bladeList.slice(0, 12)
  return bladeList
    .filter((item) => {
      const id = item.id.toLowerCase()
      const zh = item.zhName.toLowerCase()
      const en = item.enName.toLowerCase()
      return id.includes(query) || zh.includes(query) || en.includes(query)
    })
    .slice(0, 12)
})

function onInput(value: string): void {
  emit('update:modelValue', value)
  isOpen.value = true
}

function onSelect(label: string): void {
  emit('update:modelValue', label)
  isOpen.value = false
}

function onPaste(event: ClipboardEvent): void {
  const text = event.clipboardData?.getData('text')?.trim()
  if (!text || !text.includes(',')) return
  event.preventDefault()
  emit('quickPaste', text, props.slotIndex)
}

function onBlur(): void {
  window.setTimeout(() => {
    isOpen.value = false
  }, 120)
}
</script>

<template>
  <div class="relative">
    <input
      :value="modelValue"
      type="text"
      class="w-full rounded-xl border-2 border-slate-800 bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white placeholder:text-slate-600 transition-all focus:border-bx-primary focus:outline-none"
      :placeholder="t('setup.gearSlot', { n: slotIndex + 1 })"
      autocomplete="off"
      @focus="isOpen = true"
      @blur="onBlur"
      @input="onInput(($event.target as HTMLInputElement).value)"
      @paste="onPaste"
    />

    <ul
      v-if="isOpen && suggestions.length > 0"
      class="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/95 p-1 shadow-2xl"
    >
      <li v-for="entry in suggestions" :key="entry.id + entry.label">
        <button
          type="button"
          class="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-200 transition-colors hover:bg-bx-primary/15 hover:text-bx-primary"
          @click="onSelect(entry.label)"
        >
          {{ entry.label }}
        </button>
      </li>
    </ul>
  </div>
</template>
