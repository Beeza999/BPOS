const SOUND_KEY = "bipos_voice_enabled";

let unlocked = false;
let audioContext = null;
let speaking = false;
let pendingSpeechText = null;

function hasWindow() {
  return typeof window !== "undefined";
}

function getNavigatorValue(key) {
  if (!hasWindow()) return "";
  return String(navigator?.[key] || "");
}

function getAudioContext() {
  if (!hasWindow()) return null;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

function isIosLikeDevice() {
  if (!hasWindow()) return false;

  const ua = getNavigatorValue("userAgent");
  const platform = getNavigatorValue("platform");
  const vendor = getNavigatorValue("vendor");
  const touchPoints = Number(navigator.maxTouchPoints || 0);

  return Boolean(
    /iPad|iPhone|iPod/i.test(ua) ||
      (/Macintosh|Mac OS X/i.test(ua) && touchPoints > 1) ||
      (platform === "MacIntel" && touchPoints > 1) ||
      (/Apple/i.test(vendor) && touchPoints > 1 && !/Android/i.test(ua))
  );
}

function isMobileLikeDevice() {
  if (!hasWindow()) return false;

  const ua = getNavigatorValue("userAgent");
  const platform = getNavigatorValue("platform");
  const userAgentDataMobile = Boolean(navigator.userAgentData?.mobile);
  const touchPoints = Number(navigator.maxTouchPoints || 0);
  const isCoarsePointer = Boolean(
    window.matchMedia && window.matchMedia("(pointer: coarse)").matches
  );

  const isPhoneOrTabletUa =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Silk|Kindle|PlayBook/i.test(ua);

  const isIpadDesktopMode =
    (/Macintosh|Mac OS X/i.test(ua) || platform === "MacIntel") && touchPoints > 1;

  const screenMax = Math.max(
    Number(window.screen?.width || 0),
    Number(window.screen?.height || 0)
  );
  const looksLikeTablet = isCoarsePointer && touchPoints > 0 && screenMax > 0 && screenMax <= 1600;

  return Boolean(
    userAgentDataMobile ||
      isPhoneOrTabletUa ||
      isIpadDesktopMode ||
      looksLikeTablet
  );
}

export function shouldUseEnglishVoice() {
  // บังคับมือถือ / iPhone / iPad / Android ใช้ข้อความอังกฤษเสมอ
  return isMobileLikeDevice() || isIosLikeDevice();
}

function getVoicesNow() {
  if (!hasWindow() || !window.speechSynthesis) return [];

  try {
    return window.speechSynthesis.getVoices() || [];
  } catch {
    return [];
  }
}

function voicePreferences() {
  if (shouldUseEnglishVoice()) {
    return ["en-US", "en-GB", "en-AU", "en-CA", "en-IN", "en"];
  }

  return ["lo-LA", "lo", "th-TH", "th", "en-US", "en"];
}

function getBestVoiceNow() {
  const voices = getVoicesNow();
  const preferences = voicePreferences().map((lang) => lang.toLowerCase());

  for (const lang of preferences) {
    const exact = voices.find((voice) => String(voice.lang || "").toLowerCase() === lang);
    if (exact) return exact;
  }

  for (const lang of preferences) {
    const prefix = lang.split("-")[0];
    const partial = voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith(prefix));
    if (partial) return partial;
  }

  if (shouldUseEnglishVoice()) {
    const english = voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith("en"));
    if (english) return english;
  }

  return null;
}

function normalizeSpeechText(text) {
  if (text && typeof text === "object") {
    return shouldUseEnglishVoice()
      ? String(text.en || text.lo || "")
      : String(text.lo || text.en || "");
  }

  return String(text || "");
}

function resumeAudioContextNow() {
  try {
    const context = getAudioContext();
    if (context && context.state === "suspended") {
      context.resume().catch((error) => console.warn("AudioContext resume failed:", error));
    }
  } catch (error) {
    console.warn("AudioContext unlock failed:", error);
  }
}

function resumeSpeechNow() {
  if (!hasWindow() || !window.speechSynthesis) return;

  try {
    window.speechSynthesis.resume();
  } catch {
    // Safari บางเวอร์ชัน throw ได้ ปล่อยผ่าน
  }
}

function startIosSpeechKeepAlive(utterance, maxMs = 7000) {
  if (!isIosLikeDevice() || !hasWindow() || !window.speechSynthesis) return () => {};

  const startedAt = Date.now();
  const timer = window.setInterval(() => {
    if (Date.now() - startedAt > maxMs) {
      window.clearInterval(timer);
      return;
    }
    resumeSpeechNow();
  }, 250);

  const stop = () => window.clearInterval(timer);
  utterance.addEventListener?.("end", stop);
  utterance.addEventListener?.("error", stop);
  return stop;
}

