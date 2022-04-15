// Bakeoff #2 - Seleção de Alvos Fora de Alcance
// IPM 2021-22, Período 3
// Entrega: até dia 22 de Abril às 23h59 através do Fenix
// Bake-off: durante os laboratórios da semana de 18 de Abril

// p5.js reference: https://p5js.org/reference/

// Database (CHANGE THESE!)
const GROUP_NUMBER = "03-AL"; // Add your group number here as an integer (e.g., 2, 3)
const BAKE_OFF_DAY = true; // Set to 'true' before sharing during the bake-off day

// Target and grid properties (DO NOT CHANGE!)
let PPI, PPCM;
let TARGET_SIZE;
let TARGET_PADDING, MARGIN, LEFT_PADDING, TOP_PADDING;
let continue_button;
let inputArea = { x: 0, y: 0, h: 0, w: 0 }; // Position and size of the user input area

// Metrics
let trialStartTime; // time in milliseconds
let testStartTime, testEndTime; // time between the start and end of one attempt (54 trials)
let hits = 0; // number of successful selections
let misses = 0; // number of missed selections (used to calculate accuracy)
let database; // Firebase DB

// Study control parameters
let draw_targets = false; // used to control what to show in draw()
let trials = []; // contains the order of targets that activate in the test
let current_trial = 0; // the current trial number (indexes into trials array above)
let attempt = 0; // users complete each test twice to account for practice (attemps 0 and 1)
let fitts_IDs = []; // add the Fitts ID for each selection here (-1 when there is a miss, -2 for first trial)
let last_click_virtual_coords; // used to calculate Fitts ID
let optimal_selection_time; // ms

// Features (initial value = probability of being active)
// If forceAllFeatures is on, features with >= 0.5 probability will be enabled (and any others will be disabled)
const active_features = {
  particles: 0.7,
  current_target_border: 0.7,
  border_on_hover: 0.7,
  navigation_lines: 0.7,
  animate_navigation_line: 0.7,
  next_target_dim_color: 0.4,
  background_color_feedback: 0.7,
  sound_feedback: 0.7,
  snapping: 0.85,
  tutorial_screen: 0.75,
  time_bar: 0.7,
  alt_repetition_indicator: 0.75,
};

// Navigation line lerping
let line_lerp = 0;

// Background color
let background_color;

// Sound effects
let hit_sound;
let miss_sound;

// Particles
let particle_system;

let Particle = function (position) {
  this.velocity = createVector(random(-10, 10), random(-10, 10));
  this.position = position.copy();
  this.lifespan = 255;
};

Particle.prototype.run = function () {
  this.update();
  this.display();
};

Particle.prototype.display = function () {
  stroke(200, this.lifespan);
  strokeWeight(2);
  fill(127, this.lifespan);
  ellipse(
    this.position.x,
    this.position.y,
    this.lifespan / 8,
    this.lifespan / 8
  );
};

Particle.prototype.update = function () {
  this.position.add(this.velocity);
  this.lifespan -= 16;
};

Particle.prototype.isDead = function () {
  return this.lifespan < 0;
};

let ParticleSystem = function (active) {
  this.particles = [];
  this.active = active;
};

ParticleSystem.prototype.addParticle = function (position) {
  this.particles.push(new Particle(position));
};

ParticleSystem.prototype.run = function () {
  if (!this.active) return;
  for (let i = this.particles.length - 1; i >= 0; i--) {
    let p = this.particles[i];
    p.run();
    if (p.isDead()) {
      this.particles.splice(i, 1);
    }
  }
};

// Target class (position and width)
class Target {
  constructor(x, y, w) {
    this.x = x;
    this.y = y;
    this.w = w;
  }
}

// Runs once at the start
function setup() {
  randomizeFeatures();

  createCanvas(700, 500); // window size in px before we go into fullScreen()
  frameRate(60); // frame rate (DO NOT CHANGE!)

  particle_system = new ParticleSystem(active_features.particles);
  randomizeTrials(); // randomize the trial order at the start of execution
  optimal_selection_time = 30e3 / (trials.length - 1); // max 30 seconds for all trials (first one doesn't count)
  optimal_selection_time *= 0.9; // 10% buffer
  console.log(
    "Optimal selection time (per target): " + optimal_selection_time + "ms"
  );

  textFont("Arial", 18); // font size for the majority of the text
  drawUserIDScreen(); // draws the user start-up screen (student ID and display size)

  background_color = color(0, 0, 0);

  hit_sound = loadSound("assets/hit.wav");
  miss_sound = loadSound("assets/miss.wav");
}

