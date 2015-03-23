var mongoose = require('mongoose');

var SiteSchema = new mongoose.Schema({
  name: String,
  urls: Array

});
mongoose.model('Sites', SiteSchema);
