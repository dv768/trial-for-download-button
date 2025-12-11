let video;
let detector;
let detections = [];
let modelLoaded = false;
let noiseOffset = 0;
let gifButtonX, gifButtonY, pngButtonX, pngButtonY;
let buttonWidth = 60;
let buttonHeight = 30;
let buttonPadding = 20;

let capturer;
let recording = false;
let recordFrames = 0;
const gifDuration = 5; // seconds
const fps = 30; // GIF frames per second

function setup() {
  createCanvas(windowWidth, windowHeight);
  
  // Create video capture
  video = createCapture(VIDEO);
  video.size(800, 600);
  video.hide();
  
  // Wait a bit for everything to load
  setTimeout(initializeModel, 1000);
  
function setupButtons() {
  // Button positions
  pngButtonX = 20;
  pngButtonY = 20;
  gifButtonX = pngButtonX + buttonWidth + buttonPadding;
  gifButtonY = 20;

  // Initialize GIF capturer
  capturer = new CCapture({
    format: 'gif',
    workersPath: '',
    framerate: fps,
    verbose: false
  });
}
}

function initializeModel() {
  if (typeof ml5 === 'undefined') {
    console.error('ml5.js is not loaded. Please add ml5.js to your index.html');
    return;
  }
  
  console.log('Initializing model...');
  
  // Use bodyPose for person detection
  detector = ml5.bodyPose(video, modelReady);
}

function modelReady() {
  console.log('Model loaded!');
  modelLoaded = true;
  detectPeople();
}

function detectPeople() {
  if (detector && modelLoaded) {
    detector.detect(video, (results) => {
      detections = results;
    });
  }
  //requestAnimationFrame(detectPeople);
}

// Start detection at a fixed interval
setInterval(() => {
  if (detector && modelLoaded) {
    detector.detect(video, (results) => {
      detections = results;
    });
  }
}, 200); // 200ms = 5 detections per second

function modelReady() {
  console.log('Model loaded!');
  modelLoaded = true;

  // Start periodic detection
  setInterval(() => {
    if (detector && modelLoaded) {
      detector.detect(video, (results) => {
        detections = results;
      });
    }
  }, 200);
}


function draw() {
  background(0);
  
  // Scale video to fit canvas
  let scaleVal = min(width / video.width, height / video.height);
  let scaledW = video.width * scaleVal;
  let scaledH = video.height * scaleVal;
  let offsetX = (width - scaledW) / 2;
  let offsetY = (height - scaledH) / 2;
  
 // Draw video normally
push();
translate(offsetX, offsetY);
image(video, 0, 0, scaledW, scaledH);

// Add subtle green overlay (15% opacity)
fill(0, 255, 0, 10); // 38 ≈ 15% opacity
noStroke();
rect(0, 0, scaledW, scaledH);
pop();

  
  // Draw detections
  push();
  translate(offsetX, offsetY);
  if (modelLoaded && detections && detections.length > 0) {
    drawDetections(detections, scaleVal);
  }
  pop();
  
  // Draw subtle noise overlay
  drawNoise();
  
  // Draw HUD
  drawHUD();
  
  // Loading screen
  if (!modelLoaded) {
    drawLoadingScreen();
  }
}
// Subtle, reduced noise overlay
function drawNoise() {
  noiseOffset += 0.02;
  noStroke();
  for (let x = 0; x < width; x += 3) {
    for (let y = 0; y < height; y += 3) {
      let alpha = random(10, 25); // lower opacity
      fill(random(0, 40), random(0, 40), random(0, 40), alpha);
      rect(x, y, 3, 3); // smaller rectangles
    }
  }
  
  function drawButtons() {
  // PNG Button
  stroke(0, 255, 0);
  strokeWeight(1);
  fill(0, 0, 0, 0); // transparent
  rect(pngButtonX, pngButtonY, buttonWidth, buttonHeight, 4);

  fill(0, 255, 0);
  noStroke();
  textSize(12);
  textAlign(CENTER, CENTER);
  text('PNG', pngButtonX + buttonWidth / 2, pngButtonY + buttonHeight / 2);

  // GIF Button
  stroke(0, 255, 0);
  strokeWeight(1);
  fill(0, 0, 0, 0);
  rect(gifButtonX, gifButtonY, buttonWidth, buttonHeight, 4);

  fill(0, 255, 0);
  noStroke();
  textSize(12);
  textAlign(CENTER, CENTER);
  text('GIF', gifButtonX + buttonWidth / 2, gifButtonY + buttonHeight / 2);
}

function mousePressed() {
  // Check PNG button click
  if (mouseX > pngButtonX && mouseX < pngButtonX + buttonWidth &&
      mouseY > pngButtonY && mouseY < pngButtonY + buttonHeight) {
    saveCanvas('screenshot', 'png');
  }

  // Check GIF button click
  if (mouseX > gifButtonX && mouseX < gifButtonX + buttonWidth &&
      mouseY > gifButtonY && mouseY < gifButtonY + buttonHeight) {
    if (!recording) {
      console.log('Starting GIF recording');
      recording = true;
      recordFrames = 0;
      capturer.start();
    }
  }
}

function captureGifFrame() {
  if (recording) {
    capturer.capture(canvas);
    recordFrames++;
    if (recordFrames >= fps * gifDuration) { // 5 seconds
      capturer.stop();
      capturer.save();
      recording = false;
      console.log('GIF saved!');
    }
  }
}
}


