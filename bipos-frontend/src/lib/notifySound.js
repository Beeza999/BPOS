const SOUND_KEY = "bipos_voice_enabled";

let unlocked = false;

function getVoices() {
  if (!window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices() || [];
}

function waitForVoices() {
  return new Promise((resolve) => {
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

    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = finish;
    }

    setTimeout(finish, 800);
  });
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

async function speakText(text) {
  if (!text || !window.speechSynthesis) {
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

      utterance.onend = () => resolve(true);
      utterance.onerror = () => reject(new Error("Speak failed"));

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      reject(error);
    }
  });
}

export async function enableNotifySound() {
  try {
    await speakText("ເປີດສຽງແຈ້ງເຕືອນແລ້ວ");

    unlocked = true;
    localStorage.setItem(SOUND_KEY, "1");

    return true;
  } catch (error) {
    unlocked = false;
    localStorage.removeItem(SOUND_KEY);
    return false;
  }
}

export function isNotifySoundEnabled() {
  return unlocked || localStorage.getItem(SOUND_KEY) === "1";
}

export async function speakNotify(text) {
  if (!isNotifySoundEnabled()) return false;

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