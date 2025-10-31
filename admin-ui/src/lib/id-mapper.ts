import { v5 as uuidv5, validate as uuidValidate } from "uuid";

const BOT_NAMESPACE = "d7ddf5b7-068e-4acc-8fdf-68cf8127781b";
const NUMBER_NAMESPACE = "dbe69c2e-ec8e-4f30-8031-974cfeb7a477";

function ensureUuid(value: string, namespace: string) {
  if (uuidValidate(value)) {
    return value;
  }
  return uuidv5(value, namespace);
}

export function toBotUuid(value: string) {
  return ensureUuid(value, BOT_NAMESPACE);
}

export function toNumberUuid(value: string) {
  return ensureUuid(value, NUMBER_NAMESPACE);
}
