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
  gain.gain.value = 0.35;

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.25);

  return true;
}

export async function enableNotifySound() {
  try {
    const sound = getAudio();

    await playBeep();

    sound.currentTime = 0;
    await sound.play();
    sound.pause();
    sound.currentTime = 0;

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
    await playBeep();
  }
}
