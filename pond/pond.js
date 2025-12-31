// pond physics - floating words experiment
// uses matter.js for physics + tone.js for collision audio

const Pond = {
  Engine: Matter.Engine,
  Bodies: Matter.Bodies,
  Body: Matter.Body,
  Composite: Matter.Composite,
  Mouse: Matter.Mouse,
  MouseConstraint: Matter.MouseConstraint,
  Events: Matter.Events,
  Vector: Matter.Vector,

  engine: null,
  wordMap: new Map(),
  wordCounter: 0,
  mouseConstraint: null,
  animationId: null,
  isRunning: false,

  // breeze state
  breezeDirection: { x: 0, y: 0 },
  breezeTarget: { x: 0, y: 0 },
  lastBreezeChange: 0,

  // audio state
  audioInitialized: false,
  audioEnabled: false,
  chimeSynth: null,
  reverb: null,
  lastChimeTime: 0,
  CHIME_COOLDOWN: 80,

  // pentatonic scale for ~harmonious~ collisions:
  CHIME_NOTES: ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5", "G5", "A5"],
  // Dmaj7 and Emin:
  // CHIME_NOTES: ["D4", "F#5", "A5", "C#5", "E5", "G5", "B5", "E6", "D5", "D6"],
  // lilypad config
  LILYPAD_SHADOW_PADDING: 8,  // matches CSS padding for shadow space
  LILYPAD_GREENS: [
    "#2D5A27",  // dark forest
    "#3D7A3D",  // medium green
    "#4A9A4A",  // bright green
    "#5DBA5D",  // light green
    "#2E8B57"   // sea green
  ],
  LILYPAD_SIZE: { min: 40, max: 80 },

  // flower colors for lilypads
  FLOWER_PASTELS: [
    "#ffa0aeff",  // pink
    "#DDA0DD",  // poiple
    "#BD5D73",  // red
    "#F5C181",  // yeller
    "#B0E0E6",  // powder blue
    "#6c97c2ff"   // deeper blue
  ],

  // water physics config - tuned for watery/bouncy feel
  config: {
    gravity: { x: 0, y: 0 },  // no constant gravity - breeze handles drift
    body: {
      restitution: 0.5,    // more bounce/momentum transfer
      friction: 0.05,      // less resistance between bodies
      frictionAir: 0.04,   // less air drag
      density: 0.003       // slightly more mass for momentum
    },
    walls: {
      restitution: 0.4,
      friction: 0.02
    },
    drag: {
      stiffness: 0.08,
      damping: 0.3
    },
    current: {
      strength: 0.00003,
      frequency: 0.002
    },
    breeze: {
      strength: 0.00005,    // force magnitude (gentle)
      interval: 5000        // ms between direction changes
    }
  }
};

// initialize the physics engine
function initEngine() {
  Pond.engine = Pond.Engine.create();
  Pond.engine.gravity.x = Pond.config.gravity.x;
  Pond.engine.gravity.y = Pond.config.gravity.y;

  createWalls();
  setupDragging();
  setupCollisionAudio();

  Pond.isRunning = true;
  step();
}

// create invisible boundary walls
function createWalls() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const thickness = 50;

  const walls = [
    // bottom
    Pond.Bodies.rectangle(width / 2, height + thickness / 2, width + thickness * 2, thickness, {
      isStatic: true,
      ...Pond.config.walls
    }),
    // top
    Pond.Bodies.rectangle(width / 2, -thickness / 2, width + thickness * 2, thickness, {
      isStatic: true,
      ...Pond.config.walls
    }),
    // left
    Pond.Bodies.rectangle(-thickness / 2, height / 2, thickness, height + thickness * 2, {
      isStatic: true,
      ...Pond.config.walls
    }),
    // right
    Pond.Bodies.rectangle(width + thickness / 2, height / 2, thickness, height + thickness * 2, {
      isStatic: true,
      ...Pond.config.walls
    })
  ];

  Pond.Composite.add(Pond.engine.world, walls);
}

