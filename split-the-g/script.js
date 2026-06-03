const video = document.querySelector("#video");
const snapshot = document.querySelector("#snapshot");
const analysisCanvas = document.querySelector("#analysisCanvas");
const cameraEmpty = document.querySelector("#cameraEmpty");
const cameraBtn = document.querySelector("#cameraBtn");
const sipBtn = document.querySelector("#sipBtn");
const captureBtn = document.querySelector("#captureBtn");
const timer = document.querySelector("#timer");
const phaseLabel = document.querySelector("#phaseLabel");
const scoreValue = document.querySelector("#scoreValue");
const bestScore = document.querySelector("#bestScore");
const verdict = document.querySelector("#verdict");
const feedback = document.querySelector("#feedback");
const resultRing = document.querySelector(".result-ring");
const soundToggle = document.querySelector("#soundToggle");
const soundStatus = document.querySelector("#soundStatus");
const practiceDrink = document.querySelector("#practiceDrink");
const practiceReset = document.querySelector("#practiceReset");
const tiltMode = document.querySelector("#tiltMode");
const practiceBeer = document.querySelector("#practiceBeer");
const practiceHead = document.querySelector(".practice-head");
const practiceGlass = document.querySelector(".practice-glass");
const practicePanel = document.querySelector(".practice");
const practiceLiquidMask = document.querySelector(".glass-liquid-mask");
const practiceTarget = document.querySelector(".practice-target");

let stream;
let sipStart = 0;
let timerFrame;
let best = Number(localStorage.getItem("splitG.best") || 0);
let practiceLevel = 100;
let practiceRound = 1;
let practiceInterval;
let practiceLocked = false;
let tiltEnabled = false;
let tiltDrinking = false;
let tiltBaseline = null;
let soundEnabled = localStorage.getItem("splitG.sound") !== "off";

const tiltStart = 22;
const tiltStop = 8;

const samples = {
  guzzle: new Audio("audio/guzzle.wav?v=5"),
  bell: new Audio("audio/bar-bell.wav?v=5"),
  clink: new Audio("audio/glass-clink.wav?v=5"),
  cheer: new Audio("audio/pub-cheer.wav?v=5"),
  boo: new Audio("audio/pub-boo.wav?v=5"),
  shutter: new Audio("audio/camera-shutter.wav?v=5")
};

Object.values(samples).forEach(sample => {
  sample.preload = "auto";
});

bestScore.textContent = best ? `${best}` : "--";
captureBtn.disabled = true;
soundToggle.textContent = soundEnabled ? "Sound on" : "Sound off";
soundStatus.textContent = soundEnabled ? "Sound on" : "Sound off";
soundToggle.setAttribute("aria-pressed", String(soundEnabled));

function getPracticeDifficulty() {
  const step = Math.min(practiceRound - 1, 9);
  return {
    drain: 0.58 + step * 0.1,
    bandRatio: Math.max(0.07, 0.26 - step * 0.021),
    falloffRatio: Math.max(0.08, 0.16 - step * 0.008),
    passScore: Math.min(90, 68 + step * 2.2)
  };
}

function playSample(name, volume = 0.78) {
  if (!soundEnabled) return;
  const sample = samples[name];
  if (!sample) return;
  sample.currentTime = 0;
  sample.volume = volume;
  sample.play().catch(() => {});
}

function playScoreSound(score, source = "camera") {
  const successScore = source === "practice" ? getPracticeDifficulty().passScore : 84;
  if (score >= successScore) {
    playSample("cheer", 0.82);
  } else {
    playSample("boo", 0.82);
  }
}

function setResult(score, distance, source = "camera") {
  const rounded = Math.max(0, Math.min(100, Math.round(score)));
  scoreValue.textContent = rounded;
  resultRing.style.setProperty("--score", rounded);
  playScoreSound(rounded, source);
  if (rounded > best) {
    best = rounded;
    localStorage.setItem("splitG.best", String(best));
    bestScore.textContent = String(best);
  }

  const miss = Math.abs(Math.round(distance));
  if (rounded >= 96) {
    verdict.textContent = "Dead center";
    feedback.textContent = `Perfect split. The foam line kissed the G bar with a ${miss}px miss.`;
  } else if (rounded >= 84) {
    verdict.textContent = "Properly split";
    feedback.textContent = `That counts at most tables. You were ${miss}px from the strict bar.`;
  } else if (rounded >= 65) {
    verdict.textContent = "Near miss";
    feedback.textContent = `Close enough to argue about. Slow the sip slightly if the line is low, drink more if it is high.`;
  } else {
    verdict.textContent = source === "camera" ? "Try another angle" : "Reset and tune the hold";
    feedback.textContent = `The scoring line missed by ${miss}px. Keep the glass upright and center the G before scoring.`;
  }
}

