function formatDate(date){
	return d3.timeFormat("%d.%m.%Y")(date);
}

function Map(container_id){
  var self = this;
  self.container = container_id;
  self.svg = d3.select(this.container);
  self.raster = this.svg.append("g");
  self.vector = this.svg.append("g");
  self.tile = d3.tile();

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

  this.getData = function(){
    d3.csv("data/wards.csv", function(error, wards) {
      if (error) throw error;
      self.wards_data = wards;
      self.updateFilters();
    });
  }

  this.updateFilters = function(){
    var that = this;
    self.wards_data = self.wards_data.map(function(item){
      item.start_time = new Date(parseInt(item.start_time)*1000);
      item.x = parseInt(item.x);
      item.y = parseInt(item.y);
      item.ward_start_time = parseInt(item.ward_start_time);
      item.ward_end_time = parseInt(item.ward_end_time);
      item.win = item.win == "true";
      return item;
    });
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
          .attr("id", function(d, i){ return "player-"+i; });

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
          .attr("id", function(d, i){ return "hero-"+i; });

    $( "input" ).checkboxradio();

    $( "#match-date" ).slider({
      range: true,
      min: filter_limits.dates[0] / 1000,
      max: filter_limits.dates[1] / 1000,
      step: 86400,
      values: [ filter_limits.dates[0] / 1000, filter_limits.dates[1] / 1000 ],
      slide: function( event, ui ) {
        $( "#match-date-range" ).text(
          formatDate(new Date(ui.values[ 0 ] *1000)) + " - " + 
          formatDate(new Date(ui.values[ 1 ] *1000))
        );
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
        $( "#match-time-range" ).text( ui.values[ 0 ] + " - " + ui.values[ 1 ] );
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

  

  //SideMenu.hide(document.querySelector('#dashboard-sidemenu'));
}

window.addEventListener("DOMContentLoaded", function() {
  init();
});