function snapCursor(virtual_coords) {
  if (virtual_coords == null) return null;
  let closest;
  let minDist;
  for (let i = 0; i < 18; i++) {
    const target = getTargetBounds(i);
    const distance = dist(
      virtual_coords.x,
      virtual_coords.y,
      target.x,
      target.y
    );
    if (!minDist || distance < minDist) {
      closest = target;
      minDist = distance;
    }
  }
  return closest;
}

// Runs every frame and redraws the screen
function draw() {
  if (draw_targets) {
    // The user is interacting with the 6x3 target grid
    background(background_color); // sets background to black

    // Print trial count at the top left-corner of the canvas
    fill(color(255, 255, 255));
    strokeWeight(0);
    textAlign(LEFT);
    text("Trial " + (current_trial + 1) + " of " + trials.length, 50, 20);

    // Draw particles
    particle_system.run();

    // Draw all 18 targets
    for (let i = 0; i < 18; i++) drawTarget(i);

    // Draw arrow connecting to next target
    if (active_features.navigation_lines) {
      const prev = getTargetBounds(trials[current_trial - 1]);
      const current = getTargetBounds(trials[current_trial]);
      const next = getTargetBounds(trials[current_trial + 1]);
      if (current && next && current != next) {
        drawingContext.setLineDash([5, 5]);
        stroke(color(100, 100, 100));
        strokeWeight(2);
        line(current.x, current.y, next.x, next.y);
        drawingContext.setLineDash([1, 0]);
      }
      if (prev && current && prev != current) {
        stroke(color(255, 255, 255));
        strokeWeight(4);
        if (line_lerp < 1 && !active_features.animate_navigation_line)
          line_lerp = 1;
        const to = p5.Vector.lerp(
          createVector(prev.x, prev.y),
          createVector(current.x, current.y),
          line_lerp
        );
        line(prev.x, prev.y, to.x, to.y);
        line_lerp = min(line_lerp * 1.5 + 0.1, 1);
      }
    }

    // Draw a tutorial area - showing the appearance of the current target, next target and irrelevant targets
    if (active_features.tutorial_screen) {
      drawTutorialArea();
    }

    // Draw the user input area
    drawInputArea();

    // Draw the time bar pressuring user to click before it runs out
    if (active_features.time_bar) {
      drawTimeBar();
    }

    // Draw the virtual cursor
    let virtual_coords = getVirtualCoordinates();
    let snap = snapCursor(virtual_coords);

    if (virtual_coords == null) {
      return;
    }

    fill(color(255, 255, 255));
    if (active_features.snapping) {
      line(virtual_coords.x, virtual_coords.y, snap.x, snap.y);
      circle(snap.x, snap.y, 0.5 * PPCM);
    } else {
      circle(virtual_coords.x, virtual_coords.y, 0.5 * PPCM);
    }
  }
}

function randomizeFeatures() {
  // Randomize the active features
  const force_all =
    new URLSearchParams(window.location.search).get("forceAllFeatures") !==
    null;
  for (const feat of Object.keys(active_features)) {
    active_features[feat] = force_all
      ? active_features[feat] >= 0.5
      : random() < active_features[feat];
  }
  console.log("Features:", active_features);
}