function updateTimer() {
  if (!sipStart) return;
  const elapsed = (performance.now() - sipStart) / 1000;
  timer.textContent = `${elapsed.toFixed(2)}s`;
  timerFrame = requestAnimationFrame(updateTimer);
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    cameraEmpty.classList.add("is-hidden");
    captureBtn.disabled = false;
    cameraBtn.textContent = "Camera on";
    phaseLabel.textContent = "Ready for the first sip";
  } catch (error) {
    verdict.textContent = "Camera unavailable";
    feedback.textContent = "Use practice mode, or run the page from localhost and allow camera access.";
  }
}

function startSip() {
  sipStart = performance.now();
  cancelAnimationFrame(timerFrame);
  updateTimer();
  playSample("guzzle", 0.62);
  phaseLabel.textContent = "One steady sip";
  sipBtn.textContent = "Sip running";
}

function stopSipClock() {
  if (!sipStart) return 0;
  const elapsed = (performance.now() - sipStart) / 1000;
  sipStart = 0;
  cancelAnimationFrame(timerFrame);
  timer.textContent = `${elapsed.toFixed(2)}s`;
  sipBtn.textContent = "Start sip";
  return elapsed;
}

function drawGuide(ctx, width, height, lineY, detectedY) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#d6aa45";
  ctx.beginPath();
  ctx.moveTo(width * 0.2, lineY);
  ctx.lineTo(width * 0.8, lineY);
  ctx.stroke();

  if (Number.isFinite(detectedY)) {
    ctx.strokeStyle = "#1a8a8a";
    ctx.beginPath();
    ctx.moveTo(width * 0.24, detectedY);
    ctx.lineTo(width * 0.76, detectedY);
    ctx.stroke();
  }
  ctx.restore();
}

function analyzeFoamLine() {
  if (!video.videoWidth) return;
  stopSipClock();
  playSample("shutter", 0.62);

  const width = video.videoWidth;
  const height = video.videoHeight;
  snapshot.width = width;
  snapshot.height = height;
  analysisCanvas.width = analysisCanvas.clientWidth * devicePixelRatio;
  analysisCanvas.height = analysisCanvas.clientHeight * devicePixelRatio;

  const snapCtx = snapshot.getContext("2d");
  snapCtx.save();
  snapCtx.translate(width, 0);
  snapCtx.scale(-1, 1);
  snapCtx.drawImage(video, 0, 0, width, height);
  snapCtx.restore();

  const targetY = height * 0.25;
  const roi = {
    x: Math.round(width * 0.33),
    y: Math.round(height * 0.23),
    w: Math.round(width * 0.34),
    h: Math.round(height * 0.54)
  };
  const pixels = snapCtx.getImageData(roi.x, roi.y, roi.w, roi.h).data;
  const rows = [];

  for (let y = 0; y < roi.h; y += 1) {
    let bright = 0;
    let dark = 0;
    for (let x = 0; x < roi.w; x += 2) {
      const i = (y * roi.w + x) * 4;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma > 145 && r > b + 8) bright += 1;
      if (luma < 75) dark += 1;
    }
    rows.push({ y: roi.y + y, bright, dark, edge: bright - dark * 0.18 });
  }

  let bestEdge = { y: targetY, score: -Infinity };
  for (let i = 3; i < rows.length - 3; i += 1) {
    const before = rows[i - 3].edge + rows[i - 2].edge + rows[i - 1].edge;
    const after = rows[i + 1].edge + rows[i + 2].edge + rows[i + 3].edge;
    const edgeScore = before - after;
    if (edgeScore > bestEdge.score) bestEdge = { y: rows[i].y, score: edgeScore };
  }

  const scaleY = analysisCanvas.height / height;
  const scaleX = analysisCanvas.width / width;
  const ctx = analysisCanvas.getContext("2d");
  ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);
  drawGuide(ctx, width, height, targetY, bestEdge.y);

  const miss = bestEdge.y - targetY;
  const tolerance = height * 0.18;
  const score = Math.max(0, 100 - (Math.abs(miss) / tolerance) * 100);
  setResult(score, miss);
  phaseLabel.textContent = "Gold target, teal result";
}

