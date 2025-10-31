"use client";

import { useCallback } from "react";

import { useToastContext, type ToastIntent } from "./toast-provider";

export type ToastOptions = {
  title: string;
  description?: string;
  intent?: ToastIntent;
  duration?: number;
};

export function useToast() {
  const { pushToast, dismissToast } = useToastContext();

  const toast = useCallback(
    (options: ToastOptions) => {
      pushToast(options);
    },
    [pushToast],
  );

  return {
    toast,
    dismissToast,
  };
}
