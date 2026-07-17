const practiceBeer = document.querySelector("#practiceBeer");
const practiceHead = document.querySelector(".pint-head");
const practiceGlass = document.querySelector(".pint-glass");
const practiceTarget = document.querySelector("#practiceTarget");
const tiltMode = document.querySelector("#tiltMode");
const practiceReset = document.querySelector("#practiceReset");
const practiceDrink = document.querySelector("#practiceDrink");
const soundToggle = document.querySelector("#soundToggle");
const feedback = document.querySelector("#feedback");
const scoreValue = document.querySelector("#scoreValue");
const bestScore = document.querySelector("#bestScore");
const roundValue = document.querySelector("#roundValue");

let level = 100;
let round = 1;
let pouring = false;
let locked = false;
let tiltEnabled = false;
let tiltBaseline = null;
let pourTimer = null;
let soundEnabled = localStorage.getItem("splitG.sound") !== "off";
let best = Number(localStorage.getItem("splitG.best") || 0);

const samples = {
  guzzle: new Audio("audio/guzzle.wav?v=5"),
  cheer: new Audio("audio/pub-cheer.wav?v=5"),
  boo: new Audio("audio/pub-boo.wav?v=5")
};

Object.values(samples).forEach(sample => { sample.preload = "auto"; });

function difficulty() {
  const step = Math.min(round - 1, 8);
  return {
    drain: 0.52 + step * 0.1,
    bandRatio: Math.max(0.055, 0.14 - step * 0.011),
    falloffRatio: Math.max(0.07, 0.15 - step * 0.008),
    passScore: Math.min(90, 68 + step * 2.5)
  };
}

function play(name, volume = 0.8) {
  if (!soundEnabled) return;
  const sample = samples[name];
  if (!sample) return;
  sample.currentTime = 0;
  sample.volume = volume;
  sample.play().catch(() => {});
}

function setLevel(nextLevel) {
  level = Math.max(6, Math.min(100, nextLevel));
  practiceBeer.style.height = `${level}%`;
  practiceGlass.style.setProperty("--beer-height", `${level}%`);
}

function setTargetBand() {
  const glassRect = practiceGlass.getBoundingClientRect();
  const band = Math.max(18, Math.round(glassRect.height * difficulty().bandRatio));
  practiceGlass.style.setProperty("--target-band", `${band}px`);
}

function updateHud() {
  roundValue.textContent = String(round);
  bestScore.textContent = best ? String(best) : "--";
  soundToggle.textContent = soundEnabled ? "Sound on" : "Sound off";
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
}

function metrics() {
  const glassRect = practiceGlass.getBoundingClientRect();
  const headRect = practiceHead.getBoundingClientRect();
  const targetRect = practiceTarget.getBoundingClientRect();
  return {
    glassHeight: glassRect.height || 500,
    foamEdge: headRect.bottom,
    targetCenter: targetRect.top + targetRect.height / 2,
    targetBand: targetRect.height
  };
}

function stopAndScore() {
  if (!pouring) return;
  pouring = false;
  clearInterval(pourTimer);
  pourTimer = null;
  const { glassHeight, foamEdge, targetCenter, targetBand } = metrics();
  const miss = Math.max(0, Math.abs(foamEdge - targetCenter) - targetBand / 2);
  const score = Math.max(0, 100 - (miss / (glassHeight * difficulty().falloffRatio)) * 100);
  const rounded = Math.round(score);
  const passed = rounded >= difficulty().passScore;
  scoreValue.textContent = String(rounded);

  if (rounded > best) {
    best = rounded;
    localStorage.setItem("splitG.best", String(best));
  }

  if (passed) {
    play("cheer", 0.85);
    feedback.textContent = rounded >= 96 ? "Perfect split. You found the line." : "That counts. The next round is tighter.";
    round += 1;
  } else {
    play("boo", 0.82);
    feedback.textContent = "Just outside the line. Reset and try that same round again.";
  }

  locked = true;
  tiltMode.textContent = "Reset for next round";
  tiltMode.disabled = true;
  setTargetBand();
  updateHud();
}

function startPour() {
  if (locked || pouring) return;
  pouring = true;
  play("guzzle", 0.56);
  const rate = difficulty().drain;
  pourTimer = setInterval(() => {
    setLevel(level - rate);
    if (level <= 6) stopAndScore();
  }, 90);
}

function resetRound() {
  clearInterval(pourTimer);
  pourTimer = null;
  pouring = false;
  locked = false;
  tiltBaseline = null;
  setLevel(100);
  setTargetBand();
  scoreValue.textContent = "--";
  tiltMode.disabled = false;
  tiltMode.textContent = tiltEnabled ? "Hold straight to calibrate" : "Start tilt";
  feedback.textContent = tiltEnabled
    ? "Hold your phone straight for a moment, then tip it to pour."
    : "Tap start, hold your phone straight, then tilt to pour.";
  updateHud();
}

function phoneTilt(event) {
  if (!tiltEnabled || locked) return;
  const beta = Number.isFinite(event.beta) ? event.beta : 0;
  const gamma = Number.isFinite(event.gamma) ? event.gamma : 0;
  if (!tiltBaseline) {
    tiltBaseline = { beta, gamma };
    tiltMode.textContent = "Tilt to pour";
    feedback.textContent = "Tilt your phone to start pouring. Straighten it to stop on the line.";
    return;
  }
  const tilt = Math.max(Math.abs(beta - tiltBaseline.beta), Math.abs(gamma - tiltBaseline.gamma));
  if (!pouring && tilt >= 18) startPour();
  if (pouring && tilt <= 7) stopAndScore();
}

async function enableTilt() {
  if (tiltEnabled) return;
  if (!("DeviceOrientationEvent" in window)) {
    feedback.textContent = "This is a mobile tilt game. Open it on a phone to play.";
    return;
  }
  try {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        feedback.textContent = "Motion access is needed to tilt the pint.";
        return;
      }
    }
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => {});
    }
    if (screen.orientation && typeof screen.orientation.lock === "function") {
      await screen.orientation.lock("portrait").catch(() => {});
    }
    tiltEnabled = true;
    tiltBaseline = null;
    tiltMode.setAttribute("aria-pressed", "true");
    resetRound();
    window.addEventListener("deviceorientation", phoneTilt);
  } catch {
    feedback.textContent = "Motion access was not available on this phone.";
  }
}

tiltMode.addEventListener("click", enableTilt);
practiceReset.addEventListener("click", resetRound);
soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem("splitG.sound", soundEnabled ? "on" : "off");
  updateHud();
});

practiceDrink.addEventListener("pointerdown", startPour);
practiceDrink.addEventListener("pointerup", stopAndScore);
practiceDrink.addEventListener("pointercancel", stopAndScore);

window.addEventListener("resize", setTargetBand);
setLevel(level);
setTargetBand();
updateHud();
