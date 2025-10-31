"use client";

import { useEffect, useMemo } from "react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FlowModuleDefinition,
  ModuleField,
  TriggerModuleDefinition,
} from "@/data/module-catalog";
import { useForm, type ControllerProps } from "react-hook-form";

type ModuleConfigDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  definition: FlowModuleDefinition | TriggerModuleDefinition;
  initialConfig: Record<string, unknown>;
  onSubmit: (config: Record<string, unknown>) => void;
};

type FormValues = Record<string, unknown>;

const JSON_FIELD_HINT = /json/i;

function fieldToFormValue(field: ModuleField, value: unknown): unknown {
  if (value === undefined || value === null) {
    if (field.type === "toggle") return Boolean(field.defaultValue ?? false);
    if (field.type === "number") return field.defaultValue ?? "";
    if (field.type === "multiselect") return (field.defaultValue as string[]) ?? [];
    if (field.type === "keyword-list") return "";
    return field.defaultValue ?? "";
  }

  switch (field.type) {
    case "toggle":
      return Boolean(value);
    case "number":
      return value === "" ? "" : Number(value);
    case "multiselect":
      return Array.isArray(value) ? value : [];
    case "keyword-list":
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      return String(value);
    case "textarea": {
      if (Array.isArray(value)) {
        return value.join("\n");
      }
      if (
        typeof value === "object" &&
        value !== null &&
        JSON_FIELD_HINT.test(field.label)
      ) {
        return JSON.stringify(value, null, 2);
      }
      return String(value ?? "");
    }
    case "select":
    case "text":
    default:
      return String(value ?? "");
  }
}

function parseFieldValue(
  field: ModuleField,
  raw: unknown,
): { value: unknown; error?: string } {
  switch (field.type) {
    case "toggle":
      return { value: Boolean(raw) };
    case "number": {
      if (raw === "" || raw === null || raw === undefined) {
        return { value: null };
      }
      const numberValue = Number(raw);
      if (Number.isNaN(numberValue)) {
        return {
          value: null,
          error: field.errorMessage ?? "Enter a valid number",
        };
      }
      return { value: numberValue };
    }
    case "multiselect":
      if (!Array.isArray(raw)) return { value: [] };
      return { value: raw };
    case "keyword-list": {
      const text = String(raw ?? "");
      const parts = text
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      return { value: parts };
    }
    case "textarea": {
      const text = String(raw ?? "");
      if (JSON_FIELD_HINT.test(field.label)) {
        if (!text) return { value: {} };
        try {
          return { value: JSON.parse(text) };
        } catch {
          return { value: {}, error: "Invalid JSON" };
        }
      }
      if (field.key === "choices") {
        const lines = text
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        return { value: lines };
      }
      if (field.key === "retryMessage" || field.key === "prompt" || field.key === "body") {
        return { value: text };
      }
      return { value: text };
    }
    case "select":
    case "text":
    default:
      return { value: raw === "" ? "" : String(raw ?? "") };
  }
}

