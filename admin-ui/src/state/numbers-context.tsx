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

type CreateNumberInput = {
  phoneNumber: string;
  displayName: string;
  region: string;
  notes?: string;
  autoAssignPreferred?: boolean;
};

type NumbersContextValue = {
  numbers: WhatsAppNumber[];
  createNumber: (input: CreateNumberInput) => WhatsAppNumber;
  updateNumberStatus: (
    id: string,
    status: NumberStatus,
    metadata?: Partial<Pick<WhatsAppNumber, "lastSeen" | "qrExpiresAt" | "notes">>,
  ) => void;
  assignNumberToBot: (numberId: string, botId: string, assign: boolean) => void;
  regenerateQr: (numberId: string) => void;
  markQrScanned: (numberId: string) => void;
};

const NumbersContext = createContext<NumbersContextValue | undefined>(undefined);

function createRandomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mockQrSvg(text: string) {
  return `QRCode:${text}`;
}

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
  const assignedBotIds: string[] = [];

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
    autoAssignPreferred: false,
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

  const createNumber = useCallback(
    ({ phoneNumber, displayName, region, notes, autoAssignPreferred = true }: CreateNumberInput) => {
      const id = `number-${createRandomId()}`;
      const status: NumberStatus = "Pending QR";
      const newNumber: WhatsAppNumber = {
        id,
        phoneNumber,
        displayName,
        region,
        status,
        lastSeen: formatLastSeen(status),
        notes,
        qrExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        qrSvg: mockQrSvg(phoneNumber),
        assignedBotIds: [],
        autoAssignPreferred,
        createdAt: new Date().toISOString(),
      };

      setNumbers((prev) => [newNumber, ...prev]);
      return newNumber;
    },
    [],
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

  const regenerateQr = useCallback((numberId: string) => {
    setNumbers((prev) =>
      prev.map((number) =>
        number.id === numberId
          ? {
              ...number,
              status: "Pending QR",
              qrExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
              qrSvg: mockQrSvg(`${number.phoneNumber}-${Date.now()}`),
              lastSeen: "QR regenerated",
            }
          : number,
      ),
    );
  }, []);

  const markQrScanned = useCallback((numberId: string) => {
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
  }, []);

  const value = useMemo<NumbersContextValue>(
    () => ({
      numbers,
      createNumber,
      updateNumberStatus,
      assignNumberToBot,
      regenerateQr,
      markQrScanned,
    }),
    [assignNumberToBot, createNumber, markQrScanned, numbers, regenerateQr, updateNumberStatus],
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
