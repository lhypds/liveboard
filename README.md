
Liveboard
=========


Liveboard is a web application to display anything on a screen, with data updates.  


Screenshot
----------

<img width="2262" height="1370" alt="0bbf9906-399b-4de3-b6be-1e30f48012f7" src="https://github.com/user-attachments/assets/584c30c7-0490-4f44-a798-376e16b1b2f5" />


Setup & Run
-----------

Run  
`./setup.sh`  
If the `modules` folder doesn't exist, it will pull the [liveboard-mod](https://github.com/lhypds/liveboard-mod) repository.

Fillup the `.env` file.  
Mapbox token, etc.  

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
