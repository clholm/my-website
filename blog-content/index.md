---
github: https://github.com/clholm/my-website/blog/
title: clholm's blog
subtitle: aluminum enthusiast
nav-group: featured, new-1, tags, months
nav-width: 320px
css-header: background-color:hsla(202, 58%, 56%, 1); color:hsla(69, 45%, 94%, 1);
menu:
  "site home": "/"
  "blog home": "./"
  github: "https://github.com/clholm/my-website/tree/main/blog"
  about: "#/page/about"
---
<style comment="additional style">
#header { {{css-header}}  }
#left-panel  { width:{{nav-width}} }
#right-panel { left: calc({{nav-width}} + 20px) }
h1 { border-bottom:1px dotted grey }
</style>

<div id="md-post">

# Featured

## [k8s secrets, metadata, and visibility](../blog-content/20251201-k8s-secrets-metadata-visibility.md)
> observations about k8s secrets, their metadata, and the visibility of secret data

## [(one more) p-bass](../blog-content/20241223-p-bass.md)
> build writeup for my new p-bass (in progress)

# Archives

* 2025/12/27: [k8s secrets, metadata, and visibility](../blog-content/20251201-k8s-secrets-metadata-visibility.md) { #k8s, #secrets, #featured }
                    
* 2024/12/24: [(one more) p-bass](../blog-content/20241223-p-bass.md) { #bass, #aluminum, #featured }

</div>