// Print and save results at the end of 54 trials
function printAndSavePerformance() {
  // DO NOT CHANGE THESE!
  let accuracy = parseFloat(hits * 100) / parseFloat(hits + misses);
  let test_time = (testEndTime - testStartTime) / 1000;
  let time_per_target = nf(test_time / parseFloat(hits + misses), 0, 3);
  let penalty = constrain(
    (parseFloat(95) - parseFloat(hits * 100) / parseFloat(hits + misses)) * 0.2,
    0,
    100
  );
  let target_w_penalty = nf(
    test_time / parseFloat(hits + misses) + penalty,
    0,
    3
  );
  let timestamp =
    day() +
    "/" +
    month() +
    "/" +
    year() +
    "  " +
    hour() +
    ":" +
    minute() +
    ":" +
    second();

  background(color(0, 0, 0)); // clears screen
  fill(color(255, 255, 255)); // set text fill color to white
  noStroke(); // no stroke around text
  text(timestamp, 10, 20); // display time on screen (top-left corner)

  textAlign(CENTER);
  text("Attempt " + (attempt + 1) + " out of 2 completed!", width / 2, 60);
  text("Hits: " + hits, width / 2, 100);
  text("Misses: " + misses, width / 2, 120);
  text("Accuracy: " + accuracy + "%", width / 2, 140);
  text("Total time taken: " + test_time + "s", width / 2, 160);
  text("Average time per target: " + time_per_target + "s", width / 2, 180);
  text(
    "Average time for each target (+ penalty): " + target_w_penalty + "s",
    width / 2,
    220
  );

  // Print Fitts IDS (one per target, -1 if failed selection, optional)
  text("Fitts Index of Performance", width / 2, 260);
  for (let i = 0; i < fitts_IDs.length; i++) {
    let fid = fitts_IDs[i];
    if (fid === -1) fid = "MISSED";
    else if (fid === -2) fid = "---";
    // first trial
    else fid = fid.toFixed(3);
    text(
      "Target " + (i + 1) + ": " + fid,
      ((i < fitts_IDs.length / 2 ? 1 : 2) * width) / 3,
      280 + (i % (fitts_IDs.length / 2)) * 20
    );
  }

  // Saves results (DO NOT CHANGE!)
  let attempt_data = {
    project_from: GROUP_NUMBER,
    assessed_by: student_ID,
    test_completed_by: timestamp,
    attempt: attempt,
    hits: hits,
    misses: misses,
    accuracy: accuracy,
    attempt_duration: test_time,
    time_per_target: time_per_target,
    target_w_penalty: target_w_penalty,
    fitts_IDs: fitts_IDs,
    active_features, // FIXME: remove this
  };

  // Send data to DB (DO NOT CHANGE!)
  if (BAKE_OFF_DAY) {
    // Access the Firebase DB
    if (attempt === 0) {
      firebase.initializeApp(firebaseConfig);
      database = firebase.database();
    }

    // Add user performance results
    let db_ref = database.ref("G" + GROUP_NUMBER);
    db_ref.push(attempt_data);
  }
}

function getVirtualCoordinates() {
  if (insideInputArea(mouseX, mouseY)) {
    const virtual_x = map(
      mouseX,
      inputArea.x,
      inputArea.x + inputArea.w,
      0,
      width
    );
    const virtual_y = map(
      mouseY,
      inputArea.y,
      inputArea.y + inputArea.h,
      0,
      height
    );
    return createVector(virtual_x, virtual_y);
  }
  return null;
}

function getRealCoordinates(target) {
  const real_x = map(
    target.x,
    0,
    width,
    inputArea.x,
    inputArea.x + inputArea.w
  );
  const real_y = map(
    target.y,
    0,
    height,
    inputArea.y,
    inputArea.y + inputArea.h
  );
  return createVector(real_x, real_y);
}

function isTargeting(target) {
  const virtual_coords = active_features.snapping
    ? snapCursor(getVirtualCoordinates())
    : getVirtualCoordinates();
  return (
    virtual_coords !== null &&
    dist(target.x, target.y, virtual_coords.x, virtual_coords.y) < target.w / 2
  );
}

// Mouse button was pressed - lets test to see if hit was in the correct target
function mousePressed() {
  // Only look for mouse releases during the actual test
  // (i.e., during target selections)

  // as the first thing, stop any sound currently playing (so there aren't any overlapping sounds)
  hit_sound.stop();
  miss_sound.stop();
  if (draw_targets) {
    // Get the location and size of the target the user should be trying to select
    const target = getTargetBounds(trials[current_trial]);
    const virtual_coords = getVirtualCoordinates();
    if (virtual_coords) {
      // Check to see if the virtual cursor is inside the target bounds,
      // increasing either the 'hits' or 'misses' counters
      if (isTargeting(target)) {
        for (let i = 0; i < 32; i++)
          particle_system.addParticle(virtual_coords);
        // load hit sound (but first, stop any previous sound playing)
        if (active_features.sound_feedback) {
          hit_sound.play();
        }
        hits++;
        if (last_click_virtual_coords) {
          const distance = dist(
            last_click_virtual_coords.x,
            last_click_virtual_coords.y,
            target.x,
            target.y
          );
          fitts_IDs.push(Math.log2(distance / target.w + 1));
        } else {
          fitts_IDs.push(-2);
        }
        if (active_features.background_color_feedback)
          background_color = color(16, 32, 24); // green
      } else {
        if (active_features.sound_feedback) {
          miss_sound.play();
        }
        misses++;
        fitts_IDs.push(-1);
        if (active_features.background_color_feedback)
          background_color = color(60, 0, 0); // red
      }

      last_click_virtual_coords = virtual_coords;
      current_trial++; // Move on to the next trial/target
      line_lerp = 0;
      trialStartTime = millis();

      // Check if the user has completed all 54 trials
      if (current_trial === trials.length) {
        testEndTime = millis();
        draw_targets = false; // Stop showing targets and the user performance results
        printAndSavePerformance(); // Print the user's results on-screen and send these to the DB
        attempt++;

        // If there's an attempt to go create a button to start this
        if (attempt < 2) {
          continue_button = createButton("START 2ND ATTEMPT");
          continue_button.mouseReleased(continueTest);
          continue_button.position(
            width / 2 - continue_button.size().width / 2,
            height / 2 - continue_button.size().height / 2
          );
        }
      }
      // Check if this was the first selection in an attempt
      else if (current_trial === 1) {
        testStartTime = millis();
        trialStartTime = testStartTime;
      }
    }
  }
}

