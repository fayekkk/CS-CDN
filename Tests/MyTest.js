var CDN_URL = "http://127.0.0.1:8788/dist/daftra-cdn.js"; // your Cloudflare URL after deploy

$.getScript(CDN_URL).done(function () {
  // Start
  console.log("Loaded");

  // End
});
