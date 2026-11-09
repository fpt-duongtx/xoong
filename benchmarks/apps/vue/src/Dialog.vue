<script setup>
import { ref, watch, onMounted } from 'vue';

// A modal on the native <dialog>: the browser traps focus and closes on Escape; `close` keeps the parent's state in step.
const props = defineProps({ open: Boolean, role: String, label: String });
const emit = defineEmits(['close']);
const el = ref(null);
const sync = () => {
  if (props.open && !el.value.open) el.value.showModal();
  if (!props.open && el.value.open) el.value.close();
};
onMounted(sync);
watch(() => props.open, sync);
</script>

<template>
  <dialog ref="el" :role="role" :aria-label="label" @close="emit('close')">
    <slot v-if="open" />
  </dialog>
</template>