// Sets stroke, strokeWeight and fill
// set stroke and fill for irrelevant targets before calling, will persist
function setTargetDrawProperties(trial, target) {
  strokeWeight(active_features.border_on_hover && isTargeting(target) ? 4 : 2);

  // Check whether this target is the target the user should be trying to select
  if (trials[current_trial] === trial) {
    if (active_features.alt_repetition_indicator) {
      fill(color(255, 0, 0));
      stroke(
        trials[current_trial + 1] === trial
          ? color(0, 255, 255) // cyan
          : active_features.current_target_border
          ? color(255, 255, 0) // yellow
          : color(220, 220, 220) // grey
      );
    } else {
      // If the next trial is the same as the current, make it blue
      fill(
        trials[current_trial + 1] === trial
          ? color(0, 0, 255)
          : color(255, 0, 0)
      );
      stroke(
        active_features.current_target_border
          ? color(255, 255, 0)
          : color(220, 220, 220)
      );
    }
  } else if (trials[current_trial + 1] === trial) {
    fill(
      active_features.next_target_dim_color
        ? color(220, 220, 220)
        : color(255, 255, 255)
    );
  } else {
    // use already set values
  }
}

// Draw target on-screen
function drawTarget(i) {
  // Get the location and size for target (i)
  const target = getTargetBounds(i);

  stroke(color(0, 0, 0));
  fill(color(145, 145, 145));
  setTargetDrawProperties(i, target);

  // Draws the target
  circle(target.x, target.y, target.w);
}

// Returns the location and size of a given target
function getTargetBounds(i) {
  const x =
    parseInt(LEFT_PADDING) +
    parseInt((i % 3) * (TARGET_SIZE + TARGET_PADDING) + MARGIN);
  const y =
    parseInt(TOP_PADDING) +
    parseInt(Math.floor(i / 3) * (TARGET_SIZE + TARGET_PADDING) + MARGIN);

  return new Target(x, y, TARGET_SIZE);
}

// Evoked after the user starts its second (and last) attempt
function continueTest() {
  // Re-randomize the trial order
  shuffle(trials, true);
  current_trial = 0;
  print("trial order: " + trials);

  // Resets performance variables
  hits = 0;
  misses = 0;
  fitts_IDs = [];
  last_click_virtual_coords = undefined;

  continue_button.remove();

  // Shows the targets again
  background_color = color(0, 0, 0);
  line_lerp = 0;
  draw_targets = true;
  testStartTime = millis();
  trialStartTime = testStartTime;
}

// Is invoked when the canvas is resized (e.g., when we go fullscreen)
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  let display = new Display({ diagonal: display_size }, window.screen);

  // DO NOT CHANGE THESE!
  PPI = display.ppi; // calculates pixels per inch
  PPCM = PPI / 2.54; // calculates pixels per cm
  TARGET_SIZE = 1.5 * PPCM; // sets the target size in cm, i.e, 1.5cm
  TARGET_PADDING = 1.5 * PPCM; // sets the padding around the targets in cm
  MARGIN = 1.5 * PPCM; // sets the margin around the targets in cm

  // Sets the margin of the grid of targets to the left of the canvas (DO NOT CHANGE!)
  LEFT_PADDING = width / 3 - TARGET_SIZE - 1.5 * TARGET_PADDING - 1.5 * MARGIN;

  // Sets the margin of the grid of targets to the top of the canvas (DO NOT CHANGE!)
  TOP_PADDING = height / 2 - TARGET_SIZE - 3.5 * TARGET_PADDING - 1.5 * MARGIN;

  // Defines the user input area (DO NOT CHANGE!)
  inputArea = {
    x: width / 2 + 2 * TARGET_SIZE,
    y: height / 2,
    w: width / 3,
    h: height / 3,
  };

  // Starts drawing targets immediately after we go fullscreen
  draw_targets = true;
}

