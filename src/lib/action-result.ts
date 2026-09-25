import type { z } from "zod";

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export const success = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const failure = <T = never>(error: string, fieldErrors?: FieldErrors): ActionResult<T> => ({
  ok: false,
  error,
  fieldErrors,
});

export function validationFailure<T = never>(error: z.ZodError): ActionResult<T> {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return failure("Revisa los campos marcados", fieldErrors);
}
