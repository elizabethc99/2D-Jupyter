//note run order on cell

//on notebook load - loading cells from JSON
for (i=0; i<ncells; i++) {
    cell_data = new_cells[i];
    new_cell = this.insert_cell_at_index(cell_data.cell_type, i); //calls CodeCell constructor
    new_cell.fromJSON(cell_data);
    if (new_cell.cell_type === 'code' && !new_cell.output_area.trusted) {
        trusted = false;
    }
}

//cell fromJSON
Cell.prototype.fromJSON = function (data) {
  if (data.metadata !== undefined) {
      this.metadata = data.metadata;
  }
  if (data.id !== undefined) {
      this.id = data.id;
  }
};

//codecell fromJSON
CodeCell.prototype.fromJSON = function (data) {
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
};

//notebook insert cell
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