// Responsible for drawing the input area
function drawInputArea() {
  if (active_features.snapping) {
    for (let i = 0; i <= 18; i++) {
      trial = i;

      // Hack to avoid covering colored stroke
      if (i == 18) {
        trial = trials[current_trial];
      }

      const bounds = getTargetBounds(trial);

      stroke(color(220, 220, 220));
      fill(color(0, 0, 0));
      setTargetDrawProperties(trial, bounds);

      const target = getRealCoordinates(bounds);

      const up = getRealCoordinates(getTargetBounds(trial - 3)).y;
      const down = getRealCoordinates(getTargetBounds(trial + 3)).y;
      const left = getRealCoordinates(getTargetBounds(trial - 1)).x;
      const right = getRealCoordinates(getTargetBounds(trial + 1)).x;

      let topLeft = createVector((target.x + left) / 2, (target.y + up) / 2);
      let bottomRight = createVector(
        (target.x + right) / 2,
        (target.y + down) / 2
      );

      if (trial % 3 == 0) topLeft.x = inputArea.x;
      if (trial % 3 == 2) bottomRight.x = inputArea.x + inputArea.w;
      if (Math.floor(trial / 3) == 0) topLeft.y = inputArea.y;
      if (Math.floor(trial / 3) == 5) bottomRight.y = inputArea.y + inputArea.h;
      rect(
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        bottomRight.y - topLeft.y
      );
    }
  } else {
    fill(color(0, 0, 0));
    stroke(color(220, 220, 220));
    strokeWeight(2);
    rect(inputArea.x, inputArea.y, inputArea.w, inputArea.h);
  }
}

// Responsible for drawing the tutorial area
function drawTutorialArea() {
  // Draw instructions above input area
  const targetHeight = inputArea.y - TARGET_SIZE * 1.5;
  const titleHeight = inputArea.y - TARGET_SIZE * 2.25;

  fill(color(255, 0, 0));
  if (active_features.current_target_border) {
    stroke(color(255, 255, 0));
  } else {
    noStroke();
  }
  circle(inputArea.x + TARGET_SIZE * 0.5, targetHeight, TARGET_SIZE * 0.75);
  fill(color(255, 255, 255));
  noStroke();
  text("CURRENT", inputArea.x, titleHeight);

  fill(color(255, 255, 255));
  noStroke();
  circle(
    inputArea.x + inputArea.w / 4 + TARGET_SIZE * 0.5,
    targetHeight,
    TARGET_SIZE * 0.75
  );
  text("NEXT", inputArea.x + inputArea.w / 4, titleHeight);

  if (active_features.alt_repetition_indicator) {
    fill(color(255, 0, 0));
    stroke(color(0, 255, 255));
  } else {
    fill(color(0, 0, 255));
    stroke(color(255, 255, 255));
  }
  strokeWeight(4);
  circle(
    inputArea.x + inputArea.w / 2 + TARGET_SIZE * 0.5,
    targetHeight,
    TARGET_SIZE * 0.75
  );
  fill(color(255, 255, 255));
  noStroke();
  text("TWICE!", inputArea.x + inputArea.w / 2, titleHeight);

  fill(color(145, 145, 145));
  noStroke();
  circle(
    inputArea.x + (3 * inputArea.w) / 4 + TARGET_SIZE * 0.5,
    targetHeight,
    TARGET_SIZE * 0.75
  );
  fill(color(255, 255, 255));
  noStroke();
  text("IRRELEVANT", inputArea.x + (3 * inputArea.w) / 4, titleHeight);
}

function drawTimeBar() {
  // Draw bar, with outline, below input area
  const outlineY = inputArea.y + inputArea.h + TARGET_SIZE * 0.5;
  stroke(color(255, 255, 255));
  strokeWeight(2);
  noFill();
  rect(inputArea.x, outlineY, inputArea.w, TARGET_SIZE * 0.5);

  const ellapsed = current_trial > 0 ? millis() - trialStartTime : 0;
  const factor = max(0, 1 - ellapsed / optimal_selection_time);
  fill(lerpColor(color(255, 0, 0), color(0, 255, 0), factor));
  rect(inputArea.x, outlineY, inputArea.w * factor, TARGET_SIZE * 0.5);
}
