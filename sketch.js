// Bakeoff #2 - Seleção de Alvos Fora de Alcance
// IPM 2021-22, Período 3
// Entrega: até dia 22 de Abril às 23h59 através do Fenix
// Bake-off: durante os laboratórios da semana de 18 de Abril

// p5.js reference: https://p5js.org/reference/

// Database (CHANGE THESE!)
const GROUP_NUMBER = 03; // Add your group number here as an integer (e.g., 2, 3)
const BAKE_OFF_DAY = true; // Set to 'true' before sharing during the bake-off day

// Target and grid properties (DO NOT CHANGE!)
let PPI, PPCM;
let TARGET_SIZE;
let TARGET_PADDING, MARGIN, LEFT_PADDING, TOP_PADDING;
let continue_button;
let inputArea = { x: 0, y: 0, h: 0, w: 0 }; // Position and size of the user input area

// Metrics
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

// Features (initial value = probability of being active)
const active_features = {
  particles: 0.7,
  current_target_border: 0.7,
  border_on_hover: 0.7,
  navigation_lines: 0.7,
  animate_navigation_line: 0.7,
  next_target_dim_color: 0.5,
  background_color_feedback: 0.7,
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

  textFont("Arial", 18); // font size for the majority of the text
  drawUserIDScreen(); // draws the user start-up screen (student ID and display size)

  background_color = color(0, 0, 0);

  hit_sound = loadSound("assets/hit.wav");
  miss_sound = loadSound("assets/miss.wav");
}

// Runs every frame and redraws the screen
function draw() {
  if (draw_targets) {
    // The user is interacting with the 6x3 target grid
    background(background_color); // sets background to black

    // Print trial count at the top left-corner of the canvas
    fill(color(255, 255, 255));
    textAlign(LEFT);
    text("Trial " + (current_trial + 1) + " of " + trials.length, 50, 20);

    // Draw particles
    particle_system.run();

    // Draw all 18 targets
    for (var i = 0; i < 18; i++) drawTarget(i);

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

    // Draw the user input area
    drawInputArea();

    // Draw the virtual cursor
    let x = map(mouseX, inputArea.x, inputArea.x + inputArea.w, 0, width);
    let y = map(mouseY, inputArea.y, inputArea.y + inputArea.h, 0, height);

    fill(color(255, 255, 255));
    circle(x, y, 0.5 * PPCM);
  }
}

function randomizeFeatures() {
  // Randomize the active features
  for (const feat of Object.keys(active_features)) {
    active_features[feat] = random() < active_features[feat];
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
    else if (fid === -2) fid = "---"; // first trial
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

function getVirtualCoordinates(target) {
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

function isTargeting(target) {
  const virtual_coords = getVirtualCoordinates(target);
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
    const virtual_coords = getVirtualCoordinates(target);
    if (virtual_coords) {
      // Check to see if the virtual cursor is inside the target bounds,
      // increasing either the 'hits' or 'misses' counters
      if (isTargeting(target)) {
        for (let i = 0; i < 32; i++)
          particle_system.addParticle(virtual_coords);
        // load hit sound (but first, stop any previous sound playing)
        hit_sound.play();
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
        miss_sound.play();
        misses++;
        fitts_IDs.push(-1);
        if (active_features.background_color_feedback)
          background_color = color(60, 0, 0); // red
      }

      last_click_virtual_coords = virtual_coords;
      current_trial++; // Move on to the next trial/target
      line_lerp = 0;

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
      }
    }
  }
}

// Draw target on-screen
function drawTarget(i) {
  // Get the location and size for target (i)
  let target = getTargetBounds(i);

  stroke(color(220, 220, 220));
  strokeWeight(2);

  // Check whether this target is the target the user should be trying to select, otherwise red
  if (trials[current_trial] === i) {
    // If the next particle is the same as the current, make it blue
    fill(trials[current_trial + 1] === i ? color(0, 0, 255) : color(255, 0, 0));
    stroke(
      active_features.current_target_border
        ? color(255, 255, 0)
        : color(220, 220, 220)
    );
    // Remember you are allowed to access targets (i-1) and (i+1)
    // if this is the target the user should be trying to select
  } else if (trials[current_trial + 1] === i) {
    fill(
      active_features.next_target_dim_color
        ? color(220, 220, 220)
        : color(255, 255, 255)
    );
  } else {
    fill(color(145, 145, 145));
    // noStroke(); // probably won't work
    strokeWeight(0);
  }

  if (active_features.border_on_hover && isTargeting(target)) {
    strokeWeight(4);
  }

  // Draws the target
  circle(target.x, target.y, target.w);
}

// Returns the location and size of a given target
function getTargetBounds(i) {
  var x =
    parseInt(LEFT_PADDING) +
    parseInt((i % 3) * (TARGET_SIZE + TARGET_PADDING) + MARGIN);
  var y =
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
  fill(color(0, 0, 0));
  stroke(color(220, 220, 220));
  strokeWeight(2);

  rect(inputArea.x, inputArea.y, inputArea.w, inputArea.h);
}
