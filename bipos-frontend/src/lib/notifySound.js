const SOUND_KEY = "bipos_sound_enabled";

let audio = null;
let audioContext = null;
let unlocked = false;

function getAudio() {
  if (!audio) {
    audio = new Audio("/notify.mp3");
    audio.preload = "auto";
    audio.volume = 1;
  }

  return audio;
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  return audioContext;
}

async function playBeep() {
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.25;

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.2);

  return true;
}

function getBestVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || [];

  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith("lo")) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("th")) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ||
    voices[0] ||
    null
  );
}

function speakText(text) {
  return new Promise((resolve, reject) => {
    if (!text || !window.speechSynthesis) {
      reject(new Error("Speech synthesis not supported"));
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getBestVoice();

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "lo-LA";
    } else {
      utterance.lang = "lo-LA";
    }

    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onend = resolve;
    utterance.onerror = reject;

    window.speechSynthesis.speak(utterance);
  });
}

export async function enableNotifySound() {
  try {
    const sound = getAudio();

    await playBeep();

    sound.currentTime = 0;
    await sound.play();
    sound.pause();
    sound.currentTime = 0;

    // ปลดล็อก speech synthesis ด้วยการพูดสั้น ๆ หลังจากผู้ใช้กดปุ่ม
    try {
      await speakText("ເປີດສຽງແລ້ວ");
    } catch {
      // ไม่ต้องทำอะไร ถ้าเครื่องไม่รองรับเสียงพูด
    }

    unlocked = true;
    localStorage.setItem(SOUND_KEY, "1");
    return true;
  } catch {
    try {
      await playBeep();

      unlocked = true;
      localStorage.setItem(SOUND_KEY, "1");
      return true;
    } catch {
      unlocked = false;
      localStorage.removeItem(SOUND_KEY);
      return false;
    }
  }
}

export function isNotifySoundEnabled() {
  return unlocked || localStorage.getItem(SOUND_KEY) === "1";
}

export async function playNotifySound() {
  if (!isNotifySoundEnabled()) return;

  try {
    const sound = getAudio();
    sound.currentTime = 0;
    await sound.play();
  } catch {
    try {
      await playBeep();
    } catch {
      // ignore
    }
  }
}

export async function speakNotify(text) {
  if (!isNotifySoundEnabled()) return;

  try {
    // ให้มีเสียงติ๊งก่อน แล้วค่อยพูดข้อความจริง
    await playNotifySound();

    setTimeout(() => {
      speakText(text).catch(() => {});
    }, 350);
  } catch {
    try {
      await speakText(text);
    } catch {
      // ถ้าเครื่องไม่รองรับเสียงพูด จะเหลือแค่ notify.mp3
    }
  }
}

export function orderVoiceText(order) {
  const tableName =
    order?.table?.name ||
    order?.tableName ||
    order?.table ||
    order?.bill?.table?.name ||
    "";

  const items = order?.items || order?.orderItems || [];

  const itemText = items
    .map((item) => {
      const name =
        item?.menuItem?.name ||
        item?.menu?.name ||
        item?.name ||
        item?.menuName ||
        "ເມນູ";

      const qty = item?.quantity || item?.qty || 1;

      return `${name} ${qty}`;
    })
    .join(", ");

  return `ອໍເດີໃໝ່ ໂຕະ ${tableName} ${itemText}`;
}

export function readyServeVoiceText(payload) {
  const tableName =
    payload?.table?.name ||
    payload?.tableName ||
    payload?.table ||
    payload?.order?.table?.name ||
    payload?.bill?.table?.name ||
    "";

  const items = payload?.items || payload?.orderItems || payload?.order?.items || [];

  const itemText = items
    .map((item) => {
      const name =
        item?.menuItem?.name ||
        item?.menu?.name ||
        item?.name ||
        item?.menuName ||
        "ເມນູ";

      const qty = item?.quantity || item?.qty || 1;

      return `${name} ${qty}`;
    })
    .join(", ");

  return `ໂຕະ ${tableName} ພ້ອມເສີບ ${itemText}`;
}

export function staffCallVoiceText(payload) {
  const tableName =
    payload?.table?.name ||
    payload?.tableName ||
    payload?.table ||
    payload?.tableToken ||
    "";

  return `ໂຕະ ${tableName} ເອີ້ນພະນັກງານ`;
}