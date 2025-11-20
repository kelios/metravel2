// Stub for html2canvas - not needed for PDF export from images
// jsPDF tries to require it dynamically, but we only use addImage which doesn't need it
module.exports = function() {
  throw new Error('html2canvas is not available. Use addImage method instead of fromHTML.');
};

