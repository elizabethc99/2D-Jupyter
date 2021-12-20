define([  //dependencies
    'require',
    'jquery',
    'base/js/namespace',
    'base/js/events',
    'base/js/utils',
    'notebook/js/codecell',
    'notebook/js/textcell',
    'notebook/js/notebook',
    'notebook/js/cell',
    'notebook/js/celltoolbar',
    'base/js/i18n',
    'notebook/js/outputarea',
    'notebook/js/completer',
], function(   //dependencies passed to function in same order
    requireJS,
    $,
    Jupyter,
    events,
    utils,
    codecell,
    textcell,
    notebook,
    cell,
    celltoolbar,
    i18n,
    outputarea,
    completer
) {
    "use strict"; //strict mode

    var Cell = cell.Cell;
    var CodeCell = codecell.CodeCell; 
    var Notebook = notebook.Notebook;

    
    CodeCell._options = {
        cm_config : {
            extraKeys: {
                "Backspace" : "delSpaceToPrevTabStop",
            },
            mode: 'text',
            theme: 'ipython',
            matchBrackets: true,
            autoCloseBrackets: true
        },
        highlight_modes : {
            'magic_javascript'    :{'reg':['^%%javascript']},
            'magic_perl'          :{'reg':['^%%perl']},
            'magic_ruby'          :{'reg':['^%%ruby']},
            'magic_python'        :{'reg':['^%%python3?']},
            'magic_shell'         :{'reg':['^%%bash']},
            'magic_r'             :{'reg':['^%%R']},
            'magic_text/x-cython' :{'reg':['^%%cython']},
        },
    };

    CodeCell.prototype.create_element = function () {
        Cell.prototype.create_element.apply(this, arguments);
        var that = this;

        var cell =  $('<div></div>').addClass('cell code_cell');
        cell.attr('tabindex','2');

        var input = $('<div></div>').addClass('input');
        this.input = input;

        var prompt_container = $('<div/>').addClass('prompt_container');

        var run_this_cell = $('<div></div>').addClass('run_this_cell');
        run_this_cell.prop('title', 'Run this cell');
        run_this_cell.append('<i class="fa-step-forward fa"></i>');
        run_this_cell.click(function (event) {
            event.stopImmediatePropagation();
            that.execute();
        });

        var prompt = $('<div/>').addClass('prompt input_prompt');
        
        var inner_cell = $('<div/>').addClass('inner_cell');
        this.celltoolbar = new celltoolbar.CellToolbar({
            cell: this, 
            notebook: this.notebook});
        inner_cell.append(this.celltoolbar.element);
        var input_area = $('<div/>').addClass('input_area').attr("aria-label", i18n.msg._("Edit code here"));
        this.code_mirror = new CodeMirror(input_area.get(0), this._options.cm_config);
        // In case of bugs that put the keyboard manager into an inconsistent state,
        // ensure KM is enabled when CodeMirror is focused:
        this.code_mirror.on('focus', function () {
            if (that.keyboard_manager) {
                that.keyboard_manager.enable();
            }

            that.code_mirror.setOption('readOnly', !that.is_editable());
        });
        this.code_mirror.on('keydown', $.proxy(this.handle_keyevent,this));
        $(this.code_mirror.getInputField()).attr("spellcheck", "false");
        inner_cell.append(input_area);
        prompt_container.append(prompt).append(run_this_cell);
        input.append(prompt_container).append(inner_cell);

        var output = $('<div></div>');
        //cell.append(input).append(output); //REPLACED WITH BELOW
        var ncells = Jupyter.notebook.ncells();
        var initialIndex = ncells + 1;
        var repos = $('<div>' + initialIndex + '</div>').addClass("repos").width('2%').css('backgroundColor', "lightgrey").css('cursor', 'move');  // the widget for dragging a cell
        // document.getElementById('notebook-container').style.width = '800px';  // set notebook and default cell width
        // document.getElementById('notebook-container').style.marginLeft = '20px';  // left justify notebook in browser
        cell.css('backgroundColor', 'rgba(255, 255, 255, 0.8)');  	// transparency
        //prompt.css('backgroundColor', "#fff0f0").css('cursor', 'move');  // red drag target
        if(!CodeCell.zIndexCount)  CodeCell.zIndexCount = 1000;		// initialize zIndex if needed

        repos.dblclick( function(event) {   // double-click = put back into notebook
                that.element.css("position", '').css("zIndex", '').width('').height('').css("left",'').css("top",'');
                delete that.metadata.spatial;
        });
        repos.mousedown( function(event) {	// drag the cell
            //console.log(that, event);
            if(event.originalEvent.button != 0) return;   // left-click only
            //if(event.originalEvent.shiftKey) 
            event.preventDefault();  // dont select text
            if(that.element.css("zIndex") != CodeCell.zIndexCount)
                that.element.css("zIndex", ++CodeCell.zIndexCount);  // Move to front
            if(that.metadata.spatial)
                that.metadata.spatial.zIndex = CodeCell.zIndexCount;
            var x = event.pageX - that.element.offset().left;    // x offset
            var y = event.pageY - that.element.offset().top;     // y offset
            
            function onMouseMove(event) {
                //console.log(event);
                if(that.element.css("position") != "absolute")   // wait till movement occurs to pull out the cell
                    that.element.css("position", 'absolute').width(800-45);  // pull out of notebook
                that.metadata.spatial = { 	
                        left: event.pageX - x,   		
                        top: event.pageY - y,			
                        zIndex: CodeCell.zIndexCount }; 
                that.element.offset(that.metadata.spatial);    // set absolute position
            }
            document.addEventListener('mousemove', onMouseMove);  // use document events to allow rapid dragging outside the repos div

            repos.mouseup( function(event) {  
                //DOM collision detection?
                var col1 = document.getElementById("column1");
                var col2 = document.getElementById("column2");
                var thisSpatial = that.metadata.spatial;
                var col1Rect = col1.getBoundingClientRect();
                var col2Rect = col2.getBoundingClientRect();

                if(thisSpatial.left > col1Rect.left && //if collision
                    thisSpatial.top > col1Rect.top &&
                    thisSpatial.left < (col1Rect.left + col1Rect.width)
                    ){ 
                    //make cells into a single div object w/ nb container
                    var cell = that.element.detach();
                    //that.element.remove();
                    $(col1).append(cell);
                    that.metadata.column = 1;
                    //drag cells in order?
                    delete that.metadata.spatial;
                    that.element.css("position", '').css("zIndex", '').width('').height('').css("left",'').css("top",'');
                    // that.metadata.spatial = { 	
                    //     left: event.pageX - x,   		
                    //     top: event.pageY - y,			
                    //     zIndex: CodeCell.zIndexCount }; 
                    reindex();
                }

                if(thisSpatial.left > col2Rect.left && //if collision
                    thisSpatial.top > col2Rect.top &&
                    thisSpatial.left < (col2Rect.left + col2Rect.width)
                    ){ 
                    var cell = that.element.detach();
                    //that.element.remove();
                    $(col2).append(cell);
                    that.metadata.column = 2;
                    delete that.metadata.spatial;
                    that.element.css("position", '').css("zIndex", '').width('').height('').css("left",'').css("top",'');
                    reindex(); 
                }

                // var x = that.element.offset().left;    // x offset
                // var y = that.element.offset().top;     // y offset
                // console.log(x);
                // console.log(y);
                // that.metadata.spatial = { 	
                //         left: event.pageX - x,   		
                //         top: event.pageY - y,			
                //         zIndex: CodeCell.zIndexCount }; 

                document.removeEventListener('mousemove', onMouseMove);
                repos.off(event);
            });
        });
        //prompt.ondragstart = function() { return false; };
        //prompt_container.append(repos).append(prompt).append(run_this_cell);
        // new containers needed to insert repos:
        var cell2 = $('<div style="display: flex; flex-direction: row; align-items: stretch;"></div>');  // contains repos and cell3, needs to change to row flow
        var cell3 = $('<div style="display: flex; flex-direction: column; align-items: stretch; width: 98%;"></div>');  // new container for input and output, needs to change to column flow
        cell3.append(input).append(output); ////
        cell2.append(repos).append(cell3);  ////
        cell.append(cell2); 				//// cell cell2 repos cell3 input output
        //
        /////////////////////////////////////////////////////*/


        this.element = cell;
        this.output_area = new outputarea.OutputArea({
            config: this.config,
            selector: output,
            prompt_area: true,
            events: this.events,
            keyboard_manager: this.keyboard_manager,
        });
        this.completer = new completer.Completer(this, this.events);

        var ncells = Jupyter.notebook.ncells();
        that.metadata.index = ncells + 1;

    };

    CodeCell.prototype.fromJSON = function (data) {
        //create box here? 
        Cell.prototype.fromJSON.apply(this, arguments);
        if (data.cell_type === 'code') {
            if (data.source !== undefined) {
                this.set_text(data.source);
                // make this value the starting point, so that we can only undo
                // to this state, instead of a blank cell
                this.code_mirror.clearHistory();
                this.auto_highlight();
            }
            this.set_input_prompt(data.execution_count);
            this.output_area.trusted = data.metadata.trusted || false;
            this.output_area.fromJSON(data.outputs, data.metadata);
        }
        ////// ChrisNorth ////////////
        // Append to the end of function:  CodeCell.prototype.fromJSON = function (data) {
        // Restores spatial positions on notebook file load.
        //
        var col1 = document.getElementById("column1");
        var col2 = document.getElementById("column2");
        if(data.metadata.spatial) {
        	this.element.css("position", 'absolute').width(800-45);  // pull out of notebook
			this.element.css("zIndex", data.metadata.spatial.zIndex);
			if(!CodeCell.zIndexCount || CodeCell.zIndexCount < data.metadata.spatial.zIndex)
				CodeCell.zIndexCount = data.metadata.spatial.zIndex;
        	this.element.offset(data.metadata.spatial);  // set absolute position
        }
        if(data.metadata.column){
            if(data.metadata.column == 1){
                $(col1).append(this.element);
            }
            if(data.metadata.column == 2){
                $(col2).append(this.element);
            }
        }
        //////////////////////////////
    };

    Notebook.prototype.move_selection_up = function(){
        // actually will move the cell before the selection, after the selection
        var indices = this.get_selected_cells_indices();
        var first = indices[0];
        var last = indices[indices.length - 1];

        var selected = this.get_selected_index();
        var anchored = this.get_anchor_index();

        if (first === 0){
            return;
        }

        var tomove = this.get_cell_element(first - 1);
        var pivot = this.get_cell_element(last);

        var cellCol = this.get_cell(selected).metadata.column;
        var cellIndex = this.get_cell(selected).metadata.index + 1;
        var colCounts = countCellsinColumns();
        
        if(!(cellCol == 2 && cellIndex == colCounts[0] + 1)){ //if the cell is at the end of col 1
            tomove.detach();
            pivot.after(tomove);
        }

        this.get_cell(selected-1).focus_cell();
        this.select(anchored - 1);
        this.select(selected - 1, false);
        
        reindex();
    };

    Notebook.prototype.move_selection_down = function(){
        // actually will move the cell after the selection, before the selection
        var indices = this.get_selected_cells_indices();
        var first = indices[0];
        var last = indices[indices.length - 1];

        var selected = this.get_selected_index();
        var anchored = this.get_anchor_index();

        if(!this.is_valid_cell_index(last + 1)){
            return;
        }
        var tomove = this.get_cell_element(last + 1);
        var pivot = this.get_cell_element(first);

        var cellCol = this.get_cell(selected).metadata.column;
        var cellIndex = this.get_cell(selected).metadata.index + 1;
        var colCounts = countCellsinColumns();
        
        if(!(cellCol == 1 && cellIndex == colCounts[0])){ //if the cell is not at the end of col 1
            tomove.detach();
            pivot.before(tomove);
        }
       
        this.get_cell(selected+1).focus_cell();
        this.select(first);
        this.select(anchored + 1);
        this.select(selected + 1, false);

        reindex();
    };

    Notebook.prototype.insert_cell_at_index = function(type, index){
        var ncells = this.ncells();
        index = Math.min(index, ncells);
        index = Math.max(index, 0);
        var cell = null;
        type = type || this.class_config.get_sync('default_cell_type');
        if (type === 'above') {
            if (index > 0) {
                type = this.get_cell(index-1).cell_type;
            } else {
                type = 'code';
            }
        } else if (type === 'below') {
            if (index < ncells) {
                type = this.get_cell(index).cell_type;
            } else {
                type = 'code';
            }
        } else if (type === 'selected') {
            type = this.get_selected_cell().cell_type;
        }

        if (ncells === 0 || this.is_valid_cell_index(index) || index === ncells) {
            var cell_options = {
                events: this.events, 
                config: this.config, 
                keyboard_manager: this.keyboard_manager, 
                notebook: this,
                tooltip: this.tooltip
            };
            switch(type) {
            case 'code':
                cell = new codecell.CodeCell(this.kernel, cell_options);
                cell.set_input_prompt();
                break;
            case 'markdown':
                cell = new textcell.MarkdownCell(cell_options);
                break;
            case 'raw':
                cell = new textcell.RawCell(cell_options);
                break;
            default:
                console.log("Unrecognized cell type: ", type, cellmod);
                cell = new cellmod.UnrecognizedCell(cell_options);
            }

            if(this._insert_element_at_index(cell.element,index)) {
                reindex();
                cell.render();
                this.events.trigger('create.Cell', {'cell': cell, 'index': index});
                cell.refresh();
                // We used to select the cell after we refresh it, but there
                // are now cases were this method is called where select is
                // not appropriate. The selection logic should be handled by the
                // caller of the the top level insert_cell methods.
                this.set_dirty(true);
            }
        }
        return cell;

    };

    Notebook.prototype.delete_cells = function(indices) {
        if (indices === undefined) {
            indices = this.get_selected_cells_indices();
        }

        var undelete_backup = {
            cells: [],
            below: false,
            index: 0,
        };

        var cursor_ix_before = this.get_selected_index();
        var deleting_before_cursor = 0;
        for (var i=0; i < indices.length; i++) {
            if (!this.get_cell(indices[i]).is_deletable()) {
                // If any cell is marked undeletable, cancel
                return this;
            }

            if (indices[i] < cursor_ix_before) {
                deleting_before_cursor++;
            }
        }

        // If we started deleting cells from the top, the later indices would
        // get offset. We sort them into descending order to avoid that.
        indices.sort(function(a, b) {return b-a;});
        for (i=0; i < indices.length; i++) {
            var cell = this.get_cell(indices[i]);
            undelete_backup.cells.push(cell.toJSON());
            this.get_cell_element(indices[i]).remove();
            this.events.trigger('delete.Cell', {'cell': cell, 'index': indices[i]});
        }

        var new_ncells = this.ncells();
        // Always make sure we have at least one cell.
        if (new_ncells === 0) {
            this.insert_cell_below('code');
            new_ncells = 1;
        }

        var cursor_ix_after = this.get_selected_index();
        if (cursor_ix_after === null) {
            // Selected cell was deleted
            cursor_ix_after = cursor_ix_before - deleting_before_cursor;
            if (cursor_ix_after >= new_ncells) {
                cursor_ix_after = new_ncells - 1;
                undelete_backup.below = true;
            }
            this.select(cursor_ix_after);
        }

        // Check if the cells were after the cursor
        for (i=0; i < indices.length; i++) {
            if (indices[i] > cursor_ix_before) {
                undelete_backup.below = true;
            }
        }

        // This will put all the deleted cells back in one location, rather than
        // where they came from. It will do until we have proper undo support.
        undelete_backup.index = cursor_ix_after;
        $('#undelete_cell').removeClass('disabled');
        $('#undelete_cell > a').attr('aria-disabled','false');
        this.undelete_backup_stack.push(undelete_backup);
        this.set_dirty(true);

         //cell indexing
         var cells = Jupyter.notebook.get_cells();
         var ncells = Jupyter.notebook.ncells();
         for (var i=0; i<ncells; i++){
             var cell = cells[i];
             var index = Jupyter.notebook.find_cell_index(cell);
             cell.metadata.index = index;
            
             var box = document.getElementsByClassName("repos")[i]; 
             $(box)[0].innerHTML = "";
             $(box).append(index + 1);
          }

        return this;
    };

    function reindex(){
        var cells = Jupyter.notebook.get_cells();
		var ncells = Jupyter.notebook.ncells();
		for (var i=0; i<ncells; i++){
			var cell = cells[i];
            var index = Jupyter.notebook.find_cell_index(cell);
            cell.metadata.index = index;

            
            var box = document.getElementsByClassName("repos")[i]; 
            $(box)[0].innerHTML = "";
            $(box).append(index + 1);
		 }
    }

    function countCellsinColumns(){
        var colCounts = [0,0];
        var cells = Jupyter.notebook.get_cells();
        var ncells = Jupyter.notebook.ncells();
        for (var i=0; i<ncells; i++){
			var cell = cells[i];
            if(cell.metadata.column == 1){
                colCounts[0]++;
            }
            if(cell.metadata.column == 2){
                colCounts[1]++;
            }
        }
        return colCounts;
    }

    function initialize () {

        //intial run index
		var cells = Jupyter.notebook.get_cells();
		var ncells = Jupyter.notebook.ncells();
        var col1 = document.getElementById("column1");
        var col2 = document.getElementById("column2");

		for (var i=0; i<ncells; i++){
            var index = Jupyter.notebook.find_cell_index(cell);
            cell.metadata.index = index;
           
            var box = document.getElementsByClassName("repos")[i]; 
            if(typeof box !== 'undefined'){
                $(box)[0].innerHTML = "";
                $(box).append(index + 1);
            }
            
		 }
 
	}

    function load_ipython_extension() {
        document.getElementById('notebook-container').style.height = 'inherit';
        document.getElementById('notebook-container').style.width = '1200px';  // set notebook and default cell width
        document.getElementById('notebook-container').style.marginLeft = '20px';  // left justify notebook in browser
        document.getElementById('notebook-container').style.backgroundColor = "transparent";

        Jupyter.notebook.restore_checkpoint(Jupyter.notebook.checkpoints[0].id) 
        //doesn't work for first nb opened after starting jupyter

        var cln1 = document.createElement('div');
        cln1.class = "container";
        cln1.id = "column1";
        cln1.style.width = "49%";
        cln1.style.float = 'left';
        cln1.style.height = "inherit";
        cln1.style.minHeight = "30px";
        cln1.style.backgroundColor = "white";
        document.getElementById('notebook-container').appendChild(cln1);

        var cln2 = document.createElement('div');
        cln2.class = "container";
        cln2.id = "column2";
        cln2.style.width = "49%";
        cln2.style.float = 'right';
        cln2.style.height = "inherit";
        cln2.style.minHeight = "30px";
        cln2.style.backgroundColor = "white";
        document.getElementById('notebook-container').appendChild(cln2);

        if (Jupyter.notebook !== undefined && Jupyter.notebook._fully_loaded) {
			initialize();
		}
		events.on("notebook_loaded.Notebook", initialize);

    }

    return {
        load_ipython_extension: load_ipython_extension
    };
});