// setup mouse/touch dragging
function setupDragging() {
  const container = document.getElementById("pond-container");

  // Prevent UI element events from bubbling up to Matter.js listeners on the container
  const uiElements = [
    document.getElementById("input-area"),
    document.getElementById("text-input"),
    document.getElementById("drop-button"),
    document.getElementById("clear-button"),
    document.getElementById("lilypad-button"),
    document.getElementById("audio-button"),
    document.getElementById("back-link")
  ];

  uiElements.forEach(el => {
    if (!el) return;
    ["mousedown", "touchstart", "touchmove", "touchend"].forEach(eventType => {
      el.addEventListener(eventType, (e) => {
        e.stopPropagation();
      });
    });
  });

  const mouse = Pond.Mouse.create(container);

  Pond.mouseConstraint = Pond.MouseConstraint.create(Pond.engine, {
    mouse: mouse,
    constraint: {
      stiffness: Pond.config.drag.stiffness,
      damping: Pond.config.drag.damping,
      render: { visible: false }
    }
  });

  Pond.Composite.add(Pond.engine.world, Pond.mouseConstraint);

  // visual feedback for dragging
  Pond.Events.on(Pond.mouseConstraint, "startdrag", (event) => {
    const body = event.body;
    if (body && Pond.wordMap.has(String(body.id))) {
      const wordData = Pond.wordMap.get(String(body.id));
      wordData.node.classList.add("dragging");
      // ripple on pickup
      createRipple(body.position.x, body.position.y, 1);
    }
  });

  Pond.Events.on(Pond.mouseConstraint, "enddrag", (event) => {
    const body = event.body;
    if (body && Pond.wordMap.has(String(body.id))) {
      const wordData = Pond.wordMap.get(String(body.id));
      wordData.node.classList.remove("dragging");

      // ripple on release, intensity based on velocity
      const speed = Math.sqrt(body.velocity.x ** 2 + body.velocity.y ** 2);
      createRipple(body.position.x, body.position.y, Math.min(speed, 3));

      // scale down velocity slightly for gentler release
      Pond.Body.setVelocity(body, {
        x: body.velocity.x * 0.8,
        y: body.velocity.y * 0.8
      });
    }
  });

  // prevent default touch behavior to avoid scrolling
  container.addEventListener("touchmove", (e) => {
    if (Pond.mouseConstraint.body) {
      e.preventDefault();
    }
  }, { passive: false });
}

// setup collision-triggered audio and visual ripples
function setupCollisionAudio() {
  Pond.Events.on(Pond.engine, "collisionStart", (event) => {
    const now = Date.now();
    const canPlayChime = Pond.audioInitialized && Pond.audioEnabled && Pond.chimeSynth &&
                         (now - Pond.lastChimeTime >= Pond.CHIME_COOLDOWN);

    event.pairs.forEach((pair) => {
      // skip wall collisions
      if (pair.bodyA.isStatic || pair.bodyB.isStatic) return;

      // calculate collision intensity
      const relativeVelocity = Math.sqrt(
        Math.pow(pair.bodyA.velocity.x - pair.bodyB.velocity.x, 2) +
        Math.pow(pair.bodyA.velocity.y - pair.bodyB.velocity.y, 2)
      );

      // always create ripple on collision (min intensity 0.5 so it's visible)
      // const collisionPoint = pair.collision.supports?.[0] || pair.bodyA.position;
      // createRipple(collisionPoint.x, collisionPoint.y, Math.max(relativeVelocity * 0.5, 0.5));
      // UPDATE: I'm going to try and set a threshold
      // only create ripple if collision is strong enough
      if (relativeVelocity >= 3) {
        const collisionPoint = pair.collision.supports?.[0] || pair.bodyA.position;
        createRipple(collisionPoint.x, collisionPoint.y, Math.max(relativeVelocity * 0.5, 0.5));
      }

      // only play chime if audio enabled and above velocity threshold
      if (canPlayChime && relativeVelocity >= 0.5) {
        playChime(relativeVelocity);
        Pond.lastChimeTime = now;
      }
    });
  });
}

// play a chime note based on collision velocity
function playChime(velocity) {
  if (!Pond.chimeSynth) return;

  // map velocity to volume (gentle = quieter)
  const volume = Math.min(-6, -18 + velocity * 2);

  // pick a random note from pentatonic scale
  const noteIndex = Math.floor(Math.random() * Pond.CHIME_NOTES.length);
  const note = Pond.CHIME_NOTES[noteIndex];

  // duration based on velocity
  const duration = 0.1 + Math.min(0.4, velocity * 0.05);

  try {
    Pond.chimeSynth.triggerAttackRelease(note, duration, Tone.now(), Tone.dbToGain(volume));
  } catch (e) {
    console.warn("Audio playback error:", e);
  }
}

