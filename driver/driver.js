// Tapwagen.nl bestuurder route: oude zelfstandige driver.js is bewust uitgeschakeld.
// De telefoon-app draait via de hoofdapp: ../?telefoon=1&driver=1
(function(){
  try {
    var target = '../?telefoon=1&driver=1&v=114';
    if (!/telefoon=1|driver=1/.test(location.search)) location.replace(target);
  } catch(e) {}
})();
