function formatDate(date){
	return d3.timeFormat("%d.%m.%Y")(date);
}

function init() {
  var sm = document.getElementById("dashboard-sidemenu");
  $( "input" ).checkboxradio();
  $( "fieldset" ).controlgroup();
  $( "#match-date" ).slider({
      range: true,
      min: new Date("2015.01.01").getTime() / 1000,
      max: new Date("2017.06.30").getTime() / 1000,
      step: 86400,
      values: [ new Date("2016.01.01").getTime() / 1000, new Date("2017.01.01").getTime() / 1000 ],
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
      min: -70,
      max: 550,
      step: 1,
      values: [ -70, 550 ],
      slide: function( event, ui ) {
        $( "#match-time-range" ).text( ui.values[ 0 ] + " - " + ui.values[ 1 ] );
      }
  });
  $( "#match-time-range" ).text( $( "#match-time" ).slider( "values", 0 ) + " - " + $( "#match-time" ).slider( "values", 1 ) );  
  //SideMenu.hide(document.querySelector('#dashboard-sidemenu'));
}

window.addEventListener("DOMContentLoaded", function() {
  var md = new Material({
    modules: ["Responsive", "SideMenu"],
    options: {
      FancyHeader: {
        header: document.querySelector(".toolbar"),
        scrollTarget: document.querySelector(".main-content")
      }
    }
  });
  init();
});