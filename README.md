2D Jupyter
==============

This extension allows for arrangement of Jupyter cells in 2D, including arrangement in columns.  


Installation
-----
Follow the instructions at the link below to install Jupyter extensions:
https://jupyter-contrib-nbextensions.readthedocs.io/en/latest/install.html
or if you are using an Anaconda installation: 
https://docs.anaconda.com/anaconda/user-guide/tasks/use-jupyter-notebook-extensions/#obtaining-the-extensions

Download the 2D-Jupyter extension files and place them in a folder inside
src/jupyter_contrib_nbextensions/nbextension. 

Enable the extension with the command 
```jupyter nbextension enable 2D-Jupyter/2D-Jupyter```
or go to the nbextension tab in the Jupyter file tree and enable it via the checkbox. 

Usage
-----
Use the grey box on the left side of each cell to drag it around the page. Dragging a cell over an empty column will attach it to that column. Dragging it over another cell inside a column will place it after that cell. The numbers in the grey box indicate the run order of the cells when "run all cells" is used. Dragging a cell outside of the column area will take it out of the run order and it will not be run automatically. 

Use the plus and minus buttons on the notebook toolbar to add and delete columns. Deleting a column will delete all of the cells in that column. 

Use the plus button on the column header toolbars to add cell to the end of that column. The right and left arrows will shift the column right and left respectively. 

The extension currently is experiencing bugs on the first notebook opened when starting a Jupyter session - reload the page to fix. 

