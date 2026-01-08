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
          return '<div class="code-block"><button onclick="md.clipboard(this)">copy</button><pre class="hljs"><code>' +
                 hljs.highlight(str, { language: lang }).value +
                 '</code></pre></div>';
        }
        catch (__) {}
      }
      // fallback to plain code block with copy button
      // this shouldn't happen
      return '<div class="code-block"><button onclick="md.clipboard(this)">copy</button><pre class="hljs"><code>' +
             hljs.highlight(str, { language: "text" }).value +
             '</code></pre></div>';
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

  // override footnote renderer to use onclick instead of href
  // this prevents footnote anchors from breaking hash-based routing
  markdownIt.renderer.rules.footnote_ref = function(tokens, idx, options, env, self) {
    var id = tokens[idx].meta.id + 1;
    var refId = id;
    if (tokens[idx].meta.subId > 0) {
      refId += ':' + tokens[idx].meta.subId;
    }
    return '<sup class="footnote-ref"><a id="fnref' + refId + '" onclick="document.getElementById(\'fn' + id + '\').scrollIntoView({behavior:\'smooth\'})">[' + id + ']</a></sup>';
  };

  markdownIt.renderer.rules.footnote_anchor = function(tokens, idx, options, env, self) {
    var id = tokens[idx].meta.id + 1;
    var refId = id;
    if (tokens[idx].meta.subId > 0) {
      refId += ':' + tokens[idx].meta.subId;
    }
    return ' <a onclick="document.getElementById(\'fnref' + refId + '\').scrollIntoView({behavior:\'smooth\'})" class="footnote-backref">↩︎</a>';
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
    // clear any existing timeout to prevent race conditions
    if (e.resetTimeout) {
      clearTimeout(e.resetTimeout);
    }

    // get code content directly from <code> element
    let codeElement = e.parentNode.querySelector('code');
    let textToCopy = codeElement ? codeElement.innerText : e.parentNode.innerText.replace('copy\n','');

    // copy to clipboard with error handling
    navigator.clipboard.writeText(textToCopy).then(function() {
      // visual feedback
      e.innerText = 'copied';
      e.classList.add('copied');

      // auto-reset after 2 seconds
      e.resetTimeout = setTimeout(function() {
        e.innerText = 'copy';
        e.classList.remove('copied');
      }, 2000);
    }).catch(function(err) {
      // error handling
      console.error('Failed to copy:', err);
      e.innerText = 'error';
      e.resetTimeout = setTimeout(function() {
        e.innerText = 'copy';
      }, 2000);
    });
  }

  // show copy button on mobile when code block is tapped
  if ('ontouchstart' in window) {
    document.addEventListener('DOMContentLoaded', function() {
      var hideTimers = {};

      document.addEventListener('touchstart', function(e) {
        var codeBlock = e.target.closest('.markdown .code-block');
        if (codeBlock) {
          var button = codeBlock.querySelector('button');
          if (button) {
            // clear any existing timer
            if (hideTimers[codeBlock]) {
              clearTimeout(hideTimers[codeBlock]);
            }

            // show button
            button.style.display = 'block';

            // hide after 3 seconds
            hideTimers[codeBlock] = setTimeout(function() {
              button.style.display = '';
            }, 3000);
          }
        }
      });
    });
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

  // generate table of contents from rendered HTML headers
  // srcDiv: ID of div containing rendered content (e.g., 'md-post')
  // tocDiv: ID of div where TOC will be inserted (e.g., 'left-panel')
  // options: { css: 'h2,h3,h4', title: 'Contents', scrollspy: true }
  md.toc = function(srcDiv, tocDiv, options) {
    var tocSelector = (options && options.css) || 'h2,h3,h4';
    var tocTitle = (options && options.title) || 'Contents';
    var enableScrollspy = options && options.scrollspy;

    var srcElement = document.getElementById(srcDiv);
    if (!srcElement) return;

    var headers = srcElement.querySelectorAll(tocSelector);
    if (headers.length === 0) return;

    var html = '<div class="toc"><ul>';
    if (tocTitle !== 'none') {
      html += '<h3>' + tocTitle + '</h3>';
    }

    for (var i = 0; i < headers.length; i++) {
      var header = headers[i];

      // skip headers with id starting with 'no-toc'
      if (header.id && header.id.substr(0, 6) === 'no-toc') continue;

      // auto-generate ID if missing
      if (!header.id) {
        header.id = 'toc-item-' + i;
      }

      // add list item with class matching header level (H2, H3, etc.)
      html += '<li class="' + header.nodeName + '" title="#' + header.id + '" ';
      html += 'onclick="document.getElementById(this.title.substr(1)).scrollIntoView({behavior:\'smooth\'}); return false;">';
      html += header.textContent + '</li>';
    }

    html += '</ul></div>';
    var existingNav = document.getElementById(tocDiv).innerHTML;
    document.getElementById(tocDiv).innerHTML = html + existingNav;

    if (enableScrollspy) {
      md.setupScrollspy(tocDiv);
    }
  };

  // scrollspy: highlight current section in TOC as user scrolls
  md.setupScrollspy = function(tocDiv) {
    var leftPanel = document.getElementById('left-panel');
    var headerHeight = 67; // header height (60px) + padding-bottom (7px)
    
    // set the first section of the post as active
    var tocItems = document.getElementById(tocDiv).querySelectorAll('.toc li');
    tocItems[0].classList.add('active');

    // listen to window scroll
    window.onscroll = function() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      // if header is scrolled by, set navbar to fixed
      if (scrollTop >= headerHeight) {
        leftPanel.style.position = 'fixed';
        leftPanel.style.top = '0';
        leftPanel.style.maxHeight = '100vh';
      }
      // otherwise absolute  
      else {
        leftPanel.style.position = 'absolute';
        leftPanel.style.top = headerHeight + 'px';
        leftPanel.style.maxHeight = 'calc(100vh - ' + headerHeight + 'px)';
      }

      // find the last header that's been scrolled past
      var currentSection = 0;
      var threshold = 100; // distance from top of viewport to consider "scrolled past"

      for (var i = 0; i < tocItems.length; i++) {
        var targetId = tocItems[i].title.substr(1);
        var targetElement = document.getElementById(targetId);

        if (targetElement) {
          var rect = targetElement.getBoundingClientRect();
          // if header is above the threshold, it's the current section
          if (rect.top <= threshold) {
            currentSection = i;
          }
        }
      }

      // detect if we're at the bottom of the page and highlight last section
      var isAtBottom = (window.innerHeight + window.pageYOffset) >=
                       (document.documentElement.scrollHeight - 1);
      if (isAtBottom && tocItems.length > 0) {
        currentSection = tocItems.length - 1;
      }

      // remove active class from all and add to current section
      for (var j = 0; j < tocItems.length; j++) {
        tocItems[j].classList.remove('active');
      }
      tocItems[currentSection].classList.add('active');
    };
  };

  // restore normal navigation in left panel
  md.restoreNav = function() {
    if (typeof md.nav === 'function') {
      md.nav(md.indexYaml ? md.indexYaml['nav-group'] : null);
    }
  };

  if (typeof exports==='object') {
    module.exports=md;
  } else if (typeof define==='function') {
     define(function(){return md;});
  } else {
     this.md=md;
  }
}).call(function(){ return this || (typeof window!=='undefined' ? window : global)}());
