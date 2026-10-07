// The red line under a form field that failed validation.
interface FieldErrorProps {
  message?: string
}

/** A form field's validation message; renders nothing without one. */
export function FieldError({ message }: FieldErrorProps) {
  return message ? <p className="mt-1 text-[13px] text-redpencil">{message}</p> : null
}
