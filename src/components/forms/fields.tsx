"use client"

import { AlertCircle } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { Controller, type Control, type FieldPath, type FieldValues, type UseFormSetError } from "react-hook-form"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

// Thin wrappers that connect react-hook-form to the shadcn Field components.
// Each one wires up the <label>, aria-invalid, aria-describedby and the error
// message, so every form in the app gets accessible fields for free.

type BaseProps<T extends FieldValues, O> = {
  control: Control<T, unknown, O>
  name: FieldPath<T>
  label: ReactNode
  description?: ReactNode
  required?: boolean
  className?: string
}

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden="true">
      *
    </span>
  )
}

export function TextField<T extends FieldValues, O>({
  control,
  name,
  label,
  description,
  required,
  className,
  ...inputProps
}: BaseProps<T, O> & Omit<ComponentProps<typeof Input>, "name" | "value" | "defaultValue">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const id = `field-${name.replaceAll(".", "-")}`
        const describedBy = [description ? `${id}-desc` : null, fieldState.error ? `${id}-error` : null]
          .filter(Boolean)
          .join(" ")
        return (
          <Field data-invalid={fieldState.invalid || undefined} className={className}>
            <FieldLabel htmlFor={id}>
              {label} {required ? <RequiredMark /> : null}
            </FieldLabel>
            <Input
              {...inputProps}
              {...field}
              value={(field.value as string | undefined) ?? ""}
              id={id}
              required={required}
              aria-invalid={fieldState.invalid || undefined}
              aria-describedby={describedBy || undefined}
            />
            {description ? <FieldDescription id={`${id}-desc`}>{description}</FieldDescription> : null}
            <FieldError id={`${id}-error`} errors={[fieldState.error]} />
          </Field>
        )
      }}
    />
  )
}

export function TextareaField<T extends FieldValues, O>({
  control,
  name,
  label,
  description,
  required,
  className,
  ...textareaProps
}: BaseProps<T, O> & Omit<ComponentProps<typeof Textarea>, "name" | "value" | "defaultValue">) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const id = `field-${name.replaceAll(".", "-")}`
        return (
          <Field data-invalid={fieldState.invalid || undefined} className={className}>
            <FieldLabel htmlFor={id}>
              {label} {required ? <RequiredMark /> : null}
            </FieldLabel>
            <Textarea
              {...textareaProps}
              {...field}
              value={(field.value as string | undefined) ?? ""}
              id={id}
              aria-invalid={fieldState.invalid || undefined}
              aria-describedby={[description ? `${id}-desc` : null, fieldState.error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined}
            />
            {description ? <FieldDescription id={`${id}-desc`}>{description}</FieldDescription> : null}
            <FieldError id={`${id}-error`} errors={[fieldState.error]} />
          </Field>
        )
      }}
    />
  )
}

export type SelectOption = { value: string; label: string; disabled?: boolean }

export function SelectField<T extends FieldValues, O>({
  control,
  name,
  label,
  description,
  required,
  className,
  options,
  placeholder = "Choose…",
  allowNone,
  noneLabel = "None",
  onValueChange,
}: BaseProps<T, O> & {
  options: SelectOption[]
  placeholder?: string
  /** Adds a "None" choice that maps to "" (stored as null). */
  allowNone?: boolean
  noneLabel?: string
  onValueChange?: (value: string) => void
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const id = `field-${name.replaceAll(".", "-")}`
        const value = (field.value as string | undefined) || (allowNone ? "none" : "")
        return (
          <Field data-invalid={fieldState.invalid || undefined} className={className}>
            <FieldLabel htmlFor={id}>
              {label} {required ? <RequiredMark /> : null}
            </FieldLabel>
            <Select
              name={field.name}
              value={value}
              onValueChange={(v) => {
                const next = v === "none" ? "" : v
                field.onChange(next)
                onValueChange?.(next)
              }}
            >
              <SelectTrigger
                id={id}
                ref={field.ref}
                onBlur={field.onBlur}
                className="w-full"
                aria-invalid={fieldState.invalid || undefined}
                aria-describedby={[description ? `${id}-desc` : null, fieldState.error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined}
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {allowNone ? <SelectItem value="none">{noneLabel}</SelectItem> : null}
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {description ? <FieldDescription id={`${id}-desc`}>{description}</FieldDescription> : null}
            <FieldError id={`${id}-error`} errors={[fieldState.error]} />
          </Field>
        )
      }}
    />
  )
}

/** A form-level error (e.g. "That email and password don't match"). Announced by screen readers. */
export function FormAlert({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <Alert variant="destructive" role="alert">
      <AlertCircle aria-hidden="true" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

/** Copies server-side field errors from an ActionResult onto the form. */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Record<string, string[] | undefined> | undefined
) {
  if (!fieldErrors) return
  for (const [key, messages] of Object.entries(fieldErrors)) {
    if (messages?.[0] && key !== "_form") setError(key as FieldPath<T>, { message: messages[0] })
  }
}
