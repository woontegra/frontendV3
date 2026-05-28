/** Statik SMMM oda listesi — admin toplu e-posta (segment: SMMM) */

export type SmmmChamber = {
  id: string;
  name: string;
  status: "ACTIVE";
  primaryEmail: string;
  secondaryEmail?: string | null;
  tertiaryEmail?: string | null;
  kepEmail?: string | null;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/** KEP sütunundaki adresler hariç; bu iki adres normal posta olarak sayılır */
export const SMMM_KEP_NORMAL_ALLOWLIST = new Set([
  "ozelkalem@ksmmmo.org.tr",
  "destek@trbsmmmo.org.tr",
]);

export function normalizeSmmmEmail(value: string | null | undefined): string | null {
  const v = String(value || "").trim().toLowerCase();
  return EMAIL_REGEX.test(v) ? v : null;
}

export function isKepOnlyEmail(email: string | null | undefined): boolean {
  const e = normalizeSmmmEmail(email);
  if (!e) return false;
  if (SMMM_KEP_NORMAL_ALLOWLIST.has(e)) return false;
  return e.endsWith(".kep.tr") || /@hs\d{2}\.kep\.tr$/i.test(e);
}

export function collectSmmmRecipientEmails(
  chamber: SmmmChamber,
  includeSecondary: boolean
): string[] {
  const emails = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const n = normalizeSmmmEmail(raw);
    if (!n || isKepOnlyEmail(n)) return;
    emails.add(n);
  };
  add(chamber.primaryEmail);
  if (includeSecondary) {
    add(chamber.secondaryEmail);
    add(chamber.tertiaryEmail);
  }
  return [...emails];
}

function chamber(
  name: string,
  primaryEmail: string,
  secondaryEmail?: string | null,
  tertiaryEmail?: string | null,
  kepEmail?: string | null
): SmmmChamber {
  const id = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return {
    id,
    name,
    status: "ACTIVE",
    primaryEmail,
    secondaryEmail: secondaryEmail ?? null,
    tertiaryEmail: tertiaryEmail ?? null,
    kepEmail: kepEmail ?? null,
  };
}