// initialize tone.js audio (must be triggered by user interaction)
async function initAudio() {
  if (Pond.audioInitialized) return;

  try {
    await Tone.start();
    console.log("audio context started");

    // create polyphonic synth with bell-like qualities
    Pond.chimeSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "sine"
      },
      envelope: {
        attack: 0.01,
        decay: 1.5,
        sustain: 0,
        release: 2
      },
      volume: -12
    });

    // add reverb for spacious feel
    Pond.reverb = new Tone.Reverb({
      decay: 3,
      wet: 0.5
    });

    await Pond.reverb.generate();

    Pond.chimeSynth.connect(Pond.reverb);
    Pond.reverb.toDestination();

    Pond.audioInitialized = true;
    Pond.audioEnabled = true;

    // update button state
    const audioButton = document.getElementById("audio-button");
    audioButton.textContent = "disable sound"; // user can press to disable
    audioButton.classList.add("enabled");

  } catch (e) {
    console.error("Failed to initialize audio:", e);
  }
}

// toggle audio on/off
function toggleAudio() {
  if (!Pond.audioInitialized) {
    // first click: initialize audio
    initAudio();
  } else {
    // subsequent clicks: toggle enabled state
    Pond.audioEnabled = !Pond.audioEnabled;
    const audioButton = document.getElementById("audio-button");
    if (Pond.audioEnabled) {
      audioButton.textContent = "disable sound"; // user can press to disable
      audioButton.classList.add("enabled");
    } else {
      audioButton.textContent = "enable sound";
      audioButton.classList.remove("enabled");
    }
  }
}

// create word bodies from text input - words drift naturally as they spawn
function createWordsFromText(text) {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return;

  const containerRect = document.getElementById("pond-container").getBoundingClientRect();
  const startX = 50;
  const startY = 220;
  const maxX = containerRect.width - 100;
  const lineHeight = 45;
  const wordGap = 15;

  // pre-measure all word widths
  const wordWidths = words.map(word => {
    const tempSpan = document.createElement("span");
    tempSpan.className = "pond-word";
    tempSpan.textContent = word;
    tempSpan.style.visibility = "hidden";
    tempSpan.style.position = "absolute";
    document.body.appendChild(tempSpan);
    const width = tempSpan.getBoundingClientRect().width;
    tempSpan.remove();
    return width;
  });

  // track spawned bodies, line initial Ys, AND first word of each line
  const spawnedBodies = [];
  const lineStartYs = [];      // initial Y of each line (to align words 
                               // on the same line vertically)
                               // prevents "staircase" effect
  const lineFirstBodies = [];  // list of every first word of a line (their phys objs)
                               // used to position new lines relative to where 
                               // the previous line has drifted

  words.forEach((word, index) => {
    setTimeout(() => {
      let spawnX, spawnY;

      if (index === 0) {
        // first word: start at the start position
        spawnX = startX;
        spawnY = startY;
        lineStartYs.push(spawnY);
        // lineFirstBodies will be set after body is created
      } else {
        // subsequent words: position relative to previous word's current X position
        const prevData = spawnedBodies[index - 1];
        const prevBody = prevData.body;
        const prevWidth = prevData.width;

        // calculate where next word should go based on prev word's current X position
        // but keep Y anchored to the line's initial Y (for same-line alignment)
        spawnX = prevBody.position.x + prevWidth / 2 + wordGap;
        spawnY = lineStartYs[lineStartYs.length - 1];  // use stored initial Y

        // check if we need to wrap to next line
        if (spawnX + wordWidths[index] > maxX) {
          spawnX = startX;
          // NEW LINE: use previous line's first word's CURRENT (drifted) Y + lineHeight
          // this ensures new lines spawn below where previous line has actually drifted
          const prevLineFirstBody = lineFirstBodies[lineFirstBodies.length - 1];
          spawnY = prevLineFirstBody.position.y + lineHeight;
          lineStartYs.push(spawnY);  // store this as the new line's initial Y
          // lineFirstBodies will be set after body is created
        }
      }

      const body = createWordBody(word, { x: spawnX, y: spawnY });
      spawnedBodies.push({ body, width: wordWidths[index] });

      // if this is first word of a line, track its body for new line positioning
      if (index === 0 || lineStartYs.length > lineFirstBodies.length) {
        lineFirstBodies.push(body);
      }

      // give a gentle drift velocity (slight rightward + random vertical)
      Pond.Body.setVelocity(body, {
        x: 0.3 + Math.random() * 0.3,
        y: (Math.random() - 0.5) * 0.5
      });
    }, index * 80);
  });

  // clear textarea
  document.getElementById("text-input").value = "";
}

