var mongoose = require('mongoose');

var SiteSchema = new mongoose.Schema({
  name: String,
  urls: Array,
  meta: Object,
  results: Object,
  worldwide: Boolean
});



mongoose.model('Sites', SiteSchema);
