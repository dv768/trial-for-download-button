// -------------------
// GLOBALS
// -------------------
let video;
let detector;
let detections = [];
let modelLoaded = false;
let noiseOffset = 0;

let gifButtonX, gifButtonY, pngButtonX, pngButtonY;
let buttonWidth = 60, buttonHeight = 30, buttonPadding = 12;

let capturer = null;
let recording = false;
let recordFrames = 0;
const gifDuration = 5; // seconds
const fps = 30; // frames per second for GIF capture

// Detection interval handle (so we don't create multiple intervals)
let detectIntervalHandle = null;

// -------------------
// SETUP
// -------------------
function setup() {
  createCanvas(windowWidth, windowHeight);

  // Setup video at fixed resolution to keep performance sane
  video = createCapture(VIDEO);
  video.size(800, 600);
  video.hide();

  // Initialize CCapture (buttons will check if capturer exists)
  setupButtons();

  // Initialize ML model (pose / body detection)
  initializeModel();
}

// -------------------
// BUTTONS / CCapture
// -------------------
function setupButtons() {
  // Buttons don't compute positions here — use updateButtonPositions() each frame
  // Initialize CCapture if available
  if (typeof CCapture === 'undefined') {
    console.warn('CCapture not loaded — GIF functionality will be disabled.');
    capturer = null;
    return;
  }

  // Create CCapture instance
  // workersPath left empty — CCapture will fallback to main-thread if needed
  try {
    capturer = new CCapture({
      format: 'gif',
      workersPath: '',
      framerate: fps,
      verbose: false,
      quality: 90
    });
  } catch (e) {
    console.warn('Failed to initialize CCapture:', e);
    capturer = null;
  }
}

// Update button positions so they stay fixed bottom-left
function updateButtonPositions() {
  pngButtonX = 20;
  pngButtonY = height - buttonHeight - 20;

  gifButtonX = pngButtonX + buttonWidth + buttonPadding;
  gifButtonY = pngButtonY;
}

function drawButtons() {
  // Safety: ensure positions are numbers
  if (typeof pngButtonX !== 'number' || typeof pngButtonY !== 'number') return;

  // PNG Button
  stroke(0, 255, 0);
  strokeWeight(1);
  fill(0, 0, 0, 0); // transparent
  rect(pngButtonX, pngButtonY, buttonWidth, buttonHeight, 6);

  noStroke();
  fill(0, 255, 0);
  textSize(12);
  textAlign(CENTER, CENTER);
  text('PNG', pngButtonX + buttonWidth / 2, pngButtonY + buttonHeight / 2);

  // GIF Button
  stroke(0, 255, 0);
  strokeWeight(1);
  fill(0, 0, 0, 0);
  rect(gifButtonX, gifButtonY, buttonWidth, buttonHeight, 6);

  noStroke();
  fill(0, 255, 0);
  text('GIF', gifButtonX + buttonWidth / 2, gifButtonY + buttonHeight / 2);
}

// -------------------
// MOUSE
// -------------------
function mousePressed() {
  // Make sure positions are up-to-date
  updateButtonPositions();

  // PNG button clicked
  if (
    mouseX > pngButtonX &&
    mouseX < pngButtonX + buttonWidth &&
    mouseY > pngButtonY &&
    mouseY < pngButtonY + buttonHeight
  ) {
    saveCanvas('screenshot', 'png');
  }

  // GIF button clicked
  if (
    mouseX > gifButtonX &&
    mouseX < gifButtonX + buttonWidth &&
    mouseY > gifButtonY &&
    mouseY < gifButtonY + buttonHeight
  ) {
    if (!recording && capturer) {
      // Start recording
      recording = true;
      recordFrames = 0;
      try {
        capturer.start();
      } catch (e) {
        console.warn('CCapture start failed:', e);
        recording = false;
      }
    }
  }
}

// -------------------
// GIF CAPTURE
// -------------------
function captureGifFrame() {
  if (!recording || !capturer) return;

  // CCapture expects an actual canvas element
  const canvasEl = document.querySelector('canvas');
  if (!canvasEl) return;

  try {
    capturer.capture(canvasEl);
    recordFrames++;
  } catch (e) {
    console.warn('CCapture.capture failed:', e);
    // stop recording if capture fails repeatedly
    recording = false;
    return;
  }

  if (recordFrames >= fps * gifDuration) {
    try {
      capturer.stop();
      capturer.save();
    } catch (e) {
      console.warn('CCapture stop/save failed:', e);
    }
    recording = false;
    recordFrames = 0;
    // re-initialize capturer so it can be used again later (some browsers require fresh instance)
    setupButtons();
  }
}