function speakDirect(text, options = {}) {
  const speechText = normalizeSpeechText(text).trim();

  return new Promise((resolve, reject) => {
    if (!speechText || !hasWindow() || !window.speechSynthesis) {
      reject(new Error("Speech synthesis not supported"));
      return;
    }

    try {
      const useEnglish = shouldUseEnglishVoice();
      const utterance = new SpeechSynthesisUtterance(speechText);
      const voice = getBestVoiceNow();

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || (useEnglish ? "en-US" : "lo-LA");
      } else {
        utterance.lang = useEnglish ? "en-US" : "lo-LA";
      }

      utterance.rate = useEnglish ? 0.82 : 0.82;
      utterance.pitch = 1;
      utterance.volume = typeof options.volume === "number" ? options.volume : 1;

      let finished = false;
      let stopKeepAlive = () => {};

      const done = (ok, error) => {
        if (finished) return;
        finished = true;
        stopKeepAlive();
        if (ok) resolve(true);
        else reject(error || new Error("Speak failed"));
      };

      const timeout = window.setTimeout(() => done(true), options.timeoutMs || 9000);

      utterance.onend = () => {
        window.clearTimeout(timeout);
        done(true);
      };

      utterance.onerror = (event) => {
        window.clearTimeout(timeout);
        done(false, new Error(event?.error || "Speak failed"));
      };

      resumeSpeechNow();

      if (options.cancel !== false) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }

      // iOS สำคัญมาก: speak ต้องถูกเรียกทันทีจาก event แตะปุ่ม ไม่ผ่าน await ก่อน
      window.speechSynthesis.speak(utterance);
      resumeSpeechNow();
      stopKeepAlive = startIosSpeechKeepAlive(utterance, options.timeoutMs || 9000);
    } catch (error) {
      reject(error);
    }
  });
}

function playTone({ frequency = 880, duration = 0.16, delay = 0, volume = 0.22 } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const context = getAudioContext();

      if (!context) {
        if (navigator.vibrate) navigator.vibrate(120);
        resolve(true);
        return;
      }

      if (context.state === "suspended") {
        context.resume().catch(() => null);
      }

      const startAt = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startAt);

      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(volume, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.04);

      oscillator.onended = () => resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

async function playNotifyBell() {
  try {
    resumeAudioContextNow();
    await playTone({ frequency: 880, duration: 0.15, delay: 0 });
    await playTone({ frequency: 1175, duration: 0.17, delay: 0.15 });
    return true;
  } catch (error) {
    console.warn("Bell failed:", error);
    return false;
  }
}

export async function enableNotifySound() {
  if (!hasWindow()) return false;

  unlocked = true;
  localStorage.setItem(SOUND_KEY, "1");

  // ต้องทำทันทีในจังหวะที่ผู้ใช้แตะปุ่ม โดยเฉพาะ iPhone/iPad
  resumeAudioContextNow();
  resumeSpeechNow();

  speakDirect({
    lo: "ເປີດສຽງແຈ້ງເຕືອນແລ້ວ",
    en: "Notification sound enabled",
  }).catch((error) => console.warn("iOS speech unlock failed:", error));

  // ให้เสียง bell ตามหลังนิดหน่อย ไม่แย่งจังหวะ speech unlock ของ iOS
  window.setTimeout(() => {
    playNotifyBell().catch((error) => console.warn("Bell test failed:", error));
  }, isIosLikeDevice() ? 450 : 80);

  return true;
}

export function isNotifySoundEnabled() {
  return unlocked;
}

export function hasSavedNotifySoundPreference() {
  return hasWindow() && localStorage.getItem(SOUND_KEY) === "1";
}

async function speakQueued(text) {
  pendingSpeechText = text;

  if (speaking) return true;

  speaking = true;

  try {
    while (pendingSpeechText) {
      const nextText = pendingSpeechText;
      pendingSpeechText = null;

      await speakDirect(nextText).catch((error) => {
        console.warn("Voice notification failed:", error);
        return false;
      });
    }
  } finally {
    speaking = false;
  }

  return true;
}

export async function speakNotify(text) {
  if (!unlocked) return false;

  // Bell ช่วยให้ iOS มีเสียงแจ้งเตือนแน่นอน แม้ speechSynthesis บางเครื่องจะเงียบ
  playNotifyBell().catch((error) => console.warn("Bell notification failed:", error));

  await speakQueued(text);
  return true;
}

