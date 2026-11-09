import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from './Dialog.jsx';
import { createPerson, ApiError } from './api.js';

const schema = z.object({
  name: z.string().trim().min(1, 'Please fill in this field.').max(60),
  email: z.string().min(1, 'Please fill in this field.').email('Enter a valid e-mail address.'),
  role: z.enum(['admin', 'member'], { errorMap: () => ({ message: 'Please fill in this field.' }) }),
});

function Form({ onClose }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, setError, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: { name: '', email: '', role: '' } });
  const create = useMutation({
    mutationFn: createPerson,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['people'] }); onClose(); },
    onError: (e) => {
      if (e instanceof ApiError) for (const [field, message] of Object.entries(e.fields)) setError(field, { message });
    },
  });
  const field = (name) => ({ ...register(name), 'aria-invalid': errors[name] ? 'true' : undefined, 'aria-describedby': errors[name] ? `${name}-error` : undefined });
  return (
    <form onSubmit={handleSubmit((values) => create.mutate(values))} noValidate>
      <h2>Add a person</h2>
      <label>Name *<input {...field('name')} /></label>
      {errors.name && <small id="name-error">{errors.name.message}</small>}
      <label>Email *<input type="email" {...field('email')} /></label>
      {errors.email && <small id="email-error">{errors.email.message}</small>}
      <label>Role *
        <select {...field('role')}>
          <option value="" disabled></option>
          <option value="admin">admin</option>
          <option value="member">member</option>
        </select>
      </label>
      {errors.role && <small id="role-error">{errors.role.message}</small>}
      <div className="row">
        <button type="submit" disabled={create.isPending}>Add</button>
        <button type="button" onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

export function AddPersonDialog({ open, onClose }) {
  return <Dialog open={open} onClose={onClose}><Form onClose={onClose} /></Dialog>;
}
