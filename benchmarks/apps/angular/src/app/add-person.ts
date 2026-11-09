import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiError, createPerson } from './api';

@Component({
  selector: 'app-add-person',
  imports: [ReactiveFormsModule],
  templateUrl: './add-person.html',
})
export class AddPerson {
  readonly created = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly pending = signal(false);
  protected readonly submitted = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    email: ['', [Validators.required, Validators.email]],
    role: ['', Validators.required],
  });

  open() { this.dialog().nativeElement.showModal(); }
  close() { this.dialog().nativeElement.close(); }
  protected reset() { this.form.reset(); this.submitted.set(false); }
  protected invalid(name: 'name' | 'email' | 'role') { const c = this.form.controls[name]; return this.submitted() && c.invalid; }
  protected message(name: 'name' | 'email' | 'role') {
    const e = this.form.controls[name].errors;
    return e?.['server'] ?? (e?.['email'] ? 'Enter a valid e-mail address.' : 'Please fill in this field.');
  }

  protected async submit() {
    this.submitted.set(true);
    if (this.form.invalid) return;
    this.pending.set(true);
    try {
      await createPerson(this.form.getRawValue());
      this.created.emit();
      this.close();
    } catch (e) {
      if (e instanceof ApiError) for (const [field, message] of Object.entries(e.fields)) this.form.get(field)?.setErrors({ server: message });
    } finally { this.pending.set(false); }
  }
}
