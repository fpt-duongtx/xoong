import { useEffect, useRef } from 'react';

/** A modal on the native <dialog>: the browser traps focus and closes on Escape; `onClose` keeps React's state in step. */
export function Dialog({ open, onClose, role, label, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} role={role} aria-label={label} onClose={onClose}>
      {open && children}
    </dialog>
  );
}