// -------------------
// Original functions
// -------------------

function drawDetections(dets, scaleVal) {
  for (let i = 0; i < dets.length; i++) {
    const detection = dets[i];
    
    let keypoints = detection.keypoints || detection.pose?.keypoints;
    
    if (!keypoints || keypoints.length === 0) continue;
    
    let minX = 10000, minY = 10000, maxX = 0, maxY = 0;
    let validPoints = 0;
    
    for (let kp of keypoints) {
      let confidence = kp.score || kp.confidence || 0;
      let xPos = kp.x || kp.position?.x || 0;
      let yPos = kp.y || kp.position?.y || 0;
      
      if (confidence > 0.3 && xPos > 0 && yPos > 0) {
        minX = min(minX, xPos);
        minY = min(minY, yPos);
        maxX = max(maxX, xPos);
        maxY = max(maxY, yPos);
        validPoints++;
      }
    }
    
    if (validPoints < 3) continue;
    
    const padding = 50;
    minX = max(0, minX - padding);
    minY = max(0, minY - padding);
    maxX = min(video.width, maxX + padding);
    maxY = min(video.height, maxY + padding);
    
    const x = minX * scaleVal;
    const y = minY * scaleVal;
    const w = (maxX - minX) * scaleVal;
    const h = (maxY - minY) * scaleVal;
    
    const gender = i % 2 === 0 ? 'FEMALE' : 'MALE';
    const colorVal = gender === 'FEMALE' ? [255, 107, 53] : [74, 144, 226];
    const confidence = detection.score || detection.confidence || 0.85;
    
    stroke(colorVal);
    strokeWeight(3);
    noFill();
    rect(x, y, w, h);
    
    // Draw corners
    strokeWeight(4);
    const cornerSize = 20;
    line(x, y, x + cornerSize, y);
    line(x, y, x, y + cornerSize);
    line(x + w - cornerSize, y, x + w, y);
    line(x + w, y, x + w, y + cornerSize);
    line(x, y + h - cornerSize, x, y + h);
    line(x, y + h, x + cornerSize, y + h);
    line(x + w - cornerSize, y + h, x + w, y + h);
    line(x + w, y + h - cornerSize, x + w, y + h);
    
    fill(colorVal);
    noStroke();
    rect(x, y - 30, 180, 25);
    fill(0);
    textSize(14);
    textFont('monospace');
    textStyle(BOLD);
    text(`PERSON_${nf(i + 1, 3)} ${nf(confidence * 100, 2, 0)}%`, x + 5, y - 10);
    
    drawInfoPanel(i, gender, confidence, colorVal);
  }
}

