/*****************************************************************************
 * casual-markdown - a lightweight regexp-base markdown parser with TOC support
 * 2022/07/31, v0.90, refine frontmatter (simple yaml)  
 * 2023/04/12, v0.92, addCopyButton for code-block
 *
 * Copyright (c) 2022-2023, Casualwriter (MIT Licensed)
 * https://github.com/casualwriter/casual-markdown
*****************************************************************************/

/*
update 2024/12:
changes made by clholm to support clholm.com
changed markdown parser to the `markdown-it` library instead of custom regexes
*/

(function() { 
  // define md object, and extent function
  var md = { 
    yaml: {}, 
    before: function (str) { return str }, 
    after: function (str) { return str }
  };

  // initialize markdown-it with options that match the original `casual-markdown`
  // parsing functionality
  // clholm note: enabling HTML here could make the application susceptible to
  // XSS. may need to change this in the future.
  // right now I control all the content on the page, so it shouldn't be an issues.
  var markdownIt = window.markdownit({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true
  }).use(window.markdownitFootnote);


  // adding renderer rules to match the original `casual-markdown`
  // parsing functionality
  // some code below is llm-generated, but there's similar sample code in the
  // `markdown-init` docs here: https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md
  
  // remember the old renderer if overridden, or proxy to the default renderer
  var defaultRender = markdownIt.renderer.rules.link_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  // markdownIt.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  //   // add target="_blank" for links with "new" title
  //   // original `casual-markdown` code added "_new" instead, but apparently that's
  //   // not in the html spec: https://stackoverflow.com/questions/4964130/target-blank-vs-target-new
  //   var aIndex = tokens[idx].attrIndex('title');
  //   if (aIndex >= 0 && tokens[idx].attrs[aIndex][1] === 'new') {
  //     tokens[idx].attrSet('target', '_blank');
  //   }
  //   return defaultRender(tokens, idx, options, env, self);
  // };

  // add target="_blank" to all links
  // from https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer
  markdownIt.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    // add a new `target` attribute, or replace the value of the existing one.
    tokens[idx].attrSet('target', '_blank');
  
    // pass the token to the default renderer.
    return defaultRender(tokens, idx, options, env, self);
  };


  // function for REGEXP to convert html tag. ie. <TAG> => &lt;TAG&gt;
  // clholm note: no idea if this is sufficient to prevent XSS or not, I suspect
  // not
  md.formatTag = function (html) {
     return html.replace(/</g,'&lt;').replace(/\>/g,'&gt;'); 
  }

  // frontmatter for simple YAML (support multi-level, but string value only)
  // cholm todo: maybe use a yaml parsing library?
  md.formatYAML = function (front, matter) {
    var level = {}, latest = md.yaml;
    matter.replace( /^\s*#(.*)$/gm, '' ).replace( /^( *)([^:^\n]+):(.*)$/gm, function(m, sp, key,val) { 
        level[sp] = level[sp] || latest
        latest = level[sp][key.trim()] = val.trim() || {}
        for (e in level) if(e>sp) level[e]=null;
      });
    return ''
  }

  //===== format code-block, highlight remarks/keywords for code/sql
  md.formatCode = function (match, title, block) {
    // convert tag <> to &lt; &gt; tab to 3 space, support marker using ^^^
    block = block.replace(/</g,'&lt;')
      .replace(/\>/g,'&gt;')
      .replace(/\t/g,'   ')
      .replace(/\^\^\^(.+?)\^\^\^/g, '<mark>$1</mark>');
    
    // highlight comment and keyword based on title := none | sql | code
    if (title.toLowerCase(title) == 'sql') {
      block = block.replace(/^\-\-(.*)/gm,'<rem>--$1</rem>')
        .replace(/\s\-\-(.*)/gm,' <rem>--$1</rem>')
        .replace(/(\s?)(function|procedure|return|if|then|else|end|loop|while|or|and|case|when)(\s)/gim,'$1<b>$2</b>$3')
        .replace(/(\s?)(select|update|delete|insert|create|from|where|group by|having|set)(\s)/gim,'$1<b>$2</b>$3')
    } else if ((title||'none')!=='none') {
      block = block.replace(/^\/\/(.*)/gm,'<rem>//$1</rem>')
        .replace(/\s\/\/(.*)/gm,' <rem>//$1</rem>')   
        .replace(/(\s?)(function|procedure|return|exit|if|then|else|end|loop|while|or|and|case|when)(\s)/gim,'$1<b>$2</b>$3')
        .replace(/(\s?)(var|let|const|=>|for|next|do|while|loop|continue|break|switch|try|catch|finally)(\s)/gim,'$1<b>$2</b>$3')
    }
    
    return '<pre title="' + title + '"><button onclick="md.clipboard(this)">copy</button><code>'  + block + '</code></pre>'
  }

  // copy to clipboard for code-block
  md.clipboard = function (e) {
    navigator.clipboard.writeText( e.parentNode.innerText.replace('copy\n','') )
    e.innerText = 'copied'
  }

  // custom processor for features not supported by markdown-it
  // llm-generated
  md.customProcessor = function(html) {
    // custom text decorations
    html = html.replace(/\^\^\^(.+?)\^\^\^/gm, '<mark>$1</mark>') // emphasis tag
      .replace(/\^\^(\w.*?)\^\^/gm, '<ins>$1</ins>') // insert tag
      .replace(/__(\w.*?[^\\])__/gm, '<u>$1</u>'); // the unarticulated annotation (red squiggly line)

    // handles <hX>{YYYY}<hX> for some reason
    html = html.replace(/^<h(\d)\>(.*?)\s*{(.*)}\s*<\/h\d\>/gm, '<h$1 id="$3">$2</h$1>');


    // NEW: Handle the specific caption structure
    // This regex looks for:
    // 1. A paragraph tag opening (<p>)
    // 2. Strong tag with content ([<strong>...</strong>]) - this is your caption
    // 3. A break tag (<br>)
    // 4. An image tag (<img...>)
    // 5. A paragraph tag closing (</p>)
    // It captures the strong content and the image tag.
    // Then it reconstructs the html, placing the strong content inside a new div.
    html = html.replace(/<p>(\[<strong>(.*?)<\/strong>\])<br>\s*(<img[^>]+>)<\/p>/g, function(match, fullCaptionTag, captionText, imgTag) {
        // imgTag is the entire <img> element
        // captionText is just "picture 1: inspecting..."
        // fullCaptionTag is "[<strong>...</strong>]"
        return '<p>' + imgTag + '<div class="image-caption-text">' + captionText + '</div></p>';
    });


    return html;
  }

  //===== parse markdown string into HTML content (cater code-block)
  md.html = function(mdText) { 
    // replace \r\n to \n, and handle front matter for simple YAML
    mdText = mdText.replace(/\r\n/g, '\n')
      .replace(/^---+\s*\n([\s\S]*?)\n---+\s*\n/, md.formatYAML);
    
    // apply yaml variables at the markdown file
    // regex matches strings like {{css-background}}
    for (var name in this.yaml) {
      mdText = mdText.replace(new RegExp('\{\{\\s*'+name+'\\s*\}\}', 'gm'), this.yaml[name]);
    }
    
    // handle code-blocks
    mdText = mdText.replace(/\n~~~/g,'\n```')
      .replace(/\n``` *(.*?)\n([\s\S]*?)\n``` *\n/g, md.formatCode);
    
    // split by "<code>", skip for code-block and process normal text
    var pos1 = 0, pos2 = 0, mdHTML = '';
    while ((pos1 = mdText.indexOf('<code>')) >= 0) {
      pos2 = mdText.indexOf('</code>', pos1)
      mdHTML += md.customProcessor(
        markdownIt.render(
          md.before(mdText.substr(0, pos1))
        )
      );
      mdHTML += mdText.substr(pos1, (pos2 > 0 ? pos2-pos1+7 : mdText.length)) //clholm note: in the original JS this was "mdtext" - I think it was a bug
      mdText = mdText.substr(pos2 + 7)
    }

    // process remaining text
    mdHTML += md.customProcessor(
      markdownIt.render(
        md.before(mdText)
      )
    );

    // return '<div class="markdown">' + mdHTML + md.after( md.parser( md.before(mdText) ) ) + '</div>'
    return '<div class="markdown">' + mdHTML + '</div>';
  }
  
  //===== TOC support
  md.toc = function (srcDiv, tocDiv, options ) {

    // select elements, set title
    var tocSelector = (options&&options.css) || 'h1,h2,h3,h4'
    var tocTitle = (options&&options.title) || 'Table of Contents'
    var toc = document.getElementById(srcDiv).querySelectorAll( tocSelector )
    var html = '<div class="toc"><ul>' + (tocTitle=='none'? '' : '<h3>' + tocTitle + '</h3>');
    
    // loop for each element,add <li> element with class in TAG name.
    for (var i=0; i<toc.length; i++ ) {
      if (toc[i].id.substr(0,6)=='no-toc') continue;
      if (!toc[i].id) toc[i].id = "toc-item-" + i;
      html += '<li class="' + toc[i].nodeName + '" title="#' + toc[i].id +
              '" onclick="location=this.title">' + toc[i].textContent + '</a></li>';
    }
    
    document.getElementById(tocDiv).innerHTML = html + "</ul>";

    //===== scrollspy support (ps: add to document.body if element(scrollspy) not found)
    if ( options && options.scrollspy ) {
      
      (document.getElementById(options.scrollspy)||document).onscroll = function () {
      
          // get TOC elements, and viewport position   
          var list = document.getElementById(tocDiv).querySelectorAll('li')
          var divScroll = document.getElementById(options.scrollspy) || document.documentElement
          var divHeight = divScroll.clientHeight || divScroll.offsetHeight 
          
          // loop for each TOC element, add/remove scrollspy class
          for (var i=0; i<list.length; i++) {
            var div = document.getElementById( list[i].title.substr(1) )
            var pos = (div? div.offsetTop - divScroll.scrollTop + 10: 0 )  
            if ( pos>0 && pos<divHeight ) {
              list[i].className = list[i].className.replace('active','') + ' active' // classList.add( 'active' );
            } else {
              list[i].className = list[i].className.replace('active','') // classList.remove( 'active' );
            }
          }
        }
      
    }
    //===== end of scrollspy
  }  
  
  if (typeof exports==='object') { 
    module.exports=md;
  } else if (typeof define==='function') { 
     define(function(){return md;});
  } else {
     this.md=md;
  }
}).call(function(){ return this || (typeof window!=='undefined' ? window : global)}());