// -------------------
// MODEL (ml5)
// -------------------
function initializeModel() {
  if (typeof ml5 === 'undefined') {
    console.error('ml5.js not loaded! Detection disabled.');
    return;
  }

  // Use ml5 body-pose API if available; fallback to poseNet if not.
  // Many users use ml5.poseNet — if bodyPose isn't present, try poseNet.
  if (typeof ml5.bodyPose === 'function') {
    detector = ml5.bodyPose(video, modelReady);
  } else if (typeof ml5.poseNet === 'function') {
    detector = ml5.poseNet(video, modelReady);
  } else {
    console.error('No compatible pose detector in ml5.js (bodyPose/poseNet).');
    return;
  }
}

function modelReady() {
  modelLoaded = true;
  // Start periodic detection (once model is ready)
  if (detectIntervalHandle) clearInterval(detectIntervalHandle);
  detectIntervalHandle = setInterval(() => {
    if (detector && modelLoaded) {
      // many ml5 detectors expose different APIs; try common patterns
      if (typeof detector.detect === 'function') {
        detector.detect(video, (results) => {
          // many detectors return an object; normalize to array if needed
          detections = Array.isArray(results) ? results : results ? [results] : [];
        });
      } else if (detector.on) {
        // poseNet supports event listener style
        detector.on('pose', (results) => {
          detections = results || [];
        });
      }
    }
  }, 250); // ~4 detections/sec — good tradeoff for performance
}

// -------------------
// DRAW LOOP
// -------------------
function draw() {
  // update button positions first so rect() gets numbers
  updateButtonPositions();

  background(0);

  // scale video to fit canvas while maintaining aspect ratio
  const scaleVal = min(width / video.width, height / video.height);
  const scaledW = video.width * scaleVal;
  const scaledH = video.height * scaleVal;
  const offsetX = (width - scaledW) / 2;
  const offsetY = (height - scaledH) / 2;

  // draw video frame and subtle green overlay
  push();
  translate(offsetX, offsetY);
  image(video, 0, 0, scaledW, scaledH);

  // green overlay drawn as semi-transparent rectangle so video brightness is preserved
  noStroke();
  fill(0, 255, 0, 38); // ~15% opacity
  rect(0, 0, scaledW, scaledH);
  pop();

  // draw detections (translated to video position)
  push();
  translate(offsetX, offsetY);
  if (modelLoaded && detections && detections.length > 0) {
    drawDetections(detections, scaleVal);
  }
  pop();

  // subtle, low-cost noise overlay (reduced density)
  drawNoise();

  // HUD, buttons and capture
  drawHUD();
  drawButtons();
  captureGifFrame();

  // Loading screen on top if model not loaded
  if (!modelLoaded) drawLoadingScreen();
}

// -------------------
// DETECTIONS & INFO PANEL
// -------------------
function drawDetections(dets, scaleVal) {
  // dets expected to be array of poses/detections
  for (let i = 0; i < dets.length; i++) {
    const detection = dets[i];

    // Pose detectors may store keypoints differently; support multiple shapes
    const keypoints = detection.keypoints || detection.pose?.keypoints || detection.poses || [];

    if (!keypoints || keypoints.length === 0) continue;

    // compute bounding box from keypoints
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let validPoints = 0;
    for (let kp of keypoints) {
      // keypoint may be {position:{x,y}, score} or {x,y,score}
      const score = kp.score ?? kp.confidence ?? 0;
      const x = kp.x ?? kp.position?.x;
      const y = kp.y ?? kp.position?.y;
      if (score > 0.3 && typeof x === 'number' && typeof y === 'number') {
        minX = min(minX, x);
        minY = min(minY, y);
        maxX = max(maxX, x);
        maxY = max(maxY, y);
        validPoints++;
      }
    }

    if (validPoints < 3) continue;

    const padding = 40;
    minX = max(0, minX - padding);
    minY = max(0, minY - padding);
    maxX = min(video.width, maxX + padding);
    maxY = min(video.height, maxY + padding);

    const x = minX * scaleVal;
    const y = minY * scaleVal;
    const w = (maxX - minX) * scaleVal;
    const h = (maxY - minY) * scaleVal;

    const gender = i % 2 === 0 ? 'FEMALE' : 'MALE'; // simulated
    const colorVal = gender === 'FEMALE' ? [255, 107, 53] : [74, 144, 226];
    const confidence = detection.score ?? detection.confidence ?? 0.85;

    stroke(colorVal);
    strokeWeight(3);
    noFill();
    rect(x, y, w, h);

    // label box
    noStroke();
    fill(colorVal);
    rect(x, y - 28, 140, 22);
    fill(0);
    textSize(12);
    textAlign(LEFT, CENTER);
    text(`PERSON_${nf(i + 1, 3)} ${nf(confidence * 100, 2, 0)}%`, x + 6, y - 17);

    // info panel on the side (top-left stack)
    drawInfoPanel(i, gender, confidence, colorVal);
  }
}