// create a single word as a physics body
function createWordBody(word, position = null) {
  const surface = document.getElementById("pond-surface");

  // create DOM element
  const span = document.createElement("span");
  span.className = "pond-word";
  span.textContent = word;
  span.id = `word-${Pond.wordCounter}`;
  surface.appendChild(span);

  // measure rendered size
  const rect = span.getBoundingClientRect();
  const containerRect = document.getElementById("pond-container").getBoundingClientRect();

  // use provided position or random position
  let startX, startY;
  if (position) {
    startX = containerRect.left + position.x;
    startY = containerRect.top + position.y;
  } else {
    startX = containerRect.left + 100 + Math.random() * (containerRect.width - rect.width - 200);
    startY = containerRect.top + 220 + Math.random() * 60;
  }

  // create physics body
  const body = Pond.Bodies.rectangle(
    startX + rect.width / 2,
    startY + rect.height / 2,
    rect.width + 8,
    rect.height + 8,
    {
      id: Pond.wordCounter,
      label: word,
      ...Pond.config.body
    }
  );

  // store mapping
  Pond.wordMap.set(String(Pond.wordCounter), {
    node: span,
    body: body,
    width: rect.width,
    height: rect.height
  });

  // add initial velocity - none if positioned (paragraph mode), random if not
  if (!position) {
    Pond.Body.setVelocity(body, {
      x: (Math.random() - 0.5) * 3,
      y: Math.random() * 1.5
    });
  }

  // add to physics world
  Pond.Composite.add(Pond.engine.world, body);

  Pond.wordCounter++;

  return body;
}

// create a single lilypad as a physics body
function createLilypad() {
  const surface = document.getElementById("pond-surface");

  // create DOM element
  const div = document.createElement("div");
  div.className = "lilypad";
  div.id = `lilypad-${Pond.wordCounter}`;

  // random size and color
  const size = Pond.LILYPAD_SIZE.min + Math.random() * (Pond.LILYPAD_SIZE.max - Pond.LILYPAD_SIZE.min);
  const color = Pond.LILYPAD_GREENS[Math.floor(Math.random() * Pond.LILYPAD_GREENS.length)];
  const padding = Pond.LILYPAD_SHADOW_PADDING;

  // element size includes padding on each side for shadow rendering space
  div.style.width = `${size + padding * 2}px`;
  div.style.height = `${size + padding * 2}px`;
  div.style.setProperty("--lilypad-color", color);

  // randomly add flower on top (~50% chance)
  if (Math.random() > 0.5) {
    const flower = document.createElement("div");
    flower.className = "lilypad-flower";
    const petalColor = Pond.FLOWER_PASTELS[Math.floor(Math.random() * Pond.FLOWER_PASTELS.length)];
    flower.style.setProperty("--petal-color", petalColor);
    div.appendChild(flower);
  }

  surface.appendChild(div);

  // random position across the pond
  const containerRect = document.getElementById("pond-container").getBoundingClientRect();
  const startX = 50 + Math.random() * (containerRect.width - size - 100);
  const startY = 250 + Math.random() * (containerRect.height - size - 100);

  // create circular physics body
  const body = Pond.Bodies.circle(
    startX + size / 2,
    startY + size / 2,
    size / 2,
    {
      id: Pond.wordCounter,
      label: "lilypad",
      ...Pond.config.body,
      density: 0.002  // slightly heavier than words
    }
  );

  // random initial rotation
  Pond.Body.setAngle(body, Math.random() * Math.PI * 2);

  // store mapping (use padded size for DOM positioning)
  const elementSize = size + padding * 2;
  Pond.wordMap.set(String(Pond.wordCounter), {
    node: div,
    body: body,
    width: elementSize,
    height: elementSize,
    isLilypad: true
  });

  // gentle initial velocity
  Pond.Body.setVelocity(body, {
    x: (Math.random() - 0.5) * 2,
    y: (Math.random() - 0.5) * 2
  });

  // add to physics world
  Pond.Composite.add(Pond.engine.world, body);

  Pond.wordCounter++;
}

// add multiple lilypads with staggered timing
function addLilypads() {
  const count = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    setTimeout(() => createLilypad(), i * 150);
  }
}

