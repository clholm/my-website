// World global object
let World = {};
// counts number of span-wrapped elements
let id_counter = 0;
// restitution value for bodies in matter js
let bounce = .9;

// wrap every word of body text (paragraph and anchor) in a span
// and assign them an incremental id for the physics engine
function spanitize() {
  let p_arr = document.querySelectorAll("p");
  let a_arr = document.querySelectorAll("a");
  let id_counter = 0;
  // anonymous function that iterates over node array and wraps words in <span>s
  let span_helper = (arr, id_counter) => {
    arr.forEach(
      elt => {
        // regex for matching all non-whitespace characters
        let re = /[^\s]+/g;
        words = elt.innerHTML.match(re);
        // iterate over all words and wrap them in a span
        words.forEach(
          word => {
            // dynamically construct a regex that matches the word with a lookahead
            // for whitespace, periods, or a string or line end.
            let word_esc = word;
            if (word[0] === "(") {
              let esc = String.raw`\(`;
              word_esc = word_esc.replace("(", esc);
            }
            if (word.slice(-1) === ")") {
              let esc = String.raw`\)`;
              word_esc = word_esc.replace(")", esc);
            }
            let re = new RegExp(word_esc + "(?=(\\s|\\.|$))");
            // TODO: there has to be a better way
            // hacky fix for paragaphs with with "span", "an", "pan", etc. in them
            if ("span".includes(word)) {
              // negative lookbehind ensures that we aren't span-wrapping a word
              // that we've already span-wrapped
              re = new RegExp("(?<!>)\\b" + word_esc + "\\b");
            }
            elt.innerHTML = elt.innerHTML.replace(re,`<span class="phys-obj phys-id-${id_counter}">${word}</span>`);
            id_counter += 1;
          }
        )
      }
    )
    return id_counter;
  }

  if (p_arr.length < 1 && a_arr.length < 1) {
    throw "Can't find any 'paragraph' or 'anchor' elements";
  }
  // iterate over p_arr and a_arr and insert <span> tags between
  // words
  id_counter = span_helper(p_arr, id_counter);
  id_counter = span_helper(a_arr, id_counter);
}

// adds static objects to the world
// requires a World be initialized already
function staticize() {
  World.static_arr = []
  let static_arr = document.querySelectorAll("img");
  static_arr.forEach(
    img => {
      // get bounding rectangle for node
      let rect = img.getBoundingClientRect();
      // create js obj
      let obj = {
        xₒ:     rect.x,
        yₒ:     rect.y + window.scrollY,
        width:  rect.width,
        height: rect.height,
        img:    img
      }
      World.Composite.add(
        World.engine.world,
        World.Bodies.rectangle(
          rect.x + rect.width / 2,
          obj.yₒ + obj.height / 2,
          obj.width,
          obj.height,
          { isStatic: true, restitution: bounce }
        )
      );
      // store obj in World's static_arr
      World.static_arr.push(obj);
    }
  )
}

