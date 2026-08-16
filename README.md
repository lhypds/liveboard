
liveboard
=========


liveboard is a web application to display anything on a screen, with data updates.  


Screenshot
----------

<img width="1080" height="779" alt="image" src="https://github.com/user-attachments/assets/e140eb80-c2f0-405e-942a-a07af5475562" />


Setup & Run
-----------

First, fillup the `board.config.json` file.  
`componentsGitUrl` is the URL of the git repository that contains the modules.  

Run  
`./setup.sh`  

`setup.sh` pulls the modules, then runs every `src/modules/*/setup.sh`,  
and each module's `setup.sh` runs every one of its components' `setup.sh`.  
A failing component or module setup is reported but does not stop the build.  
Frontend credentials used by only one component are kept in that component's
`.env`; Vite loads `VITE_` variables from direct component directories when it
builds the board.

Then, run  
`npm run dev`  
to start.  

To start with PM2  
Setup and use `start.sh` or `restart.sh`.  


Quick Tips
----------

Free drag  
Drag a card by its header. Cards float up to fill the space above them.  
Hold Command (Ctrl on a keyboard without one) while dragging to put a card down  
anywhere: it stays where it is dropped, and stays there when other cards move,  
when the card above it is deleted, and through a reload.  
Drag it again without Command to let it float with the rest.  

Address drag  
Drag a marker icon from the address bar (like in Trip) to Clock 
or Weather to set the location.  


Modules
-------

In `src/modules` it will load module components.  
Repo named `liveboard-mod-*` will be loaded as `*` module.  