// apply gentle water current forces
function applyCurrentForces() {
  const time = Date.now() * Pond.config.current.frequency;

  Pond.wordMap.forEach((wordData, id) => {
    const body = wordData.body;
    if (!body || body.isStatic) return;

    // smooth sine-wave based current
    const forceX = Math.sin(time + body.position.y * 0.01) * Pond.config.current.strength;
    const forceY = Math.cos(time * 0.7 + body.position.x * 0.01) * Pond.config.current.strength * 0.5;

    Pond.Body.applyForce(body, body.position, { x: forceX, y: forceY });
  });
}

// update breeze direction periodically with smooth transitions
function updateBreeze() {
  const now = Date.now();
  const cfg = Pond.config.breeze;

  // pick new random direction every interval
  if (now - Pond.lastBreezeChange >= cfg.interval) {
    const angle = Math.random() * Math.PI * 2;
    Pond.breezeTarget = {
      x: Math.cos(angle) * cfg.strength,
      y: Math.sin(angle) * cfg.strength
    };
    Pond.lastBreezeChange = now;
  }

  // smooth interpolation toward target direction
  const lerpFactor = 0.02;
  Pond.breezeDirection.x += (Pond.breezeTarget.x - Pond.breezeDirection.x) * lerpFactor;
  Pond.breezeDirection.y += (Pond.breezeTarget.y - Pond.breezeDirection.y) * lerpFactor;
}

// apply breeze force to all bodies
function applyBreezeForce() {
  Pond.wordMap.forEach((wordData, id) => {
    const body = wordData.body;
    if (!body || body.isStatic) return;

    Pond.Body.applyForce(body, body.position, Pond.breezeDirection);
  });
}

// animation loop
function step() {
  if (!Pond.isRunning) return;

  // update physics
  Pond.Engine.update(Pond.engine, 1000 / 60);

  // apply forces
  updateBreeze();
  applyBreezeForce();
  applyCurrentForces();

  // update DOM positions
  Pond.wordMap.forEach((wordData, id) => {
    const body = wordData.body;
    const node = wordData.node;

    // center the word on body position
    const x = body.position.x - wordData.width / 2;
    const y = body.position.y - wordData.height / 2;
    const angle = body.angle;

    node.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;
  });

  Pond.animationId = requestAnimationFrame(step);
}

// create a ripple effect at the given position
function createRipple(x, y, intensity = 1) {
  const surface = document.getElementById("pond-surface");

  const ripple = document.createElement("div");
  ripple.className = "pond-ripple";

  // size based on intensity (collision velocity or drag action)
  const size = 40 + intensity * 20;
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${x - size / 2}px`;
  ripple.style.top = `${y - size / 2}px`;

  surface.appendChild(ripple);

  // remove after animation completes
  ripple.addEventListener("animationend", () => ripple.remove());
}

// clear all words from the pond
function clearPond() {
  // remove all word bodies from physics world
  Pond.wordMap.forEach((wordData, id) => {
    Pond.Composite.remove(Pond.engine.world, wordData.body);
    wordData.node.remove();
  });

  Pond.wordMap.clear();
}

// handle window resize
function handleResize() {
  // remove old walls
  const world = Pond.engine.world;
  const bodiesToRemove = world.bodies.filter(b => b.isStatic);
  bodiesToRemove.forEach(b => Pond.Composite.remove(world, b));

  // create new walls
  createWalls();

  // re-add mouse constraint
  Pond.Composite.remove(world, Pond.mouseConstraint);
  setupDragging();
}

// event listeners
document.addEventListener("DOMContentLoaded", () => {
  initEngine();

  // drop button
  document.getElementById("drop-button").addEventListener("click", () => {
    const text = document.getElementById("text-input").value;
    createWordsFromText(text);
  });

  // enter key in textarea
  document.getElementById("text-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = document.getElementById("text-input").value;
      createWordsFromText(text);
    }
  });

  // allow wheel scroll in textarea (prevent Matter.js from capturing it)
  document.getElementById("text-input").addEventListener("wheel", (e) => {
    e.stopPropagation();
  });

  // lilypad button
  document.getElementById("lilypad-button").addEventListener("click", addLilypads);

  // clear button
  document.getElementById("clear-button").addEventListener("click", clearPond);

  // audio button
  document.getElementById("audio-button").addEventListener("click", toggleAudio);

  // window resize
  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleResize, 250);
  });
});
