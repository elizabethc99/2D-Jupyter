2D Jupyter
==============

This extension allows for arrangement of Jupyter cells in 2D. 


Installation
-----
Follow the instructions at the link below to install Jupyter extensions:
https://jupyter-contrib-nbextensions.readthedocs.io/en/latest/install.html

Download the 2D-Jupyter extension files (both the .js and .yaml files are needed) and place them in a folder inside
src/jupyter_contrib_nbextensions/nbextension. 

Enable the extension with the command 
```jupyter nbextension enable 2D-Jupyter/2D-Jupyter```
or go to the nbextension tab in the Jupyter file tree and enable it via the checkbox. 

Usage
-----
Use the grey box on the left side of each cell to drag it around the page. Double click on the grey box to place it back in the group. 

The numbers in the grey box indicate the run order of the cells when "run all cells" is used. 

If the grey boxes don't appear on load, refresh the page. 

