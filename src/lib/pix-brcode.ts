// Builds a static EMV BR Code (PIX Copia e Cola) on the frontend.
// Reference: Manual do BR Code (Bacen) — used as fallback when the admin
// did not paste a valid 000201-prefixed code.

function tlv(id: string, value: string) {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(text: string, max: number) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .trim()
    .slice(0, max);
}

function normalizeKey(rawKey: string, keyType?: string | null) {
  const key = (rawKey || "").trim();
  const type = (keyType || "").toLowerCase();
  if (type === "cpf" || type === "cnpj" || type === "celular" || type === "phone") {
    const digits = key.replace(/\D/g, "");
    if (type === "celular" || type === "phone") {
      // E.164 BR
      return digits.startsWith("55") ? `+${digits}` : `+55${digits}`;
    }
    return digits;
  }
  return key;
}

export function isValidBrCode(code: string | null | undefined): boolean {
  if (!code) return false;
  const trimmed = code.trim();
  return trimmed.startsWith("000201") && trimmed.length >= 50;
}

export function buildStaticBrCode(input: {
  pixKey: string;
  keyType?: string | null;
  receiverName?: string | null;
  city?: string | null;
  amount?: number;
  txid?: string;
}): string {
  const key = normalizeKey(input.pixKey, input.keyType);
  if (!key) return "";

  const merchantName = sanitize(input.receiverName || "RECEBEDOR", 25) || "RECEBEDOR";
  const merchantCity = sanitize(input.city || "BRASIL", 15) || "BRASIL";
  const txid = sanitize(input.txid || "***", 25) || "***";

  const merchantAccount = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  const additionalData = tlv("05", txid);

  let payload =
    tlv("00", "01") +
    tlv("26", merchantAccount) +
    tlv("52", "0000") +
    tlv("53", "986");

  if (input.amount && input.amount > 0) {
    payload += tlv("54", input.amount.toFixed(2));
  }

  payload +=
    tlv("58", "BR") +
    tlv("59", merchantName) +
    tlv("60", merchantCity) +
    tlv("62", additionalData);

  const toCrc = payload + "6304";
  return toCrc + crc16(toCrc);
}