function getTableName(payload) {
  return (
    payload?.table?.name ||
    payload?.tableName ||
    payload?.table ||
    payload?.tableToken ||
    payload?.order?.table?.name ||
    payload?.bill?.table?.name ||
    payload?.ticket?.order?.table?.name ||
    "-"
  );
}

const TABLE_VOICE_OVERRIDES = {
  A1: "ເອ ໜຶ່ງ",
  A2: "ເອ ສອງ",
  A3: "ເອ ສາມ",
  A4: "ເອ ສີ່",
  A5: "ເອ ຫ້າ",
  A6: "ເອ ຫົກ",
  A7: "ເອ ເຈັດ",
  A8: "ເອ ແປດ",
  A9: "ເອ ເກົ້າ",
  A10: "ເອ ສິບ",

  B1: "ບີ ໜຶ່ງ",
  B2: "ບີ ສອງ",
  B3: "ບີ ສາມ",
  B4: "ບີ ສີ່",
  B5: "ບີ ຫ້າ",
  B6: "ບີ ຫົກ",
  B7: "ບີ ເຈັດ",
  B8: "ບີ ແປດ",
  B9: "ບີ ເກົ້າ",
  B10: "ບີ ສິບ",

  C1: "ຊີ ໜຶ່ງ",
  C2: "ຊີ ສອງ",
  C3: "ຊີ ສາມ",
  C4: "ຊີ ສີ່",
  C5: "ຊີ ຫ້າ",
  C6: "ຊີ ຫົກ",
  C7: "ຊີ ເຈັດ",
  C8: "ຊີ ແປດ",
  C9: "ຊີ ເກົ້າ",
  C10: "ຊີ ສິບ",

  VIP1: "ວີ ໄອ ພີ ໜຶ່ງ",
  VIP2: "ວີ ໄອ ພີ ສອງ",
  VIP3: "ວີ ໄອ ພີ ສາມ",
};

const TABLE_VOICE_OVERRIDES_EN = {
  A1: "A one",
  A2: "A two",
  A3: "A three",
  A4: "A four",
  A5: "A five",
  A6: "A six",
  A7: "A seven",
  A8: "A eight",
  A9: "A nine",
  A10: "A ten",
  B1: "B one",
  B2: "B two",
  B3: "B three",
  B4: "B four",
  B5: "B five",
  B6: "B six",
  B7: "B seven",
  B8: "B eight",
  B9: "B nine",
  B10: "B ten",
  C1: "C one",
  C2: "C two",
  C3: "C three",
  C4: "C four",
  C5: "C five",
  C6: "C six",
  C7: "C seven",
  C8: "C eight",
  C9: "C nine",
  C10: "C ten",
  VIP1: "V I P one",
  VIP2: "V I P two",
  VIP3: "V I P three",
};

const LETTER_VOICE = {
  A: "ເອ",
  B: "ບີ",
  C: "ຊີ",
  D: "ດີ",
  E: "ອີ",
  F: "ເອັຟ",
  G: "ຈີ",
  H: "ເອດ",
  I: "ໄອ",
  J: "ເຈ",
  K: "ເຄ",
  L: "ແອວ",
  M: "ເອັມ",
  N: "ເອັນ",
  O: "ໂອ",
  P: "ພີ",
  Q: "ຄິວ",
  R: "ອາ",
  S: "ເອັດ",
  T: "ທີ",
  U: "ຢູ",
  V: "ວີ",
  W: "ດັບເບິນຢູ",
  X: "ເອັກ",
  Y: "ວາຍ",
  Z: "ແຊດ",
};

const DIGIT_VOICE = {
  0: "ສູນ",
  1: "ໜຶ່ງ",
  2: "ສອງ",
  3: "ສາມ",
  4: "ສີ່",
  5: "ຫ້າ",
  6: "ຫົກ",
  7: "ເຈັດ",
  8: "ແປດ",
  9: "ເກົ້າ",
};

const DIGIT_VOICE_EN = {
  0: "zero",
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
};

const SMALL_NUMBER_EN = {
  0: "zero",
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
  11: "eleven",
  12: "twelve",
  13: "thirteen",
  14: "fourteen",
  15: "fifteen",
  16: "sixteen",
  17: "seventeen",
  18: "eighteen",
  19: "nineteen",
  20: "twenty",
};

