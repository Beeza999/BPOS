const SOUND_KEY = "bipos_notify_sound_enabled";
const SOUND_VOLUME_KEY = "bipos_notify_sound_volume";

let audio = null;
let audioContext = null;

function getVolume() {
  const value = Number(localStorage.getItem(SOUND_VOLUME_KEY) || 1);
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function getAudio() {
  if (!audio) {
    audio = new Audio("/notify.mp3");
    audio.preload = "auto";
    audio.volume = getVolume();
    audio.playsInline = true;
  }

  return audio;
}

async function unlockHtmlAudio() {
  const sound = getAudio();
  sound.volume = getVolume();
  sound.currentTime = 0;

  await sound.play();
  sound.pause();
  sound.currentTime = 0;
}

async function unlockBeepAudio() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.12);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.15);
}

export async function enableNotifySound() {
  try {
    // ต้องถูกเรียกจากการกดปุ่มของผู้ใช้เท่านั้น มือถือถึงจะปลดล็อกเสียง
    await unlockBeepAudio();

    // ถ้ามีไฟล์ public/notify.mp3 จะปลดล็อกไฟล์เสียงด้วย
    try {
      await unlockHtmlAudio();
    } catch {
      // ถ้าไม่มีไฟล์ notify.mp3 ยังใช้เสียง beep จาก AudioContext ได้
    }

    localStorage.setItem(SOUND_KEY, "1");
    return true;
  } catch (error) {
    console.warn("Enable notify sound failed:", error);
    localStorage.removeItem(SOUND_KEY);
    return false;
  }
}

export function disableNotifySound() {
  localStorage.removeItem(SOUND_KEY);
}

export function isNotifySoundEnabled() {
  return localStorage.getItem(SOUND_KEY) === "1";
}

export function setNotifySoundVolume(volume) {
  const nextVolume = Math.min(1, Math.max(0, Number(volume || 0)));
  localStorage.setItem(SOUND_VOLUME_KEY, String(nextVolume));
  if (audio) audio.volume = nextVolume;
}

export async function playNotifySound() {
  if (!isNotifySoundEnabled()) return false;

  let played = false;

  try {
    const sound = getAudio();
    sound.volume = getVolume();
    sound.currentTime = 0;
    await sound.play();
    played = true;
  } catch {
    // ถ้าไฟล์ mp3 เล่นไม่ได้ จะ fallback เป็น beep
  }

  if (!played) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;

      if (!audioContext || audioContext.state === "closed") {
        audioContext = new AudioContext();
      }

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const now = audioContext.currentTime;

      for (let index = 0; index < 2; index += 1) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const start = now + index * 0.28;

        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(index === 0 ? 880 : 1040, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.22 * getVolume(), start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);

        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.24);
      }

      played = true;
    } catch (error) {
      console.warn("Notify sound blocked:", error);
    }
  }

  return played;
}
