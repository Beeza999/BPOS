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

async function getBestVoice() {
  const voices = await waitForVoices();

  return (
    voices.find((v) => String(v.lang || "").toLowerCase().startsWith("lo")) ||
    voices.find((v) => String(v.lang || "").toLowerCase().startsWith("th")) ||
    voices.find((v) => String(v.lang || "").toLowerCase().startsWith("en")) ||
    voices[0] ||
    null
  );
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
  if (!text || !hasWindow() || !window.speechSynthesis) {
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

      const utterance = new SpeechSynthesisUtterance(String(text));

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang || "lo-LA";
      } else {
        utterance.lang = "lo-LA";
      }

      utterance.rate = 0.86;
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
      await speakText("ເປີດສຽງແຈ້ງເຕືອນແລ້ວ");
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

function tableVoiceName(tableName) {
  const raw = String(tableName || "-").trim();
  if (!raw || raw === "-") return "-";

  const clean = raw
    .replace(/^ໂຕະ\s*/i, "")
    .replace(/^โต๊ะ\s*/i, "")
    .replace(/^table\s*/i, "")
    .replace(/[\s_-]+/g, "")
    .toUpperCase();

  if (!clean) return raw;

  if (TABLE_VOICE_OVERRIDES[clean]) {
    return TABLE_VOICE_OVERRIDES[clean];
  }

  const match = clean.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    const letters = match[1]
      .split("")
      .map((char) => LETTER_VOICE[char] || char)
      .join(" ");
    const numbers = numberVoice(match[2]);
    return `${letters} ${numbers}`;
  }

  if (/^\d+$/.test(clean)) {
    return numberVoice(clean);
  }

  return clean
    .split("")
    .map((char) => {
      if (LETTER_VOICE[char]) return LETTER_VOICE[char];
      if (DIGIT_VOICE[char]) return DIGIT_VOICE[char];
      return char;
    })
    .join(" ");
}

function getTableVoiceName(payload) {
  return tableVoiceName(getTableName(payload));
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
  return item?.quantity || item?.qty || 1;
}

function itemsVoiceText(items) {
  return items.map((item) => `${getItemName(item)} ${getItemQty(item)}`).join(", ");
}

export function orderVoiceText(order) {
  const tableName = getTableVoiceName(order);
  const items = getItems(order);
  const itemText = itemsVoiceText(items);

  if (!itemText) {
    return `ອໍເດີໃໝ່ ໂຕະ ${tableName}`;
  }

  return `ອໍເດີໃໝ່ ໂຕະ ${tableName} ${itemText}`;
}

export function readyServeVoiceText(payload) {
  const tableName = getTableVoiceName(payload);
  const items = getItems(payload);
  const itemText = itemsVoiceText(items);

  if (!itemText) {
    return `ໂຕະ ${tableName} ພ້ອມເສີບ`;
  }

  return `ໂຕະ ${tableName} ພ້ອມເສີບ ${itemText}`;
}

export function staffCallVoiceText(payload) {
  const tableName = getTableVoiceName(payload);
  return `ໂຕະ ${tableName} ເອີ້ນພະນັກງານ`;
}