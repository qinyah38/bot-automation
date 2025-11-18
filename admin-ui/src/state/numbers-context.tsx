"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/state/auth-context";

export type NumberStatus = "Connected" | "Pending QR" | "Disconnected" | "Suspended";

export type WhatsAppNumber = {
  id: string;
  phoneNumber: string;
  displayName: string;
  region: string;
  status: NumberStatus;
  lastSeen: string;
  notes?: string;
  qrExpiresAt?: string;
  qrSvg?: string;
  assignedBotIds: string[];
  autoAssignPreferred: boolean;
  createdAt: string;
};

type RegisterNumberInput = {
  phoneNumber: string;
  displayName: string;
  region: string;
  notes?: string;
  autoAssignPreferred?: boolean;
};

type NumbersContextValue = {
  numbers: WhatsAppNumber[];
  registerNumber: (input: RegisterNumberInput) => Promise<WhatsAppNumber>;
  updateNumberStatus: (
    id: string,
    status: NumberStatus,
    metadata?: Partial<Pick<WhatsAppNumber, "lastSeen" | "qrExpiresAt" | "notes">>,
  ) => void;
  assignNumberToBot: (numberId: string, botId: string, assign: boolean) => void;
  regenerateQr: (numberId: string) => Promise<void>;
  markQrScanned: (numberId: string) => Promise<void>;
};

const NumbersContext = createContext<NumbersContextValue | undefined>(undefined);

function formatLastSeen(status: NumberStatus): string {
  switch (status) {
    case "Connected":
      return "Connected moments ago";
    case "Pending QR":
      return "QR pending";
    case "Disconnected":
      return "Reconnect required";
    case "Suspended":
      return "Suspended";
    default:
      return "Unknown";
  }
}

type DbNumberRow = {
  id: string;
  phone_number: string;
  display_name: string | null;
  region: string | null;
  status: string;
  notes: string | null;
  last_connected_at: string | null;
  created_at: string;
  auto_assign_preferred?: boolean | null;
  number_bot_deployments: Array<{
    status: string;
    bot_version_id: string | null;
  }> | null;
};

function mapDbNumber(row: DbNumberRow): WhatsAppNumber {
  const statusMap: Record<string, NumberStatus> = {
    connected: "Connected",
    pending_qr: "Pending QR",
    disconnected: "Disconnected",
    suspended: "Suspended",
  };
  const status = statusMap[row.status as keyof typeof statusMap] ?? "Disconnected";
  const assignedBotIds =
    row.number_bot_deployments
      ?.filter((deployment) => deployment.status === "active" && Boolean(deployment.bot_version_id))
      .map((deployment) => deployment.bot_version_id as string) ?? [];

  return {
    id: row.id,
    phoneNumber: row.phone_number,
    displayName: row.display_name ?? row.phone_number,
    region: row.region ?? "",
    status,
    lastSeen:
      row.last_connected_at
        ? new Date(row.last_connected_at).toLocaleString()
        : formatLastSeen(status),
    notes: row.notes ?? undefined,
    qrExpiresAt: undefined,
    qrSvg: undefined,
    assignedBotIds,
    autoAssignPreferred: row.auto_assign_preferred ?? false,
    createdAt: row.created_at,
  };
}