export const SMMM_CHAMBERS: SmmmChamber[] = [
  chamber("Adana SMMM Odası", "adanasmmmodasi@gmail.com"),
  chamber("Adıyaman SMMM Odası", "asmmmo002@hotmail.com"),
  chamber("Afyonkarahisar SMMM Odası", "bilgi@afyonkarahisarsmmmo.org.tr", "afyonsmmmo@windowslive.com"),
  chamber("Aksaray SMMM Odası", "aksmmmo68@gmail.com", "info@aksmmmo.org.tr"),
  chamber("Alanya SMMM Odası", "info@alsmo.org.tr"),
  chamber("Amasya SMMM Odası", "amasyasmmmodasi@gmail.com"),
  chamber("Ankara SMMM Odası", "asmmmo@asmmmo.org.tr"),
  chamber("Antalya SMMM Odası", "asmo@asmo.org.tr"),
  chamber("Artvin SMMM Odası", "semratahmaz@hotmail.com", "artvinsmmmo@hotmail.com"),
  chamber("Aydın SMMM Odası", "info@aydinsmmmo.org.tr"),
  chamber("Balıkesir SMMM Odası", "idari@blksmmmo.org.tr", "balikesirsmmmo@hotmail.com"),
  chamber("Batman SMMM Odası", "zekiasma@hotmail.com"),
  chamber("Bilecik SMMM Odası", "bilecik@bileciksmmmo.org.tr"),
  chamber("Bitlis SMMM Odası", "bitlis-mus-smmmo13@hotmail.com"),
  chamber("Burdur SMMM Odası", "burdursmmmo@hotmail.com"),
  chamber("Bursa SMMM Odası", "bsmmmo@bursa-smmmo.org.tr", "sosyalguvenlik@bursa-smmmo.org.tr"),
  chamber("Çanakkale SMMM Odası", "canakkale_smmmo@msn.com"),
  chamber("Çorum SMMM Odası", "info@corumsmmmo.org.tr"),
  chamber("Denizli SMMM Odası", "dsmmmo@denizlismmmo.org", "denizlismmmo@gmail.com"),
  chamber("Diyarbakır SMMM Odası", "diyarbakirsmmmodasi@gmail.com"),
  chamber("Düzce SMMM Odası", "bilgi@duzce.smmmo.org.tr", "idariisler@duzce.smmmo.org.tr"),
  chamber("Edirne SMMM Odası", "info@edirnesmmmo.org.tr", "esmmmo@gmail.com"),
  chamber("Elazığ SMMM Odası", "elazigsmmmo@hotmail.com"),
  chamber("Erzincan SMMM Odası", "erzincansmmmo@gmail.com"),
  chamber("Erzurum SMMM Odası", "bilgi@erzurumsmmmo.org.tr"),
  chamber("Eskişehir SMMM Odası", "esmmmo@esmmmo.org"),
  chamber("Gaziantep SMMM Odası", "info@gsmmmo.org.tr", "hukuk@gsmmmo.org.tr"),
  chamber("Giresun SMMM Odası", "info@giresunsmmmo.org.tr"),
  chamber("Gümüşhane SMMM Odası", "gumushanesmm@hotmail.com"),
  chamber("Hatay SMMM Odası", "info@hataysmmmo.org.tr"),
  chamber("Isparta SMMM Odası", "isparta@issmo.org.tr"),
  chamber("İzmir SMMM Odası", "info@izsmmmo.org.tr"),
  chamber("Kahramanmaraş SMMM Odası", "kmsmmmo@gmail.com"),
  chamber("Karabük SMMM Odası", "bilgi@karabuksmmmo.org", "karabuksmmmo@hotmail.com"),
  chamber("Karaman SMMM Odası", "karamansmmmo@msn.com", "karamansmmmo@hotmail.com.tr"),
  chamber("Kars SMMM Odası", "karssmmmo.turmob@hotmail.com"),
  chamber("Kastamonu SMMM Odası", "kastamonusmmmo@hotmail.com"),
  chamber("Kayseri SMMM Odası", "info@kayserismmmo.org.tr"),
  chamber("Kırklareli SMMM Odası", "ksmmmo@gmail.com"),
  chamber("Kırşehir SMMM Odası", "kirsehirsmmmo@hotmail.com"),
  chamber("Kocaeli SMMM Odası", "info@kocaelismmmo.org.tr"),
  chamber(
    "Konya SMMM Odası",
    "ksmmmo@ksmmmo.org.tr",
    "muhasebe@ksmmmo.org.tr",
    "ozelkalem@ksmmmo.org.tr"
  ),
  chamber("Malatya SMMM Odası", "bilgi@malatyasmmmo.org.tr"),
  chamber("Manisa SMMM Odası", "manisasmmmo45@hotmail.com"),
  chamber("Mardin SMMM Odası", "mardinsmmmo@hotmail.com", "info@mardinsmmmo.org"),
  chamber("Mersin SMMM Odası", "bilgi@mersinsmmmo.org.tr"),
  chamber("Muğla SMMM Odası", "msmmmo@msmmmo.org.tr"),
  chamber("Muş SMMM Odası", "mussmmo@outlook.com"),
  chamber("Nevşehir SMMM Odası", "info@nevsehirsmmmo.org.tr"),
  chamber("Ordu SMMM Odası", "ordu_smmmo@hotmail.com"),
  chamber("Osmaniye SMMM Odası", "osmmmo80@gmail.com"),
  chamber("Rize SMMM Odası", "rizesmmmo@rizesmmmo.org.tr"),
  chamber("Sakarya SMMM Odası", "bilgi@sakaryasmmmo.org.tr"),
  chamber("Samsun SMMM Odası", "smmmosamsun@gmail.com"),
  chamber("Sinop SMMM Odası", "sinopsmmmo@hotmail.com"),
  chamber("Sivas SMMM Odası", "sivassmmmo@gmail.com"),
  chamber("Şanlıurfa SMMM Odası", "smmmourfa@hotmail.com"),
  chamber("Tekirdağ SMMM Odası", "info@tekirdagsmmmo.org.tr"),
  chamber("Tokat SMMM Odası", "bilgi@tokatsmmmo.org.tr"),
  chamber("Trabzon SMMM Odası", "bilgi@trbsmmmo.org.tr", "destek@trbsmmmo.org.tr"),
  chamber("Uşak SMMM Odası", "bilgi@usaksmmmo.org.tr", "usaksmmmo@turmob.org.tr"),
  chamber("Van SMMM Odası", "vansmmmo@hotmail.com"),
  chamber("Yalova SMMM Odası", "info@yalovasmmmo.org"),
  chamber("Yozgat SMMM Odası", "yozgat_smmmo@hotmail.com"),
  chamber("Zonguldak SMMM Odası", "zsmmmo@zsmmmo.org.tr"),
].sort((a, b) => a.name.localeCompare(b.name, "tr"));

export const ACTIVE_SMMM_CHAMBERS = SMMM_CHAMBERS.filter((c) => c.status === "ACTIVE");