function numberVoice(value) {
  const number = Number.parseInt(String(value || "0"), 10);

  if (!Number.isFinite(number)) {
    return String(value || "")
      .split("")
      .map((char) => DIGIT_VOICE[char] || char)
      .join(" ");
  }

  if (number < 10) return DIGIT_VOICE[number] || String(number);
  if (number === 10) return "ສິບ";
  if (number === 20) return "ຊາວ";

  if (number > 10 && number < 20) {
    const ones = number % 10;
    return ones === 1 ? "ສິບ ເອັດ" : `ສິບ ${DIGIT_VOICE[ones]}`;
  }

  if (number > 20 && number < 100) {
    const tens = Math.floor(number / 10);
    const ones = number % 10;
    const tensText = tens === 2 ? "ຊາວ" : `${DIGIT_VOICE[tens]} ສິບ`;

    if (ones === 0) return tensText;
    if (ones === 1) return `${tensText} ເອັດ`;
    return `${tensText} ${DIGIT_VOICE[ones]}`;
  }

  return String(number)
    .split("")
    .map((char) => DIGIT_VOICE[char] || char)
    .join(" ");
}

function numberVoiceEn(value) {
  const number = Number.parseInt(String(value || "0"), 10);

  if (!Number.isFinite(number)) {
    return String(value || "")
      .split("")
      .map((char) => DIGIT_VOICE_EN[char] || char)
      .join(" ");
  }

  if (SMALL_NUMBER_EN[number]) return SMALL_NUMBER_EN[number];

  if (number > 20 && number < 100) {
    const tensNames = {
      2: "twenty",
      3: "thirty",
      4: "forty",
      5: "fifty",
      6: "sixty",
      7: "seventy",
      8: "eighty",
      9: "ninety",
    };
    const tens = Math.floor(number / 10);
    const ones = number % 10;
    return ones ? `${tensNames[tens]} ${DIGIT_VOICE_EN[ones]}` : tensNames[tens];
  }

  return String(number)
    .split("")
    .map((char) => DIGIT_VOICE_EN[char] || char)
    .join(" ");
}

function cleanTableName(tableName) {
  return String(tableName || "-")
    .trim()
    .replace(/^ໂຕະ\s*/i, "")
    .replace(/^โต๊ะ\s*/i, "")
    .replace(/^table\s*/i, "")
    .replace(/[\s_-]+/g, "")
    .toUpperCase();
}

function tableVoiceName(tableName) {
  const raw = String(tableName || "-").trim();
  if (!raw || raw === "-") return "-";

  const clean = cleanTableName(raw);
  if (!clean) return raw;

  if (TABLE_VOICE_OVERRIDES[clean]) return TABLE_VOICE_OVERRIDES[clean];

  const match = clean.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    const letters = match[1]
      .split("")
      .map((char) => LETTER_VOICE[char] || char)
      .join(" ");
    const numbers = numberVoice(match[2]);
    return `${letters} ${numbers}`;
  }

  if (/^\d+$/.test(clean)) return numberVoice(clean);

  return clean
    .split("")
    .map((char) => {
      if (LETTER_VOICE[char]) return LETTER_VOICE[char];
      if (DIGIT_VOICE[char]) return DIGIT_VOICE[char];
      return char;
    })
    .join(" ");
}

function tableVoiceNameEn(tableName) {
  const raw = String(tableName || "-").trim();
  if (!raw || raw === "-") return "unknown";

  const clean = cleanTableName(raw);
  if (!clean) return raw;

  if (TABLE_VOICE_OVERRIDES_EN[clean]) return TABLE_VOICE_OVERRIDES_EN[clean];

  const match = clean.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    const letters = match[1].split("").join(" ");
    const numbers = numberVoiceEn(match[2]);
    return `${letters} ${numbers}`;
  }

  if (/^\d+$/.test(clean)) return numberVoiceEn(clean);

  return clean
    .split("")
    .map((char) => {
      if (/[A-Z]/.test(char)) return char;
      if (DIGIT_VOICE_EN[char]) return DIGIT_VOICE_EN[char];
      return char;
    })
    .join(" ");
}

function getTableVoiceName(payload) {
  const tableName = getTableName(payload);
  return shouldUseEnglishVoice() ? tableVoiceNameEn(tableName) : tableVoiceName(tableName);
}

function getItems(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.orderItems)) return payload.orderItems;
  if (Array.isArray(payload?.order?.items)) return payload.order.items;
  if (Array.isArray(payload?.ticket?.items)) return payload.ticket.items;

  if (payload?.name || payload?.menuName || payload?.menuItem?.name || payload?.item?.name) {
    return [payload];
  }

  return [];
}

function getItemName(item) {
  return (
    item?.menuItem?.name ||
    item?.menu?.name ||
    item?.item?.name ||
    item?.name ||
    item?.menuName ||
    "ເມນູ"
  );
}

function getItemQty(item) {
  return Number(item?.quantity || item?.qty || 1);
}

function normalizeMenuKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.,/()]+/g, "")
    .replace(/ໍ/g, "")
    .replace(/ຫມ/g, "ໝ")
    .replace(/หม/g, "หม");
}

