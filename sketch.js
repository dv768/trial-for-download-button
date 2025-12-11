// -------------------
// GLOBALS
// -------------------
let video;
let detector;
let detections = [];
let modelLoaded = false;
let noiseOffset = 0;

let gifButtonX, gifButtonY, pngButtonX, pngButtonY;
let buttonWidth = 60, buttonHeight = 30, buttonPadding = 20;

let capturer;
let recording = false;
let recordFrames = 0;
const gifDuration = 5; // seconds
const fps = 30;

// -------------------
// SETUP
// -------------------
function setup() {
  createCanvas(windowWidth, windowHeight);

  video = createCapture(VIDEO);
  video.size(800, 600);
  video.hide();

  setupButtons();
  initializeModel();

  setInterval(() => {
    if (detector && modelLoaded) detector.detect(video, (results) => (detections = results));
  }, 200);
}

// -------------------
// BUTTONS
// -------------------
function setupButtons() {
  pngButtonX = 20;
  pngButtonY = 20;
  gifButtonX = pngButtonX + buttonWidth + buttonPadding;
  gifButtonY = 20;

  if (typeof CCapture === 'undefined') {
    console.error('CCapture is not loaded!');
    return;
  }

  capturer = new CCapture({ format: 'gif', workersPath: '', framerate: fps, verbose: false });
}

function drawButtons() {
  // PNG
  stroke(0, 255, 0); strokeWeight(1); fill(0,0,0,0); rect(pngButtonX,pngButtonY,buttonWidth,buttonHeight,4);
  noStroke(); fill(0,255,0); textAlign(CENTER,CENTER); textSize(12); text('PNG', pngButtonX+buttonWidth/2, pngButtonY+buttonHeight/2);

  // GIF
  stroke(0, 255, 0); strokeWeight(1); fill(0,0,0,0); rect(gifButtonX,gifButtonY,buttonWidth,buttonHeight,4);
  noStroke(); fill(0,255,0); text('GIF', gifButtonX+buttonWidth/2, gifButtonY+buttonHeight/2);
}

function mousePressed() {
  if (mouseX > pngButtonX && mouseX < pngButtonX+buttonWidth &&
      mouseY > pngButtonY && mouseY < pngButtonY+buttonHeight) {
    saveCanvas('screenshot', 'png');
  }

  if (mouseX > gifButtonX && mouseX < gifButtonX+buttonWidth &&
      mouseY > gifButtonY && mouseY < gifButtonY+buttonHeight) {
    if (!recording && capturer) {
      recording = true;
      recordFrames = 0;
      capturer.start();
    }
  }
}

function captureGifFrame() {
  if (recording && capturer) {
    capturer.capture(canvas);
    recordFrames++;
    if (recordFrames >= fps * gifDuration) {
      capturer.stop();
      capturer.save();
      recording = false;
      console.log('GIF saved!');
    }
  }
}

// -------------------
// MODEL
// -------------------
function initializeModel() {
  if (typeof ml5 === 'undefined') { console.error('ml5.js not loaded!'); return; }
  detector = ml5.bodyPose(video, modelReady);
}

function modelReady() {
  modelLoaded = true;
  detectPeople();
}

function detectPeople() {
  if (detector && modelLoaded) detector.detect(video, (results) => (detections = results));
}

// -------------------
// DRAW LOOP
// -------------------
function draw() {
  background(0);

  let scaleVal = min(width/video.width, height/video.height);
  let scaledW = video.width*scaleVal;
  let scaledH = video.height*scaleVal;
  let offsetX = (width-scaledW)/2;
  let offsetY = (height-scaledH)/2;

  push();
  translate(offsetX, offsetY);
  image(video,0,0,scaledW,scaledH);
  fill(0,255,0,38); noStroke(); rect(0,0,scaledW,scaledH);
  pop();

  push(); translate(offsetX, offsetY);
  if (modelLoaded && detections.length>0) drawDetections(detections, scaleVal);
  pop();

  drawNoise();
  drawHUD();
  drawButtons();
  captureGifFrame();

  if (!modelLoaded) drawLoadingScreen();
}

// -------------------
// DETECTIONS & INFO PANEL
// -------------------
function drawDetections(dets, scaleVal) {
  for (let i=0;i<dets.length;i++) {
    let detection = dets[i];
    let keypoints = detection.keypoints || detection.pose?.keypoints;
    if (!keypoints || keypoints.length==0) continue;

    let minX=10000,minY=10000,maxX=0,maxY=0, validPoints=0;
    for (let kp of keypoints) {
      let c = kp.score||kp.confidence||0;
      let x = kp.x||kp.position?.x||0;
      let y = kp.y||kp.position?.y||0;
      if (c>0.3 && x>0 && y>0) {
        minX=min(minX,x); minY=min(minY,y);
        maxX=max(maxX,x); maxY=max(maxY,y);
        validPoints++;
      }
    }
    if (validPoints<3) continue;

    const padding = 50;
    minX = max(0,minX-padding); minY=max(0,minY-padding);
    maxX = min(video.width,maxX+padding); maxY=min(video.height,maxY+padding);

    const x = minX*scaleVal, y=minY*scaleVal, w=(maxX-minX)*scaleVal, h=(maxY-minY)*scaleVal;
    const gender = i%2==0?'FEMALE':'MALE';
    const colorVal = gender==='FEMALE'?[255,107,53]:[74,144,226];
    const confidence = detection.score||detection.confidence||0.85;

    stroke(colorVal); strokeWeight(3); noFill(); rect(x,y,w,h);
    drawInfoPanel(i, gender, confidence, colorVal);
  }
}

function drawInfoPanel(index, gender, confidence, colorVal) {
  const paddingX = width*0.05, paddingY=height*0.05;
  const panelW = 200, panelH=120, spacingY=panelH+20;
  let panelX=paddingX, panelY=paddingY+index*spacingY;
  if(panelY+panelH+paddingY>height) panelY=height-panelH-paddingY;

  push();
  fill(0,0,0,128);
  stroke(colorVal); strokeWeight(2);
  rect(panelX,panelY,panelW,panelH);
  pop();

  push();
  fill(colorVal); noStroke(); textSize(12); textStyle(BOLD);
  text(`PERSON_${nf(index+1,3)}`, panelX+10,panelY+20);
  textStyle(NORMAL); textSize(11);
  text(`GENDER: ${gender}`, panelX+10,panelY+45);
  text(`CONFIDENCE: ${nf(confidence*100,2,1)}%`, panelX+10,panelY+65);
  pop();
}

// -------------------
// NOISE
// -------------------
function drawNoise() {
  noiseOffset+=0.02;
  noStroke();
  for(let x=0;x<width;x+=3){
    for(let y=0;y<height;y+=3){
      let alpha=random(10,25);
      fill(random(0,40),random(0,40),random(0,40),alpha);
      rect(x,y,3,3);
    }
  }
}

// -------------------
// HUD & LOADING
// -------------------
function drawHUD() {
  fill(0,255,0); noStroke(); textSize(12); textStyle(NORMAL);
  const date = `${year()}-${nf(month(),2)}-${nf(day(),2)}`;
  text(date,20,30);
  fill(0,255,0,180); text('SURVEILLANCE SYSTEM',20,50);
}

function drawLoadingScreen() {
  fill(0,0,0,200); noStroke(); rect(0,0,width,height);
  fill(0,255,0); textSize(24); textAlign(CENTER); textStyle(BOLD);
  text('INITIALIZING SYSTEM', width/2, height/2-20);
}

// -------------------
// RESIZE
// -------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
