const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const ui = {
  distance: document.getElementById("distance"),
  best: document.getElementById("best"),
  coins: document.getElementById("coins"),
  toast: document.getElementById("toast"),
  launch: document.getElementById("launchButton"),
  restart: document.getElementById("restartButton"),
  shop: document.getElementById("shopPanel"),
  shopToggle: document.getElementById("shopToggle"),
  shopClose: document.getElementById("shopClose"),
  elasticLevel: document.getElementById("elasticLevel"),
  elasticCost: document.getElementById("elasticCost"),
  bounceLevel: document.getElementById("bounceLevel"),
  bounceCost: document.getElementById("bounceCost"),
  luckLevel: document.getElementById("luckLevel"),
  luckCost: document.getElementById("luckCost")
};

const saveKey = "pubSlingMadnessSaveV3";

const upgrades = JSON.parse(localStorage.getItem(saveKey) || "null") || {
  coins: 0,
  best: 0,
  elastic: 1,
  bounce: 1,
  luck: 1
};

const costs = {
  elastic: () => 30 + upgrades.elastic * 28,
  bounce: () => 35 + upgrades.bounce * 30,
  luck: () => 45 + upgrades.luck * 34
};

const boostTypes = [
  { kind: "pint", label: "Pint glass", color: "#f0b84d", good: true, vx: 430, vy: -760, coins: 10 },
  { kind: "roll", label: "Sausage roll", color: "#b87333", good: true, vx: 360, vy: -690, coins: 8 },
  { kind: "crisps", label: "Crisps", color: "#e44b3e", good: true, vx: 320, vy: -650, coins: 7 },
  { kind: "money", label: "Pot of gold", color: "#f7d85d", good: true, bonus: true, vx: 540, vy: -720, coins: 45 },
  { kind: "bones", label: "Fish bones", color: "#d9e0dc", good: false, vx: 0, vy: 0, coins: 0 },
  { kind: "na", label: "NA beer", color: "#93bfd2", good: false, vx: 0, vy: 0, coins: 0 },
  { kind: "toilet", label: "Stinky toilet", color: "#b6dbc9", good: false, vx: 0, vy: 0, coins: 0 }
];

const pubSigns = [
  { name: "The Fat Cat", icon: "cat", wall: "#9e5135", roof: "#5b2630", trim: "#e6c36c", sign: "oval", width: 136, height: 58, font: "900 16px Georgia" },
  { name: "Adam & Eve", icon: "apple", wall: "#8f3f34", roof: "#452a38", trim: "#f0cf73", sign: "crest", width: 158, height: 56, font: "900 15px Georgia" },
  { name: "Ribs of Beef", icon: "bone", wall: "#a6543b", roof: "#60303a", trim: "#e9bd5c", sign: "slant", width: 150, height: 48, font: "900 15px Trebuchet MS" },
  { name: "The Murderers", icon: "spade", wall: "#834335", roof: "#4c2a31", trim: "#ddb463", sign: "plank", width: 178, height: 44, font: "900 13px Georgia" },
  { name: "Kings Head", icon: "crown", wall: "#875438", roof: "#3f2938", trim: "#e4bd67", sign: "crest", width: 146, height: 58, font: "900 15px Georgia" },
  { name: "Plasterers Arms", icon: "trowel", wall: "#98523d", roof: "#552832", trim: "#dfc177", sign: "plank", width: 184, height: 46, font: "900 13px Trebuchet MS" },
  { name: "The Lamb Inn", icon: "lamb", wall: "#794a39", roof: "#4a2d3a", trim: "#e8c778", sign: "oval", width: 140, height: 54, font: "900 15px Georgia" },
  { name: "Coach & Horses", icon: "horse", wall: "#a05c3c", roof: "#5b3037", trim: "#e0b95f", sign: "slant", width: 178, height: 48, font: "900 13px Trebuchet MS" }
];

let W = 1280;
let H = 720;
let groundY = 575;
let lastTime = performance.now();
let held = false;
let holdStarted = 0;
let messageTimer = 0;
let objects = [];
let flyingObjects = [];
let particles = [];
let nextGroundSpawnX = 0;
let nextFlyingSpawnX = 0;

const state = {
  mode: "power",
  cameraX: 0,
  runBest: 0,
  earnedThisRun: 0,
  angleTime: 0,
  powerPulse: 0,
  lockedPower: 0,
  lockedAngle: -0.62,
  player: {
    x: 146,
    y: 500,
    vx: 0,
    vy: 0,
    angle: -0.25,
    spin: 0,
    radius: 50,
    hits: 0,
    onGroundTime: 0,
    doomed: false,
    bounceTrailTime: 0
  }
};

function save() {
  localStorage.setItem(saveKey, JSON.stringify(upgrades));
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = Math.floor(window.innerWidth * dpr);
  H = Math.floor(window.innerHeight * dpr);
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  W = window.innerWidth;
  H = window.innerHeight;
  groundY = Math.max(430, H - 128);
}

function resetRun() {
  state.mode = "power";
  state.cameraX = 0;
  state.runBest = 0;
  state.earnedThisRun = 0;
  state.angleTime = 0;
  state.powerPulse = 0;
  state.lockedPower = 0;
  state.lockedAngle = -0.62;
  state.player = {
    x: 146,
    y: groundY - 74,
    vx: 0,
    vy: 0,
    angle: -0.25,
    spin: 0,
    radius: 50,
    hits: 0,
    onGroundTime: 0,
    doomed: false,
    bounceTrailTime: 0
  };
  objects = [];
  flyingObjects = [];
  nextGroundSpawnX = 760 + Math.random() * 240;
  nextFlyingSpawnX = 1250 + Math.random() * 450;
  streamObjects(3600);
  particles = [];
  ui.launch.textContent = "Set Power";
  showMessage("Step 1: hold and release to set power.");
}

function makeGroundObject(x) {
  const level = difficultyLevelForX(x);
  const gapBase = Math.max(330 + level * 28 - upgrades.luck * 7, 235);
  const roll = Math.random() + upgrades.luck * 0.014 - level * 0.026;
  let type;
  if (roll > 0.982 + level * 0.004) type = boostTypes[3];
  else if (roll > 0.79 + level * 0.018) type = boostTypes[Math.floor(Math.random() * 3)];
  else if (roll > 0.18 - level * 0.015) type = boostTypes[4 + Math.floor(Math.random() * 3)];
  else type = boostTypes[Math.floor(Math.random() * boostTypes.length)];
  const lane = Math.random();
  objects.push({
    ...type,
    x: x + (Math.random() - 0.5) * 90,
    y: groundY - 24 - (lane > 0.78 ? 36 + Math.random() * 44 : 0),
    r: type.kind === "toilet" ? 42 : type.kind === "crisps" ? 36 : type.kind === "money" ? 40 : 31,
    used: false,
    wobble: Math.random() * Math.PI * 2
  });
  return gapBase + Math.random() * (430 + level * 24) + (Math.random() < 0.21 ? 360 + Math.random() * 520 : 0);
}