function getCustomMenuVoice(item, lang) {
  if (!item || typeof item !== "object") return "";

  const sources = [
    item,
    item.menuItem,
    item.menu,
    item.item,
  ].filter(Boolean);

  for (const source of sources) {
    const value =
      lang === "en"
        ? source.voiceEn ||
          source.voiceEnglish ||
          source.speechEn ||
          source.nameEn ||
          source.englishName ||
          source.enName
        : source.voiceLo ||
          source.voiceLao ||
          source.speechLo ||
          source.laoName;

    if (value) return String(value).trim();
  }

  return "";
}

const MENU_VOICE_OVERRIDES = {
  // ข้าว / rice
  "ເຂົ້າຜັດ": { lo: "ເຂົ້າ ຜັດ", en: "fried rice" },
  "ເຂົ້າຜັດໄກ່": { lo: "ເຂົ້າ ຜັດ ໄກ່", en: "chicken fried rice" },
  "ເຂົ້າຜັດຫມູ": { lo: "ເຂົ້າ ຜັດ ໝູ", en: "pork fried rice" },
  "ເຂົ້າຜັດໝູ": { lo: "ເຂົ້າ ຜັດ ໝູ", en: "pork fried rice" },
  "ເຂົ້າຜັດເນື້ອ": { lo: "ເຂົ້າ ຜັດ ເນື້ອ", en: "beef fried rice" },
  "ເຂົ້າຜັດກຸ້ງ": { lo: "ເຂົ້າ ຜັດ ກຸ້ງ", en: "shrimp fried rice" },
  "ເຂົ້າຜັດທະເລ": { lo: "ເຂົ້າ ຜັດ ທະ ເລ", en: "seafood fried rice" },
  "ເຂົ້າຜັດໄຂ່": { lo: "ເຂົ້າ ຜັດ ໄຂ່", en: "egg fried rice" },
  "ເຂົ້າໄຂ່ຈຽວ": { lo: "ເຂົ້າ ໄຂ່ ຈຽວ", en: "rice with omelet" },
  "ໄຂ່ຈຽວ": { lo: "ໄຂ່ ຈຽວ", en: "omelet" },
  "ໄຂ່ດາວ": { lo: "ໄຂ່ ດາວ", en: "fried egg" },

  // กะเพรา / basil
  // เมนูรวมที่เจอบ่อย ให้ iPhone/iPad อ่านชัด ไม่อ่านภาษาลาวปนอังกฤษ
  "ເຂົ້າກະເພົາໄກ່ໄຂ່ດາວ": { lo: "ເຂົ້າ ກະ ເພົາ ໄກ່ ໄຂ່ ດາວ", en: "chicken basil rice with fried egg" },
  "ເຂົ້າກະເພົາໝູໄຂ່ດາວ": { lo: "ເຂົ້າ ກະ ເພົາ ໝູ ໄຂ່ ດາວ", en: "pork basil rice with fried egg" },
  "ເຂົ້າກະເພົາຫມູໄຂ່ດາວ": { lo: "ເຂົ້າ ກະ ເພົາ ໝູ ໄຂ່ ດາວ", en: "pork basil rice with fried egg" },
  "ເຂົ້າກະເພົາເນື້ອໄຂ່ດາວ": { lo: "ເຂົ້າ ກະ ເພົາ ເນື້ອ ໄຂ່ ດາວ", en: "beef basil rice with fried egg" },

  "ເຂົ້າກະເພົາໄກ່": { lo: "ເຂົ້າ ກະ ເພົາ ໄກ່", en: "rice with chicken basil" },
  "ເຂົ້າກະເພົາໝູ": { lo: "ເຂົ້າ ກະ ເພົາ ໝູ", en: "rice with pork basil" },
  "ເຂົ້າກະເພົາຫມູ": { lo: "ເຂົ້າ ກະ ເພົາ ໝູ", en: "rice with pork basil" },
  "ເຂົ້າກະເພົາເນື້ອ": { lo: "ເຂົ້າ ກະ ເພົາ ເນື້ອ", en: "rice with beef basil" },
  "ຜັດກະເພົາໄກ່": { lo: "ຜັດ ກະ ເພົາ ໄກ່", en: "chicken basil stir fry" },
  "ຜັດກະເພົາໝູ": { lo: "ຜັດ ກະ ເພົາ ໝູ", en: "pork basil stir fry" },
  "ຜັດກະເພົາຫມູ": { lo: "ຜັດ ກະ ເພົາ ໝູ", en: "pork basil stir fry" },
  "ຜັດກະເພົາເນື້ອ": { lo: "ຜັດ ກະ ເພົາ ເນື້ອ", en: "beef basil stir fry" },

  // Noodles / soup
  "ເຝີ": { lo: "ເຝີ", en: "noodle soup" },
  "ເຝີໄກ່": { lo: "ເຝີ ໄກ່", en: "chicken noodle soup" },
  "ເຝີໝູ": { lo: "ເຝີ ໝູ", en: "pork noodle soup" },
  "ເຝີຫມູ": { lo: "ເຝີ ໝູ", en: "pork noodle soup" },
  "ເຝີເນື້ອ": { lo: "ເຝີ ເນື້ອ", en: "beef noodle soup" },
  "ກ້ວຍຕຽວ": { lo: "ກ້ວຍ ຕຽວ", en: "noodle soup" },
  "ກ້ວຍຕຽວໄກ່": { lo: "ກ້ວຍ ຕຽວ ໄກ່", en: "chicken noodle soup" },
  "ກ້ວຍຕຽວໝູ": { lo: "ກ້ວຍ ຕຽວ ໝູ", en: "pork noodle soup" },
  "ກ້ວຍຕຽວຫມູ": { lo: "ກ້ວຍ ຕຽວ ໝູ", en: "pork noodle soup" },
  "ກ້ວຍຕຽວເນື້ອ": { lo: "ກ້ວຍ ຕຽວ ເນື້ອ", en: "beef noodle soup" },
  "ຜັດຊີອິ້ວ": { lo: "ຜັດ ຊີ ອິ້ວ", en: "stir fried soy sauce noodles" },
  "ຜັດໄທ": { lo: "ຜັດ ໄທ", en: "pad thai" },

  // Lao / Thai dishes
  "ຕຳໝາກຫຸ່ງ": { lo: "ຕຳ ໝາກ ຫຸ່ງ", en: "papaya salad" },
  "ຕຳຫມາກຫຸ່ງ": { lo: "ຕຳ ໝາກ ຫຸ່ງ", en: "papaya salad" },
  "ຕຳລາວ": { lo: "ຕຳ ລາວ", en: "lao papaya salad" },
  "ຕຳໄທ": { lo: "ຕຳ ໄທ", en: "thai papaya salad" },
  "ລາບໄກ່": { lo: "ລາບ ໄກ່", en: "chicken larb" },
  "ລາບໝູ": { lo: "ລາບ ໝູ", en: "pork larb" },
  "ລາບຫມູ": { lo: "ລາບ ໝູ", en: "pork larb" },
  "ລາບເນື້ອ": { lo: "ລາບ ເນື້ອ", en: "beef larb" },
  "ລາບປາ": { lo: "ລາບ ປາ", en: "fish larb" },
  "ຕົ້ມຍຳກຸ້ງ": { lo: "ຕົ້ມ ຍຳ ກຸ້ງ", en: "tom yum shrimp soup" },
  "ຕົ້ມແຊບ": { lo: "ຕົ້ມ ແຊບ", en: "spicy soup" },
  "ແກງຈືດ": { lo: "ແກງ ຈືດ", en: "clear soup" },
  "ປີ້ງໄກ່": { lo: "ປີ້ງ ໄກ່", en: "grilled chicken" },
  "ໄກ່ທອດ": { lo: "ໄກ່ ທອດ", en: "fried chicken" },
  "ໝູທອດ": { lo: "ໝູ ທອດ", en: "fried pork" },
  "ຫມູທອດ": { lo: "ໝູ ທອດ", en: "fried pork" },
  "ເນື້ອທອດ": { lo: "ເນື້ອ ທອດ", en: "fried beef" },

  // Drinks
  "ນ້ຳເປົ່າ": { lo: "ນ້ຳ ເປົ່າ", en: "water" },
  "ນໍ້າເປົ່າ": { lo: "ນ້ຳ ເປົ່າ", en: "water" },
  "ນ້ຳດື່ມ": { lo: "ນ້ຳ ດື່ມ", en: "water" },
  "ນ້ຳສົ້ມ": { lo: "ນ້ຳ ສົ້ມ", en: "orange juice" },
  "ນໍ້າສົ້ມ": { lo: "ນ້ຳ ສົ້ມ", en: "orange juice" },
  "ນ້ຳຫວານ": { lo: "ນ້ຳ ຫວານ", en: "sweet drink" },
  "ນ້ຳກ້ອນ": { lo: "ນ້ຳ ກ້ອນ", en: "ice" },
  "ນ້ຳໝາກນາວ": { lo: "ນ້ຳ ໝາກ ນາວ", en: "lime juice" },
  "ນໍ້າໝາກນາວ": { lo: "ນ້ຳ ໝາກ ນາວ", en: "lime juice" },
  "ນ້ຳຫມາກນາວ": { lo: "ນ້ຳ ໝາກ ນາວ", en: "lime juice" },
  "ນໍ້າຫມາກນາວ": { lo: "ນ້ຳ ໝາກ ນາວ", en: "lime juice" },
  "ກາເຟ": { lo: "ກາ ເຟ", en: "coffee" },
  "ກາເຟເຢັນ": { lo: "ກາ ເຟ ເຢັນ", en: "iced coffee" },
  "ຊາເຢັນ": { lo: "ຊາ ເຢັນ", en: "iced tea" },
  "ຊາຂຽວ": { lo: "ຊາ ຂຽວ", en: "green tea" },
  "ໂຄກ": { lo: "ໂຄກ", en: "coke" },
  "ເປບຊີ": { lo: "ເປບ ຊີ", en: "pepsi" },
  "ສະໄປ": { lo: "ສະ ໄປ", en: "sprite" },
  "ເຄັກຊັອກໂກແລັດ": { lo: "ເຄັກ ຊັອກ ໂກ ແລັດ", en: "chocolate cake" },
  "ໄອສະກຣີມ": { lo: "ໄອ ສະ ກຣີມ", en: "ice cream" },
};