function setPracticeLevel(level) {
  practiceLevel = Math.max(8, Math.min(100, level));
  practiceBeer.style.height = `${practiceLevel}%`;
  practiceGlass.style.setProperty("--beer-height", `${practiceLevel}%`);
}

function setPracticeTargetBand() {
  const difficulty = getPracticeDifficulty();
  const maskRect = practiceLiquidMask.getBoundingClientRect();
  const maskHeight = maskRect.height || 190;
  const band = Math.max(10, Math.round(maskHeight * difficulty.bandRatio));
  practiceGlass.style.setProperty("--practice-target-band", `${band}px`);
}

function getPracticeMetrics() {
  const maskRect = practiceLiquidMask.getBoundingClientRect();
  const targetRect = practiceTarget.getBoundingClientRect();
  const headRect = practiceHead.getBoundingClientRect();
  const maskHeight = maskRect.height || 190;
  const targetY = targetRect.top + targetRect.height / 2;
  const foamBottomY = headRect.bottom;
  const targetBand = targetRect.height;
  return { maskHeight, targetY, foamBottomY, targetBand };
}

function scorePractice() {
  const { maskHeight, targetY, foamBottomY, targetBand } = getPracticeMetrics();
  const miss = foamBottomY - targetY;
  const difficulty = getPracticeDifficulty();
  const bandMiss = Math.max(0, Math.abs(miss) - targetBand / 2);
  const falloff = maskHeight * difficulty.falloffRatio;
  const score = Math.max(0, 100 - (bandMiss / falloff) * 100);
  setResult(score, bandMiss, "practice");
  if (score >= difficulty.passScore) {
    practiceRound += 1;
    setPracticeTargetBand();
    phaseLabel.textContent = `Round ${practiceRound - 1} cleared`;
    feedback.textContent += ` Next round gets a smaller target band and a slightly faster pour.`;
  } else {
    setPracticeTargetBand();
    phaseLabel.textContent = `Round ${practiceRound}`;
    feedback.textContent += ` Round ${practiceRound} will stay at this easier setting until you clear it.`;
  }
}

function lockPracticeAttempt() {
  practiceLocked = true;
  practiceDrink.disabled = true;
  practiceDrink.textContent = "Reset for next shot";
}

function finishPracticeAttempt() {
  practiceGlass.classList.remove("is-drinking");
  stopSipClock();
  scorePractice();
  lockPracticeAttempt();
}

function startPracticeDrink() {
  if (practiceLocked) return;
  if (practiceInterval) return;
  clearInterval(practiceInterval);
  practiceGlass.classList.add("is-drinking");
  startSip();
  const difficulty = getPracticeDifficulty();
  practiceInterval = setInterval(() => {
    setPracticeLevel(practiceLevel - difficulty.drain);
    if (practiceLevel <= 8) {
      clearInterval(practiceInterval);
      practiceInterval = null;
      finishPracticeAttempt();
    }
  }, 90);
}

function stopPracticeDrink() {
  if (!practiceInterval) return;
  tiltDrinking = false;
  clearInterval(practiceInterval);
  practiceInterval = null;
  finishPracticeAttempt();
}

function getPhoneAngle(event) {
  const beta = Number.isFinite(event.beta) ? event.beta : 0;
  const gamma = Number.isFinite(event.gamma) ? event.gamma : 0;
  return { beta, gamma };
}

function getPhoneTilt(event) {
  const angle = getPhoneAngle(event);
  if (!tiltBaseline) {
    tiltBaseline = angle;
    phaseLabel.textContent = "Tip phone to drink";
    return 0;
  }

  return Math.max(
    Math.abs(angle.beta - tiltBaseline.beta),
    Math.abs(angle.gamma - tiltBaseline.gamma)
  );
}

