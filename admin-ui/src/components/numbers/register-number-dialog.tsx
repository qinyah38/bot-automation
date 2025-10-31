"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RegisterNumberFormValues = {
  displayName: string;
  phoneNumber: string;
  region: string;
  notes: string;
  autoAssignPreferred: boolean;
};

type RegisterNumberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: RegisterNumberFormValues) => void;
};

const REGION_OPTIONS = [
  { label: "Saudi Arabia", value: "SA" },
  { label: "United Arab Emirates", value: "AE" },
  { label: "Bahrain", value: "BH" },
  { label: "Kuwait", value: "KW" },
  { label: "Qatar", value: "QA" },
  { label: "Other", value: "OTHER" },
];

export function RegisterNumberDialog({
  open,
  onOpenChange,
  onSubmit,
}: RegisterNumberDialogProps) {
  const form = useForm<RegisterNumberFormValues>({
    defaultValues: {
      displayName: "",
      phoneNumber: "",
      region: "SA",
      notes: "",
      autoAssignPreferred: true,
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({
        displayName: "",
        phoneNumber: "",
        region: "SA",
        notes: "",
        autoAssignPreferred: true,
      });
    }
  }, [form, open]);

  const handleSubmit = (values: RegisterNumberFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register WhatsApp number</DialogTitle>
          <DialogDescription>
            Add a new number, capture region metadata, and choose if it should be considered for
            automatic assignments after publish.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="displayName"
              rules={{ required: "Display name is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., KSA Sales"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Name shown across admin dashboards.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phoneNumber"
              rules={{ required: "Phone number is required" }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+966 5X XXX XXXX"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Enter the number in international (E.164) format.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <FormControl>
                    <select
                      {...field}
                      className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-[var(--shadow-1)] transition focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
                    >
                      {REGION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormDescription>
                    Helps route compliance checks and select the right Supabase region.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Optional onboarding notes or reminders."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="autoAssignPreferred"
              render={({ field }) => (
                <FormItem className="flex items-start justify-between gap-4 rounded-lg border border-border px-4 py-3">
                  <div>
                    <FormLabel>Suggest for auto-assignment</FormLabel>
                    <FormDescription>
                      Keep enabled to surface this number when publishing new bots.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Register number</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
