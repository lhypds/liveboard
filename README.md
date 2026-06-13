
Liveboard
=========


Liveboard is a web application to display anything on a screen, with data updates.  


Screenshot
----------

Sample module: Tokyo Heat Map  

<img width="2262" height="1370" alt="0bbf9906-399b-4de3-b6be-1e30f48012f7" src="https://github.com/user-attachments/assets/584c30c7-0490-4f44-a798-376e16b1b2f5" />


Setup & Run
-----------

First, fillup the `.env` file.  

`.env`  
`COMPONENTS_GIT_URL` is the git url of the liveboard modules.  
If not set and components folder not exist, it will pull the [liveboard-mod](https://github.com/lhypds/liveboard-mod) template repository.

Run  
`./setup.sh`  

Then, run  
`npm run dev`  
to start.  

To start with PM2  
Setup and use `start.sh` or `restart.sh`.  


Modules
-------

In `src/modules` it will load module components.  

Templete  
Clone [liveboard-mod](https://github.com/lhypds/liveboard-mod), rename the folder to `modules` to use.