// build and populate physics world
function build_world() {
  World.Engine = Matter.Engine;
  World.Bodies = Matter.Bodies;
  World.Composite = Matter.Composite;
  // create an engine
  World.engine = World.Engine.create();
  // lower gravity a bit
  World.engine.gravity.y = .9;
  // add ground to the world
  let ground_width = document.body.offsetWidth;
  // let ground_height = document.body.offsetHeight;
  let ground_height = Math.max(
    document.body.scrollHeight, document.documentElement.scrollHeight,
    document.body.offsetHeight, document.documentElement.offsetHeight,
    document.body.clientHeight, document.documentElement.clientHeight
  );
  // TODO: add a function that changes height on window resize
  World.ground = World.Bodies.rectangle(
    (ground_width / 2) + 10,
    // ground_height + 50,
    ground_height + 60,
    ground_width + 20,
    150,
    { isStatic: true, restitution: bounce }
  );
  World.Composite.add(World.engine.world, World.ground);
  // add wall boxes
  World.left_wall = World.Bodies.rectangle(
    0,
    (ground_height / 2) + 30,
    7,
    ground_height,
    { isStatic: true, restitution: bounce }
  );
  World.right_wall = World.Bodies.rectangle(
    ground_width,
    (ground_height / 2) + 30,
    7,
    ground_height,
    { isStatic: true, restitution: bounce }
  );
  World.Composite.add(World.engine.world, [World.left_wall, World.right_wall]);
  // add other static elements
  staticize();
  // iterate over <span> wrapped elements, create a physics object for them,
  // and add them
  let nodes = document.querySelectorAll(".phys-obj");
  id_counter = 0;
  World.span_map = new Map();
  nodes.forEach(
    node => {
      // get bounding rectangle for node
      let rect = node.getBoundingClientRect();
      // create js obj
      let obj = {
        xₒ: rect.x + rect.width / 2,
        yₒ: rect.y + rect.height / 2 + window.scrollY,
        width: rect.width,
        height: rect.height,
        node: node
      }
      // create phys_obj for phys world
      // add phys_obj to span_map
      let re = /([0-9])+/g;
      let id = re.exec(node.classList[1])[0];
      let phys_obj = World.Bodies.rectangle(
        obj.xₒ,
        obj.yₒ,
        obj.width,
        obj.height,
        { id: parseFloat(`${id}`, 10), restitution: bounce }
      );
      obj.phys_obj = phys_obj;
      // add phys_obj to world
      World.Composite.add(World.engine.world, obj.phys_obj);
      World.span_map.set(`${id}`, obj);
      // console.log(phys_obj.id + " and " + `${id}`);
      ++id_counter;
    }
  )
  // add the button!
  let button = document.getElementById("gravity-button");
  let button_rect = button.getBoundingClientRect();
  let button_obj = {
    x: button_rect.x + button_rect.width / 2,
    y: button_rect.y + button_rect.height / 2 + window.scrollY,
    width: button_rect.width,
    height: button_rect.height
  }
  let button_phys_obj = World.Bodies.rectangle(
    button_obj.x,
    button_obj.y,
    button_obj.width,
    button_obj.height,
    { isStatic: true, restitution: bounce }
  );
  button_obj.phys_obj = button_phys_obj;
  // make button absolute
  button.style.position = "absolute";
  button.style.left = button_obj.x - button_rect.width / 2 + "px";
  button.style.top = button_obj.y - button_rect.height / 2 + "px";
  // TODO: fix button position on resize
  // iterate over all span-wrapped elements and make their position absolute
  for (let i = 0; i < id_counter; ++i) {
    obj = World.span_map.get(`${i}`);
    let node = obj.node;
    node.style.left = obj.xₒ - obj.width / 2 + "px";
    node.style.top = obj.yₒ - obj.height / 2 + "px";
    node.style.position = "absolute";
  }

  World.Composite.add(World.engine.world,button_obj.phys_obj);
  World.button = button_obj;
  return World;
}

// perform step in physics simulation and apply positioning
function step() {
  // update the engine, use default time step for right now
  World.Engine.update(World.engine);
  // iterate over all physics objects and update their positions
  let bodies = World.Composite.allBodies(World.engine.world);
  bodies.forEach(
    body => {
      // retrieve corresponding object from the span_map
      let obj = World.span_map.get(`${body.id}`);
      if (typeof obj !== "undefined") {
        let pos = body.position;
        let x = pos.x;
        let y = pos.y;
        let transf_x = x - obj.xₒ;
        let transf_y = y - obj.yₒ;
        obj.x = x;
        obj.y = y;
        obj.θ = body.angle;
        // do the CSS 🤠
        node = obj.node;
        node.style.transform = `translate(${transf_x}px, ${transf_y}px) rotate(${obj.θ}rad)`;
      }
    }
  )
  // recursively call step
  window.requestAnimationFrame(step);
}

// create gravity!
function gravitize() {
  build_world();
  // freeze static objects in place with absolute positioning
  World.static_arr.forEach(
    obj => {
      let img = obj.img;
      img.style.left = obj.xₒ + "px";
      img.style.top = obj.yₒ + "px";
      img.style.position = "absolute";
    }
  )
  // begin the animation!
  window.requestAnimationFrame(step);
}