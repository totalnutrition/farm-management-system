"use client";

import { z } from "zod";
import { toast } from "sonner";
import { login } from "./actions";
import { Input } from "@/components/ui/input";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

const loginSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters of long."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values: LoginValues) => {
    setServerError(null);
    const formData = new FormData();
    formData.set("email", values.email);
    formData.set("password", values.password);

    startTransition(async () => {
      const result = await login({}, formData);
      if (result?.error) {
        setServerError(result.error);
        toast("Login Error");
      }
    });
  };

  return (
    <form id="form-rhf-demo" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="form-login-email">
                Email
              </FieldLabel>
              <Input
                {...field}
                id="form-login-email"
                aria-invalid={fieldState.invalid}
                placeholder="Email"
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="form-login-email">
                Password
              </FieldLabel>
              <Input
                min={8}
                {...field}
                type="password"
                id="form-login-email"
                aria-invalid={fieldState.invalid}
                placeholder="Password"
              />
              {fieldState.invalid && (
                <FieldError errors={[fieldState.error]} />
              )}
            </Field>
          )}
        />
        {serverError ? (
          <p role="alert" className="text-xs text-destructive">
            {serverError}
          </p>
        ) : null}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Signing in..." : "Sign in"}
        </Button>
      </FieldGroup>
    </form>
  );
}