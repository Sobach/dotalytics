function formatDate(date){
	return d3.timeFormat("%d.%m.%Y")(date);
}

function zeros(dimensions) {
  var array = [];
  for (var i = 0; i < dimensions[0]; ++i) {
    array.push(dimensions.length == 1 ? 0 : zeros(dimensions.slice(1)));
  }
  return array;
}

function circle2zeros(x,y, ward_type){
  var zer = zeros([128, 128]),
    circle = [3, 6, 8, 9, 10, 11, 11, 12, 12, 12, 13, 13, 13, 13, 13, 13, 13, 12, 12, 12, 11, 11, 10, 9, 8, 6, 3];
  if(ward_type=="sen_log"){
    circle = [2, 4, 5, 6, 6, 7, 7, 7, 7, 7, 6, 6, 5, 4, 2];
  }
  var r = d3.max(circle);
  for(var i=0; i<circle.length; i++){
    for(var j=-1*circle[i]; j<circle[i]; j++){
      var y_coord = y - r + i,
        x_coord = x + j;
      if (y_coord >= 0 & y_coord < 128 & x_coord >= 0 & x_coord < 128) {
        zer[y_coord][x_coord] = 1;
      }
    }
  }
  return zer;
}

function Map(container_id){
  var self = this;
  self.container = container_id;
  self.svg = d3.select(this.container);
  self.svg.append("filter")
    .attr("id", "constantOpacity")
    .append("feComponentTransfer")
      .append("feFuncA")
        .attr("type", "table")
        .attr("tableValues", "0 .5 .5");

  self.raster = this.svg.append("g");

  self.vector = this.svg.append("g");

  self.vector.attr("filter", "url(#constantOpacity)");
  self.tile = d3.tile();

  self.fog_filter = {
    "win"  : [true, false],
    "side" : ["Radiant", "Dire"],
    "ward_type" : ["obs_log", "sen_log"],
    "start_time" : [new Date(0), new Date()],
    "ward_time"  : [-100, 10000],
    "playername" : [],
    "heroname"   : []
  };

  this.setSize = function(){
    var that = this;
    var height = $("div.main-content").height() - 50;
    that.svg
      .attr("width", "100%")
      .attr("height", height);
    var bbox = that.svg.node().getBoundingClientRect();
    that.tile.size([bbox.width, bbox.height]);
  };

  this.draw = function(){
    var that = this;
    that.setSize();
    that.zoom = d3.zoom()
      .scaleExtent([1 << 8, 1 << 13])
      .translateExtent([[-.5,-.5], [.5, .5]])
      .on("zoom", that.zoomed);

    that.svg
      .call(that.zoom)
      .call(that.zoom.transform, d3.zoomIdentity
        .translate(512, 512)
        .scale(1 << 11));
  }

  this.zoomed = function() {
    var transform = d3.event.transform;
    var tiles = self.tile
      .scale(transform.k)
      .translate([transform.x, transform.y])
      ();

    self.vector
      .attr("transform", self.stringify_vec(tiles.scale, tiles.translate, tiles[0][2]));

    var image = self.raster
      .attr("transform", self.stringify(tiles.scale, tiles.translate, true))
      .selectAll("image")
      .data(tiles, function(d) { return d; });

    image.exit().remove();

    image.enter().append("image")
        .attr("href", function(d) { return "images/map_tiles/" + d[2] + "/" + d[0] + "/" + d[1] + ".png"; })
        .attr("x", function(d) { return d[0] * 256; })
        .attr("y", function(d) { return d[1] * 256; })
        .attr("width", 257)
        .attr("height", 257);
  }

  this.stringify = function(scale, translate, withscale) {
    var k = scale / 256, r = scale % 1 ? Number : Math.round;
    if(withscale){
      return "translate(" + r(translate[0] * scale) + "," + r(translate[1] * scale) + ") scale(" + k + ")";
    }else{
      return "translate(" + r(translate[0] * scale) + "," + r(translate[1] * scale) + ")";
    }
  }

  this.stringify_vec = function(scale, translate, scal2) {
    var k = scale / 256, r = scale % 1 ? Number : Math.round;
    return "translate(" + r(translate[0] * scale) + "," + r(translate[1] * scale) + ") scale(" + (k * (2**(scal2+1))) + ")";
  }

  this.getData = function(){
    d3.csv("data/wards.csv", function(error, wards) {
      if (error) throw error;
      wards = wards.map(function(item){
        item.start_time = new Date(parseInt(item.start_time)*1000);
        item.x = parseInt(item.x);
        item.y = parseInt(item.y);
        item.ward_start_time = parseInt(item.ward_start_time);
        item.ward_end_time = parseInt(item.ward_end_time);
        item.win = item.win == "true";
        return item;
      });
      self.all_wards = wards.map(self.addCirclesToData);
      self.wards_data = self.all_wards;
      self.updateFilters();
      self.toPlotArray();
      self.redrawFog();
    });
  }

  this.addCirclesToData = function(datapoint){
    datapoint.y = 128 - datapoint.y;
    var zarr = circle2zeros(datapoint.x, datapoint.y, datapoint.ward_type);
    datapoint.arr = zarr;
    return datapoint;
  }

  this.toPlotArray = function(){
    var acc = zeros([128, 128]);
    self.fog_data = self.wards_data.reduce(function(acc, x){
      for(i=0;i<128;i++){
        for(j=0;j<128;j++){
          acc[j][i] += x.arr[j][i];
        }
      }
      return acc;
    }, acc);
    self.fog_data = self.fog_data.reduce(function(a, b){ return a.concat(b); }, []);
  }

  this.redrawFog = function(){
    self.wards_data = self.all_wards.reduce(function(acc, x){
      if(self.fog_filter.win.indexOf(x.win) >= 0 & self.fog_filter.side.indexOf(x.side) >= 0 & self.fog_filter.ward_type.indexOf(x.ward_type) >= 0 & self.fog_filter.playername.indexOf(x.playername) >= 0 & self.fog_filter.heroname.indexOf(x.heroname) >= 0 & self.fog_filter.start_time[0] <= x.start_time & x.start_time <= self.fog_filter.start_time[1] & self.fog_filter.ward_time[0] <= x.ward_end_time & x.ward_start_time <= self.fog_filter.ward_time[1]){
        acc.push(x);
      };
      return acc;
    }, []);
    self.toPlotArray();
    var maxval = d3.max(self.fog_data),
        palet = ["#a50026","#d73027","#f46d43","#fdae61","#fee090","#ffffbf","#e0f3f8","#abd9e9","#74add1","#4575b4","#313695"].map(function(x){ return d3.rgb(x) }).reverse(),
        color = d3.scaleLinear().domain(d3.range(1, maxval+1, (maxval-1)/(palet.length-1)))
          .interpolate(d3.interpolateHcl)
          .range(palet);

    console.log(d3.sum(self.fog_data));

    var selection = self.vector.selectAll("path")
      .data(d3.contours()
          .size([128, 128])
          .thresholds(d3.range(1, maxval+1, (maxval-1)/9))
          (self.fog_data));
    
    selection.exit()
      .transition(1000)
        .attr("fill-opacity", 1e-6)
        .remove();

    selection
      .transition()
      .duration(1000)
      .ease(d3.easeCubic)
        .attr("d", d3.geoPath(d3.geoIdentity()));

    selection.enter().append("path")
      .attr("d", d3.geoPath(d3.geoIdentity()))
      .attr("stroke", "#fff")
      .style("stroke-opacity", function(d){ return d.value == 0 ? 0 : .9 })
      .style("stroke-width", .1)
      .attr("fill", function(d) { return color(d.value); })
      .style("fill-opacity", function(d){ return d.value == 0 ? 0 : .5 });
  }

  this.updateFilters = function(){
    var that = this;
    filter_limits = self.wards_data.reduce(function(acc, cur){
      if( cur.start_time < acc.dates[0] ){
        acc.dates[0] = cur.start_time;
      }
      if( cur.start_time > acc.dates[1] ){
        acc.dates[1] = cur.start_time;
      }
      if( cur.ward_start_time < acc.timing[0] ){
        acc.timing[0] = cur.ward_start_time;
      }
      if( cur.ward_end_time > acc.timing[1] ){
        acc.timing[1] = cur.ward_end_time;
      }
      if( cur.playername in acc.players ){
        acc.players[cur.playername] += 1;
      }else{
        acc.players[cur.playername] = 1;
      }
      if( cur.heroname in acc.heroes ){
        acc.heroes[cur.heroname] += 1;
      }else{
        acc.heroes[cur.heroname] = 1;
      }
      return acc;
    }, {"players":{}, "heroes":{}, "dates":[new Date(), new Date(0)], "timing":[0, 0]});
    filter_limits.heroes = Object.keys(filter_limits.heroes).map(function(x){
      return [x, filter_limits.heroes[x]];
    });
    filter_limits.heroes = filter_limits.heroes.sort(function(a, b){
      return b[1] - a[1];
    });
    filter_limits.heroes = filter_limits.heroes.map(function(x){ return x[0]; });
    filter_limits.players = Object.keys(filter_limits.players).map(function(x){
      return [x, filter_limits.players[x]];
    });
    filter_limits.players = filter_limits.players.sort(function(a, b){
      return b[1] - a[1];
    });
    filter_limits.players = filter_limits.players.map(function(x){ return x[0]; });

    d3.select("fieldset#result-checkboxes").selectAll("input").on("change", function(){
      var filter = d3.select("fieldset#result-checkboxes")
        .selectAll("input").nodes()
        .map(function(x){ return [$(x).checkboxradio("option", "label"), $(x).is(":checked")]; });
      filter = filter.reduce(function(acc, x){
        if(x[0]=="Win" & x[1]){
          acc.push(true);
        }else if(x[0]=="Loose" & x[1]){
          acc.push(false);
        }
        return acc;
      }, []);
      self.fog_filter.win = filter;
      self.redrawFog();
    });

    d3.select("fieldset#team-checkboxes").selectAll("input").on("change", function(){
      var filter = d3.select("fieldset#team-checkboxes")
        .selectAll("input").nodes()
        .reduce(function(acc, x){
          if($(x).is(":checked")){
            acc.push($(x).checkboxradio("option", "label"));
          };
          return acc;
        }, []);
      self.fog_filter.side = filter;
      self.redrawFog();
    });

    d3.select("fieldset#wardtype-checkboxes").selectAll("input").on("change", function(){
      var filter = d3.select("fieldset#wardtype-checkboxes")
        .selectAll("input").nodes()
        .reduce(function(acc, x){
          if($(x).is(":checked")){
            acc.push($(x).checkboxradio("option", "label").slice(0, 3).toLowerCase() + "_log");
          };
          return acc;
        }, []);
      self.fog_filter.ward_type = filter;
      self.redrawFog();
    });

    self.fog_filter.playername = filter_limits.players;

    d3.select("fieldset#players-checkboxes").selectAll("label").data(filter_limits.players)
      .enter()
        .append("label")
          .attr("for", function(d, i){ return "player-"+i; })
          .text(function(d){ return d });


    d3.select("fieldset#players-checkboxes").selectAll("input").data(filter_limits.players)
      .enter()
        .append("input")
          .attr("type", "checkbox")
          .attr("checked", "")
          .attr("name", function(d, i){ return "player-"+i; })
          .attr("id", function(d, i){ return "player-"+i; })
          .on("change", function(){
            var filter = d3.select("fieldset#players-checkboxes")
              .selectAll("input").nodes()
              .reduce(function(acc, x){
                if($(x).is(":checked")){
                  acc.push($(x).checkboxradio("option", "label"));
                };
                return acc;
              }, []);
            self.fog_filter.playername = filter;
            self.redrawFog();
          });

    self.fog_filter.heroname = filter_limits.heroes;

    d3.select("fieldset#heroes-checkboxes").selectAll("label").data(filter_limits.heroes)
      .enter()
        .append("label")
          .attr("for", function(d, i){ return "hero-"+i; })
          .text(function(d){ return d });

    d3.select("fieldset#heroes-checkboxes").selectAll("input").data(filter_limits.heroes)
      .enter()
        .append("input")
          .attr("type", "checkbox")
          .attr("checked", "")
          .attr("name", function(d, i){ return "hero-"+i; })
          .attr("id", function(d, i){ return "hero-"+i; })
          .on("change", function(){
            var filter = d3.select("fieldset#heroes-checkboxes")
              .selectAll("input").nodes()
              .reduce(function(acc, x){
                if($(x).is(":checked")){
                  acc.push($(x).checkboxradio("option", "label"));
                };
                return acc;
              }, []);
            self.fog_filter.heroname = filter;
            self.redrawFog();
          });

    $( "input" ).checkboxradio();

    $( "#match-date" ).slider({
      range: true,
      min: filter_limits.dates[0] / 1000,
      max: filter_limits.dates[1] / 1000,
      step: 86400,
      values: [ filter_limits.dates[0] / 1000, filter_limits.dates[1] / 1000 ],
      slide: function( event, ui ) {
        var from = new Date(ui.values[0] *1000),
          to = new Date(ui.values[1] *1000);
        $( "#match-date-range" ).text(formatDate(from) + " - " + formatDate(to));
        self.fog_filter.start_time = [from, to];
        self.redrawFog();
      }
    });
    $( "#match-date-range" ).text(
      formatDate(new Date($( "#match-date" ).slider("values", 0) * 1000)) + " - " + 
      formatDate(new Date($( "#match-date" ).slider("values", 1) * 1000))
    );

    $( "#match-time" ).slider({
      range: true,
      min: filter_limits.timing[0],
      max: filter_limits.timing[1],
      step: 1,
      values: filter_limits.timing,
      slide: function( event, ui ) {
        $( "#match-time-range" ).text( ui.values[0] + " - " + ui.values[ 1 ] );
        self.fog_filter.ward_time = ui.values;
        self.redrawFog();
      }
    });
    $( "#match-time-range" ).text( $( "#match-time" ).slider( "values", 0 ) + " - " + $( "#match-time" ).slider( "values", 1 ) );  
  }

  self.getData();
}

function init() {
  /* Loading Material CSS Framework */
  var md = new Material({
    modules: ["Responsive", "SideMenu"],
    options: {
      FancyHeader: {
        header: document.querySelector(".toolbar"),
        scrollTarget: document.querySelector(".main-content")
      }
    }
  });

  /* Preparing sidemenu and map */
  //var sm = document.getElementById("dashboard-sidemenu");
  /* Preparing map */
  var map = new Map("svg#map");
  map.draw();
  d3.select(window).on("resize", map.setSize()); 
  d3.select("button#side-menu-button").on("click", function(){
    SideMenu.toggle(document.querySelector('#dashboard-sidemenu'));
  });

  $( "input" ).checkboxradio();
  $( "fieldset" ).controlgroup();
  $( "#team" ).selectmenu();

  

  //SideMenu.hide(document.querySelector('#dashboard-sidemenu'));
}

window.addEventListener("DOMContentLoaded", function() {
  init();
});