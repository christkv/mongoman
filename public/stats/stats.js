var n = 40,
    random = d3.random.normal(0, 1000),
    data = d3.range(n).map(random),
    data2 = d3.range(n).map(random),
    lines = [];    

var colorscale = d3.scale.category10();

var margin = {top: 10, right: 10, bottom: 20, left: 40},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

var x = d3.scale.linear()
    .domain([0, n - 1])
    .range([0, width]);

var y = d3.scale.linear()
    .domain([0, 1000])
    .range([height, 0]);
    
var yAxis = d3.svg.axis().scale(y).ticks(10).orient("left");

var svg = d3.select("body").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

svg.append("defs").append("clipPath")
    .attr("id", "clip")
  .append("rect")
    .attr("width", width)
    .attr("height", height);

svg.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.svg.axis().scale(x).orient("bottom"));

svg.append("g")
    .attr("class", "y axis")
    .call(d3.svg.axis().scale(y).orient("left"));

// Contains the legend
var legend = svg.append("g");

// Load the next data set
function loadNext() {
  d3.json("/statsdata", redraw);
  d3.timer.flush();
}

// Initalize the app
loadNext();
tick();

// Empty draw tick function
function tick() {}

// Set up
var currentMax = 0;
var pids = {};
var h = 0;
var margin = 10;
var emulatePid = 1;

function redraw(jsonData) {
  // Unpack values
  var value = jsonData.data; 
  var pid = jsonData.pid.toString();
  
  // Add an accumulated graph
  if(pids["0"] == null) {
    // Set up the first array
    var newArray = [];
    for(var j = 0; j < n; j++) { newArray[j] = 0; }    
    // Save the new line
    pids["0"] = {data: newArray};        
    var processline = d3.svg.line()
        .x(function(d, i) { return x(i); })
        .y(function(d, i) { return y(d); });
    var processpath = svg.append("g")
        .attr("clip-path", "url(#clip)")
      .append("path")
        .data([pids["0"].data])
        .attr("class", "line")
        .style("stroke", function(d) {return 0})
        .attr("d", processline);    
    pids["0"]['line'] = processline;
    pids["0"]['path'] = processpath;
    pids["0"]['label'] = "combined bytes written";    

    // Add the main line legend
    legend.append("text")
      .attr("x", width/2)
      .attr("y", h+margin)
      .attr("class", "title")
      .style("stroke", function(d) {return 0})
      .text(pids["0"]['label']);    
    // Adjust height
    h = h + margin;
  }
  
  // Add a new line
  if(pids[pid] == null) {
    // Set up the first array
    var newArray = [];
    for(var j = 0; j < n; j++) { newArray[j] = 0; }
    
    // Save the new line
    pids[pid] = {data: newArray};        
    var processline = d3.svg.line()
        .x(function(d, i) { return x(i); })
        .y(function(d, i) { return y(d); });
    var processpath = svg.append("g")
        .attr("clip-path", "url(#clip)")
      .append("path")
        .data([pids[pid].data])
        .attr("class", "line")
        .style("stroke", function(d) {return colorscale(pid)})
        .attr("d", processline);    
    pids[pid]['line'] = processline;
    pids[pid]['path'] = processpath;
    pids[pid]['label'] = "written bytes for pid: " + pid;

    // Add the main line legend
    legend.append("text")
      .attr("x", width/2)
      .attr("y", h+margin)
      .attr("class", "title")
      .style("stroke", function(d) {return colorscale(pid)})
      .text(pids[pid]['label']);    
    // Adjust height
    h = h + margin;
  }  

  value = isNaN(value) ? 0 : value;
  // push a new data point onto the back
  pids[pid].data.push(value);
  // Total bytes written
  var totalBytes = 0;
  // Line up all the graphs
  for(var key in pids) {
    if(pid != key && key != "0") {
      var prev = pids[key].data.pop();
      prev = isNaN(prev) ? 0 : prev;
      totalBytes = totalBytes + prev;      

      if(prev != null) {
        pids[key].data.push(prev);
        pids[key].data.push(prev);
      }      
    } else if(key != "0") {
      totalBytes = totalBytes + value;
    }
  }
  
  // Set up total bytes
  totalBytes = isNaN(totalBytes) ? 0 : totalBytes;
  
  // Add to the data for pid 0
  pids["0"].data.push(totalBytes);

  // Adjust the size
  if(value > currentMax || totalBytes > currentMax) {
    currentMax = totalBytes > currentMax ? totalBytes : value;

    // Scale if needed
    y.domain([0, currentMax + 1000]);
    var t = svg.transition().duration(500);
    t.select(".y.axis").call(yAxis);
  }
     
  // redraw all process lines
  for(var key in pids) {
    pids[key].path  
      .attr("d", pids[key].line)
      .attr("transform", null)
    .transition()
      .duration(330)
      .ease("linear")
      .attr("transform", "translate(" + x(-1) + ")")
      .each("end", tick);
      
    // pop the old data point off the front
    pids[key].data.shift();
  }

  // Get some more data
  setTimeout(loadNext, 330);
}