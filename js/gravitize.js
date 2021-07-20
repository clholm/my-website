// World global object
let World = {};
// counts number of span-wrapped elements
let id_counter = 0;

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
            let re = new RegExp(word + "(?=(\\s|\\.|$))");
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

// build and populate physics world
function build_world() {
  World.Engine = Matter.Engine;
  World.Bodies = Matter.Bodies;
  World.Composite = Matter.Composite;
  // FOR DEV PURPOSES  
  World.Render = Matter.Render;
  World.Runner = Matter.Runner;

  // create an engine
  World.engine = World.Engine.create();
  // FOR DEV PURPOSES
  World.render = World.Render.create({
    element: document.body,
    engine: World.engine
  });
  // add ground to the world
  let ground_width = document.body.offsetWidth;
  let ground_height = document.body.offsetHeight;
  // TODO: add a function that changes height on window resize
  World.ground = World.Bodies.rectangle(
    (ground_width / 2) + 10,
    ground_height,
    ground_width + 20,
    60,
    { isStatic: true }
  );
  World.Composite.add(World.engine.world, World.ground);
  // iterate over <span> wrapped elements, create a physics object for them,
  // and add them
  let nodes = document.querySelectorAll(".phys-obj");
  World.span_map = new Map();
  nodes.forEach(
    node => {
      // get bounding rectangle for node
      let rect = node.getBoundingClientRect();
      // create js obj
      let obj = {
        x: rect.x + rect.width / 2,
        y: rect.y,
        width: rect.width,
        height: rect.height
      }
      // create phys_obj for phys world
      let phys_obj = World.Bodies.rectangle(
        obj.x,
        obj.y,
        obj.width,
        obj.height
      );
      obj.phys_obj = phys_obj;
      // add phys_obj to world
      World.Composite.add(World.engine.world, obj.phys_obj);
      // add phys_obj to span_map
      let re = /([0-9])+/g;
      let id = re.exec(node.classList[1])[0];
      World.span_map.set(`${id}`, obj);
    }
  )
  // add the button!
  let button_rect = document.getElementById("gravity-button").getBoundingClientRect();
  let button_obj = {
    x: button_rect.x + button_rect.width / 2,
    y: button_rect.y,
    width: button_rect.width,
    height: button_rect.height
  }
  let button_phys_obj = World.Bodies.rectangle(
    button_obj.x,
    button_obj.y,
    button_obj.width,
    button_obj.height,
    { isStatic: true }
  );
  button_obj.phys_obj = button_phys_obj;
  World.Composite.add(World.engine.world,button_obj.phys_obj);
  // for (let i = 0; i < id_counter; ++i) {

  // }
  // run the renderer
  World.Render.run(World.render);

  // create runner
  let runner = World.Runner.create();

  // run the engine
  World.Runner.run(runner, World.engine);
}

// create gravity!
function gravitize() {
  // // module aliases
  // var Engine = Matter.Engine,
  // Render = Matter.Render,
  // Runner = Matter.Runner,
  // Bodies = Matter.Bodies,
  // Composite = Matter.Composite;

  // // create an engine
  // var engine = Engine.create();

  // // create a renderer
  // var render = Render.create({
  // element: document.body,
  // engine: engine
  // });

  // // create two boxes and a ground
  // var boxA = Bodies.rectangle(400, 200, 80, 80);
  // var boxB = Bodies.rectangle(450, 50, 80, 80);
  // var ground = Bodies.rectangle(400, 610, 810, 60, { isStatic: true });

  // // add all of the bodies to the world
  // Composite.add(engine.world, [boxA, boxB, ground]);

  // // run the renderer
  // Render.run(render);

  // // create runner
  // var runner = Runner.create();

  // // run the engine
  // Runner.run(runner, engine);
  build_world();
}