function drawInfoPanel(index, gender, confidence, colorVal) {
  // Responsive padding (5% of canvas width/height)
  const paddingX = width * 0.05;
  const paddingY = height * 0.05;
  
  const panelW = 200;
  const panelH = 120;
  const spacingY = panelH + 20; // vertical spacing between panels

  // Calculate panel position
  let panelX = paddingX;  
  let panelY = paddingY + index * spacingY;

  // Ensure panel does not go below canvas
  if (panelY + panelH + paddingY > height) {
    panelY = height - panelH - paddingY;
  }

  // Panel background
  push();
  fill(0, 0, 0, 128); // black, 50% opacity
  stroke(colorVal);
  strokeWeight(2);
  rect(panelX, panelY, panelW, panelH);
  pop();

  // Panel text
  push();
  fill(colorVal);
  noStroke();
  textSize(12);
  textStyle(BOLD);
  text(`PERSON_${nf(index + 1, 3)}`, panelX + 10, panelY + 20);

  textStyle(NORMAL);
  textSize(11);
  text(`GENDER: ${gender}`, panelX + 10, panelY + 45);
  text(`CONFIDENCE: ${nf(confidence * 100, 2, 1)}%`, panelX + 10, panelY + 65);

  stroke(colorVal);
  strokeWeight(1);
  line(panelX + 10, panelY + 75, panelX + panelW - 10, panelY + 75);

  noStroke();
  text('STATUS: TRACKING', panelX + 10, panelY + 95);
  pop();
}



function drawHUD() {
  fill(0, 255, 0);
  noStroke();
  textSize(12);
  textStyle(NORMAL);
  const date = `${year()}-${nf(month(), 2)}-${nf(day(), 2)}`;
  text(date, 20, 30);
  textSize(10);
  fill(0, 255, 0, 180);
  text('SURVEILLANCE SYSTEM', 20, 50);
  
  fill(0, 255, 0);
  textSize(12);
  textAlign(RIGHT);
  text(`${nf(hour(), 2)}:${nf(minute(), 2)}:${nf(second(), 2)}`, width - 20, 50);
  
  fill(255, 0, 0);
  circle(width - 60, 27, 8);
  if (frameCount % 60 < 30) {
    fill(255, 0, 0, 150);
    circle(width - 60, 27, 12);
  }
  fill(0, 255, 0);
  text('REC', width - 20, 30);
  textAlign(LEFT);
  
  fill(0, 255, 0);
  textSize(10);
  text('85%', 60, height - 20);
  
  stroke(0, 255, 0);
  strokeWeight(2);
  noFill();
  rect(20, height - 30, 30, 15);
  fill(0, 255, 0);
  noStroke();
  rect(22, height - 28, 25, 11);
  rect(50, height - 26, 3, 7);
  
  stroke(0, 255, 0);
  strokeWeight(2);
  noFill();
  line(0, 0, 60, 0);
  line(0, 0, 0, 60);
  line(width - 60, 0, width, 0);
  line(width, 0, width, 60);
  line(0, height - 60, 0, height);
  line(0, height, 60, height);
  line(width - 60, height, width, height);
  line(width, height - 60, width, height);
  
  fill(0, 0, 0, 200);
  noStroke();
  rect(0, height - 50, width, 50);
  
  stroke(0, 255, 0);
  strokeWeight(1);
  line(0, height - 50, width, height - 50);
  
  fill(0, 255, 0);
  textSize(10);
  text('SURVEILLANCE v2.1', 20, height - 25);
  let detCount = detections ? detections.length : 0;
  text(`DETECTIONS: ${detCount}`, width / 2 - 50, height - 25);
  textAlign(RIGHT);
  text('MODE: REAL-TIME', width - 20, height - 25);
  textAlign(LEFT);
}

function drawLoadingScreen() {
  fill(0, 0, 0, 200);
  noStroke();
  rect(0, 0, width, height);
  
  fill(0, 255, 0);
  textSize(24);
  textAlign(CENTER);
  textStyle(BOLD);
  text('INITIALIZING SYSTEM', width / 2, height / 2 - 20);
  
  textSize(14);
  textStyle(NORMAL);
  const dots = '.'.repeat((frameCount / 30) % 4);
  text(`Loading detection model${dots}`, width / 2, height / 2 + 20);
  textAlign(LEFT);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}