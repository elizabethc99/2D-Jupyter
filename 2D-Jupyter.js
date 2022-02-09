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

    var nCols = 2; //default of 2 columns
    

    
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
                var thisSpatial = that.metadata.spatial;
                // var inColumn = false;
                
                //places cells at end of columns
                var columns = document.getElementsByClassName("column");
                var nbContainer = document.getElementById("notebook-container");
                for(var c = 0; c < columns.length; c++){
                    var col = columns[c];
                    var colRect = col.getBoundingClientRect();
                    var nbContainerRect = nbContainer.getBoundingClientRect();

                    //if collision with a column
                    if(thisSpatial.left > colRect.left && 
                        thisSpatial.top > colRect.top &&
                        thisSpatial.left < (colRect.left + colRect.width) &&
                        thisSpatial.top < nbContainerRect.bottom
                        ){ 
                        //attach to column if column is empty
                        if((countCellsinColumns()[c]) == 0){ 
                            // inColumn = true;
                            //make cells into a single div object w/ nb container
                            var cell = that.element.detach();
                            $(col).append(cell);
                            that.metadata.column = c + 1;
                            //drag cells in order?
                            delete that.metadata.spatial;
                            that.element.css("position", '').css("zIndex", '').width('').height('').css("left",'').css("top",'');
                            reindex();
                        }
                        else{ //otherwise insert after cell
                            var allCells = document.getElementsByClassName("cell");
                            for(var c = 0; c < allCells.length; c++){
                                var cell = allCells[c];
                                var cellRect = cell.getBoundingClientRect();
                                if(thisSpatial.left > cellRect.left && //if collision
                                    thisSpatial.top > cellRect.top &&
                                    thisSpatial.left < (cellRect.left + cellRect.width) &&
                                    thisSpatial.top < cellRect.bottom)
                                {
                                    var cellElements = Jupyter.notebook.get_cells();
                                    var newCol = cellElements[c].metadata.column;
                                    var currCell = that.element.detach();
                                    $(cell).after(currCell);
                                    delete that.metadata.spatial;
                                    that.metadata.column = newCol;
                                    that.element.css("position", '').css("zIndex", '').width('').height('').css("left",'').css("top",'');
                                    reindex();
                                }
                            }

                        }
                    }
                    
                }

                if(that.metadata.spatial){
                    delete that.metadata.column;
                }
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

        //ids column for metadata label
        var ncells = Jupyter.notebook.ncells();
        that.metadata.index = ncells + 1;
        var colCounts = countCellsinColumns();
        var numPrevCells = 0;
        var currCol = 0;
        while(numPrevCells < that.metadata.index){
            currCol++;
            numPrevCells+=colCounts[currCol];
        }
        that.metadata.column = currCol;
        
        if(Jupyter.notebook.ncells() == 0){
            var column = document.getElementById("column1");
            $(column).append(that.element);
        }

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
        //restores position if not in column
        if(data.metadata.spatial) {
        	this.element.css("position", 'absolute').width(800-45);  // pull out of notebook
			this.element.css("zIndex", data.metadata.spatial.zIndex);
			if(!CodeCell.zIndexCount || CodeCell.zIndexCount < data.metadata.spatial.zIndex)
				CodeCell.zIndexCount = data.metadata.spatial.zIndex;
        	this.element.offset(data.metadata.spatial);  // set absolute position
        }
        
        //restores position if in column
        var cells = Jupyter.notebook.get_cells();
        for(var i=0;i<cells.length;i++){
            var cell = cells[i];
            var col = cell.metadata.column;
            var columns = document.getElementsByClassName("column");
            $(columns[col - 1]).append(cell.element);

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

        if (first === 0 || first == Jupyter.notebook.ncells()){
            return;
        }

        var tomove = this.get_cell_element(last);
        var pivot = this.get_cell_element(first - 1);

        // var cellCol = this.get_cell(selected).metadata.column;
        // var cellIndex = this.get_cell(selected).metadata.index + 1;
        // var colCounts = countCellsinColumns();

        // var numPrevCells = 0;
        // for(var i=0;i<cellCol-1;i++){
        //     numPrevCells+=colCounts[i]; //num cells in previous columns
        // }

        // if(cellIndex != (numPrevCells + 1)){ //if cell is not at top of column
        //     tomove.detach();
        //     pivot.before(tomove);
        // }

        tomove.detach();
        pivot.before(tomove);
        
        // this.get_cell(selected-1).focus_cell();
        // this.select(anchored - 1);
        // this.select(selected - 1, false);
        
        reindex();

    };

    Notebook.prototype.move_selection_down = function(){
        var indices = this.get_selected_cells_indices();
        var first = indices[0];
        var last = indices[indices.length - 1];

        var selected = this.get_selected_index();
        var anchored = this.get_anchor_index();

        if(!this.is_valid_cell_index(last + 1)){
            return;
        }
        if(last == Jupyter.notebook.ncells){ //if at bottom of nb
            return;
        }

        var tomove = this.get_cell_element(first);
        var pivot = this.get_cell_element(last + 1);

        tomove.detach();
        pivot.after(tomove);

        //this.get_cell(selected+1).focus_cell();
        // this.select(first);
        // this.select(anchored + 1);
        // this.select(selected + 1, false);

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

            // var prevCell = Jupyter.notebook.get_cell_element(index-2);
            // console.log(prevCell);
            // console.log(cell.metadata.column);

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

    Notebook.prototype._insert_element_at_index = function(element, index){
        if (element === undefined){
            return false;
        }

        var ncells = this.ncells();

        if (ncells === 0) {
            // special case append if empty
            this.container.append(element);
        } else if ( ncells === index ) {
            // special case append it the end, but not empty
            this.get_cell_element(index-1).after(element);
        } else if (this.is_valid_cell_index(index)) {
            // otherwise always somewhere to append to
            this.get_cell_element(index-1).after(element);
        } else {
            return false;
        }
        
        this.undelete_backup_stack.map(function (undelete_backup) {
            if (index < undelete_backup.index) {
                undelete_backup.index += 1;
            }
        });
        this.set_dirty(true);
        return true;
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

        reindex();
        console.log(Jupyter.notebook.ncells());

        return this;
    };

    function reindex(){
        var cells = Jupyter.notebook.get_cells();
		var ncells = Jupyter.notebook.ncells();
		for (var i=0; i<ncells; i++){
			var cell = cells[i];
            var index = Jupyter.notebook.find_cell_index(cell);
            cell.metadata.index = index + 1; //indexing starts at 1

            
            var box = document.getElementsByClassName("repos")[i]; 
            $(box)[0].innerHTML = "";
            $(box).append(index + 1);
		 }
    }

    function countCellsinColumns(){
        var colCounts = [];
        var cells = Jupyter.notebook.get_cells();
        var ncells = Jupyter.notebook.ncells();
        for (var i=0; i<nCols; i++){
            colCounts[i] = 0;
        }
        for (var j=0; j<ncells; j++){
			var cell = cells[j];
            colCounts[cell.metadata.column - 1]++;
        }
        return colCounts;
    }

    function update_styling() {
        nCols = Jupyter.notebook.metadata.columns;

        var newColumnWidth = 100/nCols - 2;
        var newNbContainerWidth = 500*nCols + 50;

        document.getElementById('notebook-container').style.width = newNbContainerWidth.toString() + "px"; //resizing nb container
        document.getElementById('notebook').style.overflowX = "visible";
        document.getElementById('notebook').style.overflowY = "visible";
        document.getElementById('notebook-container').style.height = 'inherit';
        document.getElementById('notebook-container').style.marginLeft = '20px';  // left justify notebook in browser
        document.getElementById('notebook-container').style.backgroundColor = "transparent";
        document.getElementById('notebook-container').style.boxShadow = null;
       

        for(var c = 0; c < nCols; c++){
            var newCol = document.createElement('div');   
            newCol.classList.add("column");
            newCol.id = "column" + (c+1).toString();
            newCol.style.width = newColumnWidth.toString() + "%";
            newCol.style.float = 'left';
            newCol.style.margin = "10px";
            newCol.style.height = "inherit";
            newCol.style.minHeight = "30px";
            newCol.style.backgroundColor = "white";
            document.getElementById('notebook-container').appendChild(newCol);
        }

    }

    function add_column(){
        var numColumns = document.getElementsByClassName("column").length;
        numColumns++;

        var newColumnWidth = 100/numColumns - 2;
        var newNbContainerWidth = 500*numColumns + 50;
        document.getElementById('notebook-container').style.width = newNbContainerWidth.toString() + "px"; //resizing nb container
        
        //restyling existing columns
        var columns = document.getElementsByClassName("column"); 
        for(var c = 0; c < columns.length; c++){
            columns[c].style.float = 'left';
            columns[c].style.margin = "10px";
            columns[c].style.width =  newColumnWidth.toString() + "%"
        }

        //adding new column
        var newCol = document.createElement('div');   
        newCol.classList.add("column");
        newCol.id = "column" + numColumns.toString();
        newCol.style.width = newColumnWidth.toString() + "%";
        newCol.style.float = 'left';
        newCol.style.margin = "10px";
        newCol.style.height = "inherit";
        newCol.style.minHeight = "30px";
        newCol.style.backgroundColor = "white";
        document.getElementById('notebook-container').appendChild(newCol);

        nCols++;
        Jupyter.notebook.metadata.columns = nCols;

    }

    function delete_column(){
        var columns = document.getElementsByClassName("column"); 
        var lastColumn = columns[nCols-1];

        //placing cells in last column to second to last column
        var lastColNumCells = lastColumn.getElementsByClassName("cell").length; 
        if(lastColNumCells > 0){
            var cells = Jupyter.notebook.get_cells().slice(-lastColNumCells);
            console.log(cells);
            cells.forEach(cell =>
                $(columns[nCols-2]).append(cell.element)
            )
            cells.forEach(cell =>
                cell.metadata.column = nCols-1
            )
            
        }
        
        lastColumn.remove();
        nCols--;

        var newColumnWidth = 100/nCols - 2;
        var newNbContainerWidth = 500*nCols + 50;
        document.getElementById('notebook-container').style.width = newNbContainerWidth.toString() + "px"; //resizing nb container

        //restyling existing columns
        var columns = document.getElementsByClassName("column"); 
        for(var c = 0; c < columns.length; c++){
            columns[c].style.float = 'left';
            columns[c].style.margin = "10px";
            columns[c].style.width =  newColumnWidth.toString() + "%"
        }

        Jupyter.notebook.metadata.columns = nCols;


    }

    function initialize () {       
        //set intial run indexes
		var cells = Jupyter.notebook.get_cells();
		var ncells = Jupyter.notebook.ncells();

		for (var i=0; i<ncells; i++){
            var cell = cells[i];
            var index = Jupyter.notebook.find_cell_index(cell);
            cell.metadata.index = index;
           
            var box = document.getElementsByClassName("repos")[i]; 
            if(typeof box !== 'undefined'){
                $(box)[0].innerHTML = "";
                $(box).append(index + 1);
            }
            
		}

        //draw columns
        var newNotebook = false;
        if(!Jupyter.notebook.metadata.columns || Jupyter.notebook.metadata.columns === null){
            newNotebook = true;
            Jupyter.notebook.metadata.columns = 1;
        }
        nCols = Jupyter.notebook.metadata.columns;
        update_styling();

	}

    function load_ipython_extension() {
        $(IPython.toolbar.add_buttons_group([
            IPython.keyboard_manager.actions.register({
                'help'   : 'Add Column',
                'icon'    : 'fa-columns',
                'handler': function() {
                    add_column();
                },
            }, 'add-column', 'column'),
            IPython.keyboard_manager.actions.register({
                'help'   : 'Delete Column',
                'icon'    : 'fa-times',
                'handler': function() {
                    delete_column();
                },
            }, 'delete-column', 'column'),
        ], 'add-column-btn-grp')).find('.btn').attr('id', 'add-column-btn');
        $("#maintoolbar-container").append($('#add-column-btn-grp'));

        Jupyter.notebook.restore_checkpoint('checkpoint') 
        return Jupyter.notebook.config.loaded.then(initialize);

    }

    return {
        load_ipython_extension: load_ipython_extension
    };
});