export function ModuleConfigDialog({
  open,
  onOpenChange,
  title,
  description,
  definition,
  initialConfig,
  onSubmit,
}: ModuleConfigDialogProps) {
  const defaultValues = useMemo(() => {
    const config = { ...(definition.defaultConfig ?? {}), ...initialConfig };
    return definition.fields.reduce<FormValues>((acc, field) => {
      acc[field.key] = fieldToFormValue(field, config[field.key]);
      return acc;
    }, {});
  }, [definition, initialConfig]);

  const form = useForm<FormValues>({
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form, open]);

  const handleSubmit = (values: FormValues) => {
    const parsedConfig: Record<string, unknown> = {};
    let hasError = false;

    definition.fields.forEach((field) => {
      const { value, error } = parseFieldValue(field, values[field.key]);
      if (error) {
        form.setError(field.key as never, { message: error });
        hasError = true;
        return;
      }
      parsedConfig[field.key] = value;
    });

    if (hasError) return;

    onSubmit(parsedConfig);
    onOpenChange(false);
  };

  const renderField = (field: ModuleField) => {
    const rules: ControllerProps<FormValues, string>["rules"] = {};
    if (field.required) {
      rules.required = field.errorMessage ?? `${field.label} is required`;
    }
    if (field.pattern) {
      rules.pattern = {
        value: field.pattern,
        message: field.errorMessage ?? `${field.label} has invalid format`,
      };
    }

    const validate: Record<string, (value: unknown) => true | string> = {};
    if (field.type === "number") {
      validate.numeric = (value) => {
        if (value === "" || value === null || value === undefined) {
          return true;
        }
        const numberValue = Number(value);
        if (Number.isNaN(numberValue)) {
          return field.errorMessage ?? "Enter a valid number";
        }
        if (field.min !== undefined && numberValue < field.min) {
          return `Value must be greater than or equal to ${field.min}`;
        }
        if (field.max !== undefined && numberValue > field.max) {
          return `Value must be less than or equal to ${field.max}`;
        }
        return true;
      };
    }
    if (field.type === "keyword-list" && field.required) {
      validate.keywordRequired = (value) => {
        const text = String(value ?? "").trim();
        if (!text) return field.errorMessage ?? "Enter at least one keyword";
        return true;
      };
    }
    if (field.type === "textarea" && field.required) {
      validate.textRequired = (value) => {
        const text = String(value ?? "").trim();
        if (!text) return field.errorMessage ?? `${field.label} is required`;
        return true;
      };
    }

    if (Object.keys(validate).length > 0) {
      rules.validate = validate;
    }

    return (
      <FormField
        key={field.key}
        control={form.control}
        name={field.key as never}
        rules={rules}
        render={({ field: formField }) => {
          const isRequired = field.required ?? false;

          if (field.type === "toggle") {
            return (
              <FormItem className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <FormLabel className="text-sm font-medium">
                    {field.label}
                  </FormLabel>
                  {field.description && (
                    <FormDescription>{field.description}</FormDescription>
                  )}
                </div>
                <FormControl>
                  <Switch
                    checked={Boolean(formField.value)}
                    onCheckedChange={formField.onChange}
                  />
                </FormControl>
              </FormItem>
            );
          }

          if (field.type === "multiselect" && field.options) {
            const current: string[] = Array.isArray(formField.value)
              ? formField.value
              : [];
            return (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <div className="flex flex-wrap gap-2 rounded-lg border border-border px-3 py-3">
                  {field.options.map((option) => {
                    const checked = current.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={checked}
                          onChange={(event) => {
                            if (event.target.checked) {
                              formField.onChange([...current, option.value]);
                            } else {
                              formField.onChange(
                                current.filter((value) => value !== option.value),
                              );
                            }
                          }}
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
                <FormDescription>{field.description}</FormDescription>
                <FormMessage />
              </FormItem>
            );
          }

          if (field.type === "select" && field.options) {
            return (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <FormControl>
                  <select
                    {...formField}
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-[var(--shadow-1)] transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                  >
                    {field.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormDescription>{field.description}</FormDescription>
                <FormMessage />
              </FormItem>
            );
          }

          if (field.type === "textarea") {
            const value = typeof formField.value === "string" ? formField.value : "";
            return (
              <FormItem>
                <FormLabel>{field.label}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={4}
                    value={value}
                    onChange={(event) => formField.onChange(event.target.value)}
                    onBlur={formField.onBlur}
                    name={formField.name}
                    ref={formField.ref}
                    placeholder={field.placeholder}
                  />
                </FormControl>
                <FormDescription>{field.description}</FormDescription>
                <FormMessage />
              </FormItem>
            );
          }

          const inputType = field.type === "number" ? "number" : "text";
          const inputValue = (() => {
            if (formField.value === null || formField.value === undefined) {
              return "";
            }
            if (typeof formField.value === "number") {
              return String(formField.value);
            }
            return String(formField.value);
          })();

          return (
            <FormItem>
              <FormLabel>
                {field.label}
                {isRequired ? <span className="text-destructive"> *</span> : null}
              </FormLabel>
              <FormControl>
                <Input
                  type={inputType}
                  value={inputValue}
                  onChange={(event) => formField.onChange(event.target.value)}
                  onBlur={formField.onBlur}
                  name={formField.name}
                  ref={formField.ref}
                  placeholder={field.placeholder}
                />
              </FormControl>
              <FormDescription>{field.description}</FormDescription>
              <FormMessage />
            </FormItem>
          );
        }}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {definition.fields.length > 0 ? (
              definition.fields.map(renderField)
            ) : (
              <p className="text-sm text-foreground/60">
                This module does not expose configurable fields.
              </p>
            )}
            <DialogFooter className="flex justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
