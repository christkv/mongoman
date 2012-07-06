var cluster = require('cluster');

var StatCollector = function(db) {  
  var self = this;
  this.db = db;
  this.collection = db.collection('statistics');
  this.dataLength = 0;
  this.byEvent = {};
  this.resolution = 1000;
  
  // Set up the set Interval that is used to save stats
  this.intervalId = setInterval(function() {
    if(self.db.serverConfig.isConnected() && cluster.isWorker) {
      var object = {data: self.dataLength, ts: new Date(), e:self.byEvent, pid:process.pid};
      self.collection.insert(object);
      self.dataLength = 0;    
      self.byEvent = {};
    }
  }, this.resolution);
}

StatCollector.prototype.passThroughWrite = function(event, data) {
  // Just add the amount of data
  this.dataLength = this.dataLength + data.length;  
  if(this.byEvent[event] == null) this.byEvent[event] = 0;
  this.byEvent[event] = this.byEvent[event] + data.length;
  // Return the data for usage
  return data;
}

StatCollector.prototype.findLast = function(callback) {
  this.collection.findOne({}, {sort:{ts:-1}, fields:{_id:0}}, callback);  
}

exports.StatCollector = StatCollector;