function makeFlyingObject(x) {
  const level = difficultyLevelForX(x);
  const baseY = groundY - 230 - Math.random() * 210;
  flyingObjects.push({
    kind: "pigeon",
    label: "Pigeon boost",
    good: true,
    airborne: true,
    bonus: false,
    x: x + (Math.random() - 0.5) * 220,
    y: baseY,
    baseY,
    vx: Math.max(430, 560 - level * 18),
    vy: Math.min(-680, -880 + level * 22),
    r: 34,
    coins: 14,
    used: false,
    wobble: Math.random() * Math.PI * 2,
    speed: 38 + Math.random() * 70
  });
  return 1450 + level * 160 + Math.random() * (1550 + level * 130);
}

function difficultyLevelForX(x) {
  return Math.min(10, Math.floor(Math.max(0, x - 1200) / 2200));
}

function streamObjects(targetX) {
  while (nextGroundSpawnX < targetX) {
    nextGroundSpawnX += makeGroundObject(nextGroundSpawnX);
  }
  while (nextFlyingSpawnX < targetX) {
    nextFlyingSpawnX += makeFlyingObject(nextFlyingSpawnX);
  }
}

function pruneObjects() {
  const cutoff = state.cameraX - 900;
  objects = objects.filter(object => object.x > cutoff && !object.used);
  flyingObjects = flyingObjects.filter(object => object.x > cutoff && !object.used);
}

function showMessage(text) {
  ui.toast.textContent = text;
  messageTimer = 3.2;
}

function launch() {
  if (state.mode !== "angle") return;
  const hold = state.lockedPower;
  const angle = state.lockedAngle;
  const power = 1280 + hold * 1050 + upgrades.elastic * 180;
  state.player.vx = Math.cos(angle) * power;
  state.player.vy = Math.sin(angle) * power;
  state.player.spin = 7.5 + hold * 6.5;
  state.mode = "flight";
  ui.launch.textContent = "Flying";
  showMessage("Mind the fish bones. Aim for pints, sausage rolls, and crisps.");
}

function awardRun() {
  const meters = Math.floor(state.runBest / 10);
  const payout = Math.max(5, Math.floor(meters / 8)) + state.earnedThisRun;
  upgrades.coins += payout;
  upgrades.best = Math.max(upgrades.best, meters);
  save();
  updateUi();
  state.mode = "ended";
  ui.launch.textContent = "Hold to Pull";
  showMessage(`Run over: ${meters}m. You earned ${payout} coins.`);
}

function update(dt) {
  if (messageTimer > 0) messageTimer -= dt;
  ui.toast.style.opacity = messageTimer > 0 ? "1" : "0.38";

  if (state.mode === "power") {
    state.powerPulse = held ? 0.5 + Math.sin((performance.now() - holdStarted) / 170) * 0.5 : state.powerPulse;
  }

  if (state.mode === "angle") {
    state.angleTime += dt;
    const wave = 0.5 + Math.sin(state.angleTime * 2.25) * 0.5;
    state.lockedAngle = -0.77 + wave * 0.34;
  }

  if (state.mode === "flight") {
    const p = state.player;
    const gravity = p.bounceTrailTime > 0 ? 410 : 520;
    p.vy += gravity * dt;
    p.vx *= p.bounceTrailTime > 0 ? 0.999 : 0.997;
    p.vy *= 0.999;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.spin * dt;
    p.spin *= 0.997;
    if (p.bounceTrailTime > 0) {
      p.bounceTrailTime -= dt;
      if (Math.random() < 0.85) sparkleTrail(p.x, p.y + p.radius * 0.45);
    }

    if (p.y > groundY - p.radius) {
      p.y = groundY - p.radius;
      if (p.doomed) {
        p.vy = 0;
        p.vx *= 0.28;
        p.spin *= 0.55;
        p.onGroundTime += dt;
        if (p.onGroundTime > 0.45) awardRun();
      } else if (Math.abs(p.vy) > 150 || p.vx > 75) {
        const bounce = 0.36 + upgrades.bounce * 0.04;
        p.vy = -Math.abs(p.vy) * bounce - 105;
        const momentumFloor = Math.max(460, 760 - p.hits * 55);
        p.vx = Math.max(p.vx * 1.08 + 90, momentumFloor);
        p.spin *= -0.65;
        p.hits += 1;
        p.bounceTrailTime = 2.4;
        burst(p.x, groundY - 12, true, 16);
        showMessage(["Foam bounce!", "The glass skims on momentum.", "Bounce trail active."][p.hits % 3]);
      } else {
        p.onGroundTime += dt;
        p.vx = p.bounceTrailTime > 0 ? Math.max(p.vx * 0.96, 360) : p.vx * 0.88;
        if (p.onGroundTime > 1.1) awardRun();
      }
    } else {
      p.onGroundTime = 0;
    }

    for (const object of [...objects, ...flyingObjects]) {
      if (object.used) continue;
      if (object.airborne) object.y = object.baseY + Math.sin(performance.now() / 330 + object.wobble) * 22;
      const dx = object.x - p.x;
      const dy = object.y - p.y;
      const hit = Math.hypot(dx, dy) < p.radius + object.r;
      if (!hit) continue;
      object.used = true;
      burst(object.x, object.y, object.good, object.bonus ? 34 : 22);
      if (object.good) {
        const impactSpeed = Math.min(Math.hypot(p.vx, p.vy), 2600);
        const level = difficultyLevelForX(p.x);
        const airBonus = object.airborne ? Math.max(1.16, 1.42 - level * 0.025) : 1;
        const jackpot = object.bonus ? Math.max(1.02, 1.08 - level * 0.006) : 1;
        const speedBoost = 0.85 + impactSpeed / 820;
        const difficultyDrag = Math.max(0.68, 1 - level * 0.028);
        const kick = speedBoost * (1 + upgrades.bounce * 0.09) * airBonus * jackpot * difficultyDrag;
        if (object.bonus) {
          p.vx = Math.max(p.vx * 1.18 + object.vx * kick * 1.45, 1650);
          p.vy = Math.min(p.vy, -300 - Math.abs(p.vy) * 0.2 - Math.abs(object.vy) * 0.28 * kick);
        } else {
          p.vx = Math.max(p.vx * 1.06 + object.vx * kick * 1.35, object.airborne ? 1380 : 1080);
          p.vy = Math.min(p.vy, -230 - Math.abs(p.vy) * 0.34 - Math.abs(object.vy) * 0.48 * kick);
        }
        p.spin += 7 + impactSpeed / 260;
        p.bounceTrailTime = Math.max(1.5, (object.airborne || object.bonus ? 3.0 : 2.1) - level * 0.08);
        state.earnedThisRun += object.coins;
        showMessage(object.bonus ? `${object.label}! Forward jackpot bounce.` : object.airborne ? `${object.label}! Turbo boost.` : `${object.label}! Speed bounce.`);
      } else {
        p.vx *= 0.035;
        p.vy = Math.min(p.vy * 0.06, -45);
        p.spin = -1.4;
        p.doomed = true;
        showMessage(`${object.label}! Bad landing. Run killed.`);
      }
    }

    state.runBest = Math.max(state.runBest, p.x - 146);
    state.cameraX = Math.max(0, p.x - W * 0.36);
    streamObjects(Math.max(p.x, state.cameraX + W) + 5200);
    pruneObjects();
    if (p.doomed && p.vx < 45 && p.y >= groundY - p.radius - 1) awardRun();
    if (p.y > H + 300 || p.x < state.cameraX - 400) awardRun();
  }

  updateParticles(dt);
  updateUi();
}