function handlePhoneTilt(event) {
  if (!tiltEnabled || practiceLocked) return;
  const tilt = getPhoneTilt(event);

  if (!tiltDrinking && tilt >= tiltStart) {
    tiltDrinking = true;
    startPracticeDrink();
    phaseLabel.textContent = "Tilted, drinking";
  }

  if (tiltDrinking && tilt <= tiltStop) {
    stopPracticeDrink();
  }
}

function disableTiltMode() {
  tiltEnabled = false;
  tiltDrinking = false;
  tiltBaseline = null;
  tiltMode.textContent = "Enable tilt";
  tiltMode.setAttribute("aria-pressed", "false");
  practicePanel.classList.remove("is-tilt-ready");
  window.removeEventListener("deviceorientation", handlePhoneTilt);
  if (practiceInterval) stopPracticeDrink();
  if (!practiceLocked) {
    phaseLabel.textContent = "Line up the printed G";
    feedback.textContent =
      "Align the G bar with the gold line, take one steady sip, then show the glass to score the foam line.";
  }
}

async function enableTiltMode() {
  if (tiltEnabled) {
    disableTiltMode();
    return;
  }

  if (!("DeviceOrientationEvent" in window)) {
    verdict.textContent = "Tilt unavailable";
    feedback.textContent = "This browser does not expose phone tilt controls. Use touch practice instead.";
    tiltMode.disabled = true;
    return;
  }

  try {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        verdict.textContent = "Tilt blocked";
        feedback.textContent = "Allow motion access to use tilt mode, or use touch practice.";
        return;
      }
    }

    tiltEnabled = true;
    tiltBaseline = null;
    tiltMode.textContent = "Tilt on";
    tiltMode.setAttribute("aria-pressed", "true");
    practicePanel.classList.add("is-tilt-ready");
    phaseLabel.textContent = "Hold straight to calibrate";
    feedback.textContent =
      "Keep the glass upright on screen. Tip your phone to start drinking, then straighten it to stop and score.";
    window.addEventListener("deviceorientation", handlePhoneTilt);
  } catch (error) {
    verdict.textContent = "Tilt unavailable";
    feedback.textContent = "Motion access was not available. Use touch practice instead.";
  }
}

cameraBtn.addEventListener("click", startCamera);
sipBtn.addEventListener("click", startSip);
captureBtn.addEventListener("click", analyzeFoamLine);
soundToggle.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  localStorage.setItem("splitG.sound", soundEnabled ? "on" : "off");
  soundToggle.textContent = soundEnabled ? "Sound on" : "Sound off";
  soundStatus.textContent = soundEnabled ? "Sound on" : "Sound off";
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
});

practiceDrink.addEventListener("pointerdown", startPracticeDrink);
practiceDrink.addEventListener("pointerup", stopPracticeDrink);
practiceDrink.addEventListener("pointerleave", () => {
  if (practiceInterval) stopPracticeDrink();
});
practiceDrink.addEventListener("pointercancel", stopPracticeDrink);
practiceGlass.addEventListener("pointerdown", startPracticeDrink);
practiceGlass.addEventListener("pointerup", stopPracticeDrink);
practiceGlass.addEventListener("pointerleave", () => {
  if (practiceInterval) stopPracticeDrink();
});
practiceGlass.addEventListener("pointercancel", stopPracticeDrink);
tiltMode.addEventListener("click", enableTiltMode);
practiceReset.addEventListener("click", () => {
  clearInterval(practiceInterval);
  practiceInterval = null;
  practiceLocked = false;
  tiltDrinking = false;
  tiltBaseline = null;
  practiceGlass.classList.remove("is-drinking");
  practiceDrink.disabled = false;
  practiceDrink.textContent = "Hold to drink";
  stopSipClock();
  setPracticeLevel(100);
  setPracticeTargetBand();
  timer.textContent = "0.00s";
  phaseLabel.textContent = `Round ${practiceRound}`;
  scoreValue.textContent = "--";
  resultRing.style.setProperty("--score", 0);
  verdict.textContent = "Awaiting attempt";
  feedback.textContent =
    tiltEnabled
      ? `Round ${practiceRound}: tip your phone to drink, then straighten it when the foam line reaches the G.`
      : `Round ${practiceRound}: hold to drink and release when the foam line reaches the G.`;
  if (tiltEnabled) phaseLabel.textContent = "Hold straight to calibrate";
});

setPracticeLevel(practiceLevel);
setPracticeTargetBand();
