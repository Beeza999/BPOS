const SOUND_KEY = "bipos_voice_enabled";

let unlocked = false;
let audioContext = null;
let voicesReadyPromise = null;

function hasWindow() {
  return typeof window !== "undefined";
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

function getVoices() {
  if (!hasWindow() || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices() || [];
}

function waitForVoices() {
  if (voicesReadyPromise) return voicesReadyPromise;

  voicesReadyPromise = new Promise((resolve) => {
    const voices = getVoices();

    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    let done = false;

    function finish() {
      if (done) return;
      done = true;
      resolve(getVoices());
    }

    if (hasWindow() && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = finish;
    }

    setTimeout(finish, 1200);
  });

  return voicesReadyPromise;
}

function isMobileLikeDevice() {
  if (!hasWindow()) return false;

  const ua = String(navigator.userAgent || "");
  const platform = String(navigator.platform || "");
  const userAgentDataMobile = Boolean(navigator.userAgentData?.mobile);
  const touchPoints = Number(navigator.maxTouchPoints || 0);

  return (
    userAgentDataMobile ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua) ||
    (platform === "MacIntel" && touchPoints > 1)
  );
}

export function shouldUseEnglishVoice() {
  return isMobileLikeDevice();
}

function voicePreferences() {
  if (shouldUseEnglishVoice()) return ["en-US", "en-GB", "en", "lo", "th"];
  return ["lo-LA", "lo", "th-TH", "th", "en-US", "en"];
}

async function getBestVoice() {
  const voices = await waitForVoices();
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

  return voices[0] || null;
}

function normalizeSpeechText(text) {
  if (text && typeof text === "object") {
    return shouldUseEnglishVoice()
      ? String(text.en || text.lo || "")
      : String(text.lo || text.en || "");
  }

  return String(text || "");
}

function playIosSafeBeep() {
  return new Promise((resolve, reject) => {
    try {
      const audio = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA="
      );

      audio.volume = 1;
      audio.muted = false;
      audio.playsInline = true;

      const result = audio.play();

      if (result && result.then) {
        result.then(() => resolve(true)).catch(reject);
      } else {
        resolve(true);
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function unlockAudio() {
  try {
    const context = getAudioContext();

    if (context && context.state === "suspended") {
      await context.resume();
    }

    if (hasWindow() && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(" ");
      utterance.volume = 0.01;
      utterance.rate = 1;
      utterance.pitch = 1;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }

    unlocked = true;
    localStorage.setItem(SOUND_KEY, "1");

    return true;
  } catch (error) {
    console.warn("unlockAudio failed:", error);
    return false;
  }
}

function playTone({ frequency = 880, duration = 0.18, delay = 0, volume = 0.25 } = {}) {
  return new Promise((resolve, reject) => {
    try {
      const context = getAudioContext();

      if (!context) {
        if (navigator.vibrate) navigator.vibrate(120);
        resolve(true);
        return;
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
      oscillator.stop(startAt + duration + 0.03);

      oscillator.onended = () => resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

async function playNotifyBell() {
  await unlockAudio();
  await playTone({ frequency: 880, duration: 0.16, delay: 0 });
  await playTone({ frequency: 1175, duration: 0.18, delay: 0.18 });
  return true;
}

async function speakText(text) {
  const speechText = normalizeSpeechText(text);

  if (!speechText || !hasWindow() || !window.speechSynthesis) {
    throw new Error("Speech synthesis not supported");
  }

  try {
    const context = getAudioContext();
    if (context && context.state === "suspended") {
      await context.resume();
    }
  } catch (error) {
    console.warn("resume before speak failed:", error);
  }

  const voice = await getBestVoice();

  return new Promise((resolve, reject) => {
    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(speechText);

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || (shouldUseEnglishVoice() ? "en-US" : "lo-LA");
      } else {
        utterance.lang = shouldUseEnglishVoice() ? "en-US" : "lo-LA";
      }

      utterance.rate = shouldUseEnglishVoice() ? 0.92 : 0.86;
      utterance.pitch = 1;
      utterance.volume = 1;

      let finished = false;

      const fallbackTimer = window.setTimeout(() => {
        if (finished) return;
        finished = true;
        resolve(true);
      }, 9000);

      utterance.onend = () => {
        if (finished) return;
        finished = true;
        window.clearTimeout(fallbackTimer);
        resolve(true);
      };

      utterance.onerror = (event) => {
        if (finished) return;
        finished = true;
        window.clearTimeout(fallbackTimer);
        reject(new Error(event?.error || "Speak failed"));
      };

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      reject(error);
    }
  });
}

export async function enableNotifySound() {
  try {
    unlocked = true;

    try {
      await playIosSafeBeep();
    } catch (error) {
      console.warn("iOS audio unlock failed:", error);
    }

    try {
      await unlockAudio();
    } catch (error) {
      console.warn("WebAudio unlock failed:", error);
    }

    try {
      await playNotifyBell();
    } catch (error) {
      console.warn("Bell test failed:", error);
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    try {
      await speakText({ lo: "ເປີດສຽງແຈ້ງເຕືອນແລ້ວ", en: "Notification sound enabled" });
    } catch (error) {
      console.warn("Voice test failed:", error);
    }

    localStorage.setItem(SOUND_KEY, "1");
    return true;
  } catch (error) {
    unlocked = false;
    localStorage.removeItem(SOUND_KEY);
    console.warn("Audio unlock failed:", error);
    return false;
  }
}

export function isNotifySoundEnabled() {
  return unlocked;
}

export function hasSavedNotifySoundPreference() {
  return hasWindow() && localStorage.getItem(SOUND_KEY) === "1";
}

export async function speakNotify(text) {
  if (!unlocked) return false;

  try {
    await playIosSafeBeep();
  } catch (error) {
    console.warn("iOS beep failed:", error);
  }

  try {
    await playNotifyBell();
  } catch (error) {
    console.warn("Bell notification failed:", error);
  }

  try {
    await speakText(text);
    return true;
  } catch (error) {
    console.warn("Voice notification failed:", error);
    return false;
  }
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

function itemsVoiceText(items) {
  return items.map((item) => `${getItemName(item)} ${getItemQty(item)}`).join(", ");
}

function itemsVoiceTextEn(items) {
  const totalQty = items.reduce((sum, item) => sum + getItemQty(item), 0);
  if (totalQty <= 0) return "";
  return `${numberVoiceEn(totalQty)} ${totalQty === 1 ? "item" : "items"}`;
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
