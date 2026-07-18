export type RenewalPeriod = string | number;

export interface RenewalCampaign {
  name: string | null;
  startsAt: string | null;
  endsAt: string | null;
  discountAmount: number | null;
  discountPercent: number | null;
}

export interface RenewalOption {
  productType: string;
  period: RenewalPeriod;
  label: string;
  campaign: RenewalCampaign | null;
  normalPrice: number | null;
  discountAmount: number | null;
  discountPercent: number | null;
  finalAmount: number | null;
  currency: string;
}

export interface RenewalOptions {
  currentPackage: string | null;
  licenseEnd: string | null;
  remainingDays: number | null;
  linkedBaro: string | null;
  canRenew: boolean;
  normalPrice: number | null;
  discountAmount: number | null;
  discountPercent: number | null;
  finalAmount: number | null;
  currency: string;
  campaign: RenewalCampaign | null;
  options: RenewalOption[];
  message: string | null;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};

const firstValue = (source: UnknownRecord, keys: string[]): unknown => {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
};

const asString = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return null;
};

const asLabel = (value: unknown, keys: string[]): string | null =>
  asString(value) ?? asString(firstValue(asRecord(value), keys));

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const asBoolean = (value: unknown): boolean =>
  value === true || value === 1 || value === "1" || value === "true";

const unwrapPayload = (payload: unknown): UnknownRecord => {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  return Object.keys(data).length ? data : root;
};

const priceFields = (source: UnknownRecord) => {
  const pricing = asRecord(firstValue(source, ["pricing", "price", "amounts"]));
  const discount = asRecord(firstValue(pricing, ["discount", "campaignDiscount"]));
  const merged = { ...source, ...pricing, ...discount };
  return {
    normalPrice: asNumber(firstValue(merged, ["normalPrice", "listPrice", "regularPrice", "price"])),
    discountAmount: asNumber(firstValue(merged, ["discountAmount", "campaignDiscount", "discount", "amount"])),
    discountPercent: asNumber(firstValue(merged, ["discountPercent", "discountRate", "campaignDiscountPercent", "percent"])),
    finalAmount: asNumber(firstValue(merged, ["finalAmount", "finalPrice", "discountedPrice", "payableAmount"])),
    currency: asString(firstValue(merged, ["currency", "currencyCode"])) ?? "TRY",
  };
};

const campaignFromRecord = (
  source: UnknownRecord,
  fallbackPrices?: ReturnType<typeof priceFields>,
): RenewalCampaign | null => {
  const campaignSource = asRecord(
    firstValue(source, ["campaign", "activeCampaign", "renewalCampaign"]),
  );
  const activeValue = firstValue(campaignSource, ["active", "isActive", "valid"]);
  if (
    Object.keys(campaignSource).length === 0 ||
    (activeValue !== undefined && !asBoolean(activeValue))
  ) {
    return null;
  }
  const campaignPrices = priceFields(campaignSource);
  return {
    name: asString(firstValue(campaignSource, ["name", "title", "campaignName"])),
    startsAt: asString(firstValue(campaignSource, ["startsAt", "startDate", "validFrom"])),
    endsAt: asString(firstValue(campaignSource, ["endsAt", "endDate", "validUntil"])),
    discountAmount: campaignPrices.discountAmount ?? fallbackPrices?.discountAmount ?? null,
    discountPercent: campaignPrices.discountPercent ?? fallbackPrices?.discountPercent ?? null,
  };
};

const optionFromRecord = (
  value: unknown,
  inherited: UnknownRecord = {},
): RenewalOption | null => {
  const option = { ...inherited, ...asRecord(value) };
  const productType = asString(firstValue(option, ["productType", "packageType", "package", "product"]));
  const periodValue = firstValue(option, ["period", "periodCode", "duration", "periodMonths", "months", "value"]);
  const period =
    typeof periodValue === "number" || (typeof periodValue === "string" && periodValue.trim())
      ? periodValue
      : null;
  if (!productType || period === null) return null;

  const prices = priceFields(option);
  const suppliedLabel = asString(firstValue(option, ["label", "name", "displayName"]));
  return {
    productType,
    period,
    label: suppliedLabel ?? `${formatProductType(productType)} · ${formatPeriod(period)}`,
    campaign: campaignFromRecord(option, prices),
    ...prices,
  };
};

const normalizeOptions = (source: UnknownRecord): RenewalOption[] => {
  const rawOptions = firstValue(source, [
    "options",
    "renewalOptions",
    "allowedOptions",
    "packageOptions",
    "allowedPackagePeriodOptions",
    "allowedPackages",
    "products",
  ]);
  const options: RenewalOption[] = [];

  if (Array.isArray(rawOptions)) {
    for (const rawOption of rawOptions) {
      const record = asRecord(rawOption);
      const periods = firstValue(record, ["periods", "allowedPeriods", "durations"]);
      if (Array.isArray(periods)) {
        for (const period of periods) {
          const periodRecord =
            typeof period === "object" && period !== null ? asRecord(period) : { period };
          const option = optionFromRecord(periodRecord, record);
          if (option) options.push(option);
        }
      } else {
        const option = optionFromRecord(record);
        if (option) options.push(option);
      }
    }
  }

  if (!options.length) {
    const productTypes = firstValue(source, ["allowedProductTypes", "productTypes"]);
    const periods = firstValue(source, ["allowedPeriods", "periods"]);
    if (Array.isArray(productTypes) && Array.isArray(periods)) {
      for (const productType of productTypes) {
        for (const period of periods) {
          const option = optionFromRecord({ productType, period });
          if (option) options.push(option);
        }
      }
    }
  }

  return options.filter(
    (option, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.productType === option.productType &&
          String(candidate.period) === String(option.period),
      ) === index,
  );
};

