# Just Track Time

A simple time tracker for obsdian that stores data with SQLite 

After using [TimeTagger](https://timetagger.app/) for a while, i wanted to track my time in just one app, so i created this plugin.

The usage of the plugin is simple: Install it, Open the clock ribbon icon, Type a description of the task and click Start.

After finishing the task you can press End.

If you just finished a task and need to start another one, just type the description of the new task and press Start, the plugin will end the current task and start the new one.

All trackings are stored in a SQLite file database, located at the plugin's folder.

## Libraries
- [React](https://react.dev/)
- [SQL.js](https://sql.js.org/)