function updateUi() {
  const meters = Math.floor(state.runBest / 10);
  ui.distance.textContent = `${meters}m`;
  ui.best.textContent = `${Math.max(upgrades.best, meters)}m`;
  ui.coins.textContent = upgrades.coins;
  for (const key of ["elastic", "bounce", "luck"]) {
    ui[`${key}Level`].textContent = `Lv ${upgrades[key]}`;
    ui[`${key}Cost`].textContent = upgrades[key] >= 8 ? "Maxed" : `${costs[key]()} coins`;
    const button = document.querySelector(`[data-upgrade="${key}"]`);
    button.disabled = upgrades[key] >= 8;
    button.classList.toggle("affordable", upgrades.coins >= costs[key]() && upgrades[key] < 8);
  }
}

function buyUpgrade(key) {
  if (upgrades[key] >= 8) return;
  const cost = costs[key]();
  if (upgrades.coins < cost) {
    showMessage("Not enough coins yet. One more glorious roof-skimming launch?");
    return;
  }
  upgrades.coins -= cost;
  upgrades[key] += 1;
  save();
  updateUi();
  showMessage(`${key === "elastic" ? "Better Sling" : key === "bounce" ? "Stout Boots" : "Pub Luck"} upgraded.`);
}

function setShopOpen(open) {
  ui.shop.classList.toggle("open", open);
  ui.shop.setAttribute("aria-hidden", open ? "false" : "true");
  ui.shopToggle.setAttribute("aria-expanded", open ? "true" : "false");
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawSky();
  drawDistantTown();
  drawRoofs();
  drawGround();
  drawObjects();
  drawFlyingObjects();
  drawSling();
  drawPlayer();
  drawParticles();
  drawOverlay();
}

function drawSky() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#55a6df");
  gradient.addColorStop(0.48, "#bfe3ef");
  gradient.addColorStop(1, "#f4c168");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(0, groundY - 15, W, 15);
  ctx.fillStyle = "rgba(255,255,255,0.68)";
  for (let i = 0; i < 10; i++) {
    const x = ((i * 310 - state.cameraX * 0.14) % (W + 280)) - 140;
    const y = 70 + (i % 4) * 42;
    cloud(x, y, 42 + (i % 3) * 10);
  }
  drawNorwichLandmarks();
}

function cloud(x, y, r) {
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.45, 0, 0, Math.PI * 2);
  ctx.ellipse(x + r * 0.55, y - 8, r * 0.86, r * 0.5, 0, 0, Math.PI * 2);
  ctx.ellipse(x + r * 1.18, y + 1, r * 0.72, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDistantTown() {
  const baseY = groundY - 152;
  for (let i = -2; i < 18; i++) {
    const x = i * 180 - (state.cameraX * 0.36 % 180);
    const y = baseY + (i % 3) * 12;
    ctx.fillStyle = i % 2 ? "#8d5a43" : "#6f4f44";
    roundRect(x, y, 138, 128, 8);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x + 10, y + 10, 118, 10);
    ctx.fillStyle = i % 2 ? "#5d2f2c" : "#4f3037";
    roof(x - 9, baseY + (i % 3) * 12, 156, 54);
    ctx.fillStyle = "rgba(255,224,133,0.52)";
    for (let j = 0; j < 3; j++) {
      ctx.fillRect(x + 22 + j * 34, baseY + 50 + (i % 3) * 12, 14, 20);
    }
  }
}

function drawNorwichLandmarks() {
  const horizon = groundY - 195;
  const offset = state.cameraX * 0.18;
  drawCathedral(((260 - offset) % (W + 1200)) - 220, horizon - 90);
  drawCastle(((780 - offset) % (W + 1200)) - 220, horizon - 28);
  drawChurch(((1110 - offset) % (W + 1200)) - 220, horizon - 54);
}

function drawCathedral(x, y) {
  ctx.save();
  ctx.globalAlpha = 0.74;
  ctx.fillStyle = "#d8c4a2";
  ctx.strokeStyle = "rgba(94, 70, 54, 0.42)";
  ctx.lineWidth = 2;
  roundRect(x, y + 102, 190, 68, 6);
  ctx.strokeRect(x + 18, y + 122, 22, 31);
  ctx.strokeRect(x + 55, y + 118, 24, 35);
  ctx.strokeRect(x + 112, y + 118, 24, 35);
  ctx.strokeRect(x + 150, y + 122, 22, 31);
  ctx.fillStyle = "#b69a79";
  ctx.fillRect(x + 80, y + 58, 30, 114);
  ctx.beginPath();
  ctx.moveTo(x + 95, y);
  ctx.lineTo(x + 112, y + 60);
  ctx.lineTo(x + 78, y + 60);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#efe1bf";
  ctx.fillRect(x + 88, y + 86, 14, 53);
  ctx.restore();
}