function drawInfoPanel(index, gender, confidence, colorVal) {
  const paddingX = width * 0.05;
  const paddingY = height * 0.05;
  const panelW = 200;
  const panelH = 110;
  const spacingY = panelH + 18;

  let panelX = paddingX;
  let panelY = paddingY + index * spacingY;
  if (panelY + panelH + paddingY > height) {
    panelY = height - panelH - paddingY;
  }

  push();
  fill(0, 0, 0, 160); // slightly stronger for readability
  stroke(colorVal);
  strokeWeight(2);
  rect(panelX, panelY, panelW, panelH, 6);
  pop();

  push();
  fill(colorVal);
  noStroke();
  textSize(12);
  textStyle(BOLD);
  text(`PERSON_${nf(index + 1, 3)}`, panelX + 10, panelY + 20);
  textStyle(NORMAL);
  textSize(11);
  fill(colorVal);
  text(`GENDER: ${gender}`, panelX + 10, panelY + 42);
  text(`CONFIDENCE: ${nf(confidence * 100, 2, 1)}%`, panelX + 10, panelY + 62);
  noStroke();
  stroke(colorVal);
  strokeWeight(1);
  line(panelX + 10, panelY + 76, panelX + panelW - 10, panelY + 76);
  noStroke();
  fill(0, 255, 0);
  textSize(11);
  text('STATUS: TRACKING', panelX + 10, panelY + 92);
  pop();
}

// -------------------
// NOISE (lightweight)
// -------------------
function drawNoise() {
  // small, subtle animated noise but low cost
  noiseOffset += 0.01;
  noStroke();

  // draw only over a grid with larger step to reduce CPU cost
  const step = 8;
  const alphaMin = 6;
  const alphaMax = 20;

  for (let x = 0; x < width; x += step) {
    for (let y = 0; y < height; y += step) {
      const a = random(alphaMin, alphaMax);
      fill(0, 0, 0, a);
      rect(x, y, step, step);
    }
  }
}

// -------------------
// HUD & LOADING
// -------------------
function drawHUD() {
  push();
  fill(0, 255, 0);
  noStroke();
  textSize(12);
  textStyle(NORMAL);
  const date = `${year()}-${nf(month(), 2)}-${nf(day(), 2)}`;
  text(date, 20, 30);

  fill(0, 255, 0, 200);
  text('SURVEILLANCE SYSTEM', 20, 50);

  textAlign(RIGHT);
  fill(0, 255, 0);
  text(`${nf(hour(), 2)}:${nf(minute(), 2)}:${nf(second(), 2)}`, width - 20, 50);
  textAlign(LEFT);
  pop();
}

function drawLoadingScreen() {
  push();
  fill(0, 0, 0, 220);
  noStroke();
  rect(0, 0, width, height);

  fill(0, 255, 0);
  textSize(24);
  textAlign(CENTER);
  textStyle(BOLD);
  text('INITIALIZING SYSTEM', width / 2, height / 2 - 20);

  textSize(14);
  textStyle(NORMAL);
  const dots = '.'.repeat(int((frameCount / 30) % 4));
  text(`Loading detection model${dots}`, width / 2, height / 2 + 20);
  pop();
}

// -------------------
// RESIZE
// -------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
