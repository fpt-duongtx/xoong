<script setup>
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { ref } from 'vue';
import { createPerson, ApiError } from './api.js';

const dialog = ref(null);
defineExpose({ open: () => dialog.value.showModal() });

const schema = toTypedSchema(z.object({
  name: z.string().trim().min(1, 'Please fill in this field.').max(60),
  email: z.string().min(1, 'Please fill in this field.').email('Enter a valid e-mail address.'),
  role: z.enum(['admin', 'member'], { errorMap: () => ({ message: 'Please fill in this field.' }) }),
}));
const queryClient = useQueryClient();
const { defineField, handleSubmit, errors, setFieldError, resetForm } = useForm({ validationSchema: schema, initialValues: { name: '', email: '', role: '' } });
const [name, nameAttrs] = defineField('name');
const [email, emailAttrs] = defineField('email');
const [role, roleAttrs] = defineField('role');

const create = useMutation({
  mutationFn: createPerson,
  onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['people'] }); dialog.value.close(); },
  onError: (e) => {
    if (e instanceof ApiError) for (const [field, message] of Object.entries(e.fields)) setFieldError(field, message);
  },
});
const submit = handleSubmit((values) => create.mutate(values));
</script>

<template>
  <dialog ref="dialog" @close="resetForm()">
    <form novalidate @submit.prevent="submit">
      <h2>Add a person</h2>
      <label>Name *<input v-model="name" v-bind="nameAttrs" :aria-invalid="errors.name ? 'true' : undefined" :aria-describedby="errors.name ? 'name-error' : undefined"></label>
      <small v-if="errors.name" id="name-error">{{ errors.name }}</small>
      <label>Email *<input v-model="email" v-bind="emailAttrs" type="email" :aria-invalid="errors.email ? 'true' : undefined" :aria-describedby="errors.email ? 'email-error' : undefined"></label>
      <small v-if="errors.email" id="email-error">{{ errors.email }}</small>
      <label>Role *
        <select v-model="role" v-bind="roleAttrs" :aria-invalid="errors.role ? 'true' : undefined" :aria-describedby="errors.role ? 'role-error' : undefined">
          <option value="" disabled></option>
          <option value="admin">admin</option>
          <option value="member">member</option>
        </select>
      </label>
      <small v-if="errors.role" id="role-error">{{ errors.role }}</small>
      <div class="row">
        <button type="submit" :disabled="create.isPending.value">Add</button>
        <button type="button" @click="dialog.close()">Cancel</button>
      </div>
    </form>
  </dialog>
</template>
