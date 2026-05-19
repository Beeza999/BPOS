const SOUND_KEY = "bipos_voice_enabled";

let unlocked = false;
let audioContext = null;
let voicesReadyPromise = null;

function hasWindow() {
  return typeof window !== "undefined";
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

function getAudioContext() {
  if (!hasWindow()) return null;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioContext) audioContext = new AudioContextClass();
  return audioContext;
}

async function unlockAudio() {
  const context = getAudioContext();

  if (context && context.state === "suspended") {
    await context.resume();
  }

  unlocked = true;
  localStorage.setItem(SOUND_KEY, "1");
  return true;
}

function playTone({ frequency = 880, duration = 0.18, delay = 0, volume = 0.22 } = {}) {
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

      utterance.rate = 0.88;
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
    await unlockAudio();
    await playNotifyBell();

    try {
      await speakText("ເປີດສຽງແຈ້ງເຕືອນແລ້ວ");
    } catch (error) {
      console.warn("Voice test failed, bell fallback is enabled:", error);
    }

    return true;
  } catch (error) {
    unlocked = false;
    localStorage.removeItem(SOUND_KEY);
    console.warn("Audio unlock failed:", error);
    return false;
  }
}

export function isNotifySoundEnabled() {
  // ສຳຄັນ: browser ຈະອະນຸຍາດສຽງຫຼັງຈາກ user ກົດປຸ່ມໃນ tab ນັ້ນແລ້ວເທົ່ານັ້ນ.
  // ດັ່ງນັ້ນ reload / ເຄື່ອງໃໝ່ / browser ໃໝ່ ຕ້ອງກົດເປີດສຽງອີກຄັ້ງ.
  return unlocked;
}

export function hasSavedNotifySoundPreference() {
  return hasWindow() && localStorage.getItem(SOUND_KEY) === "1";
}

export async function speakNotify(text) {
  if (!unlocked) return false;

  try {
    await playNotifyBell();
  } catch (error) {
    console.warn("Bell notification failed:", error);
  }

  try {
    await speakText(text);
    return true;
  } catch (error) {
    console.warn("Voice notification failed, bell was already played:", error);
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
  return items
    .map((item) => `${getItemName(item)} ${getItemQty(item)}`)
    .join(", ");
}

export function orderVoiceText(order) {
  const tableName = getTableName(order);
  const items = getItems(order);
  const itemText = itemsVoiceText(items);

  if (!itemText) {
    return `ອໍເດີໃໝ່ ໂຕະ ${tableName}`;
  }

  return `ອໍເດີໃໝ່ ໂຕະ ${tableName} ${itemText}`;
}

export function readyServeVoiceText(payload) {
  const tableName = getTableName(payload);
  const items = getItems(payload);
  const itemText = itemsVoiceText(items);

  if (!itemText) {
    return `ໂຕະ ${tableName} ພ້ອມເສີບ`;
  }

  return `ໂຕະ ${tableName} ພ້ອມເສີບ ${itemText}`;
}

export function staffCallVoiceText(payload) {
  const tableName = getTableName(payload);
  return `ໂຕະ ${tableName} ເອີ້ນພະນັກງານ`;
}
