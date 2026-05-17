const SOUND_KEY = "bipos_sound_enabled";

let audio = null;
let audioContext = null;
let unlocked = false;
let voicesLoaded = false;

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

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function playBeep({ frequency = 880, duration = 0.22, volume = 0.28 } = {}) {
  const ctx = getAudioContext();
  if (!ctx) return false;

  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.value = volume;

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);

  return true;
}

async function playNotifyMp3() {
  const sound = getAudio();
  sound.currentTime = 0;
  await sound.play();
}

function getVoices() {
  if (!("speechSynthesis" in window)) return [];

  const voices = window.speechSynthesis.getVoices() || [];
  voicesLoaded = voicesLoaded || voices.length > 0;
  return voices;
}

function pickVoice() {
  const voices = getVoices();
  if (!voices.length) return null;

  return (
    voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith("lo")) ||
    voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith("th")) ||
    voices.find((voice) => /lao|thai/i.test(String(voice.name || ""))) ||
    voices[0]
  );
}

export function speakNotifyText(text) {
  if (!isNotifySoundEnabled()) return false;
  if (!("speechSynthesis" in window)) return false;
  if (!text) return false;

  try {
    const utterance = new SpeechSynthesisUtterance(String(text));
    const voice = pickVoice();

    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || "lo-LA";
    } else {
      utterance.lang = "lo-LA";
    }

    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (error) {
    console.warn("Speech notification blocked:", error);
    return false;
  }
}

export async function enableNotifySound() {
  try {
    if ("speechSynthesis" in window && !voicesLoaded) {
      window.speechSynthesis.getVoices();
    }

    await playBeep({ frequency: 760, duration: 0.16 });

    try {
      await playNotifyMp3();
      const sound = getAudio();
      sound.pause();
      sound.currentTime = 0;
    } catch {
      // If mp3 is missing or blocked, beep is enough to unlock audio.
    }

    unlocked = true;
    localStorage.setItem(SOUND_KEY, "1");

    await wait(80);
    speakNotifyText("ເປີດສຽງແຈ້ງເຕືອນແລ້ວ");

    return true;
  } catch {
    try {
      await playBeep({ frequency: 760, duration: 0.16 });
      unlocked = true;
      localStorage.setItem(SOUND_KEY, "1");
      speakNotifyText("ເປີດສຽງແຈ້ງເຕືອນແລ້ວ");
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

export async function playNotifySound(text = "") {
  if (!isNotifySoundEnabled()) return;

  try {
    await playBeep({ frequency: 980, duration: 0.16, volume: 0.26 });
    await wait(90);
    await playBeep({ frequency: 760, duration: 0.16, volume: 0.24 });
  } catch {
    try {
      await playNotifyMp3();
    } catch {
      // Ignore audio fallback errors.
    }
  }

  if (text) {
    window.setTimeout(() => speakNotifyText(text), 220);
  }
}
