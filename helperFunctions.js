function reindex(){
    var cells = Jupyter.notebook.get_cells();
    var ncells = Jupyter.notebook.ncells();
    for (var i=0; i<ncells; i++){
        var cell = cells[i];
        
        var index = Jupyter.notebook.find_cell_index(cell);
        cell.metadata.index = index + 1; //indexing starts at 1

        if(cell.metadata.column){
            var box = document.getElementsByClassName("repos")[i]; 
            $(box)[0].innerHTML = "";
            $(box).append(cell.metadata.index);
        }
     }
}

function createColumnToolbar(column){
    var toolbar = document.createElement('div');
    toolbar.style.backgroundColor = "white";
    toolbar.classList.add("col-toolbar");
    //toolbar.classList.add("deselected");
    toolbar.id = "columnToolbar" + column;

    
    var cell_options = {
        events: Jupyter.notebook.events, 
        config: Jupyter.notebook.config, 
        keyboard_manager: Jupyter.notebook.keyboard_manager, 
        notebook: Jupyter.notebook,
        tooltip: Jupyter.notebook.tooltip
    };

    var buttons = document.createElement('div');
    buttons.style.width = '100%';
    buttons.style.height = '35px';
    buttons.style.border = "1.5px solid black";

    var resize = document.createElement("div");
    resize.classList.add("resizeMe");
    resize.id = "resizeCol" + column;
    resize.style.width = "20px";
    resize.style.height = "33px"; 
    resize.style.float = "right";
    resize.style.backgroundColor = "lightgrey";
    resize.style.cursor =  'col-resize';
    //resize.onclick = "resize()";
    resize.addEventListener("mousedown", resizeColumns);


    //resize.addEventListener("mousedown", resize());
    
    buttons.append(resize);


    var addCell = document.createElement('button');
    addCell.classList.add("btn");
    addCell.classList.add("btn-default");
    addCell.style.float = "left";
    addCell.innerHTML = '<i class = "fa fa-plus"></i>';
    addCell.onclick = function(){
        if(column == 0){ //if first column
            Jupyter.notebook.insert_cell_at_index('code', 0);
        }
        else{ 
            var columns = document.getElementsByClassName("column");
            var colIndex = $(this).parents()[2].id;
            colIndex = colIndex.replace('column', '');
            var currCol = columns[colIndex - 1];
            var cellsInCol = currCol.getElementsByClassName("cell");
            if(cellsInCol.length == 0){ //if column is empty
                var newCodeCell = new codecell.CodeCell(Jupyter.notebook.kernel, cell_options);
                newCodeCell.set_input_prompt();
                newCodeCell.metadata.column = column;
                currCol = columns[colIndex - 1];
                $(currCol).append(newCodeCell.element);
                
            }
            else{
                var lastCell = cellsInCol[cellsInCol.length - 1];
                var lastIndex = lastCell.getElementsByClassName("repos")[0].innerHTML;
                Jupyter.notebook.insert_cell_at_index('code', lastIndex);
            }
        }
        
    };
    buttons.append(addCell);

    var moveColRight = document.createElement('button');
    moveColRight.classList.add("btn");
    moveColRight.classList.add("btn-default");
    moveColRight.style.float = "right";
    moveColRight.innerHTML = '<i class = "fa fa-arrow-right"></i>';
    moveColRight.onclick = function(){
        var colIndex = $(this).parents()[2].id;
        colIndex = colIndex.replace('column', '');
        var columns = document.getElementsByClassName("column");
        if(parseInt(colIndex) < columns.length){
            var currCol = columns[colIndex - 1];
            var nextCol = columns[colIndex];
            $(currCol).insertAfter(nextCol);
            var increment = parseInt(colIndex) + 1;
            currCol.id = "column" + increment;
            nextCol.id = "column" + colIndex;
            currCol.querySelector("#click" + colIndex).id = "click" + increment;
            nextCol.querySelector("#click" + increment).id = "click" + colIndex;
            reindex();
        }
    }
    buttons.append(moveColRight);

    var moveColLeft = document.createElement('button');
    moveColLeft.classList.add("btn");
    moveColLeft.classList.add("btn-default");
    moveColLeft.style.float = "right";
    
    moveColLeft.innerHTML = '<i class = "fa fa-arrow-left"></i>';
    moveColLeft.onclick = function(){
        var colIndex = $(this).parents()[2].id;
        colIndex = parseInt(colIndex.replace('column', '')); //this is indexed starting at one //5
        if(colIndex > 1){
            var columns = document.getElementsByClassName("column");
            var currColIndex = colIndex - 1; //subtract 1 to access correct index in columns array //4
            var currCol = columns[currColIndex]; 
            var prevCol = columns[currColIndex - 1];
            $(prevCol).insertAfter(currCol);
            currCol.id = "column" + currColIndex;  
            prevCol.id = "column" + colIndex;
            currCol.querySelector("#click" + colIndex).id = "click" + currColIndex;
            prevCol.querySelector("#click" + currColIndex).id = "click" + colIndex;
            reindex();

        }
    }
    buttons.append(moveColLeft);

    var clickable = document.createElement('div');
    clickable.classList.add("clickable-area")
    clickable.id = "click" + column;
    clickable.style.height = "35px";
    clickable.addEventListener("click", selectColumn);
    buttons.append(clickable);

    
    toolbar.append(buttons);


    return toolbar;
}

function resizeColumns(e, colWidths){
    var ele = this;
    var colIndex = ele.id.replace('resizeCol', '');
    var column = document.getElementById("column" + colIndex);

    var numColumns = document.getElementsByClassName("column").length;

    let x, w = 0;
    
    x = e.clientX;

    const styles = window.getComputedStyle(column);
    w = parseInt(styles.width, 10);

   

    const mouseMoveHandler = function (e) {
        const dx = e.clientX - x;
        if((w + dx) >= 135){
            column.style.width = `${w + dx}px`;
            colWidths[colIndex - 1] =  `${w + dx}px`;
        }
        
        var docWidth = document.getElementById('notebook-container').style.width;
        docWidth = parseInt(docWidth.replace('px', ''));
        docWidth += dx;
        if(docWidth >= numColumns * 600){
            document.getElementById('notebook-container').style.width = `${docWidth}px`;
        }
       
    };

    const mouseUpHandler = function () {
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    };

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);

}

function selectColumn(){
    var ele = this;
    var colIndex = ele.id.replace('click', '');

    var previousSelection = document.querySelector(".column.selected");
    var column = document.getElementById("column" + colIndex);

    if(previousSelection != null && previousSelection != column){
        var previousSelection = document.querySelector(".column.selected"); 
        previousSelection.style.border = "";
        previousSelection.classList.remove('selected');
    }

    column.classList.toggle("selected");
    if(column.classList.contains("selected")){
        column.style.border = "5px solid green";
    }
    else{
        column.style.border = "";
    }

}