function drawCastle(x, y) {
  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = "#c9b18d";
  ctx.strokeStyle = "rgba(82, 58, 43, 0.42)";
  ctx.lineWidth = 2;
  roundRect(x, y + 70, 170, 92, 5);
  for (let i = 0; i < 5; i++) ctx.fillRect(x + 10 + i * 32, y + 52, 20, 23);
  ctx.strokeRect(x + 32, y + 93, 24, 38);
  ctx.strokeRect(x + 112, y + 93, 24, 38);
  ctx.fillStyle = "#9a7a5d";
  ctx.beginPath();
  ctx.arc(x + 85, y + 162, 18, Math.PI, Math.PI * 2);
  ctx.lineTo(x + 103, y + 162);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawChurch(x, y) {
  ctx.save();
  ctx.globalAlpha = 0.68;
  ctx.fillStyle = "#cdb894";
  ctx.strokeStyle = "rgba(82, 58, 43, 0.38)";
  ctx.lineWidth = 2;
  roundRect(x, y + 92, 128, 64, 5);
  ctx.fillStyle = "#b19676";
  ctx.fillRect(x + 16, y + 42, 34, 114);
  ctx.beginPath();
  ctx.moveTo(x + 33, y + 8);
  ctx.lineTo(x + 52, y + 43);
  ctx.lineTo(x + 14, y + 43);
  ctx.closePath();
  ctx.fill();
  ctx.strokeRect(x + 75, y + 112, 20, 30);
  ctx.strokeRect(x + 105, y + 112, 14, 30);
  ctx.restore();
}

function drawRoofs() {
  for (let i = -2; i < 16; i++) {
    const x = i * 270 - (state.cameraX * 0.72 % 270);
    const y = groundY - 104 - (i % 2) * 16;
    const pub = pubSigns[Math.abs(i) % pubSigns.length];
    drawPub(x, y, pub);
  }
}

function drawPub(x, y, pub) {
  ctx.fillStyle = "rgba(30,18,15,0.26)";
  roundRect(x + 8, y + 82, 238, 24, 6);
  ctx.fillStyle = pub.wall;
  roundRect(x + 16, y + 42, 228, 98, 7);
  ctx.fillStyle = "rgba(255,236,185,0.14)";
  ctx.fillRect(x + 26, y + 54, 196, 8);
  ctx.fillStyle = pub.roof;
  roof(x, y, 262, 68);

  ctx.fillStyle = "#2b211b";
  ctx.fillRect(x + 185, y - 38, 28, 46);
  ctx.fillStyle = "#4a3024";
  ctx.fillRect(x + 178, y - 47, 42, 12);

  ctx.strokeStyle = pub.trim;
  ctx.lineWidth = 5;
  ctx.strokeRect(x + 36, y + 78, 34, 38);
  ctx.strokeRect(x + 92, y + 78, 34, 38);
  ctx.fillStyle = "#ffd96e";
  ctx.fillRect(x + 41, y + 83, 24, 28);
  ctx.fillRect(x + 97, y + 83, 24, 28);

  ctx.fillStyle = "#2d1f18";
  roundRect(x + 148, y + 78, 42, 62, 5);
  ctx.fillStyle = "#dca84d";
  ctx.beginPath();
  ctx.arc(x + 181, y + 109, 3, 0, Math.PI * 2);
  ctx.fill();

  drawPubSign(x + 57, y + 34, pub);
}

function drawPubSign(x, y, pub) {
  const w = pub.width;
  const h = pub.height;
  ctx.strokeStyle = "#2a1c15";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y - 24);
  ctx.lineTo(x + w * 0.5, y + 10);
  ctx.stroke();
  drawSignShape(x, y, w, h, pub.sign, "#2a1c15", true);
  drawSignShape(x + 4, y + 4, w - 8, h - 8, pub.sign, "#f0d38a", true);
  ctx.strokeStyle = pub.roof;
  ctx.lineWidth = 3;
  drawSignShape(x + 9, y + 9, w - 18, h - 18, pub.sign, "", false);
  ctx.fillStyle = "#60331e";
  ctx.font = pub.font;
  ctx.textAlign = "center";
  ctx.fillText(pub.name, x + w * 0.58, y + h * 0.6);

  ctx.save();
  ctx.translate(x + w * 0.16, y + h * 0.55);
  ctx.scale(0.34, 0.34);
  if (pub.icon === "pint") drawPint("#e6a43d");
  if (pub.icon === "crown") drawCrownIcon();
  if (pub.icon === "boot") drawBoot(0, -6, -0.1);
  if (pub.icon === "cat") drawCatIcon();
  if (pub.icon === "apple") drawAppleIcon();
  if (pub.icon === "bone") drawPubBoneIcon();
  if (pub.icon === "spade") drawSpadeIcon();
  if (pub.icon === "trowel") drawTrowelIcon();
  if (pub.icon === "lamb") drawLambIcon();
  if (pub.icon === "horse") drawHorseIcon();
  ctx.restore();
}

function drawSignShape(x, y, w, h, shape, fill, shouldFill) {
  ctx.beginPath();
  if (shape === "oval") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (shape === "crest") {
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + w - 8, y);
    ctx.lineTo(x + w, y + h * 0.58);
    ctx.quadraticCurveTo(x + w * 0.5, y + h + 12, x, y + h * 0.58);
    ctx.closePath();
  } else if (shape === "slant") {
    ctx.moveTo(x + 12, y);
    ctx.lineTo(x + w, y + 5);
    ctx.lineTo(x + w - 14, y + h);
    ctx.lineTo(x, y + h - 5);
    ctx.closePath();
  } else {
    ctx.moveTo(x + 7, y);
    ctx.lineTo(x + w - 9, y + 3);
    ctx.lineTo(x + w, y + h - 8);
    ctx.lineTo(x + 12, y + h);
    ctx.lineTo(x, y + 8);
    ctx.closePath();
  }
  if (shouldFill) {
    ctx.fillStyle = fill;
    ctx.fill();
  } else {
    ctx.stroke();
  }
}