const MENU_WORD_EN = [
  [/(ເຂົ້າ|ข้าว)/g, "rice"],
  [/(ກະເພົາ|ກະເພາະ|กะเพรา|กระเพรา)/g, "basil"],
  [/(ຜັດ|ผัด)/g, "fried"],
  [/(ໄກ່|ไก่)/g, "chicken"],
  [/(ໝູ|ຫມູ|หมู)/g, "pork"],
  [/(ເນື້ອ|เนื้อ)/g, "beef"],
  [/(ກຸ້ງ|กุ้ง)/g, "shrimp"],
  [/(ປາ|ปลา)/g, "fish"],
  [/(ໄຂ່ດາວ|ไข่ดาว)/g, "fried egg"],
  [/(ໄຂ່ຈຽວ|ไข่เจียว)/g, "omelet"],
  [/(ໄຂ່|ไข่)/g, "egg"],
  [/(ຕຳ|ตำ)/g, "papaya salad"],
  [/(ໝາກຫຸ່ງ|ຫມາກຫຸ່ງ|มะละกอ)/g, "papaya"],
  [/(ລາບ|ลาบ)/g, "larb"],
  [/(ເຝີ|ກ້ວຍຕຽວ|ก๋วยเตี๋ยว|ก้วยเตี๋ยว)/g, "noodle soup"],
  [/(ນ້ຳ|ນໍ້າ|น้ำ)/g, "drink"],
  [/(ໝາກນາວ|ຫມາກນາວ|มะนาว)/g, "lime"],
  [/(ສົ້ມ|ส้ม)/g, "orange"],
  [/(ກາເຟ|กาแฟ)/g, "coffee"],
  [/(ຊາ|ชา)/g, "tea"],
  [/(ເຢັນ|เย็น)/g, "iced"],
  [/(ທອດ|ทอด)/g, "fried"],
  [/(ປີ້ງ|ย่าง|ปิ้ง)/g, "grilled"],
  [/(ເຄັກ|เค้ก)/g, "cake"],
  [/(ຊັອກໂກແລັດ|ช็อกโกแลต)/g, "chocolate"],
  [/(ໄອສະກຣີມ|ไอศกรีม|ไอติม)/g, "ice cream"],
];