export function normalizeRenewalOptions(payload: unknown): RenewalOptions {
  const source = unwrapPayload(payload);
  const license = asRecord(firstValue(source, ["license", "subscription", "currentSubscription"]));
  const current = asRecord(firstValue(source, ["current", "currentPackage", "currentLicense"]));
  const prices = priceFields(source);

  return {
    currentPackage:
      asLabel(firstValue(source, ["currentPackage", "package", "packageName", "productType"]), [
        "productType",
        "subscriptionType",
        "package",
        "name",
      ]) ??
      asString(firstValue(current, ["productType", "subscriptionType", "package", "name"])) ??
      asString(firstValue(license, ["productType", "subscriptionType", "package", "name"])),
    licenseEnd: asString(
      firstValue(source, ["licenseEnd", "licenseEndsAt", "subscriptionEndsAt", "endsAt", "endDate"]) ??
        firstValue(current, ["endsAt", "endDate", "subscriptionEndsAt", "licenseEnd"]) ??
        firstValue(license, ["endsAt", "endDate", "subscriptionEndsAt"]),
    ),
    remainingDays: asNumber(
      firstValue(source, ["remainingDays", "daysRemaining", "licenseRemainingDays"]) ??
        firstValue(current, ["remainingDays", "daysRemaining"]) ??
        firstValue(license, ["remainingDays", "daysRemaining"]),
    ),
    linkedBaro:
      asLabel(firstValue(source, ["linkedBaro", "baro", "barAssociation", "baroName"]), [
        "name",
        "title",
        "baroName",
      ]) ??
      asLabel(firstValue(current, ["linkedBaro", "baro", "baroName"]), [
        "name",
        "title",
        "baroName",
      ]) ??
      asLabel(firstValue(asRecord(source.user), ["baro", "baroName"]), [
        "name",
        "title",
        "baroName",
      ]),
    canRenew: asBoolean(firstValue(source, ["canRenew", "renewalAllowed", "isRenewable"])),
    ...prices,
    campaign: campaignFromRecord(source, prices),
    options: normalizeOptions(source),
    message: asString(firstValue(source, ["message", "renewalMessage", "reason"])),
  };
}

export function parseRenewalRedirect(payload: unknown): string {
  const source = unwrapPayload(payload);
  const checkout = asRecord(firstValue(source, ["checkout", "redirect", "payment"]));
  const redirectUrl = asString(
    firstValue(source, ["redirectUrl", "redirectURL", "url"]) ??
      firstValue(checkout, ["redirectUrl", "redirectURL", "url"]),
  );
  if (!redirectUrl) throw new Error("Satın alma yönlendirme adresi alınamadı.");

  const url = new URL(redirectUrl);
  const allowedHosts = new Set(["bilirkisihesap.com", "www.bilirkisihesap.com"]);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname) || url.pathname !== "/satin-al") {
    throw new Error("Geçersiz satın alma yönlendirme adresi.");
  }
  if (!url.searchParams.get("renew")) {
    throw new Error("Yenileme anahtarı alınamadı.");
  }
  return url.toString();
}

export function getOptionPricing(data: RenewalOptions, option: RenewalOption | null) {
  return {
    normalPrice: option?.normalPrice ?? data.normalPrice,
    discountAmount: option?.discountAmount ?? data.discountAmount,
    discountPercent: option?.discountPercent ?? data.discountPercent,
    finalAmount: option?.finalAmount ?? data.finalAmount,
    currency: option?.currency ?? data.currency,
  };
}

export function formatProductType(productType: string): string {
  const labels: Record<string, string> = {
    starter: "Starter",
    professional: "Professional",
    premium: "Professional",
    annual: "Yıllık Standart",
    monthly: "Aylık Standart",
    trial: "Deneme",
    demo: "Demo",
  };
  return labels[productType.toLowerCase()] ?? productType;
}

export function formatPeriod(period: RenewalPeriod): string {
  if (typeof period === "number" || /^\d+$/.test(String(period))) {
    const months = Number(period);
    return months === 12 ? "1 yıl" : `${months} ay`;
  }
  const labels: Record<string, string> = {
    monthly: "Aylık",
    annual: "Yıllık",
    yearly: "Yıllık",
    "1_year": "1 yıl",
    "6_months": "6 ay",
    "12_months": "1 yıl",
  };
  return labels[String(period).toLowerCase()] ?? String(period);
}
