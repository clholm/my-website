(function() { 
  // define md object, and extent function
  var md = {
    yaml: {},
    before: function (str) { return str }
  };


  // initialize markdown-it with options that match the original `casual-markdown`
  // parsing functionality
  // clholm note: enabling HTML here could make the application susceptible to
  // XSS. may need to change this in the future.
  // right now I control all the content on the page, so it shouldn't be an issue.
  var markdownIt = window.markdownit({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
    highlight: function (str, lang) {
      // use Highlight.js for syntax highlighting if available and language is specified
      if (lang && typeof hljs !== 'undefined' && hljs.getLanguage(lang)) {
        try {
          return '<pre class="hljs"><button onclick="md.clipboard(this)">copy</button><code>' +
                 hljs.highlight(str, { language: lang }).value +
                 '</code></pre>';
        } 
        catch (__) {}
      }
      // fallback to plain code block with copy button
      // this shouldn't happen
      return '<pre class="hljs"><button onclick="md.clipboard(this)">copy</button><code>' +
             hljs.highlight(str, { language: "text" }).value +
             '</code></pre>';
    }
  }).use(window.markdownitFootnote);


  // adding renderer rules to match the original `casual-markdown`
  // parsing functionality
  // some code below is llm-generated, but there's similar sample code in the
  // markdown-it docs here: https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md

  // remember the old renderer if overridden, or proxy to the default renderer
  var defaultRender = markdownIt.renderer.rules.link_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  // add target="_blank" to all links
  // from https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer
  markdownIt.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    // add a new `target` attribute, or replace the value of the existing one.
    tokens[idx].attrSet('target', '_blank');

    // pass the token to the default renderer.
    return defaultRender(tokens, idx, options, env, self);
  };
  // parse YAML frontmatter using js-yaml library
  md.formatYAML = function(front, matter) {
    try {
      // use js-yaml to parse the YAML frontmatter
      if (typeof jsyaml !== 'undefined') {
        md.yaml = jsyaml.load(matter) || {};
      } 
      else {
        console.warn('js-yaml library not loaded, YAML frontmatter will not be parsed');
        md.yaml = {};
      }
    } 
    catch (e) {
      console.error('Error parsing YAML frontmatter:', e);
      md.yaml = {};
    }
    return ''
  }

  // copy to clipboard for code-block
  md.clipboard = function (e) {
    navigator.clipboard.writeText( e.parentNode.innerText.replace('copy\n','') )
    e.innerText = 'copied'
  }

  // custom processor for features not supported by markdown-it
  // llm-generated
  md.customProcessor = function(html) {
    // handles <hX>{YYYY}<hX> for custom header IDs
    html = html.replace(/^<h(\d)\>(.*?)\s*{(.*)}\s*<\/h\d\>/gm, '<h$1 id="$3">$2</h$1>');

    // handle the specific caption structure
    // this regex looks for:
    // 1. a paragraph tag opening (<p>)
    // 2. strong tag with content ([<strong>...</strong>]) - this is your caption
    // 3. a break tag (<br>)
    // 4. an image tag (<img...>)
    // 5. a paragraph tag closing (</p>)
    // it captures the strong content and the image tag.
    // then it reconstructs the html, placing the strong content inside a new div.
    html = html.replace(/<p>(\[<strong>(.*?)<\/strong>\])<br>\s*(<img[^>]+>)<\/p>/g, function(match, fullCaptionTag, captionText, imgTag) {
        // imgTag is the entire <img> element
        // captionText is just "picture 1: inspecting..."
        // fullCaptionTag is "[<strong>...</strong>]"
        return '<p>' + imgTag + '<div class="image-caption-text">' + captionText + '</div></p>';
    });

    return html;
  }

  // parse markdown string into HTML content
  md.html = function(mdText) {
    // replace \r\n to \n, and handle front matter for simple YAML
    mdText = mdText.replace(/\r\n/g, '\n')
      .replace(/^---+\s*\n([\s\S]*?)\n---+\s*\n/, md.formatYAML);

    // apply yaml variables in the markdown file
    // regex matches strings like {{css-background}}
    for (var name in this.yaml) {
      mdText = mdText.replace(new RegExp('\{\{\\s*'+name+'\\s*\}\}', 'gm'), this.yaml[name]);
    }

    // normalize code fence markers (~~~ to ```)
    mdText = mdText.replace(/\n~~~/g,'\n```');

    // process markdown with markdown-it (which handles code blocks via Highlight.js)
    // then apply custom post-processing
    var mdHTML = md.customProcessor(
      markdownIt.render(
        md.before(mdText)
      )
    );

    return '<div class="markdown">' + mdHTML + '</div>';
  }

  if (typeof exports==='object') { 
    module.exports=md;
  } else if (typeof define==='function') { 
     define(function(){return md;});
  } else {
     this.md=md;
  }
}).call(function(){ return this || (typeof window!=='undefined' ? window : global)}());
