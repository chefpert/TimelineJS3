/*  VCO.TimeScale
    Strategies for laying out the timenav
    make a new one if the slides change

    TODOS: deal with clustering 
================================================== */
VCO.TimeScale = VCO.Class.extend({
    
    initialize: function (timeline_config, options) {
        timeline_config = VCO.Util.extend({ // establish defaults
            scale: 'javascript'
        }, timeline_config);

        var slides = timeline_config.events;
        this._scale = timeline_config.scale;

        options = VCO.Util.extend({ // establish defaults
            display_width: 500,
            screen_multiplier: 3,
            max_rows: null
        }, options);

        this._display_width = options.display_width;
        this._screen_multiplier = options.screen_multiplier;
        this._pixel_width = this._screen_multiplier * this._display_width;

        this._group_labels = undefined;
        this._positions = [];
        this._pixels_per_milli = 0;
        
        this._earliest = slides[0].start_date.getTime();
        // TODO: should _latest be the end date if there is one?
        this._latest = slides[slides.length - 1].start_date.getTime();
        this._span_in_millis = this._latest - this._earliest;
        this._average = (this._span_in_millis)/slides.length;

        this._pixels_per_milli = this.getPixelWidth() / this._span_in_millis;

        this._axis_helper = VCO.AxisHelper.getBestHelper(this);

        this._scaled_padding = (1/this.getPixelsPerTick()) * (this._display_width/2)
        this._computePositionInfo(slides, options.max_rows);
    },
    
    getGroupLabels: function() { /* 
        return an array of objects, one per group, in the order (top to bottom) that the groups are expected to appear. Each object will have two properties:
            * label (the string as specified in one or more 'group' properties of events in the configuration)
            * rows (the number of rows occupied by events associated with the label. ) 
        */
        var label_info = [];
		if (this._group_labels) {
	        for (var i = 0; i < this._group_labels.length; i++) {
	            label_info.push({
	                rows: 1,
                    label: this._group_labels[i]
	            }); // later, count the real number of rows per group
	        }
		}
        
        return label_info;
    },
    
    getScale: function() {
        return this._scale;
    },
    
    getNumberOfRows: function() {
        return this._number_of_rows
    },

    getPixelWidth: function() {
        return this._pixel_width;
    },

    getPosition: function(time_in_millis) {
        // be careful using millis, as they won't scale to cosmological time.
        // however, we're moving to make the arg to this whatever value 
        // comes from VCO.Date.getTime() which could be made smart about that -- 
        // so it may just be about the naming.
        return ( time_in_millis - this._earliest ) * this._pixels_per_milli
    },

    getPositionInfo: function(idx) {
        return this._positions[idx];
    },

    getPixelsPerTick: function() {
        return this._axis_helper.getPixelsPerTick(this._pixels_per_milli);
    },

    getTicks: function() {
        return { 
            major: this._axis_helper.getMajorTicks(this), 
            minor: this._axis_helper.getMinorTicks(this) }
    },

    getDateFromTime: function(t) {
        if(this._scale == 'javascript') {
            return new VCO.Date(t);
        } else if(this._scale == 'cosmological') {
            return new VCO.BigDate(new VCO.BigYear(t));
        }  
        
        throw("Don't know how to get date from time for "+this._scale);
    },
    
    getMajorScale: function() {
        return this._axis_helper.major.name;
    },
    
    getMinorScale: function() {
        return this._axis_helper.minor.name;
    },

    _assessGroups: function(slides) {
        var groups = [];
        var empty_group = false;
        for (var i = 0; i < slides.length; i++) {
            if(slides[i].group) {
                if(groups.indexOf(slides[i].group) < 0) {
                    groups.push(slides[i].group);
                } else {
                    empty_group = true;
                }            
            } 
        };
        if (groups.length && empty_group) {
            groups.push('');
        }
        return groups;
    },

    _computePositionInfo: function(slides, max_rows, default_marker_width) { // default_marker_width should be in pixels
        default_marker_width = default_marker_width || 100;
        var lasts_in_rows = []; 
        var groups = [];
 
        for (var i = 0; i < slides.length; i++) {
            var pos_info = { start: this.getPosition(slides[i].start_date.getTime()) }
            this._positions.push(pos_info);
            if (typeof(slides[i].end_date) != 'undefined') {
                var end_pos = this.getPosition(slides[i].end_date.getTime());
                pos_info.width = end_pos - pos_info.start;
                if (pos_info.width > default_marker_width) {
                    pos_info.end = pos_info.start + pos_info.width; 
                } else {
                    pos_info.end = pos_info.start + default_marker_width; 
                }
            } else {
                pos_info.width = default_marker_width;
                pos_info.end = pos_info.start + default_marker_width;
            }
            
            if(slides[i].group) {
                if(groups.indexOf(slides[i].group) < 0) {
                    groups.push(slides[i].group);
                }            
            } 
        }

        if(groups.length) {
            var empty_group = false;
            
            for(var i = 0; i < this._positions.length; i++) {
                var pos_info = this._positions[i];
                if(slides[i].group) {
                    pos_info.row = groups.indexOf(slides[i].group);
                } else {
                    empty_group = true;
                    pos_info.row = groups.length;
                }
            }
            if(empty_group) {
                groups.push("");
            }
            this._group_labels = groups;
            this._number_of_rows = groups.length;
        } else {
            for (var i = 0; i < this._positions.length; i++) {
                var pos_info = this._positions[i];
                var overlaps = []
                for (var j = 0; j < lasts_in_rows.length; j++) {
                    overlaps.push(lasts_in_rows[j].end - pos_info.start);
                    if (overlaps[j] <= 0) {
                        pos_info.row = j;
                        lasts_in_rows[j] = pos_info;
                        break;
                    }
                }
                if (typeof(pos_info.row) == 'undefined') {
                    if ((!max_rows) || (lasts_in_rows.length < max_rows)) {
                        pos_info.row = lasts_in_rows.length;
                        lasts_in_rows.push(pos_info);
                    } else {
                        var min_overlap = Math.min.apply(null,overlaps);
                        var idx = overlaps.indexOf(min_overlap);
                        pos_info.row = idx;
                        if (pos_info.end > lasts_in_rows[idx].end) {
                            lasts_in_rows[idx] = pos_info
                        }
                    }
                }

            }

            this._number_of_rows = lasts_in_rows.length;      
        }  
    },

});
