// ==UserScript==
// @name         t.co unmangler
// @namespace    http://sodium.online/
// @version      0.1.4
// @description  Replace t.co links on twitter.com and mobile.twitter.com with their actual targets.
// @author       Na
// @match        https://twitter.com/*
// @match        https://*.twitter.com/*
// @grant        none
// ==/UserScript==

// If it matters, this thing's licensed under the
// BSD 0-clause or CC0. Take your pick.

'use strict';

function unmangleTcoLinks(node){
  //  Old fashioned links (like your grandma used to make)
  //  are <a>s with a `data-expanded-url` attribute which
  //  contains the full link
  node.querySelectorAll('a[data-expanded-url]').forEach(function(anchor){
    anchor.dataset.tcoUrl = anchor.href;
    anchor.href = anchor.dataset.expandedUrl;
  }
  );


}

function unmangleCardLinks(frameWindow, tweetWindow){
  // Assuming there's only one <a> in a card frame
  var internalLink = frameWindow.document.querySelector('a');
  var externalLink = tweetWindow.document.querySelector(`a[data-tco-url="${internalLink.href}"]`);

  internalLink.href = externalLink.dataset.expandedUrl;
}


function unmangleMobileTcoLinks(node){
  // Regular links
  node.querySelectorAll('span._1piKw1fp').forEach(function(span){
    // This is probably overkill, but I don't know how
    // sanitized those links really are, and I'm not sure
    // how much I trust twitter.
    var probablySafeURL = span.innerHTML.replace(
      /\(link: (https?:.*)\) /, '$1'
    );
    try {
      var parsedURL = new URL(probablySafeURL);
      if (parsedURL.protocol !== 'http:' && parsedURL.protocol !== 'https:'){
        throw 'link protocol wasn\'t http(s). PANIC PANIC PANIC';
      }
      span.parentNode.href = parsedURL;
    } catch(e){
      window.console.debug('Twitter put something funky in their span', span);
    }
  });

  // Cards
  node.querySelectorAll('div._1ZLV7vdT._3f2NsD-H').forEach(function(card){
    var tweet = getMobileTweetObjFromCard(card);
    tweet.entities.urls.forEach(function(urlObj){
      if(urlObj.url === tweet.card.url){
        card.querySelector('a').href = urlObj.expanded_url;
      }
    });
  });
}

function getMobileTweetObjFromCard(card){
  // Ia! Ia! Cthulhu fhtagn!
  // This function is super sketchy, and reaches into
  // react's guts in order to get a tweet.
  // It's modeled off of http://stackoverflow.com/q/29321742
  // And used facebook's react dev-tools to figure out
  // *where* to expect the react guts to be
  for (var reactKey in card){
    if(reactKey.startsWith("__reactInternalInstance")){
      var tweetyBits = card.parentElement[reactKey] // React ref to tweet container
        ._currentElement  // Reactier ref
        .props.children; // All the bits that make up the tweet
      for (var i = 0; i < tweetyBits.length; i++){
        if (typeof tweetyBits[i].props.tweet !== 'undefined'){
          return tweetyBits[i].props.tweet;
        } //if child has tweet
      } // For each child
    } // if we found the react key
  } // for each property in the card
}

// Mobile and desktop twitter require different mangling
var desktopObserver = new MutationObserver(function(mutations){
  //
  // Desktop: Turns out there are two kinds of link!
  //
  mutations.forEach(function(mutation) {
    mutation.addedNodes.forEach(function(node){

      if (typeof node.matches !== 'undefined' &&
          node.matches('li, div.permalink-container, *[class*="ThreadedConversation"]')){
        // The mutations we care about are the ones that
        // insert <li>s into the DOM. Those are new tweets.
        unmangleTcoLinks(node);
      }
    });
  });
});

var mobileObserver = new MutationObserver(function(mutations){
  mutations.forEach(function(mutation) {
    mutation.addedNodes.forEach(function(node) {

      // Divs for individual tweets
      // Sections for the initial bulk page creation
      if (node.nodeName === 'DIV' || node.nodeName === 'SECTION'){
        unmangleMobileTcoLinks(node);
      }

      // There's no way to deal with cards on the mobile
      // site :(

    });
  });
});

var observerConfig = {
  //childList means we're following node addition/removal
  //mutation events and nothing else
  'childList': true,
  //subtree means that we're getting mutation events for
  //changes that happen to the target's descendants
  //(all the way down)
  'subtree': true
};

// if (document.location.pathname.startsWith('/i/cards/')
//       && typeof window.frameElement !== 'undefined'){
if (document.location.pathname.startsWith('/i/cards/') &&
    document.querySelector('meta[name="card_name"]').content !== 'promo_website' &&
    typeof window.frameElement !== 'undefined'){
  unmangleCardLinks(window, window.parent);
} else if (document.location.hostname === 'twitter.com'){
  unmangleTcoLinks(document);
  desktopObserver.observe(document, observerConfig);
} else if (document.location.hostname === 'mobile.twitter.com'){
  mobileObserver.observe(document, observerConfig);
  unmangleMobileTcoLinks(document);
}
