import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FormFieldProps = React.ComponentProps<typeof Input> & {
  label: string;
  name: string;
  errors?: string[];
};

export function FormField({ label, name, errors, ...inputProps }: FormFieldProps) {
  const errorId = `${name}-error`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={errors?.length ? true : undefined}
        aria-describedby={errors?.length ? errorId : undefined}
        {...inputProps}
      />
      {errors?.length ? (
        <p id={errorId} className="text-xs text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({ state }: { state: { error?: string; success?: string } | null }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state?.success) {
    return (
      <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">
        {state.success}
      </p>
    );
  }
  return null;
}
