
liveboard
=========


liveboard is a web application to display anything on a screen, with data updates.  


Screenshot
----------

Sample module: Tokyo Heat Map  

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


Modules
-------

In `src/modules` it will load module components.  
Repo named `liveboard-mod-*` will be loaded as `*` module.  