export function NumbersProvider({ children }: { children: ReactNode }) {
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const { toast } = useToast();
  const { supabase, user } = useAuth();

  const refreshNumbers = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("numbers")
      .select(
        `
        id,
        phone_number,
        display_name,
        region,
        status,
        notes,
        last_connected_at,
        created_at,
        auto_assign_preferred,
        number_bot_deployments:number_bot_deployments_number_id_fkey (
          status,
          bot_version_id
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Failed to load numbers",
        description: error.message,
        intent: "error",
      });
      return;
    }

    setNumbers((prev) => {
      const remoteNumbers = (data ?? []).map(mapDbNumber);
      const remoteIds = new Set(remoteNumbers.map((number) => number.id));
      const drafts = prev.filter((number) => !remoteIds.has(number.id) && number.id.startsWith("number-"));
      return [...drafts, ...remoteNumbers];
    });
  }, [supabase, toast]);

  useEffect(() => {
    if (!user) {
      setNumbers([]);
      return;
    }
    refreshNumbers();
  }, [refreshNumbers, user]);

  const registerNumber = useCallback(
    async ({
      phoneNumber,
      displayName,
      region,
      notes,
      autoAssignPreferred = true,
    }: RegisterNumberInput) => {
      let handledError = false;
      try {
        const response = await fetch("/api/numbers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber: phoneNumber.trim(),
            displayName: displayName.trim(),
            region: region.trim(),
            notes: notes?.trim(),
            autoAssignPreferred,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const message =
            typeof errorBody?.error === "string"
              ? errorBody.error
              : "Failed to register number.";
          handledError = true;
          toast({
            title: "Registration failed",
            description: message,
            intent: "error",
          });
          throw new Error(message);
        }

        const payload = await response.json();
        const mapped = mapDbNumber(payload.number);

        setNumbers((prev) => {
          const withoutDrafts = prev.filter(
            (number) =>
              !(number.id.startsWith("number-") && number.phoneNumber === mapped.phoneNumber),
          );
          const withoutDuplicate = withoutDrafts.filter((number) => number.id !== mapped.id);
          return [mapped, ...withoutDuplicate];
        });

        void refreshNumbers();

        toast({
          title: "Number registered",
          description: `${displayName} is ready for onboarding.`,
        });

        return mapped;
      } catch (error) {
        if (error instanceof Error) {
          if (!handledError) {
            toast({
              title: "Registration failed",
              description: error.message || "An unexpected error occurred.",
              intent: "error",
            });
          }
          throw error;
        }
        throw new Error("Failed to register number");
      }
    },
    [refreshNumbers, toast],
  );

  const updateNumberStatus = useCallback(
    (
      id: string,
      status: NumberStatus,
      metadata?: Partial<Pick<WhatsAppNumber, "lastSeen" | "qrExpiresAt" | "notes">>,
    ) => {
      setNumbers((prev) =>
        prev.map((number) =>
          number.id === id
            ? {
                ...number,
                status,
                lastSeen: metadata?.lastSeen ?? formatLastSeen(status),
                qrExpiresAt: metadata?.qrExpiresAt ?? number.qrExpiresAt,
                notes: metadata?.notes ?? number.notes,
              }
            : number,
        ),
      );
    },
    [],
  );

  const assignNumberToBot = useCallback(
    (numberId: string, botId: string, assign: boolean) => {
      setNumbers((prev) =>
        prev.map((number) =>
          number.id === numberId
            ? {
                ...number,
                assignedBotIds: assign
                  ? Array.from(new Set([...number.assignedBotIds, botId]))
                  : number.assignedBotIds.filter((id) => id !== botId),
              }
            : number,
        ),
      );
    },
    [],
  );

  const regenerateQr = useCallback(
    async (numberId: string) => {
      setNumbers((prev) =>
        prev.map((number) =>
          number.id === numberId
            ? { ...number, status: "Pending QR", qrExpiresAt: undefined, qrSvg: undefined }
            : number,
        ),
      );

      const response = await fetch(`/api/numbers/${numberId}/session/restart`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          typeof body?.error === "string" ? body.error : "Failed to request QR regeneration.";
        toast({
          title: "Unable to regenerate QR",
          description: message,
          intent: "error",
        });
      } else {
        toast({
          title: "QR regeneration requested",
          description: "Check back in a few moments for a new code.",
        });
      }
    },
    [toast],
  );

  const markQrScanned = useCallback(
    async (numberId: string) => {
      const response = await fetch(`/api/numbers/${numberId}/session/mark-scanned`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message =
          typeof body?.error === "string" ? body.error : "Failed to mark QR as scanned.";
        toast({
          title: "Unable to mark scanned",
          description: message,
          intent: "error",
        });
        return;
      }

      setNumbers((prev) =>
        prev.map((number) =>
          number.id === numberId
            ? {
                ...number,
                status: "Connected",
                lastSeen: "Connected just now",
                qrExpiresAt: undefined,
              }
            : number,
        ),
      );
    },
    [toast],
  );

  const value = useMemo<NumbersContextValue>(
    () => ({
      numbers,
      registerNumber,
      updateNumberStatus,
      assignNumberToBot,
      regenerateQr,
      markQrScanned,
    }),
    [assignNumberToBot, markQrScanned, numbers, regenerateQr, registerNumber, updateNumberStatus],
  );

  return <NumbersContext.Provider value={value}>{children}</NumbersContext.Provider>;
}

export function useNumbers() {
  const context = useContext(NumbersContext);
  if (!context) {
    throw new Error("useNumbers must be used within a NumbersProvider");
  }
  return context;
}