function roof(x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w * 0.12, y + h * 0.22);
  ctx.lineTo(x + w * 0.5, y);
  ctx.lineTo(x + w * 0.88, y + h * 0.22);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(44,28,24,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawGround() {
  const ground = ctx.createLinearGradient(0, groundY, 0, H);
  ground.addColorStop(0, "#775035");
  ground.addColorStop(1, "#402a1d");
  ctx.fillStyle = ground;
  ctx.fillRect(0, groundY, W, H - groundY);
  ctx.fillStyle = "#3c2d21";
  for (let i = -2; i < 24; i++) {
    const x = i * 92 - (state.cameraX % 92);
    ctx.fillRect(x, groundY + 26 + (i % 2) * 22, 68, 10);
  }
  ctx.strokeStyle = "rgba(255,227,158,0.22)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 5);
  ctx.lineTo(W, groundY + 5);
  ctx.stroke();
}

function drawObjects() {
  for (const object of objects) {
    const sx = object.x - state.cameraX;
    if (sx < -120 || sx > W + 120 || object.used) continue;
    const y = object.y + Math.sin(performance.now() / 250 + object.wobble) * 2;
    ctx.save();
    ctx.translate(sx, y);
    drawItemBadge(object.good);
    if (object.kind === "pint") drawPint(object.color);
    if (object.kind === "roll") drawSausageRoll(object.color);
    if (object.kind === "crisps") drawCrisps(object.color);
    if (object.kind === "money") drawMoneyPot();
    if (object.kind === "bones") drawBones();
    if (object.kind === "na") drawNABeer();
    if (object.kind === "toilet") drawToilet();
    ctx.restore();
  }
}

function drawFlyingObjects() {
  for (const object of flyingObjects) {
    const sx = object.x - state.cameraX;
    if (sx < -140 || sx > W + 160 || object.used) continue;
    const y = object.baseY + Math.sin(performance.now() / 330 + object.wobble) * 22;
    object.y = y;
    ctx.save();
    ctx.translate(sx, y);
    ctx.rotate(Math.sin(performance.now() / 260 + object.wobble) * 0.12);
    drawItemBadge(true);
    if (object.kind === "pigeon") drawPigeon();
    ctx.restore();
  }
}

function drawItemBadge(good) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  const glow = ctx.createRadialGradient(0, -25, 4, 0, -25, 58);
  glow.addColorStop(0, good ? "rgba(255,222,100,0.7)" : "rgba(236,67,62,0.58)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -25, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = good ? "#40b763" : "#d83a32";
  ctx.strokeStyle = "#fff8dc";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(-30, -58, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#fff8dc";
  ctx.lineWidth = 4;
  ctx.beginPath();
  if (good) {
    ctx.moveTo(-38, -58);
    ctx.lineTo(-32, -52);
    ctx.lineTo(-22, -64);
  } else {
    ctx.moveTo(-36, -64);
    ctx.lineTo(-24, -52);
    ctx.moveTo(-24, -64);
    ctx.lineTo(-36, -52);
  }
  ctx.stroke();
  ctx.restore();
}

function drawPint(color) {
  ctx.save();
  ctx.rotate(-0.05);
  ctx.fillStyle = "rgba(15, 10, 7, 0.25)";
  ctx.beginPath();
  ctx.ellipse(1, 5, 32, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  roundedTaperedGlass(-21, -60, 42, 62);
  const ale = ctx.createLinearGradient(0, -48, 0, 0);
  ale.addColorStop(0, "#ffd774");
  ale.addColorStop(1, color);
  ctx.fillStyle = ale;
  ctx.beginPath();
  ctx.moveTo(-15, -35);
  ctx.bezierCurveTo(-4, -29, 8, -41, 17, -34);
  ctx.lineTo(12, -3);
  ctx.quadraticCurveTo(0, 2, -12, -3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#fff7dc";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(22, -30, 13, -1.2, 1.3);
  ctx.stroke();
  ctx.fillStyle = "#fff7dc";
  ctx.beginPath();
  ctx.ellipse(0, -50, 26, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2a1a12";
  ctx.lineWidth = 3;
  roundedTaperedGlassStroke(-21, -60, 42, 62);
  ctx.restore();
}

function drawSausageRoll(color) {
  ctx.save();
  ctx.rotate(-0.2);
  const pastry = ctx.createLinearGradient(0, -44, 0, -8);
  pastry.addColorStop(0, "#ffd987");
  pastry.addColorStop(1, color);
  ctx.fillStyle = pastry;
  roundRect(-38, -42, 76, 32, 16);
  ctx.fillStyle = "#7b3218";
  roundRect(-27, -31, 54, 12, 6);
  ctx.strokeStyle = "#fff0a9";
  ctx.lineWidth = 4;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 14 - 3, -39);
    ctx.lineTo(i * 14 + 6, -13);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrisps(color) {
  ctx.save();
  ctx.rotate(0.16);
  ctx.fillStyle = "rgba(15, 10, 7, 0.25)";
  ctx.beginPath();
  ctx.ellipse(3, 1, 40, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  const bag = ctx.createLinearGradient(0, -70, 0, 3);
  bag.addColorStop(0, "#ffec75");
  bag.addColorStop(0.48, "#f24e38");
  bag.addColorStop(1, "#a91f2e");
  ctx.fillStyle = bag;
  ctx.beginPath();
  ctx.moveTo(-35, -65);
  ctx.bezierCurveTo(-18, -72, 16, -69, 35, -62);
  ctx.bezierCurveTo(28, -42, 42, -18, 31, 0);
  ctx.bezierCurveTo(8, -7, -16, 8, -34, -2);
  ctx.bezierCurveTo(-27, -23, -43, -42, -35, -65);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#2a1a12";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.moveTo(-23, -58);
  ctx.quadraticCurveTo(0, -52, 24, -59);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#ffe07e";
  ctx.beginPath();
  ctx.ellipse(0, -30, 21, 18, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6f2c1f";
  ctx.font = "900 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("PUB", 0, -32);
  ctx.font = "900 10px system-ui";
  ctx.fillText("CRISPS", 0, -19);
  ctx.fillStyle = "#ffd65e";
  ctx.beginPath();
  ctx.ellipse(-20, -5, 8, 5, -0.4, 0, Math.PI * 2);
  ctx.ellipse(19, -7, 9, 5, 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBones() {
  ctx.save();
  ctx.rotate(0.16);
  drawStink(-34, -65, 0.75);
  drawStink(28, -70, 0.58);
  ctx.strokeStyle = "#2b2b28";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-43, -33);
  ctx.lineTo(34, -18);
  ctx.stroke();
  ctx.strokeStyle = "#f4f1df";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-43, -33);
  ctx.lineTo(34, -18);
  ctx.stroke();
  ctx.fillStyle = "#f4f1df";
  ctx.strokeStyle = "#2b2b28";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-43, -33);
  ctx.quadraticCurveTo(-62, -50, -72, -31);
  ctx.quadraticCurveTo(-58, -12, -43, -33);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2b2b28";
  ctx.beginPath();
  ctx.arc(-56, -32, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f4f1df";
  ctx.lineWidth = 4;
  for (let i = -2; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-8 + i * 9, -27 + i * 1.6);
    ctx.lineTo(-2 + i * 9, -43 + i * 1.6);
    ctx.moveTo(-8 + i * 9, -27 + i * 1.6);
    ctx.lineTo(-1 + i * 9, -12 + i * 1.6);
    ctx.stroke();
  }
  ctx.fillStyle = "#f4f1df";
  ctx.beginPath();
  ctx.moveTo(35, -18);
  ctx.lineTo(59, -34);
  ctx.lineTo(54, -18);
  ctx.lineTo(62, -5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#2b2b28";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawNABeer() {
  ctx.save();
  ctx.rotate(-0.12);
  ctx.fillStyle = "rgba(15, 10, 7, 0.25)";
  ctx.beginPath();
  ctx.ellipse(2, 1, 26, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  const can = ctx.createLinearGradient(0, -66, 0, 4);
  can.addColorStop(0, "#bdeaff");
  can.addColorStop(0.44, "#43b4dc");
  can.addColorStop(1, "#1c6985");
  ctx.fillStyle = can;
  roundRect(-22, -68, 44, 70, 9);
  ctx.strokeStyle = "#20313b";
  ctx.lineWidth = 4;
  roundStroke(-22, -68, 44, 70, 9);
  ctx.fillStyle = "#f8f5de";
  roundRect(-16, -47, 32, 34, 5);
  ctx.fillStyle = "#2c5662";
  ctx.font = "900 15px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("0.0", 0, -28);
  ctx.strokeStyle = "#2c5662";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -13, 10, Math.PI + 0.2, Math.PI * 2 - 0.2);
  ctx.stroke();
  ctx.fillStyle = "#2c5662";
  ctx.beginPath();
  ctx.arc(-8, -22, 2.5, 0, Math.PI * 2);
  ctx.arc(8, -22, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e7f8ff";
  ctx.fillRect(-13, -63, 26, 5);
  ctx.restore();
}

function drawMoneyPot() {
  ctx.save();
  ctx.fillStyle = "rgba(15, 10, 7, 0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 5, 45, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  const pot = ctx.createLinearGradient(0, -42, 0, 10);
  pot.addColorStop(0, "#1a1a18");
  pot.addColorStop(0.55, "#37302a");
  pot.addColorStop(1, "#11100f");
  ctx.fillStyle = pot;
  ctx.beginPath();
  ctx.moveTo(-38, -31);
  ctx.quadraticCurveTo(-47, -4, -25, 13);
  ctx.lineTo(25, 13);
  ctx.quadraticCurveTo(47, -4, 38, -31);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#060504";
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = "#2f2a25";
  ctx.beginPath();
  ctx.ellipse(0, -34, 43, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  for (let i = 0; i < 14; i++) {
    const cx = -30 + (i % 7) * 10 + (i > 6 ? 5 : 0);
    const cy = -42 - (i > 6 ? 12 : 0) + Math.sin(i * 1.7) * 4;
    const coin = ctx.createRadialGradient(cx - 2, cy - 2, 1, cx, cy, 8);
    coin.addColorStop(0, "#fff8a8");
    coin.addColorStop(0.5, "#f5c944");
    coin.addColorStop(1, "#ba7615");
    ctx.fillStyle = coin;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 8, 6, Math.sin(i) * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7a4c10";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = "#f8dc58";
  ctx.font = "900 22px Georgia";
  ctx.textAlign = "center";
  ctx.fillText("$", 0, -3);
  ctx.restore();
}

function drawPigeon() {
  ctx.save();
  ctx.fillStyle = "rgba(15, 10, 7, 0.24)";
  ctx.beginPath();
  ctx.ellipse(3, 10, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8798a6";
  ctx.strokeStyle = "#2a1a12";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(-4, -18, 34, 21, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#c8d5dc";
  ctx.beginPath();
  ctx.moveTo(-18, -24);
  ctx.quadraticCurveTo(-45, -61, -74, -32);
  ctx.quadraticCurveTo(-48, -33, -23, -12);
  ctx.closePath();
  ctx.moveTo(6, -24);
  ctx.quadraticCurveTo(34, -58, 67, -28);
  ctx.quadraticCurveTo(39, -29, 11, -10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#2a1a12";
  ctx.stroke();
  ctx.strokeStyle = "#8597a5";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-50, -37);
  ctx.lineTo(-24, -18);
  ctx.moveTo(45, -34);
  ctx.lineTo(13, -17);
  ctx.stroke();
  ctx.fillStyle = "#7f95a8";
  ctx.beginPath();
  ctx.arc(27, -33, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#4f6574";
  ctx.beginPath();
  ctx.moveTo(-32, -17);
  ctx.lineTo(-55, -5);
  ctx.lineTo(-32, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f0c15a";
  ctx.beginPath();
  ctx.moveTo(40, -33);
  ctx.lineTo(57, -28);
  ctx.lineTo(40, -22);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#10100e";
  ctx.beginPath();
  ctx.arc(30, -37, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ffd65e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-19, -4);
  ctx.lineTo(-29, 11);
  ctx.moveTo(-6, 0);
  ctx.lineTo(-13, 13);
  ctx.stroke();
  ctx.restore();
}

function drawToilet() {
  ctx.save();
  drawStink(-38, -92, 0.9);
  drawStink(12, -105, 0.7);
  drawStink(41, -82, 0.62);
  ctx.fillStyle = "#244b3f";
  roundRect(-35, -69, 58, 44, 12);
  ctx.fillStyle = "#d6f0e5";
  roundRect(-31, -74, 55, 44, 12);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  roundRect(-22, -67, 18, 28, 6);
  ctx.fillStyle = "#f6fff9";
  ctx.beginPath();
  ctx.ellipse(4, -22, 34, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2b4b40";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#203c3e";
  ctx.beginPath();
  ctx.ellipse(3, -23, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8bb45e";
  ctx.beginPath();
  ctx.arc(4, -23, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#243b3c";
  ctx.font = "900 11px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("STINK", 1, -48);
  ctx.restore();
}

function drawSling() {
  const baseX = 92 - state.cameraX;
  if (baseX < -230) return;
  ctx.save();
  ctx.translate(baseX, groundY - 18);
  ctx.fillStyle = "#57371f";
  ctx.fillRect(-8, -148, 16, 148);
  ctx.fillRect(86, -148, 16, 148);
  ctx.strokeStyle = "#2b160d";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, -145);
  ctx.quadraticCurveTo(48, -118 + state.powerPulse * 44, 94, -145);
  ctx.stroke();
  ctx.strokeStyle = "#cf9b5a";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = "#47301d";
  ctx.beginPath();
  ctx.ellipse(48, -114 + state.powerPulse * 48, 34, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c48a42";
  ctx.fillRect(-25, -10, 144, 18);
  ctx.restore();

  if (state.mode === "power" || state.mode === "angle") {
    const angle = state.mode === "angle" ? state.lockedAngle : -0.62;
    const x = 145;
    const y = groundY - 110;
    if (state.mode === "angle") drawPointingArm(x, y, angle);
    drawPowerMeter(24, groundY - 294, state.mode === "power" ? state.powerPulse : state.lockedPower);
    drawLaunchStepLabel(x + 110, y - 118);
  }
}

function isLaunchSetupMode() {
  return state.mode === "power" || state.mode === "angle";
}

function drawPointingArm(x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = "rgba(34, 22, 13, 0.2)";
  ctx.beginPath();
  ctx.ellipse(78, 29, 112, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e59a72";
  ctx.strokeStyle = "#2b160d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-54, -15);
  ctx.bezierCurveTo(-7, -17, 42, -14, 84, -8);
  ctx.lineTo(86, 15);
  ctx.bezierCurveTo(40, 22, -7, 21, -56, 16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const skin = ctx.createLinearGradient(-40, -18, 120, 18);
  skin.addColorStop(0, "#d98b62");
  skin.addColorStop(0.58, "#f2b089");
  skin.addColorStop(1, "#f6c29c");
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-56, -11);
  ctx.bezierCurveTo(-6, -12, 43, -10, 80, -4);
  ctx.lineTo(81, 11);
  ctx.bezierCurveTo(42, 16, -9, 15, -56, 11);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f7c39d";
  ctx.strokeStyle = "#2b160d";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(72, -17);
  ctx.bezierCurveTo(87, -28, 114, -22, 121, -6);
  ctx.bezierCurveTo(129, 12, 115, 29, 94, 25);
  ctx.bezierCurveTo(77, 22, 68, 8, 72, -17);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#f7c39d";
  roundRect(111, -20, 86, 13, 7);
  roundStroke(111, -20, 86, 13, 7);

  ctx.fillStyle = "#f7c39d";
  ctx.beginPath();
  ctx.ellipse(201, -13, 7, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#eca77f";
  for (let i = 0; i < 3; i++) {
    const fy = -2 + i * 10;
    roundRect(87, fy, 42, 10, 6);
    roundStroke(87, fy, 42, 10, 6);
  }

  ctx.fillStyle = "#f2b089";
  ctx.beginPath();
  ctx.ellipse(82, 1, 13, 9, -0.65, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(87, 40, 22, 0.52)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(126, -14);
  ctx.lineTo(190, -14);
  ctx.moveTo(92, 5);
  ctx.lineTo(121, 5);
  ctx.moveTo(91, 15);
  ctx.lineTo(118, 15);
  ctx.stroke();

  ctx.restore();
}

function drawLaunchStepLabel(x, y) {
  ctx.save();
  ctx.fillStyle = "rgba(34, 22, 13, 0.72)";
  roundRect(x - 8, y - 22, 156, 42, 8);
  ctx.fillStyle = "#fff7d4";
  ctx.font = "900 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(state.mode === "power" ? "1. SET POWER" : "2. SET ANGLE", x + 70, y - 4);
  ctx.fillStyle = state.mode === "power" ? "#f6c85f" : "#55d5ff";
  ctx.font = "800 10px system-ui";
  ctx.fillText(state.mode === "power" ? "release to lock" : "release to launch", x + 70, y + 11);
  ctx.restore();
}

function drawPowerMeter(x, y, power) {
  ctx.save();
  ctx.fillStyle = "rgba(34, 22, 13, 0.72)";
  roundRect(x - 5, y - 5, 32, 108, 8);
  const meter = ctx.createLinearGradient(0, y + 96, 0, y);
  meter.addColorStop(0, "#49bb6c");
  meter.addColorStop(0.5, "#f6c85f");
  meter.addColorStop(1, "#e14d3f");
  ctx.fillStyle = meter;
  roundRect(x, y + 96 - power * 96, 22, Math.max(7, power * 96), 6);
  ctx.strokeStyle = "#2b160d";
  ctx.lineWidth = 3;
  roundStroke(x, y, 22, 96, 6);
  ctx.fillStyle = "#fff7d4";
  ctx.font = "900 10px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("POWER", x + 11, y + 119);
  ctx.restore();
}

function drawPlayer() {
  const p = state.player;
  const x = p.x - state.cameraX;
  const y = p.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(p.angle);
  drawFlyingPintGlass(126, 146);
  ctx.restore();
}

function drawFlyingPintGlass(w, h) {
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = "#10100e";
  ctx.beginPath();
  ctx.ellipse(8, h * 0.42, w * 0.42, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.scale(w / 126, h / 146);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.fillStyle = "rgba(16, 12, 9, 0.34)";
  ctx.beginPath();
  ctx.moveTo(-36, -54);
  ctx.lineTo(38, -54);
  ctx.lineTo(28, 60);
  ctx.lineTo(-28, 60);
  ctx.closePath();
  ctx.fill();

  const glass = ctx.createLinearGradient(0, -66, 0, 70);
  glass.addColorStop(0, "rgba(255,255,255,0.9)");
  glass.addColorStop(0.5, "rgba(205,237,255,0.42)");
  glass.addColorStop(1, "rgba(255,255,255,0.74)");
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(-38, -58);
  ctx.quadraticCurveTo(0, -70, 39, -58);
  ctx.lineTo(29, 60);
  ctx.quadraticCurveTo(0, 72, -29, 60);
  ctx.closePath();
  ctx.fill();

  const ale = ctx.createLinearGradient(0, -20, 0, 62);
  ale.addColorStop(0, "#ffd76b");
  ale.addColorStop(0.55, "#efa62d");
  ale.addColorStop(1, "#b96618");
  ctx.fillStyle = ale;
  ctx.beginPath();
  ctx.moveTo(-30, -22);
  ctx.bezierCurveTo(-12, -15, 12, -30, 31, -21);
  ctx.lineTo(25, 55);
  ctx.quadraticCurveTo(0, 64, -25, 55);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff7dd";
  ctx.beginPath();
  ctx.ellipse(0, -52, 43, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-20, -61, 16, 13, 0, 0, Math.PI * 2);
  ctx.ellipse(2, -64, 21, 15, 0, 0, Math.PI * 2);
  ctx.ellipse(24, -59, 17, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-17, -17);
  ctx.lineTo(-21, 45);
  ctx.moveTo(18, -17);
  ctx.lineTo(13, 45);
  ctx.stroke();

  ctx.strokeStyle = "#231812";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-38, -58);
  ctx.quadraticCurveTo(0, -70, 39, -58);
  ctx.lineTo(29, 60);
  ctx.quadraticCurveTo(0, 72, -29, 60);
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = "#5e3218";
  ctx.beginPath();
  ctx.arc(-11, 12, 3, 0, Math.PI * 2);
  ctx.arc(11, 12, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundedTaperedGlass(x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y + 6);
  ctx.quadraticCurveTo(x + w / 2, y - 8, x + w, y + 6);
  ctx.lineTo(x + w * 0.72, y + h);
  ctx.quadraticCurveTo(x + w / 2, y + h + 8, x + w * 0.28, y + h);
  ctx.closePath();
  ctx.fill();
}

function roundedTaperedGlassStroke(x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y + 6);
  ctx.quadraticCurveTo(x + w / 2, y - 8, x + w, y + 6);
  ctx.lineTo(x + w * 0.72, y + h);
  ctx.quadraticCurveTo(x + w / 2, y + h + 8, x + w * 0.28, y + h);
  ctx.closePath();
  ctx.stroke();
}

function drawStink(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "rgba(69, 122, 58, 0.78)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-12, 18);
  ctx.bezierCurveTo(-30, 2, 15, -4, -7, -22);
  ctx.moveTo(14, 19);
  ctx.bezierCurveTo(32, 3, -12, -2, 10, -23);
  ctx.stroke();
  ctx.restore();
}

function drawBoot(x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = "#c9834f";
  ctx.strokeStyle = "#221711";
  ctx.lineWidth = 4;
  roundRect(-2, -10, 34, 22, 8);
  ctx.stroke();
  ctx.fillStyle = "#211611";
  ctx.fillRect(4, 8, 31, 5);
  ctx.restore();
}

function drawCrownIcon() {
  ctx.save();
  ctx.fillStyle = "#f4c74c";
  ctx.strokeStyle = "#221711";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-32, 14);
  ctx.lineTo(-28, -24);
  ctx.lineTo(-12, -4);
  ctx.lineTo(0, -30);
  ctx.lineTo(12, -4);
  ctx.lineTo(28, -24);
  ctx.lineTo(32, 14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#a83b2d";
  ctx.beginPath();
  ctx.arc(0, -30, 6, 0, Math.PI * 2);
  ctx.arc(-28, -24, 5, 0, Math.PI * 2);
  ctx.arc(28, -24, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe78e";
  ctx.fillRect(-28, 5, 56, 10);
  ctx.restore();
}

function drawCatIcon() {
  ctx.save();
  ctx.fillStyle = "#3a281f";
  ctx.strokeStyle = "#21150f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -8, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-18, -25);
  ctx.lineTo(-27, -46);
  ctx.lineTo(-7, -32);
  ctx.moveTo(18, -25);
  ctx.lineTo(27, -46);
  ctx.lineTo(7, -32);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f0d38a";
  ctx.beginPath();
  ctx.arc(-9, -12, 4, 0, Math.PI * 2);
  ctx.arc(9, -12, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f0d38a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-3, 1);
  ctx.lineTo(-26, 8);
  ctx.moveTo(3, 1);
  ctx.lineTo(26, 8);
  ctx.stroke();
  ctx.restore();
}

function drawAppleIcon() {
  ctx.save();
  ctx.fillStyle = "#b93b30";
  ctx.strokeStyle = "#21150f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(-9, -6, 18, 0, Math.PI * 2);
  ctx.arc(9, -6, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#4d7d3d";
  ctx.beginPath();
  ctx.ellipse(12, -34, 17, 7, -0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPubBoneIcon() {
  ctx.save();
  ctx.rotate(-0.24);
  ctx.strokeStyle = "#f4f1df";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-30, -7);
  ctx.lineTo(30, -7);
  ctx.stroke();
  ctx.fillStyle = "#f4f1df";
  for (const [x, y] of [[-36, -10], [-29, -18], [36, -10], [29, -18]]) {
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSpadeIcon() {
  ctx.save();
  ctx.fillStyle = "#2b211b";
  ctx.strokeStyle = "#21150f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -44);
  ctx.bezierCurveTo(-34, -20, -24, 11, 0, 6);
  ctx.bezierCurveTo(24, 11, 34, -20, 0, -44);
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(-5, 0, 10, 28);
  ctx.fillRect(-18, 24, 36, 8);
  ctx.restore();
}

function drawTrowelIcon() {
  ctx.save();
  ctx.rotate(-0.36);
  ctx.fillStyle = "#c5d0cd";
  ctx.strokeStyle = "#21150f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-34, -16);
  ctx.lineTo(14, -34);
  ctx.lineTo(31, -3);
  ctx.lineTo(-20, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#9b5b2f";
  roundRect(-47, 5, 34, 12, 5);
  ctx.restore();
}

function drawLambIcon() {
  ctx.save();
  ctx.fillStyle = "#f4f1df";
  ctx.strokeStyle = "#21150f";
  ctx.lineWidth = 4;
  for (const [x, y, r] of [[-16, -10, 14], [0, -18, 17], [18, -10, 14], [0, 1, 16]]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "#3a281f";
  ctx.beginPath();
  ctx.arc(27, -16, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHorseIcon() {
  ctx.save();
  ctx.fillStyle = "#7a4a2b";
  ctx.strokeStyle = "#21150f";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-32, 8);
  ctx.quadraticCurveTo(-10, -34, 18, -28);
  ctx.quadraticCurveTo(34, -20, 24, -2);
  ctx.quadraticCurveTo(8, -9, -1, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#2b1b13";
  ctx.beginPath();
  ctx.moveTo(-6, -27);
  ctx.quadraticCurveTo(-26, -22, -30, 4);
  ctx.quadraticCurveTo(-16, -8, -1, -10);
  ctx.fill();
  ctx.restore();
}

function burst(x, y, good, countOverride) {
  const color = good ? "#ffe06a" : "#f04d42";
  const count = countOverride || (good ? 22 : 18);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = good ? 140 + Math.random() * 280 : 80 + Math.random() * 180;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed + (good ? 95 : -30),
      vy: Math.sin(angle) * speed - (good ? 170 : 35),
      life: good ? 0.75 : 0.55,
      maxLife: good ? 0.75 : 0.55,
      size: good ? 4 + Math.random() * 6 : 5 + Math.random() * 5,
      color,
      good
    });
  }
}

function sparkleTrail(x, y) {
  particles.push({
    x: x - 26 + Math.random() * 52,
    y: y - 8 + Math.random() * 18,
    vx: -80 - Math.random() * 120,
    vy: -40 - Math.random() * 90,
    life: 0.56,
    maxLife: 0.56,
    size: 3 + Math.random() * 5,
    color: Math.random() < 0.5 ? "#fff7d4" : "#f7c24c",
    good: true
  });
}

function updateParticles(dt) {
  particles = particles.filter(particle => {
    particle.life -= dt;
    particle.vy += 520 * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    return particle.life > 0;
  });
}

function drawParticles() {
  for (const particle of particles) {
    const t = particle.life / particle.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.max(0, t);
    ctx.fillStyle = particle.color;
    ctx.translate(particle.x - state.cameraX, particle.y);
    if (particle.good) {
      ctx.beginPath();
      ctx.moveTo(0, -particle.size);
      ctx.lineTo(particle.size * 0.55, 0);
      ctx.lineTo(0, particle.size);
      ctx.lineTo(-particle.size * 0.55, 0);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
    }
    ctx.restore();
  }
}

function drawOverlay() {
  if (state.mode !== "ended") return;
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff5d1";
  ctx.font = "900 46px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Another round?", W / 2, H / 2 - 34);
  ctx.font = "700 20px system-ui";
  ctx.fillText("Buy an upgrade, then hold the launch button again.", W / 2, H / 2 + 8);
}

function roundRect(x, y, w, h, r) {
  roundedPath(x, y, w, h, r);
  ctx.fill();
}

function roundStroke(x, y, w, h, r) {
  roundedPath(x, y, w, h, r);
  ctx.stroke();
}

function roundedPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

ui.launch.addEventListener("pointerdown", event => {
  event.preventDefault();
  if (state.mode === "ended") resetRun();
  if (!isLaunchSetupMode()) return;
  held = true;
  holdStarted = performance.now();
  ui.launch.setPointerCapture(event.pointerId);
  ui.launch.textContent = state.mode === "power" ? "Lock Power" : "Launch!";
});

ui.launch.addEventListener("pointerup", event => {
  event.preventDefault();
  if (!held) return;
  held = false;
  if (state.mode === "power") {
    state.lockedPower = state.powerPulse;
    state.mode = "angle";
    state.angleTime = 0;
    ui.launch.textContent = "Set Angle";
    showMessage("Step 2: hold and release to set angle.");
    return;
  }
  launch();
});

ui.launch.addEventListener("pointercancel", () => {
  held = false;
  ui.launch.textContent = state.mode === "angle" ? "Set Angle" : "Set Power";
});

ui.restart.addEventListener("click", resetRun);

ui.shopToggle.addEventListener("click", () => {
  setShopOpen(!ui.shop.classList.contains("open"));
});

ui.shopClose.addEventListener("click", () => {
  setShopOpen(false);
});

document.querySelectorAll("[data-upgrade]").forEach(button => {
  button.addEventListener("click", () => buyUpgrade(button.dataset.upgrade));
});

window.addEventListener("resize", () => {
  resize();
  resetRun();
});

resize();
resetRun();
updateUi();
requestAnimationFrame(frame);