const MENU_WORD_LO = [
  [/(ເຂົ້າ)/g, "ເຂົ້າ "],
  [/(ຜັດ)/g, "ຜັດ "],
  [/(ໄກ່)/g, "ໄກ່ "],
  [/(ໝູ|ຫມູ)/g, "ໝູ "],
  [/(ເນື້ອ)/g, "ເນື້ອ "],
  [/(ກຸ້ງ)/g, "ກຸ້ງ "],
  [/(ປາ)/g, "ປາ "],
  [/(ໄຂ່)/g, "ໄຂ່ "],
  [/(ຕຳ)/g, "ຕຳ "],
  [/(ໝາກຫຸ່ງ|ຫມາກຫຸ່ງ)/g, "ໝາກ ຫຸ່ງ "],
  [/(ລາບ)/g, "ລາບ "],
  [/(ເຝີ)/g, "ເຝີ "],
  [/(ນ້ຳ|ນໍ້າ)/g, "ນ້ຳ "],
  [/(ສົ້ມ)/g, "ສົ້ມ "],
  [/(ກາເຟ)/g, "ກາ ເຟ "],
  [/(ຊາ)/g, "ຊາ "],
  [/(ເຢັນ)/g, "ເຢັນ "],
  [/(ທອດ)/g, "ທອດ "],
  [/(ປີ້ງ)/g, "ປີ້ງ "],
];

