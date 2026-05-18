/* Tapwagen.nl push veilig uitgeschakeld voor V206 clean.
   Bezorger meldingen werken via Firebase alerts; geen serviceworker/push-knop nodig. */
(function(){
  window.BNS_PUSH_DISABLED = true;
  window.BNS_ENABLE_PUSH = function(){ console.log('[BNS Push] uitgeschakeld; alerts lopen via Firebase.'); };
})();
