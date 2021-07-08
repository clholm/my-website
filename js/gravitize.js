// wrap every word of body text (paragraph and anchor) in a span
function spanitize() {
  let p_arr = document.querySelectorAll("p");
  let a_arr = document.querySelectorAll("a");
  let id_counter = 0;
  if (p_arr.length < 1 && a_arr.length < 1) {
    throw "Can't find any 'paragraph' or 'anchor' elements";
  }
  // iterate over p_arr and insert <span> tags between
  // words
  p_arr.forEach(
    elt => {
      // console.log(elt);
      // regex for matching all non-whitespace characters
      let re = /[^\s]+/g;
      words = elt.innerHTML.match(re);
      // iterate over all words and wrap them in a span
      words.forEach(
        word => {
          // dynamically constructs a regex that matches the word with a lookahead
          // for whitespace, periods, or a string or line end.
          let re = new RegExp(word + "(?=(\\s|\\.|$))");
          elt.innerHTML = elt.innerHTML.replace(re,`<span class="phys-obj phys-id-${id_counter}">${word}</span>`);
          id_counter += 1;
        }
      )
    }
  )
  // iterate over a_arr now
  a_arr.forEach(
    elt => {
      // console.log(elt);
      // regex for matching all non-whitespace characters
      let re = /[^\s]+/g;
      words = elt.innerHTML.match(re);
      // iterate over all words and wrap them in a span
      words.forEach(
        word => {
          // dynamically constructs a regex that matches the word with a lookahead
          // for whitespace, periods, or a string or line end.
          let re = new RegExp(word + "(?=(\\s|\\.|$))");
          elt.innerHTML = elt.innerHTML.replace(re,`<span class="phys-obj phys-id-${id_counter}">${word}</span>`);
          id_counter += 1;
        }
      )
    }
  )
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
}