function hasLaoOrThaiText(value) {
  return /[\u0E80-\u0EFF\u0E00-\u0E7F]/.test(String(value || ""));
}

function cleanVoiceText(value) {
  return String(value || "")
    .replace(/[_/()\[\]{}]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function menuFallbackEn(name) {
  let text = String(name || "");
  const recognized = [];

  for (const [pattern, replacement] of MENU_WORD_EN) {
    const matched = text.match(pattern);
    if (matched) {
      recognized.push(replacement);
      text = text.replace(pattern, " ");
    }
  }

  const remainingEnglish = cleanVoiceText(
    text
      .replace(/[\u0E80-\u0EFF\u0E00-\u0E7F]+/g, " ")
      .replace(/[^a-zA-Z0-9 ]+/g, " ")
  );

  const result = cleanVoiceText([...recognized, remainingEnglish].filter(Boolean).join(" "));

  if (!result) return "menu item";

  return result;
}

function menuFallbackLo(name) {
  let text = String(name || "");

  for (const [pattern, replacement] of MENU_WORD_LO) {
    text = text.replace(pattern, replacement);
  }

  return cleanVoiceText(text) || "ເມນູ";
}

function menuVoiceName(item) {
  const custom = getCustomMenuVoice(item, "lo");
  if (custom) return custom;

  const name = getItemName(item);
  const override = MENU_VOICE_OVERRIDES[normalizeMenuKey(name)];
  if (override?.lo) return override.lo;

  return menuFallbackLo(name);
}

function menuVoiceNameEn(item) {
  const custom = getCustomMenuVoice(item, "en");
  if (custom) return custom;

  const name = getItemName(item);
  const override = MENU_VOICE_OVERRIDES[normalizeMenuKey(name)];
  if (override?.en) return override.en;

  return menuFallbackEn(name);
}

function itemsVoiceText(items) {
  return items
    .map((item) => `${menuVoiceName(item)} ${numberVoice(getItemQty(item))}`)
    .join(", ");
}

function itemsVoiceTextEn(items) {
  return items
    .map((item) => `${numberVoiceEn(getItemQty(item))} ${menuVoiceNameEn(item)}`)
    .join(", ");
}

export function isBillCall(payload) {
  const type = String(payload?.type || payload?.callType || "").toUpperCase();
  const message = String(payload?.message || "").toLowerCase();

  return (
    type === "BILL" ||
    type === "PAYMENT" ||
    message.includes("ເກັບເງິນ") ||
    message.includes("ຂໍເກັບເງິນ") ||
    message.includes("pay") ||
    message.includes("bill") ||
    message.includes("cashier")
  );
}

export function orderVoiceText(order) {
  const tableName = getTableVoiceName(order);
  const items = getItems(order);

  if (shouldUseEnglishVoice()) {
    const itemText = itemsVoiceTextEn(items);
    return itemText ? `New order, table ${tableName}, ${itemText}` : `New order, table ${tableName}`;
  }

  const itemText = itemsVoiceText(items);
  if (!itemText) return `ອໍເດີໃໝ່ ໂຕະ ${tableName}`;
  return `ອໍເດີໃໝ່ ໂຕະ ${tableName} ${itemText}`;
}

export function readyServeVoiceText(payload) {
  const tableName = getTableVoiceName(payload);
  const items = getItems(payload);

  if (shouldUseEnglishVoice()) {
    const itemText = itemsVoiceTextEn(items);
    return itemText ? `Table ${tableName} ready to serve, ${itemText}` : `Table ${tableName} ready to serve`;
  }

  const itemText = itemsVoiceText(items);
  if (!itemText) return `ໂຕະ ${tableName} ພ້ອມເສີບ`;
  return `ໂຕະ ${tableName} ພ້ອມເສີບ ${itemText}`;
}

export function billCallVoiceText(payload) {
  const tableName = getTableVoiceName(payload);

  if (shouldUseEnglishVoice()) {
    return `Customer at table ${tableName} wants to pay`;
  }

  return `ລູກຄ້າໂຕະ ${tableName} ເອີ້ນເກັບເງິນ`;
}

export function staffCallVoiceText(payload) {
  if (isBillCall(payload)) return billCallVoiceText(payload);

  const tableName = getTableVoiceName(payload);

  if (shouldUseEnglishVoice()) {
    return `Customer at table ${tableName} calls staff`;
  }

  return `ໂຕະ ${tableName} ເອີ້ນພະນັກງານ`;
}
